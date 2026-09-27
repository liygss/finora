"""
Orkestrator ingestion pipeline.

Untuk CSV/XLSX transaksi:
    validate -> load -> auto-jurnal (langsung ke DB akuntansi, CEPAT)
    RAG pipeline (chunk/embed/qdrant) DIJALANKAN DI BACKGROUND THREAD
    supaya upload response cepat dan tidak gagal kalau Ollama/Qdrant down.

Untuk PDF aturan/pengetahuan:
    validate -> load -> normalize -> markdown -> chunk -> embed -> qdrant

Status UploadedFile di-update di setiap tahap:
    UPLOADED -> PROCESSING -> POSTED (csv/xlsx) | INGESTED (pdf) | FAILED
"""

import threading
from pathlib import Path

from sqlalchemy.orm import Session

from app.config.logging import get_logger
from app.config.settings import settings
from app.database.database import SessionLocal
from app.database.models import DocumentChunk, StatusUpload, UploadedFile
from app.services.ingestion import qdrant_service
from app.services.ingestion.chunking import chunk_markdown
from app.services.ingestion.csv_to_jurnal import auto_journal_from_dataframe
from app.services.ingestion.embedding import embed_chunks
from app.services.ingestion.file_loader import load_file
from app.services.ingestion.markdown_generator import generate_markdown
from app.services.ingestion.metadata_generator import build_chunk_metadata
from app.services.ingestion.normalizer import normalize_document
from app.services.ingestion.pdf_transactions import extract_transaction_dataframe

logger = get_logger(__name__)


class IngestionError(Exception):
    pass


def _cleanup_failed_file(stored_path: str) -> None:
    """Hapus file fisik dari disk saat ingestion gagal supaya tidak menumpuk."""
    try:
        path = Path(stored_path)
        if path.exists():
            path.unlink()
            logger.info("File gagal dihapus: %s", stored_path)
    except Exception as exc:
        logger.warning("Gagal menghapus file '%s': %s", stored_path, exc)


def _update_status(db: Session, uploaded_file: UploadedFile, status: StatusUpload, error: str | None = None) -> None:
    uploaded_file.status = status
    uploaded_file.error_message = error
    db.add(uploaded_file)
    db.commit()


def _ingest_markdown_text(
    db: Session,
    uploaded_file: UploadedFile,
    markdown_text: str,
    judul: str,
    category_override: str | None = None,
) -> int:
    """
    Pipeline RAG: chunk -> embed -> simpan ke Qdrant + Postgres.
    Mengembalikan jumlah chunk yang berhasil disimpan.
    """
    chunks = chunk_markdown(markdown_text)
    if not chunks:
        raise IngestionError("Tidak ada konten yang bisa diekstrak dari file ini")

    # Dump chunk ke file hanya untuk keperluan debug/inspection. Di serverless
    # (filesystem read-only) ini harus best-effort: kegagalan menulis file tidak
    # boleh menggagalkan ingestion ke Qdrant.
    try:
        chunks_dir = Path(settings.CHUNKS_DIR)
        chunks_dir.mkdir(parents=True, exist_ok=True)
        safe_judul = judul.replace("/", "_")
        for c in chunks:
            (chunks_dir / f"{safe_judul}_chunk_{c.index:03d}.md").write_text(c.content, encoding="utf-8")
    except OSError as exc:
        logger.debug("Tidak bisa menulis dump chunk ke disk (diabaikan): %s", exc)

    vectors = embed_chunks([c.content for c in chunks])

    payloads = []
    for c in chunks:
        meta = build_chunk_metadata(
            source_file_id=uploaded_file.id,
            source_filename=uploaded_file.original_filename,
            chunk_index=c.index,
            category=category_override,
        )
        payloads.append(
            {
                "content": c.content,
                "heading": c.heading,
                "source_file_id": meta.source_file_id,
                "source_filename": meta.source_filename,
                "chunk_index": meta.chunk_index,
                "category": meta.category,
                "uploaded_at": meta.uploaded_at,
            }
        )

    point_ids = qdrant_service.upsert_chunks(vectors, payloads)

    for c, point_id in zip(chunks, point_ids):
        db.add(
            DocumentChunk(
                source_file_id=uploaded_file.id,
                chunk_index=c.index,
                content=c.content,
                qdrant_point_id=point_id,
                token_count=len(c.content.split()),
            )
        )
    db.commit()
    return len(chunks)


def _rag_background(
    uploaded_file_id: str,
    stored_path: str,
    file_type: str,
    judul: str,
) -> None:
    """
    RAG pipeline dijalankan di background thread dengan DB session sendiri.
    normalize + markdown dijalankan di sini juga supaya tidak blocking response.
    """
    db = SessionLocal()
    try:
        uploaded_file = db.query(UploadedFile).filter(UploadedFile.id == uploaded_file_id).first()
        if not uploaded_file:
            logger.warning("RAG background: uploaded_file id=%s tidak ditemukan", uploaded_file_id)
            return
        doc = load_file(stored_path, file_type)
        doc = normalize_document(doc)
        markdown_text = generate_markdown(doc, judul)
        jumlah_chunk = _ingest_markdown_text(db, uploaded_file, markdown_text, judul)
        uploaded_file.status = StatusUpload.INGESTED
        db.add(uploaded_file)
        db.commit()
        logger.info("RAG background selesai untuk '%s': %d chunk tersimpan.", uploaded_file.original_filename, jumlah_chunk)
    except Exception as exc:
        logger.info("RAG background skip (tidak wajib): %s", exc)
    finally:
        db.close()


def process_uploaded_file(db: Session, uploaded_file: UploadedFile) -> UploadedFile:
    """
    Pipeline upload:
    - CSV/XLSX: auto-jurnal dulu (cepat, batch insert), RAG di background thread.
    - PDF berisi data transaksi (baris CSV): auto-jurnal dulu, RAG di background thread.
    - PDF aturan/prosa/scan: RAG pipeline saja.
    """
    try:
        _update_status(db, uploaded_file, StatusUpload.PROCESSING)

        doc = load_file(uploaded_file.stored_path, uploaded_file.file_type)

        judul = Path(uploaded_file.original_filename).stem

        # --- CSV/XLSX: AUTO-JURNAL (prioritas utama, batch insert) ---
        if uploaded_file.file_type in ("csv", "xlsx"):
            raw_df = doc.get_transaction_dataframe()
            if raw_df is not None and not raw_df.empty:
                jumlah_jurnal, warnings = auto_journal_from_dataframe(
                    db=db,
                    dataframe=raw_df,
                    uploaded_file_id=uploaded_file.id,
                    user_id=uploaded_file.uploaded_by_id,
                    filename_stem=judul,
                )
                error_msg = None
                if warnings:
                    shown = warnings[:8]
                    error_msg = "Diproses dengan catatan; " + "; ".join(shown)
                    if len(warnings) > len(shown):
                        error_msg += f" (+{len(warnings) - len(shown)} baris lagi)"
                _update_status(db, uploaded_file, StatusUpload.POSTED, error=error_msg)
                logger.info(
                    "Auto-jurnal selesai untuk '%s': %d jurnal dibuat.",
                    uploaded_file.original_filename,
                    jumlah_jurnal,
                )

                # RAG di background thread (non-blocking, normalize+markdown juga di sini)
                t = threading.Thread(
                    target=_rag_background,
                    args=(uploaded_file.id, uploaded_file.stored_path, uploaded_file.file_type, judul),
                    daemon=True,
                )
                t.start()

                return uploaded_file

            logger.warning("CSV/XLSX '%s' tidak punya kolom transaksi, masuk RAG pipeline.", uploaded_file.original_filename)

        # --- PDF: cek dulu apakah berisi data transaksi ---
        # PDF yang dibuat dari CSV/XLSX transaksi (baris-baris CSV sebagai teks)
        # harus dibuatkan jurnal otomatis sama seperti CSV/XLSX supaya datanya
        # masuk dashboard. PDF aturan/prosa/scan jatuh ke RAG pipeline di bawah.
        if uploaded_file.file_type == "pdf":
            trans_df = extract_transaction_dataframe(doc)
            if trans_df is not None and not trans_df.empty:
                jumlah_jurnal, warnings = auto_journal_from_dataframe(
                    db=db,
                    dataframe=trans_df,
                    uploaded_file_id=uploaded_file.id,
                    user_id=uploaded_file.uploaded_by_id,
                    filename_stem=judul,
                )
                error_msg = None
                if warnings:
                    shown = warnings[:8]
                    error_msg = "Diproses dengan catatan; " + "; ".join(shown)
                    if len(warnings) > len(shown):
                        error_msg += f" (+{len(warnings) - len(shown)} baris lagi)"
                _update_status(db, uploaded_file, StatusUpload.POSTED, error=error_msg)
                logger.info(
                    "Auto-jurnal dari PDF selesai untuk '%s': %d jurnal dibuat.",
                    uploaded_file.original_filename,
                    jumlah_jurnal,
                )

                # RAG di background thread supaya chatbot tetap bisa menjawab
                # pertanyaan dari isi PDF ini (sama seperti jalur CSV/XLSX).
                t = threading.Thread(
                    target=_rag_background,
                    args=(uploaded_file.id, uploaded_file.stored_path, uploaded_file.file_type, judul),
                    daemon=True,
                )
                t.start()

                return uploaded_file

            logger.info("PDF '%s' bukan data transaksi, masuk RAG pipeline.", uploaded_file.original_filename)

        # --- PDF / fallback: RAG pipeline ---
        if uploaded_file.file_type == "pdf" and not "".join(doc.raw_text_pages).strip():
            raise IngestionError(
                "PDF tidak punya teks yang bisa dibaca (kemungkinan hasil scan/foto). "
                "Untuk data transaksi, upload CSV/XLSX atau PDF yang berisi teks."
            )

        doc = normalize_document(doc)
        markdown_text = generate_markdown(doc, judul)

        # Simpan markdown hasil normalisasi (debug/inspection). Best-effort:
        # di serverless filesystem read-only, kegagalan menulis tidak boleh
        # menghentikan ingestion.
        try:
            markdown_dir = Path(settings.MARKDOWN_DIR)
            markdown_dir.mkdir(parents=True, exist_ok=True)
            markdown_path = markdown_dir / f"{judul}.md"
            markdown_path.write_text(markdown_text, encoding="utf-8")
        except OSError as exc:
            logger.debug("Tidak bisa menyimpan markdown ke disk (diabaikan): %s", exc)

        jumlah_chunk = _ingest_markdown_text(db, uploaded_file, markdown_text, judul)
        _update_status(db, uploaded_file, StatusUpload.INGESTED)
        logger.info(
            "Ingestion selesai untuk '%s': %d chunk tersimpan.",
            uploaded_file.original_filename,
            jumlah_chunk,
        )
        return uploaded_file

    except Exception as exc:  # noqa: BLE001
        logger.error("Ingestion gagal untuk '%s': %s", uploaded_file.original_filename, exc)
        _update_status(db, uploaded_file, StatusUpload.FAILED, error=str(exc))
        _cleanup_failed_file(uploaded_file.stored_path)
        raise


def ingest_static_markdown(
    db: Session,
    uploaded_file: UploadedFile,
    markdown_text: str,
    category: str | None = None,
) -> UploadedFile:
    """
    Pipeline pendek untuk file markdown knowledge base (sudah final).
    Langsung chunk -> embed -> simpan.
    """
    try:
        _update_status(db, uploaded_file, StatusUpload.PROCESSING)
        judul = Path(uploaded_file.original_filename).stem
        jumlah_chunk = _ingest_markdown_text(db, uploaded_file, markdown_text, judul, category_override=category)
        _update_status(db, uploaded_file, StatusUpload.INGESTED)
        logger.info("Ingestion knowledge base '%s': %d chunk tersimpan.", uploaded_file.original_filename, jumlah_chunk)
        return uploaded_file
    except Exception as exc:  # noqa: BLE001
        logger.error("Ingestion knowledge base gagal untuk '%s': %s", uploaded_file.original_filename, exc)
        _update_status(db, uploaded_file, StatusUpload.FAILED, error=str(exc))
        _cleanup_failed_file(uploaded_file.stored_path)
        raise
