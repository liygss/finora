"""
Router upload file (transaksi csv/xlsx, aturan pdf) dan input knowledge teks.

Alur file (STAGED -> commit):
  POST /upload/file          -> simpan isi file ke database, status STAGED
  POST /upload/{id}/commit   -> baca isi file dari database, proses jadi jurnal

Isi file disimpan di kolom `uploaded_files.file_bytes`, BUKAN bergantung pada file
di disk. Di Vercel filesystem proyek read-only dan /tmp tidak bertahan antar
request, jadi file yang ditulis di request upload sudah hilang ketika request
commit arrive di instance berikutnya (terbukti menghasilkan HTTP 500
`FileNotFoundError`). `stored_path` tetap ditulis sebagai best-effort untuk
keebutuhan aplikasi desktop/lokal (Electron) yang tidak serverless.

Endpoint /upload/file hanya menaruh file di database (STAGED) tanpa memproses;
pemrosesan berjalan saat user mengonfirmasi lewat /commit.
"""

import re
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, UploadFile, status
from slowapi import Limiter
from slowapi.util import get_remote_address

from sqlalchemy.orm import Session

from app.config.logging import get_logger
from app.config.settings import resolve_writable_dir, settings
from app.database.database import SessionLocal, get_db
from app.database.models import (
    DocumentChunk,
    JurnalDetail,
    JurnalUmum,
    RoleUser,
    StatusUpload,
    UploadedFile,
    User,
)
from app.middleware.auth import require_active_user, require_admin
from app.schemas.upload_schema import CommitResponse, KnowledgeInput, KnowledgeResponse, UploadedFileResponse
from app.services.ingestion.ingestion_pipeline import (
    ingest_static_markdown,
    process_uploaded_file,
)
from app.services.ingestion.qdrant_service import delete_by_source_file
from app.services.ingestion.validator import validate_upload

router = APIRouter(prefix="/upload", tags=["Upload"])
logger = get_logger(__name__)

# Rate limiter. Instance ini memakai storage sendiri (pola yang sama dengan
# app/routers/authentication.py); app.state.limiter yang dipakai untuk
# exception handler dipasang di app/main.py.
limiter = Limiter(key_func=get_remote_address)

# Batas request. Upload menelan memory + parse + embedding jadi dibuat ketat;
# commit sedikit lebih longgar karena user sah sedang menuntaskan satu file.
UPLOAD_RATE_LIMIT = "5/minute"
COMMIT_RATE_LIMIT = "10/minute"

# Status yang masih boleh diproses ulang lewat /commit. STAGED = belum pernah
# dicoba; FAILED = percobaan sebelumnya gagal dan aman untuk dicoba lagi.
_COMMITTABLE_STATUS = {StatusUpload.STAGED, StatusUpload.FAILED}


def _safe_filename(name: str) -> str:
    """Sanitasi nama file untuk mencegah path traversal."""
    name = name.strip()
    name = re.sub(r"[^\w\-\.]", "_", name)
    name = re.sub(r"\.{2,}", ".", name)
    name = re.sub(r"^\.+", "", name)
    return name[:100] or "untitled"


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "module": "upload"}


def _persist_file_best_effort(content: bytes, filename: str) -> str | None:
    """Tulis file ke disk kalau memungkinkan; kembalikan path atau None.

    Kegagalan menulis TIDAK lagi membatalkan upload: isi file sudah aman di
    `file_bytes`, dan itulah yang dibaca saat commit. Versi lama membalas 507 di
    sini, sehingga di Vercel (filesystem read-only) upload selalu gagal total,
    padahal prosesnya sendiri tidak butuh disk sama sekali.
    """
    try:
        upload_dir = Path(resolve_writable_dir(settings.UPLOAD_DIR, "uploads"))
        upload_dir.mkdir(parents=True, exist_ok=True)
        stored_path = upload_dir / f"{uuid.uuid4()}_{filename}"
        stored_path.write_bytes(content)
        return str(stored_path)
    except OSError as exc:
        logger.warning("Tidak bisa menyimpan file ke disk (diabaikan, isi tetap ada di DB): %s", exc)
        return None


@router.post("/file", response_model=UploadedFileResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(UPLOAD_RATE_LIMIT)
async def upload_file(
    request: Request,
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
) -> UploadedFile:
    content = await file.read()
    validation = validate_upload(file.filename, len(content))
    if not validation.is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=validation.error)

    # Isi file disimpan di database (file_bytes) karena inilah sumber kebenaran
    # saat commit. Penulisan ke disk hanya bonus untuk mode desktop/lokal.
    stored_path = _persist_file_best_effort(content, file.filename)
    if stored_path is None:
        logger.info(
            "File '%s' tidak bisa ditulis ke disk; akan diproses dari database.",
            file.filename,
        )

    uploaded_file = UploadedFile(
        original_filename=file.filename,
        stored_path=stored_path or "",
        file_bytes=content,
        file_type=validation.file_type,
        file_size_bytes=len(content),
        uploaded_by_id=current_user.id,
        status=StatusUpload.STAGED,
    )
    db.add(uploaded_file)
    db.commit()
    db.refresh(uploaded_file)

    logger.info("File '%s' diterima, status STAGED (menunggu konfirmasi user).", file.filename)

    return uploaded_file


@router.get("/", response_model=list[UploadedFileResponse])
def list_uploads(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
) -> list[UploadedFile]:
    return (
        db.query(UploadedFile)
        .filter(UploadedFile.uploaded_by_id == current_user.id)
        .order_by(UploadedFile.created_at.desc())
        .all()
    )


# ---------------------------------------------------------------------------
# Knowledge Base (Admin only) — defined BEFORE /{upload_id} to avoid
# FastAPI treating "knowledge" as a wildcard upload_id.
# ---------------------------------------------------------------------------
def _run_knowledge_ingestion(uploaded_file_id: str, markdown_text: str, category: str) -> None:
    db = SessionLocal()
    try:
        uploaded_file = db.query(UploadedFile).filter(UploadedFile.id == uploaded_file_id).first()
        if not uploaded_file:
            logger.warning("Knowledge ingestion: file id=%s tidak ditemukan", uploaded_file_id)
            return
        ingest_static_markdown(db, uploaded_file, markdown_text, category=category)
        logger.info("Knowledge ingestion selesai untuk '%s'", uploaded_file.original_filename)
    except Exception:
        logger.exception("Knowledge ingestion gagal untuk file id=%s", uploaded_file_id)
    finally:
        db.close()


@router.post("/knowledge", response_model=KnowledgeResponse, status_code=status.HTTP_201_CREATED)
async def add_knowledge(
    payload: KnowledgeInput,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> UploadedFile:
    judul = payload.judul.strip()
    konten = payload.konten.strip()
    if not judul or not konten:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Judul dan konten tidak boleh kosong")

    knowledge_dir = Path(resolve_writable_dir(settings.MARKDOWN_DIR, "markdown")) / "auto"
    knowledge_dir.mkdir(parents=True, exist_ok=True)

    safe_name = _safe_filename(judul)
    file_path = knowledge_dir / f"{safe_name}.md"
    try:
        file_path.write_text(konten, encoding="utf-8")
    except OSError as exc:
        logger.error("Gagal menyimpan file knowledge: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
            detail="Server tidak bisa menyimpan file knowledge (disk penuh/read-only).",
        ) from exc

    uploaded_file = UploadedFile(
        original_filename=f"{judul}.md",
        stored_path=str(file_path),
        file_type="knowledge",
        file_size_bytes=len(konten.encode("utf-8")),
        uploaded_by_id=current_user.id,
    )
    db.add(uploaded_file)
    db.commit()
    db.refresh(uploaded_file)

    background_tasks.add_task(_run_knowledge_ingestion, uploaded_file.id, konten, payload.kategori)
    logger.info("Knowledge '%s' diterima, ingestion dijalankan di background.", judul)

    return uploaded_file


@router.get("/knowledge", response_model=list[KnowledgeResponse])
def list_knowledge(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> list[UploadedFile]:
    files = (
        db.query(UploadedFile)
        .filter(UploadedFile.file_type == "knowledge")
        .order_by(UploadedFile.created_at.desc())
        .all())
    result = []
    for f in files:
        chunk_count = db.query(DocumentChunk).filter(DocumentChunk.source_file_id == f.id).count()
        resp = KnowledgeResponse.model_validate(f)
        resp.chunk_count = chunk_count
        result.append(resp)
    return result


@router.delete("/knowledge/{upload_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_knowledge(
    upload_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> None:
    uploaded_file = (
        db.query(UploadedFile)
        .filter(UploadedFile.id == upload_id, UploadedFile.file_type == "knowledge")
        .first()
    )
    if uploaded_file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge tidak ditemukan")

    try:
        delete_by_source_file(upload_id)
    except Exception as exc:
        logger.warning("Gagal hapus chunks dari Qdrant untuk knowledge '%s': %s", uploaded_file.original_filename, exc)

    try:
        file_path = Path(uploaded_file.stored_path)
        if file_path.exists():
            file_path.unlink()
    except Exception as exc:
        logger.warning("Gagal menghapus file fisik '%s': %s", uploaded_file.stored_path, exc)

    db.query(DocumentChunk).filter(DocumentChunk.source_file_id == uploaded_file.id).delete()
    db.delete(uploaded_file)
    db.commit()


# ---------------------------------------------------------------------------
# File CRUD — dynamic /{upload_id} must come AFTER /knowledge routes
# ---------------------------------------------------------------------------
def _validate_uuid(value: str, name: str = "id") -> None:
    import re
    if not re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', value.lower()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{name} harus berupa UUID yang valid",
        )


@router.delete("/reset", status_code=status.HTTP_204_NO_CONTENT)
def reset_user_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
) -> None:
    """
    Hapus SEMUA data akuntansi milik user: semua file upload + jurnal (termasuk
    jurnal yang tidak terikat ke file upload / sumber_upload_id NULL), supaya
    dashboard kembali kosong.
    Hanya OWNER atau ADMIN yang boleh melakukan reset.
    """
    if current_user.role not in (RoleUser.OWNER, RoleUser.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hanya owner atau admin yang boleh mereset data",
        )

    logger.warning("RESET DATA oleh user %s (role=%s)", current_user.id, current_user.role.value)
    # 1. Semua jurnal milik user (termasuk orphan tanpa sumber_upload_id)
    jurnal_ids = [
        r[0]
        for r in db.query(JurnalUmum.id).filter(JurnalUmum.created_by_id == current_user.id).all()
    ]
    if jurnal_ids:
        db.query(JurnalDetail).filter(JurnalDetail.jurnal_id.in_(jurnal_ids)).delete(synchronize_session=False)
        db.query(JurnalUmum).filter(JurnalUmum.id.in_(jurnal_ids)).delete(synchronize_session=False)
        logger.info("Reset data: %d jurnal dihapus untuk user %s", len(jurnal_ids), current_user.id)

    # 2. Semua file upload milik user + chunks-nya (PDF knowledge, csv, dll)
    files = db.query(UploadedFile).filter(UploadedFile.uploaded_by_id == current_user.id).all()
    if files:
        file_ids = [f.id for f in files]
        for f in files:
            try:
                delete_by_source_file(f.id)
            except Exception as exc:
                logger.warning("Reset data: gagal hapus chunks Qdrant '%s': %s", f.original_filename, exc)
            try:
                path = Path(f.stored_path)
                if path.exists():
                    path.unlink()
            except Exception as exc:
                logger.warning("Reset data: gagal hapus file fisik '%s': %s", f.stored_path, exc)
        db.query(DocumentChunk).filter(DocumentChunk.source_file_id.in_(file_ids)).delete(synchronize_session=False)
        for f in files:
            db.delete(f)
        logger.info("Reset data: %d file upload dihapus untuk user %s", len(files), current_user.id)

    db.commit()


@router.get("/{upload_id}", response_model=UploadedFileResponse)
def get_upload_status(
    upload_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
) -> UploadedFile:
    _validate_uuid(upload_id, "upload_id")
    uploaded_file = (
        db.query(UploadedFile)
        .filter(UploadedFile.id == upload_id, UploadedFile.uploaded_by_id == current_user.id)
        .first()
    )
    if uploaded_file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload tidak ditemukan")
    return uploaded_file


@router.delete("/{upload_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_upload(
    upload_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
) -> None:
    _validate_uuid(upload_id, "upload_id")
    uploaded_file = (
        db.query(UploadedFile)
        .filter(UploadedFile.id == upload_id, UploadedFile.uploaded_by_id == current_user.id)
        .first()
    )
    if uploaded_file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload tidak ditemukan")

    try:
        delete_by_source_file(upload_id)
    except Exception as exc:
        logger.warning("Gagal hapus chunks dari Qdrant untuk '%s': %s", uploaded_file.original_filename, exc)

    try:
        file_path = Path(uploaded_file.stored_path)
        if file_path.exists():
            file_path.unlink()
    except Exception as exc:
        logger.warning("Gagal menghapus file fisik '%s': %s", uploaded_file.stored_path, exc)

    jurnal_ids = [
        r[0]
        for r in db.query(JurnalUmum.id).filter(JurnalUmum.sumber_upload_id == uploaded_file.id).all()
    ]
    if jurnal_ids:
        db.query(JurnalDetail).filter(JurnalDetail.jurnal_id.in_(jurnal_ids)).delete(synchronize_session=False)
        db.query(JurnalUmum).filter(JurnalUmum.id.in_(jurnal_ids)).delete(synchronize_session=False)
        logger.info("Menghapus %d jurnal dari upload '%s'", len(jurnal_ids), uploaded_file.original_filename)

    db.query(DocumentChunk).filter(DocumentChunk.source_file_id == uploaded_file.id).delete()
    db.delete(uploaded_file)
    db.commit()


# ---------------------------------------------------------------------------
# Commit — konfirmasi upload STAGED → jurnal
# ---------------------------------------------------------------------------
@router.post("/{upload_id}/commit", response_model=CommitResponse)
@limiter.limit(COMMIT_RATE_LIMIT)
def commit_upload(
    request: Request,
    upload_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
) -> dict:
    """Konfirmasi upload STAGED → jalankan auto-jurnal → POSTED.

    File berstatus FAILED juga boleh di-commit ulang (retry), karena kegagalan
    sebelumnya sering hanya masalah lingkungan (mis. file hilang di /tmp) yang
    sekarang sudah diperbaiki. Tanpa ini satu kegagalan = file permanen rusak.
    """
    _validate_uuid(upload_id, "upload_id")
    uploaded_file = (
        db.query(UploadedFile)
        .filter(UploadedFile.id == upload_id, UploadedFile.uploaded_by_id == current_user.id)
        .first()
    )
    if uploaded_file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload tidak ditemukan")

    if uploaded_file.status not in _COMMITTABLE_STATUS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File sudah diproses (status: {uploaded_file.status.value}). Hanya file yang belum selesai diproses yang bisa di-commit.",
        )

    if uploaded_file.status == StatusUpload.FAILED:
        # Bersihkan sisa error supaya tidak terbawa kalau retry juga gagal.
        uploaded_file.error_message = None
        logger.info("Retry commit untuk file id=%s (sebelumnya FAILED).", upload_id)

    try:
        uploaded_file = process_uploaded_file(db, uploaded_file)
    except Exception as exc:  # noqa: BLE001
        # Jangan kirim str(exc) ke user: bisa berisi path internal/errno.
        # Pesan yang lebih berguna sudah disimpan di uploaded_file.error_message.
        logger.exception("Commit upload id=%s gagal", upload_id)
        db.refresh(uploaded_file)
        detail = uploaded_file.error_message or "Gagal memproses file. Coba lagi atau periksa format file."
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memproses file: {detail}",
        ) from exc

    jurnal_count = db.query(JurnalUmum).filter(JurnalUmum.sumber_upload_id == uploaded_file.id).count()
    logger.info("Commit upload '%s': %d jurnal dibuat.", uploaded_file.original_filename, jurnal_count)

    return {
        "status": uploaded_file.status.value,
        "journal_count": jurnal_count,
        "upload_id": uploaded_file.id,
    }
