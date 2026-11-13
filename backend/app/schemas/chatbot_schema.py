"""Schema untuk endpoint chatbot (RAG)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.database.models import ChatRole


class ChatRequest(BaseModel):
    session_id: str | None = None  # None = mulai sesi baru
    message: str
    page: str | None = None  # label halaman aktif user (untuk jawaban kontekstual)
    upload_id: str | None = None  # ID file upload untuk analisis mendalam


class RetrievedSource(BaseModel):
    chunk_id: str
    content_snippet: str
    score: float
    source_filename: str | None = None


class ChatResponse(BaseModel):
    session_id: str
    answer: str
    sources: list[RetrievedSource] = []
    has_financial_data: bool = False  # True jika jawaban menggunakan data keuangan user

class TaxConsultRequest(BaseModel):
    session_id: str | None = None
    wp_orang_pribadi: bool = True
    omzet_bulan_ini: float
    omzet_kumulatif_sebelum_bulan_ini: float = 0
    include_ppn: bool = False
    nilai_transaksi: float | None = None
    sudah_termasuk_ppn: bool = False
    barang_mewah: bool = False
    pertanyaan: str | None = None
    page: str | None = "Kalkulator Pajak"

class TaxConsultResponse(BaseModel):
    session_id: str
    answer: str
    pph: dict
    ppn: dict | None = None
    sources: list[RetrievedSource] = []

class TaxChatRequest(BaseModel):
    session_id: str | None = None
    message: str
    page: str | None = "Kalkulator Pajak"

class TaxChatResponse(BaseModel):
    session_id: str
    answer: str
    calculation: dict | None = None
    sources: list[RetrievedSource] = []

class ChatMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role: ChatRole
    content: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Dataset (kumpulan transaksi/jurnal)
# ---------------------------------------------------------------------------
class DatasetItem(BaseModel):
    deskripsi: str
    tanggal: str
    detail: list[dict]


class ParseDatasetRequest(BaseModel):
    message: str  # bisa multi-baris, satu transaksi per baris


class ParseDatasetResponse(BaseModel):
    items: list[DatasetItem]
    raw_response: str | None = None


class CreateDatasetRequest(BaseModel):
    items: list[DatasetItem]


class JournalCreated(BaseModel):
    jurnal_id: str
    no_bukti: str


class CreateDatasetResponse(BaseModel):
    status: str
    total: int
    journals: list[JournalCreated]


class UploadResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    original_filename: str
    file_type: str
    file_size_bytes: int
    status: str
    error_message: str | None = None
    journal_count: int = 0
    chunk_count: int = 0
    journal_total_debit: float = 0
    journal_total_kredit: float = 0
    transactions: list[dict] = []  # daftar transaksi ringkas
    account_breakdown: list[dict] = []  # breakdown per akun


class FollowUpSuggestion(BaseModel):
    text: str
    icon: str | None = None  # nama icon lucide


# ---------------------------------------------------------------------------
# Update transaksi (edit sebelum konfirmasi)
# ---------------------------------------------------------------------------
class UpdateTransactionRequest(BaseModel):
    current_transaction: dict  # {deskripsi, tanggal, detail: [{kode_akun, nama_akun, debit, kredit, keterangan}]}
    update_command: str        # perintah perubahan dari user, misal "ubah nominal jadi 75000"
