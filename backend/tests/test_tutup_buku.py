"""Tests untuk fitur Tutup Buku (closing entries tahunan)."""

from datetime import date

import pandas as pd
import pytest

from app.database.models import (
    Akun,
    JenisJurnal,
    JurnalDetail,
    JurnalUmum,
    KategoriAkun,
    SaldoNormal,
    TutupBuku,
    UploadedFile,
    User,
)


def _get_user(db) -> User:
    return db.query(User).filter(User.email == "test@example.com").one()


def _seed_akun(db):
    akun_rows = [
        ("1-1000", "Kas", KategoriAkun.ASET, SaldoNormal.DEBIT),
        ("3-1000", "Modal Pemilik", KategoriAkun.MODAL, SaldoNormal.KREDIT),
        ("3-2000", "Prive", KategoriAkun.MODAL, SaldoNormal.DEBIT),
        ("3-3000", "Laba Ditahan", KategoriAkun.MODAL, SaldoNormal.KREDIT),
        ("4-1000", "Pendapatan Penjualan", KategoriAkun.PENDAPATAN, SaldoNormal.KREDIT),
        ("5-2000", "Beban Gaji", KategoriAkun.BEBAN, SaldoNormal.DEBIT),
        ("5-9000", "Beban Lain-lain", KategoriAkun.BEBAN, SaldoNormal.DEBIT),
    ]
    for kode, nama, kategori, saldo_normal in akun_rows:
        db.add(Akun(kode_akun=kode, nama_akun=nama, kategori=kategori, saldo_normal=saldo_normal, is_active=True))
    db.commit()


def _jurnal(db, user, no_bukti, tanggal, deskripsi, lines):
    j = JurnalUmum(
        no_bukti=no_bukti,
        tanggal=tanggal,
        deskripsi=deskripsi,
        jenis=JenisJurnal.UMUM,
        created_by_id=user.id,
    )
    for i, (kode, debit, kredit) in enumerate(lines):
        akun = db.query(Akun).filter(Akun.kode_akun == kode).one()
        j.detail.append(JurnalDetail(akun_id=akun.id, urutan=i, debit=debit, kredit=kredit))
    db.add(j)
    return j


def _seed_tahun_2025(db, user):
    _seed_akun(db)
    # Kas 8jt masuk dari penjualan; 3jt gaji keluar; 500rb prive.
    _jurnal(db, user, "JU-2025-001", date(2025, 6, 15), "Penjualan tunai", [
        ("1-1000", 8_000_000, 0),
        ("4-1000", 0, 8_000_000),
    ])
    _jurnal(db, user, "JU-2025-002", date(2025, 7, 10), "Bayar gaji", [
        ("5-2000", 3_000_000, 0),
        ("1-1000", 0, 3_000_000),
    ])
    _jurnal(db, user, "JU-2025-003", date(2025, 8, 5), "Prive pemilik", [
        ("3-2000", 500_000, 0),
        ("1-1000", 0, 500_000),
    ])
    db.commit()


class TestTutupBukuStatusReview:
    def test_status_punya_data_2025_belum_ditutup(self, auth_client, db):
        user = _get_user(db)
        _seed_tahun_2025(db, user)
        resp = auth_client.get("/accounting/tutup-buku/status")
        assert resp.status_code == 200
        rows = resp.json()
        assert any(r["tahun"] == 2025 and r["is_closed"] is False for r in rows)

    def test_review_menghitung_laba_dan_prive(self, auth_client, db):
        user = _get_user(db)
        _seed_tahun_2025(db, user)
        resp = auth_client.get("/accounting/tutup-buku/2025/review")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total_pendapatan"] == 8_000_000.0
        assert body["total_beban"] == 3_000_000.0
        assert body["laba_bersih"] == 5_000_000.0
        assert body["prive"] == 500_000.0


class TestTutupBukuClose:
    def test_tutup_buku_membuat_jurnal_penutup(self, auth_client, db):
        user = _get_user(db)
        _seed_tahun_2025(db, user)
        resp = auth_client.post("/accounting/tutup-buku", json={"tahun": 2025})
        assert resp.status_code == 201
        body = resp.json()
        assert body["tahun"] == 2025
        assert body["laba_bersih"] == 5_000_000.0
        assert body["jurnal_penutup_no_bukti"].startswith("PBK-2025-")
        assert body["jurnal_prive_no_bukti"].startswith("PBK-2025-")

        # Status jadi closed + laba tercatat.
        status = auth_client.get("/accounting/tutup-buku/status").json()
        row = next(r for r in status if r["tahun"] == 2025)
        assert row["is_closed"] is True
        assert row["laba_bersih"] == 5_000_000.0

        # Akun P&L tahun 2025 sudah nol di neraca saldo per 31-12-2025.
        ns = auth_client.get("/accounting/laporan/neraca-saldo", params={"tanggal_per": "2025-12-31"}).json()
        pnl = {b["kode_akun"]: (b["debit"] or 0) - (b["kredit"] or 0) for b in ns["baris"]}
        assert pnl["4-1000"] == 0.0
        assert pnl["5-2000"] == 0.0

    def test_double_close_ditolak_409(self, auth_client, db):
        user = _get_user(db)
        _seed_tahun_2025(db, user)
        assert auth_client.post("/accounting/tutup-buku", json={"tahun": 2025}).status_code == 201
        resp = auth_client.post("/accounting/tutup-buku", json={"tahun": 2025})
        assert resp.status_code == 409

    def test_tutup_buku_tanpa_aktivitas_ditolak(self, auth_client, db):
        user = _get_user(db)
        _seed_akun(db)
        resp = auth_client.post("/accounting/tutup-buku", json={"tahun": 2025})
        assert resp.status_code == 400


class TestPenguncianPeriode:
    def test_jurnal_tahun_ditutup_ditolak(self, auth_client, db):
        user = _get_user(db)
        _seed_tahun_2025(db, user)
        auth_client.post("/accounting/tutup-buku", json={"tahun": 2025})

        payload = {
            "no_bukti": "JU-2025-004",
            "tanggal": "2025-03-01",
            "deskripsi": "Coba input setelah tutup buku",
            "jenis": "UMUM",
            "detail": [
                {"kode_akun": "1-1000", "debit": 1_000_000, "kredit": 0, "keterangan": None},
                {"kode_akun": "4-1000", "debit": 0, "kredit": 1_000_000, "keterangan": None},
            ],
        }
        resp = auth_client.post("/accounting/jurnal", json=payload)
        assert resp.status_code == 400
        assert "sudah ditutup" in resp.json()["detail"]

    def test_jurnal_tahun_setelah_ditutup_masih_berjalan(self, auth_client, db):
        user = _get_user(db)
        _seed_tahun_2025(db, user)
        auth_client.post("/accounting/tutup-buku", json={"tahun": 2025})

        payload = {
            "no_bukti": "JU-2026-001",
            "tanggal": "2026-01-05",
            "deskripsi": "Transaksi tahun baru",
            "jenis": "UMUM",
            "detail": [
                {"kode_akun": "1-1000", "debit": 500_000, "kredit": 0, "keterangan": None},
                {"kode_akun": "4-1000", "debit": 0, "kredit": 500_000, "keterangan": None},
            ],
        }
        resp = auth_client.post("/accounting/jurnal", json=payload)
        assert resp.status_code == 201


class TestUploadSkippedClosedYear:
    def test_auto_jurnal_lewati_baris_tahun_ditutup(self, auth_client, db):
        from app.services.ingestion.csv_to_jurnal import auto_journal_from_dataframe

        user = _get_user(db)
        _seed_akun(db)

        # Tahun 2025 ditutup tanpa jurnal apapun.
        db.add(TutupBuku(user_id=user.id, tahun=2025, tanggal_tutup=date(2025, 12, 31), laba_bersih=0))
        uploaded = UploadedFile(
            original_filename="transaksi.txt",
            stored_path="file://mock",
            file_type="csv",
            uploaded_by_id=user.id,
        )
        db.add(uploaded)
        db.commit()

        df = pd.DataFrame({
            "tanggal": ["2025-07-01", "2026-03-01"],
            "deskripsi": ["Penjualan ditutup", "Penjualan terbuka"],
            "debit": [0.0, 0.0],
            "kredit": [1_000_000.0, 2_000_000.0],
        })
        jumlah, warnings = auto_journal_from_dataframe(db, df, uploaded.id, user.id, "test")
        assert jumlah == 1  # hanya baris 2026 yang dibuat
        assert any("sudah ditutup" in w for w in warnings)