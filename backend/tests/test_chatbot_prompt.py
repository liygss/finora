"""Tes untuk prompt chatbot: prompt umum + konteks halaman aktif + boosting pajak."""

from app.llm.prompt_template import get_system_prompt
from app.rag.context_builder import build_context
from app.rag.prompt_builder import build_messages, detect_domain, is_out_of_topic
from app.rag.rag_pipeline import merge_chunks
from app.rag.retriever import RetrievedChunk
from app.schemas.chatbot_schema import ChatRequest


def _empty_context():
    return build_context([])


def _chunk(pid: str) -> RetrievedChunk:
    return RetrievedChunk(
        qdrant_point_id=pid,
        score=1.0,
        content="isi",
        heading=None,
        source_filename="x.md",
        source_file_id="f",
        category="tax",
    )


def test_system_prompt_membatasi_topik_akuntansi():
    prompt = get_system_prompt().lower()
    assert "asisten finora" in prompt
    # membantu pertanyaan akuntansi/keuangan/pajak DAN aplikasi finora
    assert "membantu pertanyaan" in prompt
    assert "aplikasi finora" in prompt
    # menolak pertanyaan di luar topik
    assert "tolak dengan sopan" in prompt


def test_build_messages_termasuk_lokasi_halaman():
    messages = build_messages("cara input jurnal?", _empty_context(), [], None, page="Jurnal Umum")
    system = messages[0]["content"]
    assert "Lokasi pengguna saat ini: halaman Jurnal Umum" in system
    assert messages[-1]["role"] == "user"
    assert messages[-1]["content"] == "cara input jurnal?"


def test_build_messages_tanpa_page_tidak_menambah_lokasi():
    messages = build_messages("halo", _empty_context(), [], None, page=None)
    assert "Lokasi pengguna saat ini" not in messages[0]["content"]


def test_build_messages_tanpa_konteks_mengarahkan_tolak_topik_lain():
    messages = build_messages("jelaskan apa itu inflasi", _empty_context())
    system = messages[0]["content"].lower()
    assert "tolak dengan sopan" in system
    assert "di luar topik akuntansi" in system
    assert "aplikasi finora" in system


def test_chat_request_menerima_page():
    req = ChatRequest(message="halo", page="Dashboard")
    assert req.page == "Dashboard"
    assert req.session_id is None


def test_detect_domain_pajak():
    assert detect_domain("Isi SPT 1770 apa saja?") == "tax"
    assert detect_domain("Berapa tarif PPN 12%?") == "tax"
    assert detect_domain("cara buat id billing") == "tax"
    assert detect_domain("berapa pajak penjualan Rp 100 juta?") == "tax"


def test_detect_domain_laporan_tidak_salah_jadi_pajak():
    assert detect_domain("tampilkan laporan penjualan bulan ini") != "tax"


def test_detect_domain_akuntansi():
    assert detect_domain("cara membuat jurnal penjualan") == "accounting"
    assert detect_domain("apa itu neraca saldo") == "accounting"


def test_detect_domain_umum():
    assert detect_domain("jelaskan apa itu inflasi") == ""


def test_detect_domain_aplikasi():
    assert detect_domain("cara upload data transaksi") == "app"
    assert detect_domain("fitur apa saja di finora") == "app"
    assert detect_domain("apa itu aplikasi finora") == "app"
    assert detect_domain("halaman dashboard") == "app"
    assert detect_domain("fitur chatbot") == "app"


def test_merge_chunks_dedupe():
    gabungan = merge_chunks([_chunk("a"), _chunk("b")], [_chunk("b"), _chunk("c")])
    ids = [c.qdrant_point_id for c in gabungan]
    assert ids == ["a", "b", "c"]


def test_is_out_of_topic_menolak_topik_di_luar_akuntansi():
    assert is_out_of_topic("aku lapar") is True
    assert is_out_of_topic("cuaca hari ini") is True
    assert is_out_of_topic("resep nasi goreng") is True
    assert is_out_of_topic("siapa presiden Indonesia") is True


def test_is_out_of_topic_menerima_topik_akuntansi():
    assert is_out_of_topic("jurnal transaksi") is False
    assert is_out_of_topic("pajak ppn") is False
    assert is_out_of_topic("laporan laba rugi") is False
    assert is_out_of_topic("neraca saldo") is False
    assert is_out_of_topic("cara pembukuan") is False


def test_is_out_of_topic_menerima_topik_aplikasi():
    assert is_out_of_topic("cara upload data") is False
    assert is_out_of_topic("fitur apa saja di finora") is False
    assert is_out_of_topic("apa itu aplikasi finora") is False
    assert is_out_of_topic("cara membuat jurnal") is False
    assert is_out_of_topic("bagaimana cara mengisi SPT") is False
    assert is_out_of_topic("halaman dashboard") is False
