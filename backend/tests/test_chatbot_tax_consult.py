"""Tes endpoint konsultasi pajak: hitung deterministik + penjelasan RAG."""

from app.rag.rag_pipeline import RagAnswer


def test_tax_consult_menghitung_pph_dan_ppn(auth_client, monkeypatch):
    def fake_ask(*args, **kwargs):
        raise AssertionError("perhitungan tanpa pertanyaan lanjutan tidak perlu LLM")

    monkeypatch.setattr("app.routers.chatbot.ask", fake_ask)

    resp = auth_client.post(
        "/chatbot/tax-consult",
        json={
            "wp_orang_pribadi": True,
            "omzet_bulan_ini": 600_000_000,
            "omzet_kumulatif_sebelum_bulan_ini": 0,
            "include_ppn": True,
            "nilai_transaksi": 5_000_000,
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["session_id"].startswith("local-")
    assert body["answer"].startswith("Berikut hasil perhitungan pajak Anda:")
    assert "PPh Final UMKM" in body["answer"]
    assert body["pph"]["omzet_kena_pajak"] == 100_000_000
    assert body["pph"]["pph_final_terutang"] == 500_000
    assert body["ppn"]["dasar_pengenaan_pajak"] == 5_000_000
    assert body["ppn"]["ppn"] == 550_000


def test_tax_consult_meneruskan_pertanyaan_lanjutan_ke_llm(auth_client, monkeypatch):
    captured = {}

    def fake_ask(db, user_id, session_id, pertanyaan, financial_context=None, page=None, context_label=None):
        captured["pertanyaan"] = pertanyaan
        return RagAnswer(session_id="sesi-lanjutan", answer="Jawaban Ollama", sources=[])

    monkeypatch.setattr("app.routers.chatbot.ask", fake_ask)

    resp = auth_client.post(
        "/chatbot/tax-consult",
        json={
            "omzet_bulan_ini": 10_000_000,
            "pertanyaan": "Apa itu Coretax?",
        },
    )

    assert resp.status_code == 200
    assert resp.json()["answer"] == "Jawaban Ollama"
    assert captured["pertanyaan"] == "Apa itu Coretax?"


def test_tax_consult_menolak_nilai_negatif(auth_client):
    resp = auth_client.post(
        "/chatbot/tax-consult",
        json={"omzet_bulan_ini": -1},
    )

    assert resp.status_code == 400


def test_tax_chat_mengekstrak_data_dan_menghitung(auth_client, monkeypatch):
    def fake_ask(*args, **kwargs):
        raise AssertionError("pertanyaan hitung harus dijawab deterministik tanpa LLM")

    monkeypatch.setattr("app.routers.chatbot.ask", fake_ask)

    resp = auth_client.post(
        "/chatbot/tax-chat",
        json={"message": "Omzet saya 600 juta, hitung PPh Final UMKM"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["session_id"].startswith("local-")
    assert body["answer"].startswith("Berikut hasil perhitungan pajak Anda:")
    assert "PPh Final UMKM" in body["answer"]
    assert body["calculation"]["pph"]["omzet_kena_pajak"] == 100_000_000
    assert body["calculation"]["pph"]["pph_final_terutang"] == 500_000
    assert body["calculation"]["ppn"] is None


def test_tax_chat_tanpa_data_hitung_tetap_dijawab_llm(auth_client, monkeypatch):
    monkeypatch.setattr(
        "app.routers.chatbot._extract_tax_params",
        lambda message: {"butuh_hitung": False},
    )
    monkeypatch.setattr(
        "app.routers.chatbot.ask",
        lambda *args, **kwargs: RagAnswer(session_id="sesi-bebas", answer="Penjelasan Coretax", sources=[]),
    )

    resp = auth_client.post("/chatbot/tax-chat", json={"message": "Apa itu Coretax?"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["answer"] == "Penjelasan Coretax"
    assert body["calculation"] is None


def test_coerce_amount_format_indonesia():
    from app.routers.chatbot import _coerce_amount

    assert _coerce_amount("25 juta") == 25_000_000
    assert _coerce_amount("1,5 juta") == 1_500_000
    assert _coerce_amount("Rp 25.000.000") == 25_000_000
    assert _coerce_amount(600_000_000) == 600_000_000
    assert _coerce_amount(None) is None


def test_extract_tax_params_locally_dari_omzet():
    from app.routers.chatbot import _extract_tax_params_locally

    params = _extract_tax_params_locally(
        "Omzet saya Rp 30 juta, berapa PPh Final UMKM saya?"
    )

    assert params["butuh_hitung"] is True
    assert params["wp_orang_pribadi"] is True
    assert params["omzet_bulan_ini"] == 30_000_000


def test_tax_chat_tetap_menghitung_saat_llm_gagal(auth_client, monkeypatch):
    from app.llm.ollama_service import OllamaError

    def raise_llm(*args, **kwargs):
        raise OllamaError("kuota habis")

    monkeypatch.setattr("app.routers.chatbot._extract_tax_params", raise_llm)
    monkeypatch.setattr("app.routers.chatbot.ask", raise_llm)

    resp = auth_client.post(
        "/chatbot/tax-chat",
        json={"message": "Omzet saya Rp 600 juta, berapa PPh Final UMKM saya?"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["session_id"].startswith("local-")
    assert body["calculation"]["pph"]["pph_final_terutang"] == 500_000
    assert "PPh Final UMKM" in body["answer"]
    assert "Ollama" not in body["answer"]


def test_tax_chat_error_llm_tanpa_perhitungan_tidak_menyebut_ollama(auth_client, monkeypatch):
    from app.llm.ollama_service import OllamaError

    def raise_llm(*args, **kwargs):
        raise OllamaError("kuota habis")

    monkeypatch.setattr("app.routers.chatbot._extract_tax_params", raise_llm)
    monkeypatch.setattr("app.routers.chatbot.ask", raise_llm)

    resp = auth_client.post("/chatbot/tax-chat", json={"message": "Apa itu Coretax?"})

    assert resp.status_code == 503
    assert "Ollama" not in resp.json()["detail"]


def test_ask_chat_menjawab_hitungan_pajak_deterministik(auth_client, monkeypatch):
    def fake_ask(*args, **kwargs):
        raise AssertionError("pertanyaan hitung tidak perlu LLM")

    monkeypatch.setattr("app.routers.chatbot.ask", fake_ask)

    resp = auth_client.post(
        "/chatbot/ask",
        json={"message": "Omzet saya Rp 30 juta, berapa PPh Final UMKM saya?"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["session_id"].startswith("local-")
    assert "PPh Final UMKM: Rp0" in body["answer"]
    assert "Maaf, saya tidak bisa membantu" not in body["answer"]
    assert body["has_financial_data"] is True
