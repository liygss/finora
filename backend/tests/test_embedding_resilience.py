"""Tes ketahanan RAG di serverless: model embedding & Qdrant gagal = chatbot tetap jalan.

Di Vercel filesystem read-only dan model fastembed (~241MB) harus diunduh saat
instance baru nyala. Test ini mengunci graceful degradation supaya tidak balik
jadi HTTP 500 / request menggantung.
"""

import threading

import pytest

from app.llm import embedding_service
from app.rag import retriever


@pytest.fixture(autouse=True)
def _reset_embedding_state():
    """Pastikan state global embedding bersih sebelum/sesudah tiap test."""
    saved = (
        embedding_service._fastembed_model,
        embedding_service._model_ready,
        embedding_service._load_started,
        embedding_service._load_error,
    )
    embedding_service._fastembed_model = None
    embedding_service._model_ready = threading.Event()
    embedding_service._load_started = False
    embedding_service._load_error = None
    yield
    (
        embedding_service._fastembed_model,
        embedding_service._model_ready,
        embedding_service._load_started,
        embedding_service._load_error,
    ) = saved


def test_retrieve_kembalikan_kosong_kala_embedding_gagal(monkeypatch):
    """Embedding gagal -> [] bukan exception (supaya tidak jadi 500)."""

    def _boom(*args, **kwargs):
        raise embedding_service.EmbeddingError("model belum siap")

    monkeypatch.setattr(retriever, "get_embedding", _boom)
    assert retriever.retrieve("apa itu jurnal umum") == []


def test_retrieve_kembalikan_kosong_kala_qdrant_gagal(monkeypatch):
    """Qdrant tidak terjangkau -> [] bukan exception."""
    monkeypatch.setattr(retriever, "get_embedding", lambda *a, **k: [0.0, 1.0, 0.0])

    def _boom(*args, **kwargs):
        raise RuntimeError("Qdrant tidak terhubung")

    monkeypatch.setattr(retriever.qdrant_service, "search", _boom)
    assert retriever.retrieve("apa itu jurnal umum") == []


def test_get_fastembed_model_melempar_bila_melewati_batas_waktu(monkeypatch):
    """Cold start: model belum siap -> error TERKENDALI, bukan hang."""

    # Simulasikan model yang belum selesai diunduh.
    embedding_service._model_ready = threading.Event()
    embedding_service._load_started = True  # pretend sedang di-load di thread lain

    with pytest.raises(embedding_service.EmbeddingUnavailableError):
        embedding_service.get_fastembed_model(max_wait=0.05)


def test_unavailable_error_turunan_embedding_error():
    """Supaya penangkap exception upstream (`except EmbeddingError`) tetap berlaku."""
    assert issubclass(embedding_service.EmbeddingUnavailableError, embedding_service.EmbeddingError)


def test_warm_up_hanya_menjalankan_thread_satu_kali(monkeypatch):
    """Pemanasan harus idempotent, tidak spawn thread berulang tiap request."""
    started: list[bool] = []
    monkeypatch.setattr(
        embedding_service.threading,
        "Thread",
        lambda *a, **k: started.append(True) or type("T", (), {"start": lambda self: None})(),
    )

    assert embedding_service.warm_up_embedding_model() is False
    assert embedding_service.warm_up_embedding_model() is False
    assert len(started) == 1
