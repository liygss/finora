"""
Entry point aplikasi FastAPI.

Jalankan dengan:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

Sebelum pertama kali jalan, siapkan database:
    python -m app.database.migration
"""

from contextlib import asynccontextmanager
import os
import threading
import time

from fastapi import FastAPI, Depends, Request
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config.logging import get_logger, setup_logging
from app.config.settings import settings
from app.database.database import check_db_connection, check_qdrant_connection
from app.middleware.auth import require_admin
from app.middleware.cors import setup_cors
from app.routers import accounting, admin, authentication, chatbot, dashboard, downloads, feedback, notifications, setup, spt, upload

setup_logging()
logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Rate limiter
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)

# ---------------------------------------------------------------------------
# Seed status tracking
# ---------------------------------------------------------------------------
_seed_status = {
    "running": False,
    "completed": False,
    "error": None,
    "started_at": None,
    "completed_at": None,
}


def _is_serverless() -> bool:
    """True kalau jalan di Vercel (atau platform serverless lain)."""
    return bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s (env=%s)...", settings.APP_NAME, settings.ENV)
    # Pastikan tabel & chart of accounts tersedia (aman dijalankan tiap start).
    from app.database.migration import create_tables, seed_bootstrap_admin, seed_chart_of_accounts

    create_tables()
    seed_chart_of_accounts()
    seed_bootstrap_admin()
    db_ok = check_db_connection()
    qdrant_ok = check_qdrant_connection()
    if not db_ok:
        logger.warning("Database tidak terhubung saat startup — cek konfigurasi/koneksi.")
    if not qdrant_ok:
        logger.warning("Qdrant tidak terhubung saat startup — fitur RAG tidak akan berfungsi.")

    # Seed knowledge base di background (idempotent — hanya proses file baru).
    # Hanya untuk aplikasi desktop/lokal: di serverless (Vercel) instance bisa
    # dibekukan atau dimatikan kapan saja sehingga daemon thread tidak pernah
    # selesai, dan knowledge base lebih baik diisi dari mesin lain.
    if _is_serverless():
        logger.info(
            "Environment serverless terdeteksi — seeding knowledge base "
            "otomatis dilewati. Jalankan seeding manual lewat CLI."
        )
    else:
        _seed_status["running"] = True
        _seed_status["started_at"] = time.time()
        threading.Thread(target=_seed_knowledge_background, daemon=True).start()

    # Panaskan model embedding di background supaya permintaan pertama tidak
    # ikut menunggu proses download (~241MB) yang bisa makan >100 detik.
    if settings.EMBEDDING_WARMUP_ON_STARTUP and settings.EMBEDDING_PROVIDER.lower() == "fastembed":
        from app.llm.embedding_service import warm_up_embedding_model

        if warm_up_embedding_model():
            logger.info("Model embedding sudah siap sebelum melayani request.")
        else:
            logger.info("Pemanasan model embedding dimulai di background thread.")

    yield
    logger.info("Shutting down %s...", settings.APP_NAME)


def _seed_knowledge_background() -> None:
    try:
        from app.services.ingestion.seed_knowledge_base import run as seed_run

        seed_run()
        _seed_status["completed"] = True
        _seed_status["completed_at"] = time.time()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Seeding knowledge base di background gagal — fitur RAG mungkin kosong.")
        _seed_status["error"] = str(exc)
    finally:
        _seed_status["running"] = False


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Backend Finora untuk pembukuan & konsultasi pajak UMKM (SAK EMKM).",
    lifespan=lifespan,
)

# Tambah rate limiter ke app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Prefix yang sampai ke FastAPI. Di desktop/local path sudah tanpa prefix
# (Vite proxy menghapusnya), sedangkan di Vercel path datang sebagai /api/...
_API_PREFIX = "/api"


@app.middleware("http")
async def strip_api_prefix(request: Request, call_next):
    """Buang prefix /api kalau masih ada, supaya router (yang tanpa prefix)
    tetap cocok baik di local (sudah di-strip proxy) maupun di Vercel."""
    path = request.scope.get("path", "")
    if path == _API_PREFIX:
        request.scope["path"] = "/"
    elif path.startswith(_API_PREFIX + "/"):
        request.scope["path"] = path[len(_API_PREFIX):]
    raw_path = request.scope.get("raw_path")
    if raw_path and raw_path.startswith(_API_PREFIX.encode()):
        request.scope["raw_path"] = raw_path[len(_API_PREFIX):]
    return await call_next(request)


setup_cors(app)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(authentication.router)
app.include_router(admin.router)
app.include_router(setup.router)
app.include_router(accounting.router)
app.include_router(spt.router)
app.include_router(upload.router)
app.include_router(dashboard.router)
app.include_router(chatbot.router)
app.include_router(downloads.router)
app.include_router(notifications.router)
app.include_router(feedback.router)


@app.get("/", tags=["Root"])
def root() -> dict:
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "env": settings.ENV,
        "docs": "/docs",
    }


@app.get("/health", tags=["Root"])
def health() -> dict:
    """Health check publik — tidak membocorkan info internal."""
    return {"status": "ok"}


@app.get("/health/detail", tags=["Root"])
def health_detail(admin=Depends(require_admin)) -> JSONResponse:
    """Health check detail — hanya untuk admin/monitoring internal."""
    db_ok = check_db_connection()
    qdrant_ok = check_qdrant_connection()
    status_code = 200 if db_ok else 503
    return JSONResponse(
        status_code=status_code,
        content={
            "database": "connected" if db_ok else "disconnected",
            "qdrant": "connected" if qdrant_ok else "disconnected",
        },
    )


@app.get("/health/seed-status", tags=["Root"])
def seed_status(admin=Depends(require_admin)) -> dict:
    """Status background seeding knowledge base."""
    result = dict(_seed_status)
    if result["started_at"]:
        result["started_at"] = time.strftime(
            "%Y-%m-%dT%H:%M:%S", time.localtime(result["started_at"])
        )
    if result["completed_at"]:
        result["completed_at"] = time.strftime(
            "%Y-%m-%dT%H:%M:%S", time.localtime(result["completed_at"])
        )
    return result
