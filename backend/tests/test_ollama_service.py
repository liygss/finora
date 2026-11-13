"""Tes fallback provider LLM dan error yang ramah untuk endpoint pajak."""

import pytest
from ollama import ResponseError

from app.config.settings import settings
from app.llm import ollama_service
from app.llm.ollama_service import OllamaError


class FakeClient:
    def __init__(self, response=None, error=None):
        self.response = response
        self.error = error

    def chat(self, **kwargs):
        if self.error is not None:
            raise self.error
        return {"message": {"content": self.response}}


def test_chat_completion_fallback_ke_lokal_saat_kuota_habis(monkeypatch):
    monkeypatch.setattr(settings, "OLLAMA_FALLBACK_ENABLED", True)
    monkeypatch.setattr(settings, "OLLAMA_BASE_URL", "https://ollama.com")
    monkeypatch.setattr(settings, "OLLAMA_FALLBACK_BASE_URL", "http://localhost:11434")

    primary = FakeClient(error=ResponseError("Add usage credits or subscribe", 402))
    fallback = FakeClient(response="jawaban lokal")

    def fake_get_client(base_url=None, api_key=None, timeout=None):
        return primary if base_url is None else fallback

    monkeypatch.setattr(ollama_service, "get_client", fake_get_client)

    hasil = ollama_service.chat_completion([{"role": "user", "content": "Halo"}])

    assert hasil == "jawaban lokal"


def test_chat_completion_melempar_ollama_error_bukan_retry_error(monkeypatch):
    monkeypatch.setattr(settings, "OLLAMA_FALLBACK_ENABLED", True)
    monkeypatch.setattr(settings, "OLLAMA_BASE_URL", "https://ollama.com")
    monkeypatch.setattr(settings, "OLLAMA_FALLBACK_BASE_URL", "http://localhost:11434")

    primary = FakeClient(error=ResponseError("Add usage credits or subscribe", 402))
    fallback = FakeClient(error=ConnectionError("localhost:11434 refused"))

    def fake_get_client(base_url=None, api_key=None, timeout=None):
        return primary if base_url is None else fallback

    monkeypatch.setattr(ollama_service, "get_client", fake_get_client)

    with pytest.raises(OllamaError) as exc_info:
        ollama_service.chat_completion([{"role": "user", "content": "Halo"}])

    assert exc_info.value.quota_exceeded is True
    assert exc_info.value.status_code == 402
    assert "RetryError" not in type(exc_info.value).__name__


def test_chat_completion_tidak_fallback_saat_provider_utama_sukses(monkeypatch):
    monkeypatch.setattr(settings, "OLLAMA_FALLBACK_ENABLED", True)
    monkeypatch.setattr(settings, "OLLAMA_BASE_URL", "https://ollama.com")
    monkeypatch.setattr(settings, "OLLAMA_FALLBACK_BASE_URL", "http://localhost:11434")

    primary = FakeClient(response="jawaban cloud")

    def fake_get_client(base_url=None, api_key=None, timeout=None):
        assert base_url is None
        return primary

    monkeypatch.setattr(ollama_service, "get_client", fake_get_client)

    hasil = ollama_service.chat_completion([{"role": "user", "content": "Halo"}])

    assert hasil == "jawaban cloud"
