"""
Orkestrator RAG penuh: retrieve -> rerank -> context -> prompt -> LLM -> parse.
Juga mengurus penyimpanan/pengambilan histori chat (ChatSession/ChatMessage)
supaya chatbot punya "ingatan" percakapan dalam satu sesi.
"""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.config.logging import get_logger
from app.database.models import ChatMessage, ChatRole, ChatSession
from app.llm.ollama_service import chat_completion
from app.llm.response_parser import parse_llm_response
from app.rag.context_builder import build_context
from app.rag.prompt_builder import (
    INJECTION_ANSWER,
    OUT_OF_TOPIC_NOTE,
    build_messages,
    detect_domain,
    is_out_of_topic,
    is_prompt_injection,
    normalize_query,
)
from app.rag.reranker import rerank
from app.rag.retriever import RetrievedChunk, retrieve
from app.services.data_context_service import get_financial_context

logger = get_logger(__name__)

MAX_HISTORY_MESSAGES = 6  # jumlah pesan terakhir yang dibawa sebagai konteks percakapan
RETRIEVAL_TOP_K = 8       # ambil agak banyak dulu dari Qdrant
RERANK_TOP_N = 4          # baru dipangkas ke yang paling relevan setelah rerank
CATEGORY_BOOST_TOP_K = 6
TAX_BOOST_CATEGORIES = ("tax", "regulations", "faq")


@dataclass
class RagAnswer:
    session_id: str
    answer: str
    sources: list[RetrievedChunk]


def _get_or_create_session(db: Session, user_id: str, session_id: str | None) -> ChatSession:
    if session_id:
        session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == user_id).first()
        if session:
            return session
    session = ChatSession(user_id=user_id, title="Percakapan baru")
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def _ambil_histori(db: Session, session: ChatSession) -> list[dict[str, str]]:
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(MAX_HISTORY_MESSAGES)
        .all()
    )
    messages.reverse()
    return [{"role": m.role.value.lower(), "content": m.content} for m in messages]


def _simpan_percakapan(
    db: Session,
    session: ChatSession,
    pertanyaan: str,
    jawaban: str,
    sources: list[RetrievedChunk],
) -> None:
    db.add(ChatMessage(session_id=session.id, role=ChatRole.USER, content=pertanyaan))
    db.add(
        ChatMessage(
            session_id=session.id,
            role=ChatRole.ASSISTANT,
            content=jawaban,
            retrieved_chunk_ids=",".join(c.qdrant_point_id for c in sources),
        )
    )
    db.commit()


def merge_chunks(*chunk_lists: list[RetrievedChunk]) -> list[RetrievedChunk]:
    """Gabungkan beberapa daftar chunk, dedupe berdasarkan qdrant_point_id (urutan pertama menang)."""
    seen: set[str] = set()
    hasil: list[RetrievedChunk] = []
    for chunks in chunk_lists:
        for chunk in chunks:
            if chunk.qdrant_point_id in seen:
                continue
            seen.add(chunk.qdrant_point_id)
            hasil.append(chunk)
    return hasil


def ask(
    db: Session,
    user_id: str,
    session_id: str | None,
    pertanyaan: str,
    financial_context: str | None = None,
    page: str | None = None,
    context_label: str | None = None,
) -> RagAnswer:
    session = _get_or_create_session(db, user_id, session_id)
    histori = _ambil_histori(db, session)
    pertanyaan = normalize_query(pertanyaan)

    if is_prompt_injection(pertanyaan):
        _simpan_percakapan(db, session, pertanyaan, INJECTION_ANSWER, [])
        logger.info("Guardrail menahan prompt injection untuk sesi %s.", session.id)
        return RagAnswer(session_id=session.id, answer=INJECTION_ANSWER, sources=[])

    guardrail_note = OUT_OF_TOPIC_NOTE if is_out_of_topic(pertanyaan) else None

    # 1. Retrieve (knowledge base dari Qdrant)
    retrieved = retrieve(pertanyaan, top_k=RETRIEVAL_TOP_K)

    # 1b. Boosting kategori: kalau pertanyaan bernuansa pajak/akuntansi/aplikasi, cari
    #     juga khusus kategori tsb lalu gabungkan (dedupe) dengan hasil umum.
    domain = detect_domain(pertanyaan)
    if domain == "tax":
        for category in TAX_BOOST_CATEGORIES:
            category_hits = retrieve(pertanyaan, top_k=CATEGORY_BOOST_TOP_K, category=category)
            retrieved = merge_chunks(retrieved, category_hits)
    elif domain in ("accounting", "app"):
        category_hits = retrieve(pertanyaan, top_k=CATEGORY_BOOST_TOP_K, category=domain)
        retrieved = merge_chunks(retrieved, category_hits)

    # 2. Rerank
    reranked = rerank(pertanyaan, retrieved, top_n=RERANK_TOP_N)

    # 3. Context (knowledge base)
    context = build_context(reranked)

    # 3b. Financial context — gunakan yang sudah dihitung atau hitung baru
    if financial_context is None:
        financial_context = get_financial_context(db, user_id, pertanyaan)

    # 4. Prompt (gabungkan knowledge base + financial context)
    messages = build_messages(
        pertanyaan,
        context,
        histori,
        financial_context,
        page,
        context_label,
        guardrail_note=guardrail_note,
    )

    # 5. LLM
    raw_answer = chat_completion(messages)

    # 6. Parse
    parsed = parse_llm_response(raw_answer)

    # Simpan histori (pertanyaan user + jawaban asisten)
    _simpan_percakapan(db, session, pertanyaan, parsed.answer, context.sources)

    logger.info(
        "RAG answer untuk sesi %s: %d chunk (knowledge) + financial_data=%s.",
        session.id,
        len(context.sources),
        "yes" if financial_context else "no",
    )

    return RagAnswer(session_id=session.id, answer=parsed.answer, sources=context.sources)
