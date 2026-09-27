"""
Layanan embedding untuk RAG, multi-provider (terpusat di satu tempat):

- fastembed (DEFAULT) — lokal, gratis, tanpa API key. Cocok aplikasi desktop.
  Model default: intfloat/multilingual-e5-small (384 dimensi). Model di-download
  sekali saat pertama dipakai, lalu di-cache di folder model.
- openai — OpenAI-compatible endpoint /v1/embeddings (butuh EMBEDDING_API_KEY).
- ollama — embedding via Ollama lokal (butuh Ollama terpasang).

Semua modul lain (rag/*, services/ingestion/embedding.py) memanggil lewat
`get_embedding` / `get_embeddings_batch` di file ini.
"""

import os
import threading
from functools import lru_cache
from pathlib import Path

from app.config.logging import get_logger
from app.config.settings import settings

logger = get_logger(__name__)

EmbeddingError = RuntimeError


class EmbeddingUnavailableError(EmbeddingError):
    """Model embedding belum siap dalam batas waktu yang diizinkan.

    Dipakai supaya jalur RAG bisa di-skip dengan rapi (bukan 500), sementara
    pemuatan model tetap berjalan di background thread.
    """


_fastembed_model = None
_model_ready = threading.Event()
_load_started = False
_load_lock = threading.Lock()
_load_error: Exception | None = None


def _resolve_model_cache_dir() -> str:
    """Pilih folder cache model embedding yang BENAR-BENAR bisa ditulis.

    Di serverless (Vercel) filesystem proyek read-only, jadi `DATA_DIR/models`
    tidak bisa dipakai untuk download model. Urutan fallback:
      1. FASTEMBED_CACHE_PATH (kalau user set)
      2. <writable DATA_DIR>/models
      3. /tmp/finora/models  (selalu writable di serverless)
    """
    explicit = os.environ.get("FASTEMBED_CACHE_PATH")
    candidates = [explicit] if explicit else []
    candidates.append(str(Path(settings.DATA_DIR) / "models"))
    candidates.append("/tmp/finora/models")

    for cand in candidates:
        if not cand:
            continue
        try:
            p = Path(cand)
            p.mkdir(parents=True, exist_ok=True)
            probe = p / ".write_probe"
            probe.write_text("ok", encoding="utf-8")
            probe.unlink()
            return str(p)
        except OSError:
            continue

    # Tidak ada yang bisa ditulis — biarkan fastembed pakai default-nya.
    return "/tmp/finora/models"


def _load_fastembed_model():
    """Muat model fastembed (dipanggil di dalam background thread)."""
    global _fastembed_model, _load_error
    try:
        from fastembed import TextEmbedding
    except ImportError as exc:  # pragma: no cover
        _load_error = EmbeddingError(
            "Package 'fastembed' belum terpasang. Jalankan: pip install fastembed"
        )
        return

    # Simpan model di folder yang writable supaya tidak mengotori home user
    # dan tetap jalan di serverless (filesystem read-only).
    cache_dir = _resolve_model_cache_dir()
    os.environ.setdefault("FASTEMBED_CACHE_PATH", cache_dir)
    os.environ.setdefault("HF_HOME", cache_dir)

    logger.info("Memuat model embedding %s (cache=%s)...", settings.EMBEDDING_MODEL, cache_dir)
    try:
        _fastembed_model = TextEmbedding(model_name=settings.EMBEDDING_MODEL)
    except Exception as exc:  # noqa: BLE001
        _load_error = EmbeddingError(
            f"Gagal memuat model embedding '{settings.EMBEDDING_MODEL}': {exc}"
        )
        return
    logger.info("Model embedding siap.")


def _load_worker():
    global _load_error
    try:
        _load_fastembed_model()
    except Exception as exc:  # noqa: BLE001
        _load_error = exc
        logger.error("Gagal memuat model embedding: %s", exc)
    finally:
        # WAJIB set di finally: kalau gagal pun, pemanggil tidak boleh hang.
        _model_ready.set()


def warm_up_embedding_model() -> bool:
    """Mulai/ulang pemuatan model embedding di background thread. Non-blocking.

    Aman dipanggil berulang kali: hanya thread pertama yang benar-benar jalan.
    Mengembalikan True kalau model sudah siap.

    Tidak ada yang perlu di-warm-up untuk provider non-fastembed (mis. Qdrant
    Cloud Inference, yang meng-embed di sisi server), jadi langsung True.
    """
    if settings.EMBEDDING_PROVIDER.lower() != "fastembed":
        return True

    global _load_started
    if _model_ready.is_set():
        return True

    with _load_lock:
        if _load_started:
            return False
        _load_started = True

    threading.Thread(target=_load_worker, name="embedding-warmup", daemon=True).start()
    return False


def is_embedding_ready() -> bool:
    """True kalau model embedding sudah siap dipakai.

    Untuk provider non-fastembed tidak ada model lokal yang perlu dimuat, jadi
    selalu True (embedding dibuat di sisi Qdrant/LLM).
    """
    if settings.EMBEDDING_PROVIDER.lower() != "fastembed":
        return True
    return _model_ready.is_set() and _fastembed_model is not None


def get_fastembed_model(max_wait: float | None = None):
    """Ambil model fastembed, tunggu paling lama `max_wait` detik.

    `max_wait=None` berarti tunggu tanpa batas (dipakai jalur ingestion/CLI yang
    tidak punya deadline request). Kalau `max_wait` habis, lempar
    EmbeddingUnavailableError supaya RAG bisa di-skip, bukan menggantung request.
    """
    if is_embedding_ready():
        return _fastembed_model

    warm_up_embedding_model()
    if not _model_ready.wait(timeout=max_wait):
        raise EmbeddingUnavailableError(
            f"Model embedding belum siap setelah {max_wait}s "
            f"(sedang diunduh di background). RAG dilewati untuk request ini."
        )

    if _fastembed_model is None:
        raise EmbeddingUnavailableError(
            f"Gagal memuat model embedding: {_load_error or 'tidak diketahui'}"
        )
    return _fastembed_model


def _embed_fastembed(texts: list[str], max_wait: float | None = None) -> list[list[float]]:
    model = get_fastembed_model(max_wait=max_wait)
    vectors = [v.tolist() for v in model.embed(texts)]
    return vectors


def _embed_openai(texts: list[str]) -> list[list[float]]:
    if not settings.EMBEDDING_API_KEY:
        raise EmbeddingError("EMBEDDING_API_KEY belum diset untuk provider 'openai'.")
    try:
        import httpx
    except ImportError as exc:  # pragma: no cover
        raise EmbeddingError("Package 'httpx' belum terpasang.") from exc

    headers = {
        "Authorization": f"Bearer {settings.EMBEDDING_API_KEY}",
        "Content-Type": "application/json",
    }
    payload: dict = {"model": settings.EMBEDDING_MODEL, "input": texts}
    if settings.EMBEDDING_DIMENSIONS:
        payload["dimensions"] = settings.EMBEDDING_DIMENSIONS

    resp = httpx.post(
        f"{settings.EMBEDDING_BASE_URL.rstrip('/')}/embeddings",
        headers=headers,
        json=payload,
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    results = sorted(data["data"], key=lambda item: item["index"])
    return [item["embedding"] for item in results]


def _embed_ollama(texts: list[str]) -> list[list[float]]:
    from app.llm.ollama_service import get_client

    client = get_client()
    vectors = []
    for t in texts:
        resp = client.embeddings(model=settings.EMBEDDING_MODEL, prompt=t)
        vectors.append(resp["embedding"])
    return vectors


def uses_qdrant_inference() -> bool:
    """True kalau embedding dibuat oleh Qdrant Cloud, bukan di backend.

    Kalau True, pemanggil harus mengirim TEKS ke Qdrant (lewat
    `qdrant_service.search_by_text` / `upsert_documents`) — bukan vektor —
    karena Qdrant tidak menyediakan endpoint untuk mengambil vektor mentah.
    """
    return settings.EMBEDDING_PROVIDER.lower() == "qdrant"


def _get_embeddings(texts: list[str], max_wait: float | None = None) -> list[list[float]]:
    provider = settings.EMBEDDING_PROVIDER.lower()
    try:
        if provider == "fastembed":
            return _embed_fastembed(texts, max_wait=max_wait)
        if provider == "openai":
            return _embed_openai(texts)
        if provider == "ollama":
            return _embed_ollama(texts)
        if provider == "qdrant":
            raise EmbeddingError(
                "EMBEDDING_PROVIDER='qdrant' tidak bisa dipakai lewat get_embedding(): "
                "Qdrant membuat vektornya sendiri di sisi server. Gunakan "
                "qdrant_service.search_by_text() / upsert_documents() yang mengirim "
                "teks, atau kembalikan EMBEDDING_PROVIDER ke 'fastembed'."
            )
        raise EmbeddingError(f"EMBEDDING_PROVIDER tidak dikenal: {provider}")
    except EmbeddingError:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.error("Gagal membuat embedding (provider=%s): %s", provider, exc)
        raise EmbeddingError(f"Gagal membuat embedding: {exc}") from exc


def get_embedding(text: str, max_wait: float | None = None) -> list[float]:
    """Embed satu string. Dipakai untuk query maupun untuk chunk dokumen.

    `max_wait` hanya relevan untuk fastembed: batas menunggu model siap supaya
    request tidak hang di serverless.
    """
    return _get_embeddings([text], max_wait=max_wait)[0]


def get_embeddings_batch(texts: list[str], max_wait: float | None = None) -> list[list[float]]:
    """Embed banyak teks sekaligus (fastembed & openai mendukung batch native)."""
    return _get_embeddings(texts, max_wait=max_wait)


@lru_cache
def embedding_dimensions() -> int:
    """Dimensi vektor model embedding saat ini (untuk koleksi Qdrant).

    Kalau model belum bisa dimuat (mis. serverless yang belum sempat download),
    jatuh ke QDRANT_VECTOR_SIZE supaya pembuatan collection tetap bisa jalan.
    """
    # Qdrant Cloud Inference tidak bisa di-probe dari sini: kita tidak pernah
    # memegang vektornya, jadi dimensi harus berasal dari konfigurasi.
    if uses_qdrant_inference():
        return settings.QDRANT_VECTOR_SIZE

    try:
        probe = get_embedding("probe", max_wait=settings.EMBEDDING_MAX_WAIT_SECONDS)
        return len(probe)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Tidak bisa probing dimensi model embedding (%s); pakai QDRANT_VECTOR_SIZE=%d.",
            exc, settings.QDRANT_VECTOR_SIZE,
        )
        return settings.QDRANT_VECTOR_SIZE
