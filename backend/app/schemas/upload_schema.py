"""Schema untuk endpoint upload file (csv/xlsx transaksi, pdf aturan)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.database.models import StatusUpload


class UploadedFileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    original_filename: str
    file_type: str
    file_size_bytes: int
    status: StatusUpload
    error_message: str | None = None
    created_at: datetime
    processed_at: datetime | None = None
    context: str | None = None


class KnowledgeInput(BaseModel):
    judul: str
    kategori: str = "umum"
    konten: str


class KnowledgeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    original_filename: str
    file_type: str
    file_size_bytes: int
    status: StatusUpload
    error_message: str | None = None
    created_at: datetime
    processed_at: datetime | None = None
    chunk_count: int = 0
    context: str | None = None


class CommitResponse(BaseModel):
    status: str
    journal_count: int
    upload_id: str
