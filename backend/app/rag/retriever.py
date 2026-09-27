"""Retriever: embed query lalu cari chunk paling relevan di Qdrant."""

from dataclasses import dataclass

from app.config.logging import get_logger
from app.config.settings import settings
from app.llm.embedding_service import get_embedding
from app.services.ingestion import qdrant_service

logger = get_logger(__name__)


@dataclass
class RetrievedChunk:
    qdrant_point_id: str
    score: float
    content: str
    heading: str | None
    source_filename: str
    source_file_id: str
    category: str


def retrieve(query: str, top_k: int | None = None, category: str | None = None) -> list[RetrievedChunk]:
    """Cari chunk relevan. Kalau embedding/Qdrant bermasalah, kembalikan []

    Chatbot harus tetap bisa menjawab (dengan financial context saja) alih-alih
    balas 500 — retrieval knowledge base itu nilai tambah, bukan syarat.
    """
    try:
        query_vector = get_embedding(
            query, max_wait=settings.EMBEDDING_MAX_WAIT_SECONDS
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Embedding query gagal, lewati retrieval knowledge base: %s", exc)
        return []

    try:
        results = qdrant_service.search(
            query_vector, top_k=top_k or settings.TOP_K_RETRIEVAL, category=category
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Pencarian Qdrant gagal, lewati retrieval knowledge base: %s", exc)
        return []

    return [
        RetrievedChunk(
            qdrant_point_id=str(r["id"]),
            score=r["score"],
            content=r["payload"].get("content", ""),
            heading=r["payload"].get("heading"),
            source_filename=r["payload"].get("source_filename", "unknown"),
            source_file_id=r["payload"].get("source_file_id", ""),
            category=r["payload"].get("category", "umum"),
        )
        for r in results
    ]
