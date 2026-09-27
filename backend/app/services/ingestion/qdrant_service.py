"""Operasi Qdrant: buat collection, upsert chunk+vector, dan search.

Dua jalur pemrosesan vektor didukung:

- Vektor dihitung di backend (provider fastembed/openai/ollama) lalu dikirim
  ke Qdrant. Dipakai untuk Qdrant embedded lokal & mode desktop.
- Teks mentah dikirim ke Qdrant Cloud Inference (provider 'qdrant'), yang
  membuat vektornya sendiri di sisi server. Tidak ada model yang perlu
  diunduh ke backend, jadi bebas cold start di serverless.
"""

import uuid

from qdrant_client.models import (
    Distance,
    Document,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)

from app.config.logging import get_logger
from app.config.settings import settings
from app.database.database import get_qdrant_client
from app.llm.embedding_service import embedding_dimensions

logger = get_logger(__name__)

# Batas ukuran batch upsert: terlalu besar dalam satu request berisiko timeout,
# terutama lewat Qdrant Cloud Inference yang vektornya dibuat di sisi server.
BATCH_SIZE = 50


def _build_filter(category: str | None) -> Filter | None:
    if not category:
        return None
    return Filter(must=[FieldCondition(key="category", match=MatchValue(value=category))])


def _to_results(points) -> list[dict]:
    return [{"id": p.id, "score": p.score, "payload": p.payload} for p in points]


def _ensure_payload_indexes(client) -> None:
    """Buat payload index supaya query/filter field payload cepat dan valid:
    'category' (filter kategori/mis. tax) dan 'source_file_id' (dipakai
    delete_by_source_file saat file dihapus/di-reupload)."""
    for field_name in ("category", "source_file_id"):
        try:
            client.create_payload_index(
                collection_name=settings.QDRANT_COLLECTION_NAME,
                field_name=field_name,
                field_schema={"type": "keyword"},
            )
            logger.info("Payload index '%s' dibuat.", field_name)
        except Exception as exc:  # noqa: BLE001 - index sudah ada / jenis tidak didukung
            logger.info("Payload index '%s' (dibuat atau sudah ada): %s", field_name, exc)


def ensure_collection() -> None:
    client = get_qdrant_client()
    existing = {c.name for c in client.get_collections().collections}
    if settings.QDRANT_COLLECTION_NAME not in existing:
        dims = embedding_dimensions()
        client.create_collection(
            collection_name=settings.QDRANT_COLLECTION_NAME,
            vectors_config=VectorParams(size=dims, distance=Distance.COSINE),
        )
        logger.info("Collection Qdrant '%s' dibuat (dimensi %d).", settings.QDRANT_COLLECTION_NAME, dims)
    _ensure_payload_indexes(client)


def upsert_chunks(
    vectors: list[list[float]],
    payloads: list[dict],
) -> list[str]:
    """
    Simpan banyak chunk sekaligus. `payloads[i]` minimal berisi:
        {"content": str, "source_file_id": str, "source_filename": str,
         "chunk_index": int, "category": str}
    Mengembalikan list qdrant_point_id (uuid string) sesuai urutan input.
    """
    ensure_collection()
    client = get_qdrant_client()

    point_ids = [str(uuid.uuid4()) for _ in vectors]
    points = [
        PointStruct(id=point_ids[i], vector=vectors[i], payload=payloads[i])
        for i in range(len(vectors))
    ]

    # Batch upsert: kalau banyak chunk, pecah per BATCH_SIZE supaya tidak timeout
    for batch_start in range(0, len(points), BATCH_SIZE):
        batch = points[batch_start:batch_start + BATCH_SIZE]
        client.upsert(collection_name=settings.QDRANT_COLLECTION_NAME, points=batch)

    logger.info("Upsert %d chunk ke Qdrant.", len(points))
    return point_ids


def search(
    query_vector: list[float],
    top_k: int | None = None,
    category: str | None = None,
) -> list[dict]:
    """Cari chunk paling mirip dari vektor yang sudah dihitung backend."""
    ensure_collection()
    client = get_qdrant_client()

    results = client.query_points(
        collection_name=settings.QDRANT_COLLECTION_NAME,
        query=query_vector,
        limit=top_k or settings.TOP_K_RETRIEVAL,
        query_filter=_build_filter(category),
        with_payload=True,
    ).points
    return _to_results(results)


def search_by_text(
    query: str,
    top_k: int | None = None,
    category: str | None = None,
) -> list[dict]:
    """Cari chunk paling mirip dari teks mentah.

    Qdrant Cloud Inference yang meng-embed query ini di sisi server, jadi
    backend tidak perlu memuat model embedding sama sekali.
    """
    ensure_collection()
    client = get_qdrant_client()

    results = client.query_points(
        collection_name=settings.QDRANT_COLLECTION_NAME,
        query=Document(text=query, model=settings.QDRANT_INFERENCE_MODEL),
        limit=top_k or settings.TOP_K_RETRIEVAL,
        query_filter=_build_filter(category),
        with_payload=True,
    ).points
    return _to_results(results)


def upsert_documents(
    contents: list[str],
    payloads: list[dict],
) -> list[str]:
    """Simpan chunk ke Qdrant, dengan Qdrant yang membuat vektornya sendiri.

    Dipakai saat EMBEDDING_PROVIDER=qdrant. `payloads[i]` minimal berisi:
        {"content": str, "source_file_id": str, "source_filename": str,
         "chunk_index": int, "category": str}
    """
    if len(contents) != len(payloads):
        raise ValueError(
            f"Jumlah konten ({len(contents)}) harus sama dengan jumlah payload ({len(payloads)})."
        )

    ensure_collection()
    client = get_qdrant_client()

    point_ids = [str(uuid.uuid4()) for _ in contents]
    points = [
        PointStruct(
            id=point_ids[i],
            vector=Document(text=contents[i], model=settings.QDRANT_INFERENCE_MODEL),
            payload=payloads[i],
        )
        for i in range(len(contents))
    ]

    for batch_start in range(0, len(points), BATCH_SIZE):
        client.upsert(
            collection_name=settings.QDRANT_COLLECTION_NAME,
            points=points[batch_start:batch_start + BATCH_SIZE],
        )

    logger.info(
        "Upsert %d chunk ke Qdrant via inference '%s'.",
        len(points),
        settings.QDRANT_INFERENCE_MODEL,
    )
    return point_ids



def delete_by_source_file(source_file_id: str) -> None:
    """Hapus semua chunk milik satu file (dipakai kalau file dihapus/di-reupload)."""
    client = get_qdrant_client()
    client.delete(
        collection_name=settings.QDRANT_COLLECTION_NAME,
        points_selector=Filter(
            must=[FieldCondition(key="source_file_id", match=MatchValue(value=source_file_id))]
        ),
    )
