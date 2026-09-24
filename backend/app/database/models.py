"""
ORM models.
Skema disusun mengikuti alur akuntansi SAK EMKM:
    Transaksi -> Jurnal Umum -> Buku Besar (turunan) -> Neraca Saldo (turunan)
    -> Jurnal Penyesuaian -> Laporan Keuangan (turunan)

Buku Besar dan Neraca Saldo sengaja TIDAK punya tabel sendiri karena keduanya
adalah hasil agregasi dari JurnalDetail (dihitung on the fly di
app/accounting/buku_besar.py dan neraca_saldo.py). Ini menghindari duplikasi
data dan potensi tidak sinkron antara jurnal dan laporan turunannya.
"""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------
class KategoriAkun(str, enum.Enum):
    ASET = "ASET"
    LIABILITAS = "LIABILITAS"
    MODAL = "MODAL"
    PENDAPATAN = "PENDAPATAN"
    BEBAN = "BEBAN"


class SaldoNormal(str, enum.Enum):
    DEBIT = "DEBIT"
    KREDIT = "KREDIT"


class JenisJurnal(str, enum.Enum):
    UMUM = "UMUM"                # jurnal transaksi harian
    PENYESUAIAN = "PENYESUAIAN"  # jurnal penyesuaian akhir periode
    PENUTUP = "PENUTUP"          # jurnal penutup


class StatusUpload(str, enum.Enum):
    UPLOADED = "UPLOADED"
    STAGED = "STAGED"          # file sudah diupload, belum di-commit ke jurnal
    PROCESSING = "PROCESSING"
    NORMALIZED = "NORMALIZED"
    INGESTED = "INGESTED"        # sudah masuk ke vector store (untuk pdf/aturan)
    POSTED = "POSTED"            # sudah jadi jurnal (untuk csv/xlsx transaksi)
    FAILED = "FAILED"


class RoleUser(str, enum.Enum):
    ADMIN = "ADMIN"
    OWNER = "OWNER"       # pemilik UMKM
    STAFF = "STAFF"


class PlanUser(str, enum.Enum):
    FREE = "FREE"                    # paket gratis
    MAINTENANCE = "MAINTENANCE"      # paket berbayar / jasa maintenance pembukuan


class ChatRole(str, enum.Enum):
    USER = "USER"
    ASSISTANT = "ASSISTANT"


# ---------------------------------------------------------------------------
# User & Auth
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[RoleUser] = mapped_column(Enum(RoleUser), default=RoleUser.OWNER)
    company_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    setup_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    plan: Mapped[PlanUser] = mapped_column(Enum(PlanUser), default=PlanUser.FREE)
    # Kapan user bergabung paket maintenance (diisi saat plan diubah ke MAINTENANCE).
    maintenance_joined_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Terakhir kali user aktif (login) — untuk indikator aktivitas non-sensitif di dashboard admin.
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    verification_token: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    reset_password_token: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    reset_password_expires: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now
    )

    jurnal_entries: Mapped[list["JurnalUmum"]] = relationship(back_populates="created_by")
    uploaded_files: Mapped[list["UploadedFile"]] = relationship(back_populates="uploaded_by")
    chat_sessions: Mapped[list["ChatSession"]] = relationship(back_populates="user")
    spt_records: Mapped[list["SptTahunan"]] = relationship(back_populates="user")
    notifications: Mapped[list["Notification"]] = relationship(
        back_populates="user", foreign_keys="Notification.user_id"
    )
    feedbacks: Mapped[list["Feedback"]] = relationship(
        back_populates="user", foreign_keys="Feedback.user_id"
    )
    exit_feedbacks: Mapped[list["ExitFeedback"]] = relationship(
        back_populates="user", foreign_keys="ExitFeedback.user_id"
    )


# ---------------------------------------------------------------------------
# Chart of Accounts (Akun)
# ---------------------------------------------------------------------------
class Akun(Base):
    """Daftar akun / Chart of Accounts sesuai SAK EMKM."""

    __tablename__ = "akun"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    kode_akun: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    nama_akun: Mapped[str] = mapped_column(String(150), nullable=False)
    kategori: Mapped[KategoriAkun] = mapped_column(Enum(KategoriAkun), nullable=False)
    sub_kategori: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # contoh sub_kategori: "Aset Lancar", "Aset Tetap", "Liabilitas Jangka Pendek", dst.
    saldo_normal: Mapped[SaldoNormal] = mapped_column(Enum(SaldoNormal), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    deskripsi: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    detail_jurnal: Mapped[list["JurnalDetail"]] = relationship(back_populates="akun")

    def __repr__(self) -> str:
        return f"<Akun {self.kode_akun} - {self.nama_akun}>"


# ---------------------------------------------------------------------------
# Jurnal Umum (header) & Jurnal Detail (baris debit/kredit)
# ---------------------------------------------------------------------------
class JurnalUmum(Base):
    """Header transaksi jurnal. Satu jurnal punya >= 2 baris JurnalDetail."""

    __tablename__ = "jurnal_umum"
    # index komposit: dashboard & laporan hampir selalu memfilter (created_by_id, tanggal)
    __table_args__ = (Index("ix_jurnal_umum_created_tanggal", "created_by_id", "tanggal"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    no_bukti: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    tanggal: Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    deskripsi: Mapped[str] = mapped_column(Text, nullable=False)
    jenis: Mapped[JenisJurnal] = mapped_column(Enum(JenisJurnal), default=JenisJurnal.UMUM)

    # referensi ke sumber data (upload csv/xlsx), nullable karena bisa juga input manual
    sumber_upload_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("uploaded_files.id"), nullable=True, index=True
    )

    created_by_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    created_by: Mapped["User"] = relationship(back_populates="jurnal_entries")

    is_locked: Mapped[bool] = mapped_column(
        Boolean, default=False
    )  # dikunci setelah dipakai untuk menyusun laporan periode tertentu
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    detail: Mapped[list["JurnalDetail"]] = relationship(
        back_populates="jurnal", cascade="all, delete-orphan", order_by="JurnalDetail.urutan"
    )
    sumber_upload: Mapped["UploadedFile | None"] = relationship(back_populates="jurnal_entries")

    def total_debit(self) -> float:
        return sum(float(d.debit) for d in self.detail)

    def total_kredit(self) -> float:
        return sum(float(d.kredit) for d in self.detail)

    def is_balanced(self) -> bool:
        return round(self.total_debit(), 2) == round(self.total_kredit(), 2)


class JurnalDetail(Base):
    """Baris debit/kredit pada satu jurnal. Tepat satu dari debit/kredit yang > 0."""

    __tablename__ = "jurnal_detail"
    __table_args__ = (
        Index("ix_jurnal_detail_jurnal_id", "jurnal_id"),
        Index("ix_jurnal_detail_akun_id", "akun_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    jurnal_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("jurnal_umum.id", ondelete="CASCADE")
    )
    akun_id: Mapped[str] = mapped_column(String(36), ForeignKey("akun.id"))
    urutan: Mapped[int] = mapped_column(default=0)  # urutan baris dalam 1 jurnal
    debit: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    kredit: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    keterangan: Mapped[str | None] = mapped_column(String(255), nullable=True)

    jurnal: Mapped["JurnalUmum"] = relationship(back_populates="detail")
    akun: Mapped["Akun"] = relationship(back_populates="detail_jurnal")


# ---------------------------------------------------------------------------
# Tutup Buku (penutupan buku tahunan)
# ---------------------------------------------------------------------------
class TutupBuku(Base):
    """Riwayat penutupan buku per (user, tahun fiskal).

    Saat tutup buku berjalan, sistem membuat Jurnal Penutup (jenis PENUTUP)
    yang memindahkan saldo Pendapatan & Beban ke Laba Ditahan (3-3000), opsi
    jurnal penutup Prive, lalu mengunci semua jurnal di tahun tersebut.
    Satu record per user per tahun — mencegah tutup buku ganda.
    """

    __tablename__ = "tutup_buku"
    __table_args__ = (
        UniqueConstraint("user_id", "tahun", name="uq_tutup_buku_user_tahun"),
        Index("ix_tutup_buku_user_tahun", "user_id", "tahun"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    tahun: Mapped[int] = mapped_column(Integer, nullable=False)
    tanggal_tutup: Mapped[Date] = mapped_column(Date, nullable=False)
    laba_bersih: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    jurnal_penutup_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("jurnal_umum.id"), nullable=True
    )
    jurnal_penutup_no_bukti: Mapped[str | None] = mapped_column(String(50), nullable=True)
    jurnal_prive_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("jurnal_umum.id"), nullable=True
    )
    jurnal_prive_no_bukti: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)


# ---------------------------------------------------------------------------
# Upload & Ingestion tracking
# ---------------------------------------------------------------------------
class UploadedFile(Base):
    """
    Metadata file yang diupload user.
    - csv/xlsx transaksi -> diproses jadi JurnalUmum (lihat services/ingestion)
    - pdf aturan/kebijakan -> diproses jadi DocumentChunk untuk RAG
    """

    __tablename__ = "uploaded_files"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(10), nullable=False)  # csv | xlsx | pdf
    file_size_bytes: Mapped[int] = mapped_column(default=0)
    status: Mapped[StatusUpload] = mapped_column(Enum(StatusUpload), default=StatusUpload.UPLOADED)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    uploaded_by_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    uploaded_by: Mapped["User"] = relationship(back_populates="uploaded_files")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    jurnal_entries: Mapped[list["JurnalUmum"]] = relationship(back_populates="sumber_upload")
    chunks: Mapped[list["DocumentChunk"]] = relationship(back_populates="source_file")


class DocumentChunk(Base):
    """
    Metadata chunk teks yang embedding-nya disimpan di Qdrant.
    Tabel ini menyimpan teks asli + referensi qdrant_point_id supaya
    hasil retrieval bisa ditelusuri balik ke sumber dokumennya.
    """

    __tablename__ = "document_chunks"
    __table_args__ = (UniqueConstraint("source_file_id", "chunk_index", name="uq_chunk_per_file"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    source_file_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("uploaded_files.id", ondelete="CASCADE")
    )
    chunk_index: Mapped[int] = mapped_column(nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    qdrant_point_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    token_count: Mapped[int | None] = mapped_column(nullable=True)
    extra_metadata: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    source_file: Mapped["UploadedFile"] = relationship(back_populates="chunks")


# ---------------------------------------------------------------------------
# Chatbot history
# ---------------------------------------------------------------------------
class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(255), default="Percakapan baru")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now
    )

    user: Mapped["User"] = relationship(back_populates="chat_sessions")
    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.created_at"
    )


# ---------------------------------------------------------------------------
# SPT Tahunan (Formulir 1770 / 1770S)
# ---------------------------------------------------------------------------
class SptTahunan(Base):
    __tablename__ = "spt_tahunan"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    form_type: Mapped[str] = mapped_column(String(10), nullable=False)  # "1770" atau "1770S"
    tahun_pajak: Mapped[int] = mapped_column(nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT")  # DRAFT, FINAL
    data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now
    )

    user: Mapped["User"] = relationship(back_populates="spt_records")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("chat_sessions.id", ondelete="CASCADE")
    )
    role: Mapped[ChatRole] = mapped_column(Enum(ChatRole), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # daftar chunk yang dipakai sebagai konteks jawaban (untuk sitasi di frontend)
    retrieved_chunk_ids: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON list
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    session: Mapped["ChatSession"] = relationship(back_populates="messages")


# ---------------------------------------------------------------------------
# Notifikasi (dikirim admin ke user spesifik, atau dihasilkan otomatis oleh
# sistem — misalnya Ringkasan Bulanan).
# ---------------------------------------------------------------------------
class FeedbackCategory(str, enum.Enum):
    COMPLAINT = "COMPLAINT"
    QUESTION = "QUESTION"
    SUGGESTION = "SUGGESTION"
    OTHER = "OTHER"


class FeedbackStatus(str, enum.Enum):
    OPEN = "OPEN"
    REPLIED = "REPLIED"
    CLOSED = "CLOSED"


class NotificationType(str, enum.Enum):
    ADMIN = "ADMIN"          # dibuat manual oleh admin
    MONTHLY = "MONTHLY"      # ringkasan bulanan (sistem)
    SYSTEM = "SYSTEM"        # notifikasi sistem lain (placeholder)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    # Nullable: NULL berarti dikirim oleh sistem (tidak ada admin spesifik).
    sender_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType), default=NotificationType.ADMIN
    )
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    # Route frontend tujuan saat notifikasi diklik, nullable (kosong = tidak navigasi).
    link: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, index=True)

    user: Mapped["User"] = relationship(
        back_populates="notifications", foreign_keys=[user_id]
    )


# ---------------------------------------------------------------------------
# Feedback / CS (komplain / pertanyaan user -> admin)
# ---------------------------------------------------------------------------
class Feedback(Base):
    __tablename__ = "feedback"
    __table_args__ = (Index("ix_feedback_user_status", "user_id", "status"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    category: Mapped[FeedbackCategory] = mapped_column(
        Enum(FeedbackCategory), default=FeedbackCategory.COMPLAINT
    )
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[FeedbackStatus] = mapped_column(
        Enum(FeedbackStatus), default=FeedbackStatus.OPEN, index=True
    )
    admin_reply: Mapped[str | None] = mapped_column(Text, nullable=True)
    replied_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    replied_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now
    )

    user: Mapped["User"] = relationship(foreign_keys=[user_id])
    replied_by: Mapped["User | None"] = relationship(foreign_keys=[replied_by_id])


# ---------------------------------------------------------------------------
# Exit Feedback (rating singkat saat user logout)
# ---------------------------------------------------------------------------
class ExitFeedback(Base):
    __tablename__ = "exit_feedback"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    user: Mapped["User"] = relationship(foreign_keys=[user_id])
