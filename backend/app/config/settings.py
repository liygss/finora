"""
Konfigurasi utama aplikasi.
Semua nilai bisa di-override lewat environment variable atau file .env
"""

import os
from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import AnyHttpUrl, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ---------- General ----------
    APP_NAME: str = "Finora"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    ENV: str = Field(default="development")  # development | staging | production

    # ---------- Database (SQLite default) ----------
    # Biarkan kosong untuk memakai SQLite. Untuk override penuh (mis. tetap
    # pakai PostgreSQL di server) set DATABASE_URL_OVERRIDE, contoh:
    #   postgresql+psycopg2://user:pass@host:5432/db
    DATABASE_URL_OVERRIDE: str | None = None
    # Path SQLite relatif terhadap folder kerja (di aplikasi desktop diarahkan
    # ke folder data milik Electron lewat env DATA_DIR).
    SQLITE_PATH: str = "data/finora.db"

    # Folder basis untuk semua penyimpanan file aplikasi (database, qdrant,
    # upload, log, dll). Di desktop di-set ke userData/.. oleh Electron.
    DATA_DIR: str = "data"

    @property
    def DATABASE_URL(self) -> str:
        """URL database final yang dipakai SQLAlchemy."""
        if self.DATABASE_URL_OVERRIDE:
            return self.DATABASE_URL_OVERRIDE
        return f"sqlite:///{self.SQLITE_PATH}"

    @property
    def is_sqlite(self) -> bool:
        return not self.DATABASE_URL_OVERRIDE or self.DATABASE_URL_OVERRIDE.startswith("sqlite")

    @property
    def ASYNC_DATABASE_URL(self) -> str:
        return self.DATABASE_URL

    # ---------- Vector DB (Qdrant) ----------
    # Mode cloud: isi QDRANT_HOST + QDRANT_API_KEY (seperti yang sudah terisi
    # di .env). Mode embedded lokal: biarkan QDRANT_API_KEY kosong, data
    # disimpan di QDRANT_LOCAL_PATH (tanpa server/Docker).
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_API_KEY: str | None = None
    QDRANT_COLLECTION_NAME: str = "accounting_knowledge"
    QDRANT_VECTOR_SIZE: int = 384  # multilingual-e5-small = 384
    QDRANT_LOCAL_PATH: str = "data/qdrant"

    # Model untuk Qdrant Cloud Inference (dipakai kalau EMBEDDING_PROVIDER=qdrant).
    # Qdrant yang membuat vektornya di sisi server, jadi tidak ada model yang
    # perlu diunduh ke backend — bebas cold start di serverless.
    # Hanya model berlabel "Cost: Free" yang bisa dipakai tanpa API key tambahan.
    QDRANT_INFERENCE_MODEL: str = "intfloat/multilingual-e5-small"

    @property
    def QDRANT_URL(self) -> str:
        if self.QDRANT_API_KEY:
            return f"https://{self.QDRANT_HOST}"
        return f"http://{self.QDRANT_HOST}:{self.QDRANT_PORT}"

    @property
    def use_qdrant_local(self) -> bool:
        """True = pakai Qdrant embedded lokal; False = pakai Qdrant cloud/server."""
        return not bool(self.QDRANT_API_KEY)

    # ---------- LLM (Ollama — lokal ATAU Ollama Cloud ollama.com) ----------
    # Cloud: set OLLAMA_API_KEY (key milik kalian, di-bundle ke desktop app).
    # Lokal: biarkan OLLAMA_API_KEY kosong dan arahkan OLLAMA_BASE_URL ke
    # http://localhost:11434.
    OLLAMA_BASE_URL: AnyHttpUrl = "https://ollama.com"
    OLLAMA_API_KEY: str | None = None
    # Model chat. Untuk cloud pakai nama model cloud (mis. gpt-oss:120b).
    OLLAMA_MODEL: str = "llama3.2:3b"
    OLLAMA_TIMEOUT: int = 300

    @property
    def ollama_is_cloud(self) -> bool:
        return bool(self.OLLAMA_API_KEY)

    # ---------- Embedding (RAG) ----------
    # fastembed (default): lokal, gratis, tanpa API key — cocok desktop app.
    # openai: OpenAI-compatible endpoint /v1/embeddings (butuh EMBEDDING_API_KEY).
    # ollama: pakai Ollama lokal (butuh Ollama terpasang).
    EMBEDDING_PROVIDER: str = "fastembed"  # fastembed | qdrant | openai | ollama
    EMBEDDING_MODEL: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    EMBEDDING_API_KEY: str | None = None
    EMBEDDING_BASE_URL: str = "https://api.openai.com/v1"
    EMBEDDING_DIMENSIONS: int | None = None  # text-embedding-3-small bisa 512/1024/1536

    # Batas waktu (detik) request chat menunggu model embedding siap. Di serverless
    # model fastembed (~241MB) harus diunduh saat instance baru nyala, bisa >100 detik.
    # Jadi request TIDAK boleh menunggu tak terbatas: kalau lewat, RAG dilewati dan
    # chat dijawab LLM saja, sementara download lanjut di background.
    EMBEDDING_MAX_WAIT_SECONDS: float = 10.0
    # Panaskan model embedding saat aplikasi start, supaya permintaan pertama
    # tidak memblokir proses download.
    EMBEDDING_WARMUP_ON_STARTUP: bool = True

    # ---------- Auth / Security ----------
    SECRET_KEY: str = Field(default="")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 hari

    # ---------- Bootstrap Admin ----------
    # Email yang otomatis dijadikan ADMIN saat aplikasi pertama kali jalan
    # (di-upgrade/dibuat bila belum ada). Bisa di-override lewat env.
    BOOTSTRAP_ADMIN_EMAIL: str = "haidarmgn@gmail.com"

    @model_validator(mode="after")
    def validate_security(self) -> "Settings":
        if not self.SECRET_KEY or len(self.SECRET_KEY) < 32:
            env_val = os.environ.get("SECRET_KEY", "")
            if env_val and len(env_val) >= 32:
                self.SECRET_KEY = env_val
            elif self.ENV.lower() == "production":
                raise ValueError(
                    "SECRET_KEY harus di-set minimal 32 karakter di production. "
                    "Generate: python -c \"import secrets; print(secrets.token_hex(32))\""
                )
            else:
                self.SECRET_KEY = "dev-only-secret-key-change-in-production-min32char!"
        if self.DEBUG and self.ENV.lower() == "production":
            import warnings
            warnings.warn("ENV=production tapi DEBUG=True — nonaktifkan di production!")
        return self

    # ---------- CORS ----------
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    # ---------- File storage ----------
    LOG_DIR: str = "logs"
    UPLOAD_DIR: str = "data/uploads"
    MARKDOWN_DIR: str = "data/markdown"
    CHUNKS_DIR: str = "data/chunks"
    EMBEDDINGS_DIR: str = "data/embeddings"
    KNOWLEDGE_DIR: str = "../knowledge"  # folder pengetahuan statis (lihat struktur proyek)
    # Folder installer aplikasi desktop (DMG/EXE/AppImage) yang disajikan
    # langsung dari backend lewat GET /downloads/<file> (untuk halaman landing).
    DOWNLOADS_DIR: str = "../downloads"
    # Batas Vercel untuk request body serverless function adalah 4.5MB. Menyetel
    # nilai lebih besar hanya menghasilkan HTTP 413 "Request Entity Too Large"
    # dari platform (tanpa pesan dari aplikasi), jadi batasnya diturunkan ke
    # bawah plafon itu supaya penolakan terjadi di level aplikasi dengan pesan
    # yang jelas. Batas ini hanya berlaku di serverless; desktop tidak punya
    # plafon tersebut.
    MAX_UPLOAD_SIZE_MB: int = 4

    # Ambang peringatan ukuran database (MB) untuk /api/chatbot/health. Plan
    # gratis database biasanya punya kuota sekitar 500MB; project di-suspend
    # begitu kuota habis, dan itu tidak bisa diperbaiki dari sisi aplikasi.
    DB_SIZE_WARN_MB: float = 400.0
    ALLOWED_UPLOAD_EXTENSIONS: List[str] = [".csv", ".xlsx", ".xls", ".pdf"]

    # ---------- RAG ----------
    CHUNK_SIZE: int = 800
    CHUNK_OVERLAP: int = 100
    TOP_K_RETRIEVAL: int = 5

    # ---------- Email Verification (SMTP) ----------
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@finora.local"
    SMTP_USE_TLS: bool = True

    # URL aplikasi frontend, dipakai untuk membangun link reset password di email.
    FRONTEND_BASE_URL: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance supaya .env cuma di-parse sekali."""
    return Settings()


settings = get_settings()


@lru_cache
def resolve_writable_dir(preferred: str, name: str) -> str:
    """Kembalikan `preferred` kalau bisa ditulis, kalau tidak pakai /tmp/<name>.

    Dipakai untuk folder yang perlu ditulis: upload, dump chunk, cache model.
    Di serverless (Vercel) filesystem proyek read-only, jadi kita perlu
    fallback ke /tmp yang selalu writable. Isi /tmp TIDAK persisten
    antar instance — cukup untuk memproses satu request.
    """
    for candidate in (preferred, f"/tmp/finora/{name}"):
        if not candidate:
            continue
        try:
            path = Path(candidate)
            path.mkdir(parents=True, exist_ok=True)
            probe = path / ".write_probe"
            probe.write_text("ok", encoding="utf-8")
            probe.unlink()
            return str(path)
        except OSError:
            continue
    return f"/tmp/finora/{name}"
