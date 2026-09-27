"""
Generate embedding untuk chunk, dengan cache berbasis file (embeddings/embedding_cache.json)
supaya re-ingest file yang sama (mis. setelah normalizer diperbaiki sedikit)
tidak perlu memanggil ulang model embedding untuk teks yang persis sama.

Embedding dihitung secara paralel pakai ThreadPoolExecutor supaya
beberapa request Ollama bisa jalan bersamaan (network I/O bound).
"""

import hashlib
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from app.config.logging import get_logger
from app.config.settings import resolve_writable_dir, settings
from app.llm.embedding_service import get_embedding

logger = get_logger(__name__)

# Batas aman untuk embedding model nomic-embed-text (8192 tokens).
# ~1.3 token per kata Bahasa Indonesia -> 512 token ~= 390 kata.
MAX_EMBEDDING_WORDS = 400

# Jumlah worker paralel untuk Ollama embedding calls.
# Ollama inference GPU-bound, tapi network I/O menambah latensi.
# 4 worker cukup untuk mengurangi waktu tunggu tanpa overloading.
EMBEDDING_WORKERS = 4


def _cache_path() -> Path:
    # resolve_writable_dir() sudah menangani filesystem read-only (serverless)
    # dengan fallback ke /tmp, jadi pemanggilan ini tidak akan crash di sini.
    return Path(resolve_writable_dir(settings.EMBEDDINGS_DIR, "embeddings")) / "embedding_cache.json"


def _hash_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _cache_fingerprint() -> str:
    """Penanda model embedding yang dipakai saat cache dibuat.

    Cache lama sengaja hanya memakai hash teks, sehingga mengganti model
    (mis. fastembed -> provider lain) diam-diam mengembalikan vektor dari model
    yang salah daninasional. Menyertakan nama model+pengaturan membuat kunci
    cache otomatis berbeda begitu konfigurasi berubah.
    """
    raw = "|".join(
        [
            settings.EMBEDDING_PROVIDER.lower(),
            settings.EMBEDDING_MODEL,
            str(settings.QDRANT_INFERENCE_MODEL),
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12]


def _load_cache() -> dict[str, list[float]]:
    path = _cache_path()
    if not path.exists():
        return {}
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning("Gagal membaca embedding cache, mulai dari cache kosong: %s", exc)
        return {}

    # Format lama: {"<hash>": [floats]}. Format baru: {"fingerprint": ..., "entries": {...}}
    if not isinstance(data, dict) or "entries" not in data:
        logger.info("Format embedding cache lama, diabaikan (perlu hitung ulang).")
        return {}

    if data.get("fingerprint") != _cache_fingerprint():
        logger.info("Embedding cache dibuat dengan model lain, diabaikan (perlu hitung ulang).")
        return {}

    return data["entries"]


def _save_cache(cache: dict[str, list[float]]) -> None:
    path = _cache_path()
    payload = {"fingerprint": _cache_fingerprint(), "entries": cache}
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f)
    except OSError as exc:
        logger.warning("Gagal menyimpan embedding cache: %s", exc)

def _compute_one(text: str, key: str, idx: int) -> tuple[int, str, list[float]]:
    """Hitung embedding untuk satu teks. Dipanggil oleh ThreadPoolExecutor."""
    vector = get_embedding(text)
    return idx, key, vector


def embed_chunks(texts: list[str]) -> list[list[float]]:
    """Embed banyak teks sekaligus, pakai cache + paralelisme untuk teks baru."""
    cache = _load_cache()
    hasil: list[list[float] | None] = [None] * len(texts)
    to_compute: list[tuple[int, str, str]] = []  # (index, text, hash)

    for i, text in enumerate(texts):
        word_count = len(text.split())
        if word_count > MAX_EMBEDDING_WORDS:
            words = text.split()
            text = " ".join(words[:MAX_EMBEDDING_WORDS])
        key = _hash_text(text)
        if key in cache:
            hasil[i] = cache[key]
        else:
            to_compute.append((i, text, key))

    if to_compute:
        logger.info("Menghitung embedding baru untuk %d/%d chunk (paralel, sisanya cache).", len(to_compute), len(texts))

        if len(to_compute) == 1:
            # Single item, no need for thread pool
            idx, text, key = to_compute[0]
            vector = get_embedding(text)
            hasil[idx] = vector
            cache[key] = vector
        else:
            # Parallel embedding via ThreadPoolExecutor
            with ThreadPoolExecutor(max_workers=min(EMBEDDING_WORKERS, len(to_compute))) as executor:
                futures = {
                    executor.submit(_compute_one, text, key, idx): idx
                    for idx, text, key in to_compute
                }
                for future in as_completed(futures):
                    try:
                        idx, key, vector = future.result()
                        hasil[idx] = vector
                        cache[key] = vector
                    except Exception as exc:
                        logger.error("Gagal menghitung embedding untuk chunk %d: %s", futures[future], exc)
                        raise

        _save_cache(cache)

    return hasil  # type: ignore[return-value]
