from datetime import date, timedelta

from app.accounting.anomaly_detection import (
    detect_from_journals,
    render_anomaly_context,
)
from app.database.models import (
    Akun,
    JurnalDetail,
    JurnalUmum,
    KategoriAkun,
    SaldoNormal,
    User,
)
from app.services.data_context_service import _detect_intent


def _buat_user(db):
    user = User(email="anomali@example.com", hashed_password="x", full_name="Anomali User")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _buat_akun(db, kode, nama, kategori=KategoriAkun.ASET, saldo=SaldoNormal.DEBIT, aktif=True):
    akun = Akun(
        kode_akun=kode,
        nama_akun=nama,
        kategori=kategori,
        saldo_normal=saldo,
        is_active=aktif,
    )
    db.add(akun)
    db.commit()
    db.refresh(akun)
    return akun


def _buat_jurnal(db, user, no_bukti, tanggal, deskripsi, akun_debit, akun_kredit, nominal):
    jurnal = JurnalUmum(
        no_bukti=no_bukti,
        tanggal=tanggal,
        deskripsi=deskripsi,
        created_by_id=user.id,
    )
    db.add(jurnal)
    db.commit()
    db.refresh(jurnal)
    db.add_all([
        JurnalDetail(jurnal_id=jurnal.id, akun_id=akun_debit.id, debit=nominal, kredit=0, urutan=0),
        JurnalDetail(jurnal_id=jurnal.id, akun_id=akun_kredit.id, debit=0, kredit=nominal, urutan=1),
    ])
    db.commit()
    return jurnal


def test_detect_jurnal_tidak_balance(db):
    user = _buat_user(db)
    kas = _buat_akun(db, "1-1000", "Kas")
    pendapatan = _buat_akun(
        db, "4-1000", "Pendapatan", KategoriAkun.PENDAPATAN, SaldoNormal.KREDIT
    )
    jurnal = JurnalUmum(
        no_bukti="BUKTI-1",
        tanggal=date.today(),
        deskripsi="Jual barang",
        created_by_id=user.id,
    )
    db.add(jurnal)
    db.commit()
    db.add_all([
        JurnalDetail(jurnal_id=jurnal.id, akun_id=kas.id, debit=100_000, kredit=0, urutan=0),
        JurnalDetail(jurnal_id=jurnal.id, akun_id=pendapatan.id, debit=0, kredit=90_000, urutan=1),
    ])
    db.commit()

    temuan = detect_from_journals(db, user.id)

    assert any(t.jenis == "Jurnal tidak balance" and t.nominal == 10_000 for t in temuan)


def test_detect_transaksi_duplikat(db):
    user = _buat_user(db)
    kas = _buat_akun(db, "1-1000", "Kas")
    pendapatan = _buat_akun(
        db, "4-1000", "Pendapatan", KategoriAkun.PENDAPATAN, SaldoNormal.KREDIT
    )
    tanggal = date.today() - timedelta(days=1)
    _buat_jurnal(db, user, "BUKTI-1", tanggal, "Jual kopi", kas, pendapatan, 50_000)
    _buat_jurnal(db, user, "BUKTI-2", tanggal, "Jual kopi", kas, pendapatan, 50_000)

    temuan = detect_from_journals(db, user.id)

    assert any(t.jenis == "Transaksi duplikat" and "BUKTI-1" in t.no_bukti for t in temuan)


def test_detect_nominal_outlier(db):
    user = _buat_user(db)
    kas = _buat_akun(db, "1-1000", "Kas")
    pendapatan = _buat_akun(
        db, "4-1000", "Pendapatan", KategoriAkun.PENDAPATAN, SaldoNormal.KREDIT
    )
    hari = date.today()
    for index, nominal in enumerate([100_000, 110_000, 90_000, 105_000, 9_000_000], start=1):
        _buat_jurnal(
            db, user, f"BUKTI-{index}", hari - timedelta(days=index),
            f"Transaksi {index}", kas, pendapatan, nominal,
        )

    temuan = detect_from_journals(db, user.id)

    assert any(t.jenis == "Nominal outlier" and t.nominal == 9_000_000 for t in temuan)


def test_detect_tanggal_akun_dan_baris_invalid(db):
    user = _buat_user(db)
    akun_nonaktif = _buat_akun(db, "1-1999", "Kas Lama", aktif=False)
    jurnal = JurnalUmum(
        no_bukti="BUKTI-1",
        tanggal=date.today() + timedelta(days=3),
        deskripsi="Transaksi besok",
        created_by_id=user.id,
    )
    db.add(jurnal)
    db.commit()
    db.add(JurnalDetail(
        jurnal_id=jurnal.id, akun_id=akun_nonaktif.id, debit=10_000, kredit=0, urutan=0
    ))
    db.commit()

    temuan = detect_from_journals(db, user.id)
    jenis = {t.jenis for t in temuan}

    assert "Tanggal di masa depan" in jenis
    assert "Akun nonaktif digunakan" in jenis
    assert "Jumlah baris tidak lazim" in jenis


def test_render_anomali_tanpa_temuan():
    hasil = render_anomaly_context([], "jurnal tersimpan")

    assert "Tidak ditemukan anomali" in hasil
    assert "Daftar ini bersifat tertutup" in hasil


def test_intent_anomali_terdeteksi():
    assert "anomali" in _detect_intent("apakah ada data yang anomali?")
    assert "anomali" in _detect_intent("ada transaksi kembar?")


def test_ask_chat_anomali_menggunakan_hasil_pemeriksaan(auth_client, db, monkeypatch):
    captured = {}

    def fake_llm(messages):
        captured["system"] = messages[0]["content"]
        return "Ada satu jurnal yang belum balance."

    monkeypatch.setattr("app.rag.rag_pipeline.retrieve", lambda *args, **kwargs: [])
    monkeypatch.setattr("app.rag.rag_pipeline.chat_completion", fake_llm)

    user = db.query(User).filter(User.email == "test@example.com").first()
    kas = _buat_akun(db, "1-1000", "Kas")
    pendapatan = _buat_akun(
        db, "4-1000", "Pendapatan", KategoriAkun.PENDAPATAN, SaldoNormal.KREDIT
    )
    jurnal = JurnalUmum(
        no_bukti="BUKTI-ANOMALI",
        tanggal=date.today(),
        deskripsi="Jual barang",
        created_by_id=user.id,
    )
    db.add(jurnal)
    db.commit()
    db.add_all([
        JurnalDetail(jurnal_id=jurnal.id, akun_id=kas.id, debit=100_000, kredit=0, urutan=0),
        JurnalDetail(jurnal_id=jurnal.id, akun_id=pendapatan.id, debit=0, kredit=90_000, urutan=1),
    ])
    db.commit()

    resp = auth_client.post("/chatbot/ask", json={"message": "apakah ada data yang anomali?"})

    assert resp.status_code == 200
    assert "Hasil Pemeriksaan Anomali" in captured["system"]
    assert "Jurnal tidak balance" in captured["system"]
    assert "maaf" not in resp.json()["answer"].lower()
