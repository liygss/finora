"""
Konfigurasi logging terpusat untuk seluruh aplikasi.
Import `setup_logging()` sekali di main.py saat startup.

Serverless/Vercel: filesystem read-only (kecuali /tmp) → handler file
di-skip otomatis supaya aplikasi TIDAK PERNAH mati gara-gara logging.
Di desktop/lokal (folder logs writable) perilaku tetap sama seperti dulu.
"""

import logging
import logging.config
import sys
from pathlib import Path

from app.config.settings import settings

# ---------------------------------------------------------------------------
# Deteksi writability folder log (Vercel = read-only /var/task)
# ---------------------------------------------------------------------------
LOG_DIR = Path(settings.LOG_DIR)

def _check_log_dir_writable() -> bool:
    try:
        LOG_DIR.mkdir(exist_ok=True, parents=True)
        probe = LOG_DIR / ".write_probe"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink()
        return True
    except OSError:
        return False

LOG_WRITABLE = _check_log_dir_writable()

# ---------------------------------------------------------------------------
# Handler: console SELALU ada; file & error_file HANYA kalau writable
# ---------------------------------------------------------------------------
_handlers: dict = {
    "console": {
        "class": "logging.StreamHandler",
        "formatter": "default",
        "level": "DEBUG" if settings.DEBUG else "INFO",
    },
}

if LOG_WRITABLE:
    _handlers["file"] = {
        "class": "logging.handlers.RotatingFileHandler",
        "formatter": "default",
        "filename": str(LOG_DIR / "app.log"),
        "maxBytes": 10 * 1024 * 1024,  # 10 MB
        "backupCount": 5,
        "encoding": "utf-8",
        "level": "INFO",
    }
    _handlers["error_file"] = {
        "class": "logging.handlers.RotatingFileHandler",
        "formatter": "default",
        "filename": str(LOG_DIR / "error.log"),
        "maxBytes": 10 * 1024 * 1024,
        "backupCount": 5,
        "encoding": "utf-8",
        "level": "ERROR",
    }


def _clean_handlers(names: list[str]) -> list[str]:
    """Hanya kembalikan nama handler yang benar-benar terdaftar."""
    return [name for name in names if name in _handlers]


LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
        "access": {
            "format": "%(asctime)s | %(levelname)-8s | %(client_addr)s - \"%(request_line)s\" %(status_code)s",
        },
    },
    "handlers": _handlers,
    "loggers": {
        "": {  # root logger
            "handlers": _clean_handlers(["console", "file", "error_file"]),
            "level": "DEBUG" if settings.DEBUG else "INFO",
        },
        "uvicorn": {
            "handlers": _clean_handlers(["console", "file"]),
            "level": "INFO",
            "propagate": False,
        },
        "uvicorn.error": {
            "handlers": _clean_handlers(["console", "file", "error_file"]),
            "level": "INFO",
            "propagate": False,
        },
        "sqlalchemy.engine": {
            "handlers": _clean_handlers(["console", "file"]),
            "level": "WARNING",  # ganti ke INFO kalau mau lihat semua query SQL
            "propagate": False,
        },
    },
}


def setup_logging() -> None:
    """Pasang logging. Tidak akan pernah mematikan app walau filesystem read-only."""
    try:
        logging.config.dictConfig(LOGGING_CONFIG)
    except Exception:  # noqa: BLE001
        # Jaring pengaman: fallback ke console-only biar app tetap boot.
        logging.basicConfig(
            level=logging.DEBUG if settings.DEBUG else logging.INFO,
            stream=sys.stdout,
            format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    logger = logging.getLogger(__name__)
    logger.info(
        "Logging diinisialisasi (env=%s, debug=%s, file_log=%s)",
        settings.ENV, settings.DEBUG, LOG_WRITABLE,
    )


def get_logger(name: str) -> logging.Logger:
    """Helper supaya module lain tinggal: `logger = get_logger(__name__)`"""
    return logging.getLogger(name)
