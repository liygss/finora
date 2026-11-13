"""
Wrapper tipis di atas library `ollama` untuk chat completion.

Mendukung dua mode:
- Cloud (Ollama Cloud / ollama.com): otomatis aktif kalau OLLAMA_API_KEY di-set.
  Client mengirim header Authorization: Bearer <key> ke OLLAMA_BASE_URL.
- Lokal: OLLAMA_API_KEY kosong, base URL menunjuk ke http://localhost:11434.

Kalau provider utama gagal (mis. kuota cloud habis), service otomatis mencoba
Ollama lokal lewat OLLAMA_FALLBACK_* supaya chat tetap bisa dipakai.

Embedding TIDAK lewat service ini lagi — pindah ke app/llm/embedding_service.py
(karena Ollama Cloud tidak mendukung model embedding, dan embedding lokal via
fastembed lebih cocok untuk aplikasi desktop).
"""

import threading
import time

from ollama import Client

from app.config.logging import get_logger
from app.config.settings import settings

logger = get_logger(__name__)

_clients: dict[tuple[str, str, int], Client] = {}
_clients_lock = threading.Lock()


def get_client(
    base_url: str | None = None,
    api_key: str | None = None,
    timeout: int | None = None,
) -> Client:
    host = str(base_url or settings.OLLAMA_BASE_URL).rstrip("/")
    key = (settings.OLLAMA_API_KEY if base_url is None else api_key) or ""
    client_timeout = timeout or settings.OLLAMA_TIMEOUT
    cache_key = (host, key, client_timeout)

    with _clients_lock:
        client = _clients.get(cache_key)
        if client is None:
            headers = {"Authorization": f"Bearer {key}"} if key else {}
            client = Client(host=host, timeout=client_timeout, headers=headers)
            _clients[cache_key] = client
        return client


class OllamaError(Exception):
    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        quota_exceeded: bool = False,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.quota_exceeded = quota_exceeded


def _is_quota_error(exc: Exception) -> bool:
    if getattr(exc, "status_code", None) == 402:
        return True
    text = str(exc).lower()
    return any(
        marker in text
        for marker in ("usage credits", "payment required", "subscribe")
    )


def _call_model(
    client: Client,
    model: str,
    messages: list[dict[str, str]],
    temperature: float,
) -> str:
    last_exc: Exception | None = None
    for attempt in range(2):
        try:
            response = client.chat(
                model=model,
                messages=messages,
                options={"temperature": temperature},
            )
            return response["message"]["content"]
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            # Kuota habis tidak akan pulih dengan retry; langsung fallback.
            if _is_quota_error(exc) or attempt == 1:
                break
            time.sleep(1)

    assert last_exc is not None
    raise last_exc


def chat_completion(
    messages: list[dict[str, str]],
    model: str | None = None,
    temperature: float = 0.2,
) -> str:
    """
    messages: list of {"role": "system"|"user"|"assistant", "content": "..."}
    temperature rendah (0.2) dipakai default karena ini use case akuntansi/pajak
    yang butuh jawaban konsisten & tidak terlalu "kreatif".
    """
    primary_model = model or settings.OLLAMA_MODEL
    primary_failure: Exception | None = None

    try:
        return _call_model(get_client(), primary_model, messages, temperature)
    except Exception as exc:  # noqa: BLE001
        primary_failure = exc
        logger.error(
            "Gagal mendapatkan chat completion dari provider utama: %s",
            exc,
        )

    assert primary_failure is not None
    fallback_exc: Exception | None = None
    if settings.ollama_fallback_available:
        try:
            fallback_client = get_client(
                base_url=str(settings.OLLAMA_FALLBACK_BASE_URL),
                api_key="",
                timeout=settings.OLLAMA_FALLBACK_TIMEOUT,
            )
            logger.warning(
                "Mencoba fallback Ollama lokal (%s / %s).",
                settings.OLLAMA_FALLBACK_BASE_URL,
                settings.OLLAMA_FALLBACK_MODEL,
            )
            return _call_model(
                fallback_client,
                settings.OLLAMA_FALLBACK_MODEL,
                messages,
                temperature,
            )
        except Exception as exc:  # noqa: BLE001
            fallback_exc = exc
            logger.error("Fallback Ollama lokal juga gagal: %s", exc)

    detail = str(primary_failure)
    if fallback_exc is not None:
        detail = f"{detail} | fallback: {fallback_exc}"
    raise OllamaError(
        f"Layanan AI tidak tersedia: {detail}",
        status_code=getattr(primary_failure, "status_code", None),
        quota_exceeded=_is_quota_error(primary_failure),
    ) from primary_failure


def check_ollama_available() -> bool:
    try:
        get_client().list()
        return True
    except Exception:  # noqa: BLE001
        return False
