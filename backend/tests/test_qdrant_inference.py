"""Tes jalur Qdrant Cloud Inference (EMBEDDING_PROVIDER=qdrant).

Dengan provider ini backend TIDAK memuat model embedding: teks dikirim apa
 adanya ke Qdrant, yang membuat vektornya di sisi server. Itu yang membuat
chatbot bebas cold start di serverless.

Yang dikunci test ini:
- retriever & ingestion benar-benar mengirim TEKS, bukan memanggil get_embedding
- model/collection/dimensi diambil dari konfigurasi
- kegagalan Qdrant tetap degrade jadi [], bukan HTTP 500
- cache embedding lokal tidak lagi dipakai lintas-model
"""

import threading

import pytest
from qdrant_client.models import Distance, VectorParams

from app.llm import embedding_service
from app.rag import retriever
from app.services.ingestion import embedding as embedding_cache
from app.services.ingestion import ingestion_pipeline, qdrant_service


@pytest.fixture(autouse=True)
def _provider_qdrant(monkeypatch):
    """Paksa provider 'qdrant' dan bersihkan cache dimensi (lru_cache)."""
    monkeypatch.setattr(embedding_service.settings, "EMBEDDING_PROVIDER", "qdrant")
    embedding_service.embedding_dimensions.cache_clear()
    yield
    embedding_service.embedding_dimensions.cache_clear()


@pytest.fixture(autouse=True)
def _reset_embedding_state():
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


def test_uses_qdrant_inference_hanya_saat_provider_qdrant(monkeypatch):
    assert embedding_service.uses_qdrant_inference() is True
    monkeypatch.setattr(embedding_service.settings, "EMBEDDING_PROVIDER", "fastembed")
    assert embedding_service.uses_qdrant_inference() is False


def test_versi_client_qdrant_dukung_cloud_inference():
    """cloud_inference=True itu wajib;Tanpanya client mencoba fastembed lokal."""
    import inspect

    from qdrant_client import QdrantClient

    assert "cloud_inference" in inspect.signature(QdrantClient.__init__).parameters


def test_dimensi_embedding_diambil_dari_konfigurasi(monkeypatch):
    """Tidak bisa probe vektor (Qdrant yang megang), jadi ambil dari setting."""
    monkeypatch.setattr(embedding_service.settings, "QDRANT_VECTOR_SIZE", 384)
    embedding_service.embedding_dimensions.cache_clear()

    def _should_not_be_called(*a, **k):  # pragma: no cover - bila dipanggil test gagal
        raise AssertionError("provider qdrant tidak boleh memuat model lokal")

    monkeypatch.setattr(embedding_service, "get_embedding", _should_not_be_called)

    assert embedding_service.embedding_dimensions() == 384


def test_get_embedding_melempar_pesan_jelas_untuk_provider_qdrant():
    """get_embedding tidak bisa dipakai di provider ini; error harus ACTIONABLE."""
    with pytest.raises(embedding_service.EmbeddingError) as exc:
        embedding_service.get_embedding("apa itu jurnal umum")

    msg = str(exc.value)
    assert "search_by_text" in msg
    assert "upsert_documents" in msg


def test_embedding_selalu_siap_tanpa_model_lokal():
    """Tidak ada model yang perlu dimuat, jadi tidak mungkin 'belum warm'."""
    assert embedding_service.is_embedding_ready() is True
    assert embedding_service.warm_up_embedding_model() is True


def test_retrieve_mengirim_teks_tanpa_memuat_model(monkeypatch):
    """Titik kunci: query dikirim apa adanya ke Qdrant sebagai teks."""
    captured: dict = {}

    def _fake_search_by_text(query, top_k=None, category=None):
        captured.update(query=query, top_k=top_k, category=category)
        return [
            {
                "id": "point-1",
                "score": 0.9,
                "payload": {
                    "content": "Jurnal umum mencatat transaksi debit dan kredit.",
                    "heading": "Jurnal Umum",
                    "source_filename": "06_jurnal_umum.md",
                    "source_file_id": "file-1",
                    "category": "akuntansi",
                },
            }
        ]

    def _tidak_boleh_embed(*a, **k):  # pragma: no cover
        raise AssertionError("provider qdrant tidak boleh memanggil get_embedding")

    monkeypatch.setattr(retriever, "get_embedding", _tidak_boleh_embed)
    monkeypatch.setattr(retriever.qdrant_service, "search_by_text", _fake_search_by_text)
    monkeypatch.setattr(
        retriever.qdrant_service, "search", _tidak_boleh_embed
    )

    hasil = retriever.retrieve("apa itu jurnal umum", top_k=3, category="akuntansi")

    assert captured["query"] == "apa itu jurnal umum"
    assert captured["top_k"] == 3
    assert captured["category"] == "akuntansi"
    assert len(hasil) == 1
    assert hasil[0].source_filename == "06_jurnal_umum.md"


def test_retrieve_mengembalikan_kosong_kala_qdrant_inference_gagal(monkeypatch):
    def _boom(*args, **kwargs):
        raise RuntimeError("model inference Qdrant ditolak")

    monkeypatch.setattr(retriever.qdrant_service, "search_by_text", _boom)
    assert retriever.retrieve("apa itu jurnal umum") == []


def test_search_by_text_mengirim_document_dengan_model_inference(monkeypatch):
    """Dokumentasi Qdrant: query harus berupa Document(text=..., model=...)."""
    monkeypatch.setattr(embedding_service.settings, "QDRANT_INFERENCE_MODEL", "intfloat/multilingual-e5-small")

    class _Points:
        points = []

    class _Result:
        @staticmethod
        def query_points(**kwargs):
            _Result.kwargs = kwargs
            return _Points()

    class _FakeClient:
        get_collections = staticmethod(lambda: type("C", (), {"collections": []})())
        query_points = staticmethod(_Result.query_points)

    monkeypatch.setattr(qdrant_service, "get_qdrant_client", lambda: _FakeClient())
    monkeypatch.setattr(qdrant_service, "ensure_collection", lambda: None)

    assert qdrant_service.search_by_text("apa itu jurnal umum", top_k=5) == []

    query = _Result.kwargs["query"]
    assert query.text == "apa itu jurnal umum"
    assert query.model == "intfloat/multilingual-e5-small"
    assert _Result.kwargs["limit"] == 5


def test_upsert_documents_mengirim_document_bukan_vektor(monkeypatch):
    monkeypatch.setattr(embedding_service.settings, "QDRANT_INFERENCE_MODEL", "intfloat/multilingual-e5-small")

    class _FakeClient:
        get_collections = staticmethod(lambda: type("C", (), {"collections": []})())
        upserted: list = []

        @classmethod
        def upsert(cls, **kwargs):
            cls.upserted.append(kwargs["points"])

    fake = _FakeClient()
    monkeypatch.setattr(qdrant_service, "get_qdrant_client", lambda: fake)
    monkeypatch.setattr(qdrant_service, "ensure_collection", lambda: None)

    point_ids = qdrant_service.upsert_documents(
        ["isi chunk satu", "isi chunk dua"],
        [
            {"content": "isi chunk satu", "source_file_id": "f1", "source_filename": "a.md", "chunk_index": 0, "category": "umum"},
            {"content": "isi chunk dua", "source_file_id": "f1", "source_filename": "a.md", "chunk_index": 1, "category": "umum"},
        ],
    )

    assert len(point_ids) == 2
    points = fake.upserted[0]
    assert len(points) == 2
    # Vektor harus Document (teks), bukan list[float].
    assert points[0].vector.text == "isi chunk satu"
    assert points[0].vector.model == "intfloat/multilingual-e5-small"


def test_upsert_documents_menolak_panjang_tidak_seimbang():
    with pytest.raises(ValueError, match="harus sama"):
        qdrant_service.upsert_documents(["a", "b"], [{"content": "a"}])


def test_ensure_collection_memakai_dimensi_konfigurasi(monkeypatch):
    """Collection baru harus 384 (E5), bukan hasil probe yang bisa gagal."""
    created: dict = {}

    class _FakeClient:
        get_collections = staticmethod(lambda: type("C", (), {"collections": []})())
        create_payload_index = staticmethod(lambda **k: None)

        @staticmethod
        def create_collection(**kwargs):
            created.update(kwargs)

    monkeypatch.setattr(qdrant_service, "get_qdrant_client", lambda: _FakeClient())
    monkeypatch.setattr(embedding_service.settings, "QDRANT_VECTOR_SIZE", 384)
    monkeypatch.setattr(
        embedding_service.settings, "QDRANT_COLLECTION_NAME", "accounting_knowledge_test"
    )
    embedding_service.embedding_dimensions.cache_clear()

    qdrant_service.ensure_collection()

    assert created["collection_name"] == "accounting_knowledge_test"
    assert created["vectors_config"].size == 384
    assert created["vectors_config"].distance == Distance.COSINE
    assert isinstance(created["vectors_config"], VectorParams)


def test_ingest_markdown_mengirim_teks_bukan_vektor(monkeypatch):
    """Pipeline ingestion harus melewati embed_chunks saat provider qdrant."""
    documents: dict = {}

    def _tidak_boleh_embed(texts):  # pragma: no cover
        raise AssertionError("embed_chunks tidak boleh dipanggil saat provider qdrant")

    def _fake_upsert_documents(contents, payloads):
        documents.update(contents=contents, payloads=payloads)
        return [f"point-{i}" for i in range(len(contents))]

    def _tidak_boleh_upsert_vektor(*a, **k):  # pragma: no cover
        raise AssertionError("upsert_chunks tidak boleh dipanggil saat provider qdrant")

    monkeypatch.setattr(ingestion_pipeline, "embed_chunks", _tidak_boleh_embed)
    monkeypatch.setattr(ingestion_pipeline.qdrant_service, "upsert_documents", _fake_upsert_documents)
    monkeypatch.setattr(ingestion_pipeline.qdrant_service, "upsert_chunks", _tidak_boleh_upsert_vektor)
    monkeypatch.setattr(ingestion_pipeline, "build_chunk_metadata", lambda **k: type(
        "M", (), {
            "source_file_id": "f1", "source_filename": "a.md", "chunk_index": 0,
            "category": "umum", "uploaded_at": "2026-01-01",
        }
    )())

    class _FakeFile:
        id = "f1"
        original_filename = "a.md"

    class _FakeDB:
        def __init__(self):
            self.added = []

        def add(self, obj):
            self.added.append(obj)

        def commit(self):
            pass

    db = _FakeDB()
    total = ingestion_pipeline._ingest_markdown_text(
        db, _FakeFile(), "# Judul\n\nJurnal umum adalah pencatatan transaksi.", "a"
    )

    assert total == 1
    assert documents["contents"]
    assert len(documents["payloads"]) == len(documents["contents"])
    assert len(db.added) == 1


def test_cache_embedding_diabaikan_antarmodel(monkeypatch, tmp_path):
    """Ganti model -> fingerprint beda -> cache lama tidak boleh dipakai diam-diam."""
    monkeypatch.setattr(embedding_cache.settings, "EMBEDDINGS_DIR", str(tmp_path))
    monkeypatch.setattr(
        embedding_cache.settings, "EMBEDDING_PROVIDER", "fastembed", raising=False
    )
    monkeypatch.setattr(embedding_cache.settings, "EMBEDDING_MODEL", "model-lama")
    monkeypatch.setattr(embedding_cache.settings, "QDRANT_INFERENCE_MODEL", "intfloat/multilingual-e5-small")

    # Seed cache dengan model "lama".
    path = embedding_cache._cache_path()
    import json

    path.write_text(json.dumps({"fingerprint": "deadbeef", "entries": {"abc": [0.1, 0.2]}}))
    assert embedding_cache._load_cache() == {}

    # Seed cache dengan fingerprint yang cocok -> dipakai.
    path.write_text(json.dumps({
        "fingerprint": embedding_cache._cache_fingerprint(),
        "entries": {"abc": [0.1, 0.2]},
    }))
    assert embedding_cache._load_cache() == {"abc": [0.1, 0.2]}

    # Ganti model lagi -> harus dianggap cache milik model lain.
    monkeypatch.setattr(embedding_cache.settings, "EMBEDDING_MODEL", "model-baru")
    assert embedding_cache._load_cache() == {}


def test_cache_lama_tanpa_fingerprint_ditolak(monkeypatch, tmp_path):
    """Format cache lama (v1) tidak punya fingerprint -> rebuild, bukan salah baca."""
    import json

    monkeypatch.setattr(embedding_cache.settings, "EMBEDDINGS_DIR", str(tmp_path))
    embedding_cache._cache_path().write_text(json.dumps({"abc": [0.1, 0.2]}))
    assert embedding_cache._load_cache() == {}
