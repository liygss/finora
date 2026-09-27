"""Retriever: cari chunk paling relevan di Qdrant.

Query boleh di-embed di backend (provider fastembed/openai/ollama) atau
dikirim apa adanya ke Qdrant Cloud Inference (provider 'qdrant').
"""

from dataclasses import dataclass

from app.config.logging import get_logger
from app.config.settings import settings
from app.llm.embedding_service import get_embedding, uses_qdrant_inference
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
        if uses_qdrant_inference():
            # Qdrant yang meng-embed query; backend tidak memuat model apa pun.
            results = qdrant_service.search_by_text(
                query, top_k=top_k or settings.TOP_K_RETRIEVAL, category=category
            )
        else:
            query_vector = get_embedding(
                query, max_wait=settings.EMBEDDING_MAX_WAIT_SECONDS
            )
            results = qdrant_service.search(
                query_vector, top_k=top_k or settings.TOP_K_RETRIEVAL, category=category
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Retrieval knowledge base gagal, lewati: %s", exc)
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
