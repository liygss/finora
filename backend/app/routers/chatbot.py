"""Router chatbot: tanya jawab akuntansi & pajak berbasis RAG + Ollama."""

import asyncio
import json
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.accounting.jurnal_umum import JurnalDetailInputDTO, JurnalError
from app.accounting.jurnal_umum import buat_jurnal as service_buat_jurnal
from app.config.logging import get_logger
from app.config.settings import settings
from app.database.database import (
    check_db_connection,
    check_qdrant_connection,
    get_db,
    get_database_size_mb,
)
from app.database.models import Akun, User
from app.llm.embedding_service import is_embedding_ready
from app.llm.ollama_service import OllamaError, chat_completion
from app.middleware.auth import require_active_user
from app.rag.rag_pipeline import ask
from app.schemas.chatbot_schema import (
    ChatRequest,
    ChatResponse,
    CreateDatasetRequest,
    CreateDatasetResponse,
    DatasetItem,
    FollowUpSuggestion,
    JournalCreated,
    ParseDatasetRequest,
    ParseDatasetResponse,
    RetrievedSource,
    UpdateTransactionRequest,
    UploadResultResponse,
)
from app.services.data_context_service import get_financial_context, get_upload_analysis_context

router = APIRouter(prefix="/chatbot", tags=["Chatbot"])
logger = get_logger(__name__)

CHATBOT_TIMEOUT_SECONDS = 60


@router.get("/health")
def health() -> dict:
    """Health chatbot + status dependensi.

    Sengaja hanya cek koneksi (tidak memanggil LLM/embedding) supaya tetap cepat.
    Kolom `degraded` membantu cari tahu kenapa RAG tidak mengembalikan sumber:
    di serverless kita tidak bisa membaca log runtime.
    """
    db_ok = check_db_connection()
    qdrant_ok = check_qdrant_connection()
    embedding_ready = is_embedding_ready()

    degraded = []
    if not db_ok:
        degraded.append("database")
    if not qdrant_ok:
        degraded.append("qdrant")
    if not embedding_ready:
        # Embedding belum warm != error: di serverless model bisa saja sedang
        # diunduh di background, RAG akan aktif di request berikutnya.
        degraded.append("embedding_belum_warm")

    # Peringatan dini kuota storage. Saat kuota habis, provider men-suspend
    # project sehingga seluruh aplikasi mati (registrasi, upload, dashboard)
    # dan tidak bisa diperbaiki dari sisi aplikasi — hanya dari akun provider.
    db_size_mb = get_database_size_mb() if db_ok else None
    if db_size_mb is not None and db_size_mb >= settings.DB_SIZE_WARN_MB:
        degraded.append(f"penyimpanan_database_mendekati_kuota({db_size_mb}MB)")

    return {
        "status": "ok" if db_ok else "degraded",
        "module": "chatbot",
        "rag": {
            "database": db_ok,
            "qdrant": qdrant_ok,
            "embedding_ready": embedding_ready,
            "embedding_provider": settings.EMBEDDING_PROVIDER,
            "embedding_model": (
                settings.QDRANT_INFERENCE_MODEL
                if settings.EMBEDDING_PROVIDER.lower() == "qdrant"
                else settings.EMBEDDING_MODEL
            ),
        },
        "database_size_mb": db_size_mb,
        "degraded": degraded,
    }


@router.post("/ask", response_model=ChatResponse)
async def ask_chatbot(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
) -> ChatResponse:
    try:
        # Hitung financial context sekali saja (termasuk upload_id jika ada)
        financial_context = get_financial_context(
            db, current_user.id, payload.message, upload_id=payload.upload_id,
        )
        has_financial_data = financial_context is not None

        # Jalankan RAG pipeline dengan timeout
        hasil = await asyncio.wait_for(
            asyncio.to_thread(
                ask,
                db,
                current_user.id,
                payload.session_id,
                payload.message,
                financial_context,
                payload.page,
            ),
            timeout=CHATBOT_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Chatbot terlalu lama merespons. Silakan coba lagi nanti.",
        )
    except OllamaError as exc:
        detail_msg = str(exc)
        if "prompt is too long" in detail_msg.lower() or "context length" in detail_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=(
                    "Data terlalu besar untuk diproses LLM dalam satu permintaan. "
                    "Coba pertanyaan yang lebih spesifik, atau gunakan data yang lebih kecil."
                ),
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Layanan LLM (Ollama) sedang tidak bisa diakses. Pastikan server "
                f"Ollama berjalan. Detail: {exc}"
            ),
        ) from exc

    return ChatResponse(
        session_id=hasil.session_id,
        answer=hasil.answer,
        sources=[
            RetrievedSource(
                chunk_id=s.qdrant_point_id,
                content_snippet=s.content[:200],
                score=s.score,
                source_filename=s.source_filename,
            )
            for s in hasil.sources
        ],
        has_financial_data=has_financial_data,
    )


# ---------------------------------------------------------------------------
# Chat-to-Journal: parse transaksi dari pesan natural language
# ---------------------------------------------------------------------------
class ParseTransactionRequest(BaseModel):
    message: str


class ParsedJournalLine(BaseModel):
    kode_akun: str
    nama_akun: str
    debit: float = 0
    kredit: float = 0
    keterangan: str | None = None


class ParseTransactionResponse(BaseModel):
    deskripsi: str
    tanggal: str
    detail: list[ParsedJournalLine]
    raw_response: str | None = None


class CreateJournalRequest(BaseModel):
    deskripsi: str
    tanggal: str
    detail: list[dict]


def _build_account_list_text(db: Session) -> str:
    """Build a simple text list of all active accounts for LLM context."""
    akun_list = db.query(Akun).filter(Akun.is_active.is_(True)).order_by(Akun.kode_akun).all()
    lines = []
    for a in akun_list:
        lines.append(f"{a.kode_akun} | {a.nama_akun} | {a.kategori.value} | {a.saldo_normal.value}")
    return "\n".join(lines)


PARSE_TRANSACTION_PROMPT = """\
Kamu adalah asisten pencatatan transaksi Finora. Tugas kamu: menerima deskripsi transaksi dari user lalu mengubahnya menjadi jurnal akuntansi (SAK EMKM).

Aturan:
1. Analisis deskripsi transaksi yang diberikan user.
2. Tentukan akun yang tepat dari daftar akun yang tersedia.
3. Pastikan jurnal BALANCE (total debit = total kredit).
4. Gunakan format tanggal YYYY-MM-DD (default hari ini jika tidak disebutkan).
5. Return HANYA JSON valid tanpa teks lain, dengan format:
{
  "deskripsi": "ringkasan transaksi",
  "tanggal": "YYYY-MM-DD",
  "detail": [
    {"kode_akun": "X-XXXX", "nama_akun": "Nama Akun", "debit": 0, "kredit": 0, "keterangan": "opsional"},
    ...
  ]
}

Contoh input: "Jual tunai barang dagang Rp 500.000"
Contoh output:
{
  "deskripsi": "Penjualan tunai barang dagang",
  "tanggal": "2025-01-15",
  "detail": [
    {"kode_akun": "1-1000", "nama_akun": "Kas", "debit": 500000, "kredit": 0, "keterangan": "Pelanggan"},
    {"kode_akun": "4-1000", "nama_akun": "Pendapatan Penjualan", "debit": 0, "kredit": 500000, "keterangan": "Penjualan tunai"}
  ]
}

Contoh input: "Bayar listrik Rp 200.000"
Contoh output:
{
  "deskripsi": "Pembayaran listrik bulanan",
  "tanggal": "2025-01-15",
  "detail": [
    {"kode_akun": "5-2200", "nama_akun": "Beban Listrik, Air, dan Telepon", "debit": 200000, "kredit": 0},
    {"kode_akun": "1-1000", "nama_akun": "Kas", "debit": 0, "kredit": 200000}
  ]
}

Contoh input: "Beli perlengkapan kantor Rp 150.000 cash"
Contoh output:
{
  "deskripsi": "Pembelian perlengkapan kantor",
  "tanggal": "2025-01-15",
  "detail": [
    {"kode_akun": "1-1400", "nama_akun": "Perlengkapan", "debit": 150000, "kredit": 0},
    {"kode_akun": "1-1000", "nama_akun": "Kas", "debit": 0, "kredit": 150000}
  ]
}

Jika transaksi tidak jelas atau tidak cukup informasi, return JSON dengan "detail" kosong dan "deskripsi" berisi penjelasan apa yang kurang.

DAFTAR AKUN YANG TERSEDIA:
{accounts}
"""


@router.post("/parse-transaction", response_model=ParseTransactionResponse)
async def parse_transaction(
    payload: ParseTransactionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
) -> ParseTransactionResponse:
    account_list_text = _build_account_list_text(db)
    system_prompt = PARSE_TRANSACTION_PROMPT.replace("{accounts}", account_list_text)

    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(
                chat_completion,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": payload.message},
                ],
                temperature=0.1,
            ),
            timeout=CHATBOT_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="LLM terlalu lama merespons. Coba lagi.",
        )
    except OllamaError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Layanan LLM tidak tersedia: {exc}",
        ) from exc

    # Parse JSON from LLM response
    try:
        # Strip markdown code fences if present
        clean = result.strip()
        if clean.startswith("```"):
            lines = clean.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            clean = "\n".join(lines)
        parsed = json.loads(clean)
    except json.JSONDecodeError:
        logger.warning("Failed to parse LLM output as JSON: %s", result[:200])
        return ParseTransactionResponse(
            deskripsi="",
            tanggal=date.today().isoformat(),
            detail=[],
            raw_response=result,
        )

    # Validate account codes exist
    valid_codes = {a.kode_akun for a in db.query(Akun.kode_akun).filter(Akun.is_active.is_(True)).all()}
    detail = []
    for line in parsed.get("detail", []):
        kode = line.get("kode_akun", "")
        if kode not in valid_codes:
            continue
        detail.append(ParsedJournalLine(
            kode_akun=kode,
            nama_akun=line.get("nama_akun", ""),
            debit=float(line.get("debit", 0)),
            kredit=float(line.get("kredit", 0)),
            keterangan=line.get("keterangan"),
        ))

    return ParseTransactionResponse(
        deskripsi=parsed.get("deskripsi", ""),
        tanggal=parsed.get("tanggal", date.today().isoformat()),
        detail=detail,
    )


@router.post("/create-journal")
async def create_journal_from_chat(
    payload: CreateJournalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
) -> dict:
    from app.database.models import JurnalUmum

    # Generate no_bukti
    today = date.today()
    count_today = db.query(JurnalUmum).filter(
        JurnalUmum.created_by_id == current_user.id,
        JurnalUmum.tanggal == today,
    ).count()
    no_bukti = f"CHT-{today.strftime('%Y%m%d')}-{count_today + 1:03d}"

    detail_dto = []
    for d in payload.detail:
        detail_dto.append(JurnalDetailInputDTO(
            kode_akun=d["kode_akun"],
            debit=float(d.get("debit", 0)),
            kredit=float(d.get("kredit", 0)),
            keterangan=d.get("keterangan"),
        ))

    try:
        jurnal = service_buat_jurnal(
            db,
            no_bukti=no_bukti,
            tanggal=date.fromisoformat(payload.tanggal),
            deskripsi=payload.deskripsi,
            detail=detail_dto,
            created_by_id=current_user.id,
        )
    except JurnalError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return {
        "status": "ok",
        "message": f"Jurnal {no_bukti} berhasil dibuat",
        "jurnal_id": jurnal.id,
        "no_bukti": no_bukti,
    }


# ---------------------------------------------------------------------------
# Dataset: parse multi-transaksi + batch create
# ---------------------------------------------------------------------------
PARSE_DATASET_PROMPT = """\
Kamu adalah asisten pencatatan transaksi Finora. Tugas kamu: menerima beberapa
deskripsi transaksi dari user lalu mengubahnya menjadi kumpulan jurnal akuntansi
(SAK EMKM).

Aturan:
1. Analisis SETIAP baris/barisan transaksi (dipisahkan oleh newline atau titik koma).
2. Tentukan akun yang tepat dari daftar akun yang tersedia.
3. Pastikan tiap transaksi jurnal BALANCE (total debit = total kredit).
4. Gunakan format tanggal YYYY-MM-DD (default hari ini jika tidak disebutkan).
5. Return HANYA JSON valid tanpa teks lain, dengan format:
{
  "items": [
    {
      "deskripsi": "ringkasan transaksi",
      "tanggal": "YYYY-MM-DD",
      "detail": [
        {"kode_akun": "X-XXXX", "nama_akun": "Nama Akun", "debit": 0, "kredit": 0, "keterangan": "opsional"},
        ...
      ]
    }
  ]
}

Contoh input:
"Beli bahan baku Rp 500.000 tunai ke Supplier X
Bayar listrik bulan Januari Rp 200.000
Jual produk jadi Rp 1.000.000 ke Customer Y"

Contoh output:
{
  "items": [
    {
      "deskripsi": "Pembelian bahan baku tunai",
      "tanggal": "2025-07-15",
      "detail": [
        {"kode_akun": "1-2100", "nama_akun": "Persediaan Barang Dagang", "debit": 500000, "kredit": 0},
        {"kode_akun": "1-1000", "nama_akun": "Kas", "debit": 0, "kredit": 500000}
      ]
    },
    {
      "deskripsi": "Pembayaran listrik bulanan",
      "tanggal": "2025-07-15",
      "detail": [
        {"kode_akun": "5-2200", "nama_akun": "Beban Listrik, Air, dan Telepon", "debit": 200000, "kredit": 0},
        {"kode_akun": "1-1000", "nama_akun": "Kas", "debit": 0, "kredit": 200000}
      ]
    }
  ]
}

Jika ada transaksi yang tidak jelas, skip saja transaksi tersebut (jangan masukkan ke items).

DAFTAR AKUN YANG TERSEDIA:
{accounts}
"""


@router.post("/parse-dataset", response_model=ParseDatasetResponse)
async def parse_dataset(
    payload: ParseDatasetRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
) -> ParseDatasetResponse:
    account_list_text = _build_account_list_text(db)
    system_prompt = PARSE_DATASET_PROMPT.replace("{accounts}", account_list_text)

    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(
                chat_completion,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": payload.message},
                ],
                temperature=0.1,
            ),
            timeout=CHATBOT_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="LLM terlalu lama merespons. Coba lagi.",
        )
    except OllamaError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Layanan LLM tidak tersedia: {exc}",
        ) from exc

    # Parse JSON
    try:
        clean = result.strip()
        if clean.startswith("```"):
            lines = clean.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            clean = "\n".join(lines)
        parsed = json.loads(clean)
    except json.JSONDecodeError:
        logger.warning("parse-dataset: LLM output bukan JSON valid: %s", result[:200])
        return ParseDatasetResponse(items=[], raw_response=result)

    valid_codes = {a.kode_akun for a in db.query(Akun.kode_akun).filter(Akun.is_active.is_(True)).all()}
    items = []
    for item in parsed.get("items", []):
        detail = []
        for line in item.get("detail", []):
            kode = line.get("kode_akun", "")
            if kode not in valid_codes:
                continue
            detail.append({
                "kode_akun": kode,
                "nama_akun": line.get("nama_akun", ""),
                "debit": float(line.get("debit", 0)),
                "kredit": float(line.get("kredit", 0)),
                "keterangan": line.get("keterangan"),
            })
        if detail:
            items.append(DatasetItem(
                deskripsi=item.get("deskripsi", ""),
                tanggal=item.get("tanggal", date.today().isoformat()),
                detail=detail,
            ))

    return ParseDatasetResponse(items=items)


@router.post("/create-dataset", response_model=CreateDatasetResponse)
async def create_dataset(
    payload: CreateDatasetRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
) -> CreateDatasetResponse:
    from app.database.models import JurnalUmum

    today = date.today()
    base_count = db.query(JurnalUmum).filter(
        JurnalUmum.created_by_id == current_user.id,
        JurnalUmum.tanggal == today,
    ).count()

    journals = []
    for idx, item in enumerate(payload.items):
        no_bukti = f"CHT-{today.strftime('%Y%m%d')}-{base_count + idx + 1:03d}"
        detail_dto = []
        for d in item.detail:
            detail_dto.append(JurnalDetailInputDTO(
                kode_akun=d["kode_akun"],
                debit=float(d.get("debit", 0)),
                kredit=float(d.get("kredit", 0)),
                keterangan=d.get("keterangan"),
            ))

        try:
            jurnal = service_buat_jurnal(
                db,
                no_bukti=no_bukti,
                tanggal=date.fromisoformat(item.tanggal),
                deskripsi=item.deskripsi,
                detail=detail_dto,
                created_by_id=current_user.id,
            )
            journals.append(JournalCreated(jurnal_id=jurnal.id, no_bukti=no_bukti))
        except JurnalError as exc:
            logger.warning("create-dataset: gagal simpan jurnal %s: %s", item.deskripsi, exc)
            continue

    return CreateDatasetResponse(
        status="ok",
        total=len(journals),
        journals=journals,
    )


# ---------------------------------------------------------------------------
# Upload result summary (untuk chat) — dengan data detail
# ---------------------------------------------------------------------------
@router.get("/upload/{upload_id}/result", response_model=UploadResultResponse)
async def get_upload_result(
    upload_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
) -> UploadResultResponse:
    from collections import defaultdict
    from app.database.models import DocumentChunk, JurnalDetail, JurnalUmum, UploadedFile

    uploaded_file = (
        db.query(UploadedFile)
        .filter(UploadedFile.id == upload_id, UploadedFile.uploaded_by_id == current_user.id)
        .first()
    )
    if uploaded_file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload tidak ditemukan")

    # Hitung jurnal yang terkait + kumpulkan data detail
    jurnals = (
        db.query(JurnalUmum)
        .filter(JurnalUmum.sumber_upload_id == upload_id)
        .order_by(JurnalUmum.tanggal.asc())
        .all()
    )
    journal_count = len(jurnals)
    total_debit = 0.0
    total_kredit = 0.0
    transactions: list[dict] = []
    akun_breakdown: dict[str, dict] = defaultdict(lambda: {"debit": 0.0, "kredit": 0.0, "count": 0})

    if jurnals:
        j_ids = [j.id for j in jurnals]
        details = db.query(JurnalDetail).filter(JurnalDetail.jurnal_id.in_(j_ids)).all()
        for d in details:
            val_d = float(d.debit or 0)
            val_k = float(d.kredit or 0)
            total_debit += val_d
            total_kredit += val_k
            nama = d.akun.nama_akun if d.akun else "Unknown"
            akun_breakdown[nama]["debit"] += val_d
            akun_breakdown[nama]["kredit"] += val_k
            akun_breakdown[nama]["count"] += 1

        for j in jurnals:
            tx_detail = []
            for d in j.detail:
                tx_detail.append({
                    "akun": d.akun.nama_akun if d.akun else "Unknown",
                    "debit": float(d.debit or 0),
                    "kredit": float(d.kredit or 0),
                })
            transactions.append({
                "no_bukti": j.no_bukti,
                "tanggal": j.tanggal.isoformat() if hasattr(j.tanggal, 'isoformat') else str(j.tanggal),
                "deskripsi": j.deskripsi,
                "detail": tx_detail,
            })

    chunk_count = db.query(DocumentChunk).filter(DocumentChunk.source_file_id == upload_id).count()

    account_breakdown = [
        {"nama_akun": nama, "debit": data["debit"], "kredit": data["kredit"], "count": data["count"]}
        for nama, data in sorted(akun_breakdown.items(), key=lambda x: x[1]["debit"] + x[1]["kredit"], reverse=True)
    ]

    return UploadResultResponse(
        id=uploaded_file.id,
        original_filename=uploaded_file.original_filename,
        file_type=uploaded_file.file_type,
        file_size_bytes=uploaded_file.file_size_bytes,
        status=uploaded_file.status.value if hasattr(uploaded_file.status, 'value') else uploaded_file.status,
        error_message=uploaded_file.error_message,
        journal_count=journal_count,
        chunk_count=chunk_count,
        journal_total_debit=total_debit,
        journal_total_kredit=total_kredit,
        transactions=transactions,
        account_breakdown=account_breakdown,
    )


# ---------------------------------------------------------------------------
# Follow-up suggestions setelah upload
# ---------------------------------------------------------------------------
@router.get("/upload/{upload_id}/follow-ups", response_model=list[FollowUpSuggestion])
async def get_upload_follow_ups(
    upload_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
) -> list[FollowUpSuggestion]:
    """Generate follow-up question suggestions berdasarkan file yang di-upload."""
    from app.database.models import JurnalUmum, UploadedFile

    uploaded_file = (
        db.query(UploadedFile)
        .filter(UploadedFile.id == upload_id, UploadedFile.uploaded_by_id == current_user.id)
        .first()
    )
    if not uploaded_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload tidak ditemukan")

    journal_count = db.query(JurnalUmum).filter(JurnalUmum.sumber_upload_id == upload_id).count()
    filename = uploaded_file.original_filename

    suggestions = [
        FollowUpSuggestion(text=f"Jelaskan isi data dari {filename}", icon="FileText"),
        FollowUpSuggestion(text=f"Berapa total pemasukan dari {filename}?", icon="TrendingUp"),
        FollowUpSuggestion(text=f"Akun mana yang paling banyak transaksinya?", icon="Landmark"),
    ]

    if journal_count > 0:
        suggestions.append(
            FollowUpSuggestion(text="Bagaimana cara meningkatkan penjualan dari data ini?", icon="TrendingUp"),
        )
        suggestions.append(
            FollowUpSuggestion(text="Buatkan ringkasan keuangan dari data ini", icon="Wallet"),
        )
        suggestions.append(
            FollowUpSuggestion(text="Tunjukkan tren penjualan per kategori dalam grafik", icon="TrendingUp"),
        )
        suggestions.append(
            FollowUpSuggestion(text="Akun mana yang paling besar nilainya?", icon="Landmark"),
        )

    return suggestions


# ---------------------------------------------------------------------------
# Update transaksi (edit sebelum konfirmasi)
# ---------------------------------------------------------------------------
UPDATE_TRANSACTION_PROMPT = """\
Kamu adalah asisten pencatatan transaksi Finora. Tugas kamu: memodifikasi jurnal akuntansi yang sudah ada berdasarkan perintah perubahan dari user.

Kamu akan menerima:
1. Data jurnal SAAT INI (dalam format JSON)
2. Perintah perubahan dari user (dalam bahasa sehari-hari)

Aturan:
1. Terapkan perubahan sesuai perintah user. Perubahan bisa berupa:
   - Ubah nominal (debit/kredit) -> update angka yang sesuai
   - Ubah deskripsi -> ganti field deskripsi
   - Ubah tanggal -> ganti field tanggal (format YYYY-MM-DD)
   - Ubah/ganti akun -> ganti kode_akun dan nama_akun
   - Tambah/hapus baris jurnal
2. PASTIKAN jurnal tetap BALANCE (total debit = total kredit) setelah perubahan.
   Jika user hanya mengubah satu sisi (misal debit saja), otomatis sesuaikan sisi lain agar tetap balance.
3. Return HANYA JSON valid tanpa teks lain, dengan format:
{
  "deskripsi": "deskripsi yang sudah diupdate",
  "tanggal": "YYYY-MM-DD",
  "detail": [
    {"kode_akun": "X-XXXX", "nama_akun": "Nama Akun", "debit": 0, "kredit": 0, "keterangan": "opsional"},
    ...
  ]
}

Contoh:
Input saat ini:
{"deskripsi": "Penjualan tunai", "tanggal": "2025-01-15", "detail": [{"kode_akun": "1-1000", "nama_akun": "Kas", "debit": 50000, "kredit": 0}, {"kode_akun": "4-1000", "nama_akun": "Pendapatan Penjualan", "debit": 0, "kredit": 50000}]}

Perintah: "ubah nominal jadi 75000"

Output:
{"deskripsi": "Penjualan tunai", "tanggal": "2025-01-15", "detail": [{"kode_akun": "1-1000", "nama_akun": "Kas", "debit": 75000, "kredit": 0}, {"kode_akun": "4-1000", "nama_akun": "Pendapatan Penjualan", "debit": 0, "kredit": 75000}]}

Contoh 2:
Perintah: "ganti deskripsi jadi Penjualan kopi ke warung Pak Budi"

Output:
{"deskripsi": "Penjualan kopi ke warung Pak Budi", "tanggal": "2025-01-15", "detail": [{"kode_akun": "1-1000", "nama_akun": "Kas", "debit": 75000, "kredit": 0}, {"kode_akun": "4-1000", "nama_akun": "Pendapatan Penjualan", "debit": 0, "kredit": 75000}]}

DAFTAR AKUN YANG TERSEDIA:
{accounts}
"""


@router.post("/update-transaction")
async def update_transaction(
    payload: UpdateTransactionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
) -> dict:
    account_list_text = _build_account_list_text(db)
    system_prompt = UPDATE_TRANSACTION_PROMPT.replace("{accounts}", account_list_text)

    user_content = (
        f"Data jurnal saat ini:\n{json.dumps(payload.current_transaction, ensure_ascii=False, indent=2)}\n\n"
        f"Perintah perubahan: {payload.update_command}"
    )

    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(
                chat_completion,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                temperature=0.1,
            ),
            timeout=CHATBOT_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="LLM terlalu lama merespons. Coba lagi.",
        )
    except OllamaError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Layanan LLM tidak tersedia: {exc}",
        ) from exc

    # Parse JSON from LLM response
    try:
        clean = result.strip()
        if clean.startswith("```"):
            lines = clean.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            clean = "\n".join(lines)
        parsed = json.loads(clean)
    except json.JSONDecodeError:
        logger.warning("update-transaction: LLM output bukan JSON valid: %s", result[:200])
        return payload.current_transaction

    # Validate account codes exist
    valid_codes = {a.kode_akun for a in db.query(Akun.kode_akun).filter(Akun.is_active.is_(True)).all()}
    detail = []
    for line in parsed.get("detail", []):
        kode = line.get("kode_akun", "")
        if kode not in valid_codes:
            continue
        detail.append({
            "kode_akun": kode,
            "nama_akun": line.get("nama_akun", ""),
            "debit": float(line.get("debit", 0)),
            "kredit": float(line.get("kredit", 0)),
            "keterangan": line.get("keterangan"),
        })

    return {
        "deskripsi": parsed.get("deskripsi", payload.current_transaction.get("deskripsi", "")),
        "tanggal": parsed.get("tanggal", payload.current_transaction.get("tanggal", "")),
        "detail": detail,
    }
