"""Tests untuk fitur dashboard baru: kategori pengeluaran & Insight AI."""

from datetime import date

from app.llm.ollama_service import OllamaError


def _get_user_id(db, email="test@example.com"):
    from app.database.models import User

    return db.query(User).filter(User.email == email).first().id


def _seed_laba_rugi(db, user_id, debit_lebih=0.0):
    """Seed 1 jurnal: pendapatan 5jt, beban pembelian (HPP) 2jt, beban gaji 1jt."""
    from app.database.models import (
        Akun,
        JenisJurnal,
        JurnalDetail,
        JurnalUmum,
        KategoriAkun,
        SaldoNormal,
    )

    kas = Akun(kode_akun="1-1000", nama_akun="Kas", kategori=KategoriAkun.ASET,
               saldo_normal=SaldoNormal.DEBIT, is_active=True)
    pend = Akun(kode_akun="4-1000", nama_akun="Pendapatan Usaha", kategori=KategoriAkun.PENDAPATAN,
                saldo_normal=SaldoNormal.KREDIT, is_active=True)
    beban1 = Akun(kode_akun="5-1100", nama_akun="Beban Pembelian", kategori=KategoriAkun.BEBAN,
                  saldo_normal=SaldoNormal.DEBIT, is_active=True)
    beban2 = Akun(kode_akun="5-2100", nama_akun="Beban Gaji", kategori=KategoriAkun.BEBAN,
                  saldo_normal=SaldoNormal.DEBIT, is_active=True)
    db.add_all([kas, pend, beban1, beban2])
    db.commit()
    for a in (kas, pend, beban1, beban2):
        db.refresh(a)

    jurnal = JurnalUmum(
        no_bukti="TEST-001",
        tanggal=date.today(),
        deskripsi="Penjualan tunai",
        jenis=JenisJurnal.UMUM,
        created_by_id=user_id,
    )
    jurnal.detail.append(JurnalDetail(akun=kas, urutan=1, debit=2_000_000 + debit_lebih, kredit=0))
    jurnal.detail.append(JurnalDetail(akun=beban1, urutan=2, debit=2_000_000, kredit=0))
    jurnal.detail.append(JurnalDetail(akun=beban2, urutan=3, debit=1_000_000, kredit=0))
    jurnal.detail.append(JurnalDetail(akun=pend, urutan=4, debit=0, kredit=5_000_000 + debit_lebih))
    db.add(jurnal)
    db.commit()


class TestDashboardAuth:
    def test_kategori_requires_auth(self, client):
        resp = client.get("/dashboard/kategori")
        assert resp.status_code == 401

    def test_insight_requires_auth(self, client):
        resp = client.get("/dashboard/insight")
        assert resp.status_code == 401


class TestKategori:
    def test_kategori_empty_for_new_user(self, auth_client):
        resp = auth_client.get("/dashboard/kategori")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_kategori_returns_breakdown_sorted(self, auth_client, db):
        _seed_laba_rugi(db, _get_user_id(db))
        resp = auth_client.get("/dashboard/kategori")
        assert resp.status_code == 200
        data = resp.json()
        assert [ (d["nama_akun"], d["nilai"]) for d in data ] == [
            ("Beban Pembelian", 2_000_000.0),
            ("Beban Gaji", 1_000_000.0),
        ]


class TestInsight:
    def test_insight_no_data_returns_static(self, auth_client):
        resp = auth_client.get("/dashboard/insight")
        assert resp.status_code == 200
        body = resp.json()
        assert body["has_data"] is False
        assert "Belum ada data transaksi" in body["insight"]

    def test_insight_with_data_uses_llm(self, auth_client, db, monkeypatch):
        _seed_laba_rugi(db, _get_user_id(db))
        monkeypatch.setattr(
            "app.routers.dashboard.chat_completion",
            lambda messages, temperature=0.2: "Insight uji",
        )
        resp = auth_client.get("/dashboard/insight")
        assert resp.status_code == 200
        body = resp.json()
        assert body["has_data"] is True
        assert body["insight"] == "Insight uji"

    def test_insight_llm_down_returns_503(self, auth_client, db, monkeypatch):
        _seed_laba_rugi(db, _get_user_id(db))

        def _down(messages, temperature=0.2):
            raise OllamaError("matot")

        monkeypatch.setattr("app.routers.dashboard.chat_completion", _down)
        resp = auth_client.get("/dashboard/insight")
        assert resp.status_code == 503


class TestAlerts:
    def test_alerts_requires_auth(self, client):
        resp = client.get("/dashboard/alerts")
        assert resp.status_code == 401

    def test_alerts_empty_for_new_user(self, auth_client):
        resp = auth_client.get("/dashboard/alerts")
        assert resp.status_code == 200
        assert resp.json()["alerts"] == []

    @staticmethod
    def _seed_dua_bulan(db, user_id, beban_prev, beban_curr, pendapatan):
        """1 jurnal bulan lalu + 1 jurnal bulan ini; jurnal balance."""
        from app.database.models import (
            Akun,
            JenisJurnal,
            JurnalDetail,
            JurnalUmum,
            KategoriAkun,
            SaldoNormal,
        )

        kas = Akun(kode_akun="1-1000", nama_akun="Kas", kategori=KategoriAkun.ASET,
                   saldo_normal=SaldoNormal.DEBIT, is_active=True)
        beban1 = Akun(kode_akun="5-1100", nama_akun="Beban Pembelian", kategori=KategoriAkun.BEBAN,
                      saldo_normal=SaldoNormal.DEBIT, is_active=True)
        beban2 = Akun(kode_akun="5-2100", nama_akun="Beban Gaji", kategori=KategoriAkun.BEBAN,
                      saldo_normal=SaldoNormal.DEBIT, is_active=True)
        pend = Akun(kode_akun="4-1000", nama_akun="Pendapatan Usaha", kategori=KategoriAkun.PENDAPATAN,
                    saldo_normal=SaldoNormal.KREDIT, is_active=True)
        db.add_all([kas, beban1, beban2, pend])
        db.commit()
        for a in (kas, beban1, beban2, pend):
            db.refresh(a)

        today = date.today()
        if today.month == 1:
            prev_tgl = today.replace(year=today.year - 1, month=12, day=15)
        else:
            prev_tgl = today.replace(month=today.month - 1, day=15)

        def _jurnal(no_bukti, tgl, beban_total, kas_debit):
            j = JurnalUmum(
                no_bukti=no_bukti, tanggal=tgl, deskripsi="Alerts seed",
                jenis=JenisJurnal.UMUM, created_by_id=user_id,
            )
            b1 = round(beban_total * 0.6, 2)
            b2 = round(beban_total - b1, 2)
            j.detail.append(JurnalDetail(akun=kas, urutan=1, debit=kas_debit, kredit=0))
            j.detail.append(JurnalDetail(akun=beban1, urutan=2, debit=b1, kredit=0))
            j.detail.append(JurnalDetail(akun=beban2, urutan=3, debit=b2, kredit=0))
            j.detail.append(JurnalDetail(akun=pend, urutan=4, debit=0, kredit=kas_debit))
            db.add(j)
            db.commit()

        # Beban bulan lalu + pendapatan (balance: debit kas = kredit pendapatan)
        _jurnal("ALRT-PREV", prev_tgl, beban_prev, pendapatan)
        # Beban bulan ini; debit kas menampung selisih supaya balance.
        _jurnal("ALRT-CURR", today, beban_curr, pendapatan + (beban_curr - beban_prev))

    @staticmethod
    def _seed_tanpa_hpp(db, user_id, pendapatan=5_000_000):
        """Pendapatan ada tapi tidak ada HPP (hanya beban operasional) — skenario
        margin tidak realistis yang sering terjadi di data UMKM."""
        from app.database.models import (
            Akun,
            JenisJurnal,
            JurnalDetail,
            JurnalUmum,
            KategoriAkun,
            SaldoNormal,
        )

        kas = Akun(kode_akun="1-1000", nama_akun="Kas", kategori=KategoriAkun.ASET,
                   saldo_normal=SaldoNormal.DEBIT, is_active=True)
        pend = Akun(kode_akun="4-1000", nama_akun="Pendapatan Usaha", kategori=KategoriAkun.PENDAPATAN,
                    saldo_normal=SaldoNormal.KREDIT, is_active=True)
        beban_gaji = Akun(kode_akun="5-2100", nama_akun="Beban Gaji", kategori=KategoriAkun.BEBAN,
                          saldo_normal=SaldoNormal.DEBIT, is_active=True)
        db.add_all([kas, pend, beban_gaji])
        db.commit()
        for a in (kas, pend, beban_gaji):
            db.refresh(a)

        jurnal = JurnalUmum(
            no_bukti="NOHPP-001", tanggal=date.today(), deskripsi="Penjualan tanpa HPP",
            jenis=JenisJurnal.UMUM, created_by_id=user_id,
        )
        jurnal.detail.append(JurnalDetail(akun=kas, urutan=1, debit=pendapatan, kredit=0))
        jurnal.detail.append(JurnalDetail(akun=beban_gaji, urutan=2, debit=100_000, kredit=0))
        jurnal.detail.append(JurnalDetail(akun=pend, urutan=3, debit=0, kredit=pendapatan))
        db.add(jurnal)
        db.commit()

    def test_alerts_warning_beban_naik(self, auth_client, db):
        TestAlerts._seed_dua_bulan(db, _get_user_id(db), beban_prev=1_000_000, beban_curr=1_500_000, pendapatan=2_000_000)
        resp = auth_client.get("/dashboard/alerts")
        assert resp.status_code == 200
        judul = {a["judul"] for a in resp.json()["alerts"]}
        assert "Beban naik signifikan" in judul

    def test_alerts_danger_rugi_beruntun(self, auth_client, db):
        TestAlerts._seed_dua_bulan(db, _get_user_id(db), beban_prev=1_000_000, beban_curr=1_000_000, pendapatan=500_000)
        resp = auth_client.get("/dashboard/alerts")
        assert resp.status_code == 200
        judul = {a["judul"] for a in resp.json()["alerts"]}
        assert "Usaha rugi beruntun" in judul

    def test_alerts_hpp_kosong_saat_ada_pendapatan(self, auth_client, db):
        """Pendapatan tercatat tapi HPP tidak ada → alert margin tidak realistis."""
        TestAlerts._seed_tanpa_hpp(db, _get_user_id(db))
        resp = auth_client.get("/dashboard/alerts")
        assert resp.status_code == 200
        judul = {a["judul"] for a in resp.json()["alerts"]}
        assert any("HPP belum dicatat" in j for j in judul)

    def test_alerts_no_hpp_alert_when_data_empty(self, auth_client):
        """Tanpa data sama sekali, tidak boleh muncul alert HPP."""
        resp = auth_client.get("/dashboard/alerts")
        assert resp.status_code == 200
        judul = {a["judul"] for a in resp.json()["alerts"]}
        assert not any("HPP" in j for j in judul)


class TestPiutangUtang:
    def test_piutang_utang_requires_auth(self, client):
        resp = client.get("/dashboard/piutang-utang")
        assert resp.status_code == 401

    def test_piutang_utang_empty_for_new_user(self, auth_client):
        resp = auth_client.get("/dashboard/piutang-utang")
        assert resp.status_code == 200
        body = resp.json()
        assert body["piutang_usaha"] == 0.0
        assert body["utang_usaha"] == 0.0
        assert body["utang_pajak"] == 0.0
        assert body["utang_bank"] == 0.0
        assert body["selisih"] == 0.0

    def test_piutang_utang_breakdown(self, auth_client, db):
        from app.database.models import (
            Akun,
            JenisJurnal,
            JurnalDetail,
            JurnalUmum,
            KategoriAkun,
            SaldoNormal,
        )

        specs = [
            ("1-1000", "Kas", KategoriAkun.ASET, SaldoNormal.DEBIT),
            ("1-1200", "Piutang Usaha", KategoriAkun.ASET, SaldoNormal.DEBIT),
            ("2-1100", "Utang Usaha", KategoriAkun.LIABILITAS, SaldoNormal.KREDIT),
            ("2-1200", "Utang Pajak", KategoriAkun.LIABILITAS, SaldoNormal.KREDIT),
            ("2-1300", "Utang Bank", KategoriAkun.LIABILITAS, SaldoNormal.KREDIT),
            ("4-1000", "Pendapatan Usaha", KategoriAkun.PENDAPATAN, SaldoNormal.KREDIT),
            ("5-2100", "Beban Gaji", KategoriAkun.BEBAN, SaldoNormal.DEBIT),
        ]
        akun = {}
        for kode, nama, kat, sn in specs:
            a = Akun(kode_akun=kode, nama_akun=nama, kategori=kat, saldo_normal=sn, is_active=True)
            db.add(a)
            akun[kode] = a
        db.commit()
        for a in akun.values():
            db.refresh(a)

        # Penjualan tunai 3jt + piutang 2jt <=> pendapatan 5jt
        j1 = JurnalUmum(no_bukti="PU-001", tanggal=date.today(), deskripsi="Penjualan kredit",
                        jenis=JenisJurnal.UMUM, created_by_id=_get_user_id(db))
        j1.detail.append(JurnalDetail(akun=akun["1-1000"], urutan=1, debit=3_000_000, kredit=0))
        j1.detail.append(JurnalDetail(akun=akun["1-1200"], urutan=2, debit=2_000_000, kredit=0))
        j1.detail.append(JurnalDetail(akun=akun["4-1000"], urutan=3, debit=0, kredit=5_000_000))
        db.add(j1)
        # Beban gaji 5jt dibiayai utang usaha 3jt, utang pajak 1jt, utang bank 1jt
        j2 = JurnalUmum(no_bukti="PU-002", tanggal=date.today(), deskripsi="Beban dibayar utang",
                        jenis=JenisJurnal.UMUM, created_by_id=_get_user_id(db))
        j2.detail.append(JurnalDetail(akun=akun["5-2100"], urutan=1, debit=5_000_000, kredit=0))
        j2.detail.append(JurnalDetail(akun=akun["2-1100"], urutan=2, debit=0, kredit=3_000_000))
        j2.detail.append(JurnalDetail(akun=akun["2-1200"], urutan=3, debit=0, kredit=1_000_000))
        j2.detail.append(JurnalDetail(akun=akun["2-1300"], urutan=4, debit=0, kredit=1_000_000))
        db.add(j2)
        db.commit()

        resp = auth_client.get("/dashboard/piutang-utang")
        assert resp.status_code == 200
        body = resp.json()
        assert body["piutang_usaha"] == 2_000_000.0
        assert body["utang_usaha"] == 3_000_000.0
        assert body["utang_pajak"] == 1_000_000.0
        assert body["utang_bank"] == 1_000_000.0
        assert body["selisih"] == -3_000_000.0


class TestDashboardOverview:
    def test_overview_requires_auth(self, client):
        resp = client.get("/dashboard/overview")
        assert resp.status_code == 401

    def test_overview_empty_for_new_user(self, auth_client):
        resp = auth_client.get("/dashboard/overview")
        assert resp.status_code == 200
        body = resp.json()
        assert body["summary"]["pendapatan_bulan_ini"] == 0.0
        assert body["summary"]["beban_bulan_ini"] == 0.0
        assert {m["pendapatan"] for m in body["monthly"]} == {0.0}
        assert body["alerts"] == []
        assert body["kategori"] == []
        assert body["produk"] == []
        assert body["piutang_utang"]["piutang_usaha"] == 0.0
        assert body["piutang_utang"]["utang_usaha"] == 0.0

    def test_overview_can_filter_by_committed_upload(self, auth_client, db):
        from app.database.models import (
            Akun,
            JenisJurnal,
            JurnalDetail,
            JurnalUmum,
            KategoriAkun,
            SaldoNormal,
            StatusUpload,
            UploadedFile,
        )

        user_id = _get_user_id(db)
        kas = Akun(
            kode_akun="1-1000",
            nama_akun="Kas",
            kategori=KategoriAkun.ASET,
            saldo_normal=SaldoNormal.DEBIT,
            is_active=True,
        )
        pendapatan = Akun(
            kode_akun="4-1000",
            nama_akun="Pendapatan Usaha",
            kategori=KategoriAkun.PENDAPATAN,
            saldo_normal=SaldoNormal.KREDIT,
            is_active=True,
        )
        db.add_all([kas, pendapatan])
        db.flush()

        upload_a = UploadedFile(
            original_filename="penjualan-januari.csv",
            stored_path="",
            file_type="csv",
            file_size_bytes=10,
            uploaded_by_id=user_id,
            status=StatusUpload.POSTED,
        )
        upload_b = UploadedFile(
            original_filename="penjualan-februari.csv",
            stored_path="",
            file_type="csv",
            file_size_bytes=10,
            uploaded_by_id=user_id,
            status=StatusUpload.POSTED,
        )
        db.add_all([upload_a, upload_b])
        db.flush()

        for no_bukti, upload, amount in (
            ("UPLOAD-A", upload_a, 1_000_000),
            ("UPLOAD-B", upload_b, 2_000_000),
        ):
            jurnal = JurnalUmum(
                no_bukti=no_bukti,
                tanggal=date.today(),
                deskripsi="Penjualan upload",
                jenis=JenisJurnal.UMUM,
                sumber_upload_id=upload.id,
                created_by_id=user_id,
            )
            jurnal.detail.append(JurnalDetail(akun=kas, urutan=1, debit=amount, kredit=0))
            jurnal.detail.append(JurnalDetail(akun=pendapatan, urutan=2, debit=0, kredit=amount))
            db.add(jurnal)
        db.commit()

        filtered = auth_client.get("/dashboard/overview", params={"upload_id": upload_a.id})
        assert filtered.status_code == 200
        filtered_body = filtered.json()
        assert filtered_body["summary"]["total_pendapatan_tahun_berjalan"] == 1_000_000.0
        assert filtered_body["summary"]["jumlah_transaksi_bulan_ini"] == 1

        combined = auth_client.get("/dashboard/overview")
        assert combined.status_code == 200
        assert combined.json()["summary"]["total_pendapatan_tahun_berjalan"] == 3_000_000.0

        invalid = auth_client.get("/dashboard/overview", params={"upload_id": "not-owned"})
        assert invalid.status_code == 404

    def test_overview_matches_individual_endpoints(self, auth_client):
        """/overview harus konsisten dengan endpoint terpisah yang sudah ada."""
        overview = auth_client.get("/dashboard/overview").json()

        summary = auth_client.get("/dashboard/summary").json()
        assert overview["summary"] == summary

        monthly = auth_client.get("/dashboard/monthly").json()
        assert overview["monthly"] == monthly

        alerts = auth_client.get("/dashboard/alerts").json()["alerts"]
        assert overview["alerts"] == alerts

        piutang = auth_client.get("/dashboard/piutang-utang").json()
        assert overview["piutang_utang"] == piutang

        kategori = auth_client.get("/dashboard/kategori").json()
        assert overview["kategori"] == kategori

    def test_overview_with_data_summary_and_kategori(self, auth_client, db):
        _seed_laba_rugi(db, _get_user_id(db))
        resp = auth_client.get("/dashboard/overview")
        assert resp.status_code == 200
        body = resp.json()
        assert body["summary"]["pendapatan_bulan_ini"] == 5_000_000.0
        assert body["summary"]["beban_bulan_ini"] == 3_000_000.0
        assert body["summary"]["laba_rugi_bulan_ini"] == 2_000_000.0
        assert [(k["nama_akun"], k["nilai"]) for k in body["kategori"]] == [
            ("Beban Pembelian", 2_000_000.0),
            ("Beban Gaji", 1_000_000.0),
        ]
        assert len(body["monthly"]) >= 1

    def test_overview_respects_tanggal_per(self, auth_client, db):
        from datetime import timedelta

        _seed_laba_rugi(db, _get_user_id(db))
        tgl = (date.today() - timedelta(days=1)).isoformat()
        resp = auth_client.get("/dashboard/overview", params={"tanggal_per": tgl})
        assert resp.status_code == 200
        body = resp.json()
        assert body["summary"]["tanggal_per"] == tgl


class TestProyeksi:
    def test_proyeksi_requires_auth(self, client):
        resp = client.get("/dashboard/proyeksi")
        assert resp.status_code == 401

    def test_proyeksi_empty_for_new_user(self, auth_client):
        resp = auth_client.get("/dashboard/proyeksi")
        assert resp.status_code == 200
        assert resp.json()["proyeksi"] == []

    def test_proyeksi_three_months_cumulative(self, auth_client, db):
        _seed_laba_rugi(db, _get_user_id(db))
        resp = auth_client.get("/dashboard/proyeksi")
        assert resp.status_code == 200
        body = resp.json()
        rows = body["proyeksi"]
        assert len(rows) == 3
        assert [r["proyeksi_laba"] for r in rows] == [2_000_000.0, 2_000_000.0, 2_000_000.0]
        assert [r["kas_akhir"] for r in rows] == [4_000_000.0, 6_000_000.0, 8_000_000.0]
        assert [r["bulan"] for r in rows] == sorted(r["bulan"] for r in rows)


def _seed_produk(db, user_id):
    """Seed jurnal berimbang dengan deskripsi produk yang bervariasi:
    Rokok 3x (total 450rb), Mie Instan 2x (total 1jt), Bahan Baku 1x (1,2jt)."""
    from app.database.models import (
        Akun,
        JenisJurnal,
        JurnalDetail,
        JurnalUmum,
        KategoriAkun,
        SaldoNormal,
    )

    kas = db.query(Akun).filter_by(kode_akun="1-1000").first()
    pend = db.query(Akun).filter_by(kode_akun="4-1000").first()
    if kas is None or pend is None:
        kas = Akun(kode_akun="1-1000", nama_akun="Kas", kategori=KategoriAkun.ASET,
                   saldo_normal=SaldoNormal.DEBIT, is_active=True)
        pend = Akun(kode_akun="4-1000", nama_akun="Pendapatan Usaha", kategori=KategoriAkun.PENDAPATAN,
                    saldo_normal=SaldoNormal.KREDIT, is_active=True)
        db.add_all([kas, pend])
        db.commit()
        for a in (kas, pend):
            db.refresh(a)

    def _jurnal(no_bukti, deskripsi, amt):
        j = JurnalUmum(
            no_bukti=f"PRD-{user_id[:8]}-{no_bukti}", tanggal=date.today(), deskripsi=deskripsi,
            jenis=JenisJurnal.UMUM, created_by_id=user_id,
        )
        j.detail.append(JurnalDetail(akun=kas, urutan=1, debit=amt, kredit=0))
        j.detail.append(JurnalDetail(akun=pend, urutan=2, debit=0, kredit=amt))
        db.add(j)
        db.commit()

    _jurnal("PRD-001", "Penjualan Rokok", 100_000)
    _jurnal("PRD-002", "Penjualan Rokok", 150_000)
    _jurnal("PRD-003", "Penjualan Rokok", 200_000)
    _jurnal("PRD-004", "Penjualan Mie Instan", 500_000)
    _jurnal("PRD-005", "Penjualan Mie Instan", 500_000)
    _jurnal("PRD-006", "Pembelian Bahan Baku", 1_200_000)


class TestProduk:
    def test_normalisasi_produk(self):
        from app.accounting.dashboard_metrics import _normalisasi_produk

        assert _normalisasi_produk("Penjualan Rokok") == "Rokok"
        assert _normalisasi_produk("Pembelian Bahan Baku") == "Bahan Baku"
        assert _normalisasi_produk("Pembayaran sewa bulanan") == "sewa bulanan"
        assert _normalisasi_produk("Setoran modal awal pemilik") == "modal awal pemilik"
        assert _normalisasi_produk("Penjualan") == "Penjualan"
        assert _normalisasi_produk("") == "Transaksi"

    def test_produk_empty_for_new_user(self, auth_client):
        resp = auth_client.get("/dashboard/overview")
        assert resp.status_code == 200
        assert resp.json()["produk"] == []

    def test_produk_ranking_terbesar(self, auth_client, db):
        _seed_produk(db, _get_user_id(db))
        resp = auth_client.get("/dashboard/overview")
        assert resp.status_code == 200
        produk = resp.json()["produk"]
        assert [(p["produk"], p["nilai"], p["jumlah"]) for p in produk] == [
            ("Bahan Baku", 1_200_000.0, 1),
            ("Mie Instan", 1_000_000.0, 2),
            ("Rokok", 450_000.0, 3),
        ]

    def test_produk_ranking_terbanyak_is_client_side_sort(self, auth_client, db):
        """Backend mengembalikan jumlah per produk; frontend mengurutkannya untuk
        tab 'Terbanyak' (frekuensi). Data yang tersedia harus benar."""
        _seed_produk(db, _get_user_id(db))
        produk = auth_client.get("/dashboard/overview").json()["produk"]
        by_jumlah = sorted(produk, key=lambda p: p["jumlah"], reverse=True)
        assert [(p["produk"], p["jumlah"]) for p in by_jumlah] == [
            ("Rokok", 3),
            ("Mie Instan", 2),
            ("Bahan Baku", 1),
        ]

    def test_produk_sorted_by_nilai_even_when_seeded_out_of_order(self, auth_client, db):
        _seed_produk(db, _get_user_id(db))
        resp = auth_client.get("/dashboard/overview")
        assert resp.status_code == 200
        nilai = [p["nilai"] for p in resp.json()["produk"]]
        assert nilai == sorted(nilai, reverse=True)

    def test_produk_isolated_per_user(self, auth_client, db):
        from datetime import timedelta
        from app.database.models import RoleUser, User

        _seed_produk(db, _get_user_id(db))

        # User lain dengan jurnal sendiri — tidak boleh menambah produk miliknya.
        other = User(
            email="other@example.com",
            hashed_password="x",
            full_name="Other",
            company_name="O",
            role=RoleUser.OWNER,
            is_active=True,
            email_verified=True,
        )
        db.add(other)
        db.commit()
        db.refresh(other)
        _seed_produk(db, other.id)

        produk = auth_client.get("/dashboard/overview").json()["produk"]
        names = {p["produk"] for p in produk}
        assert names == {"Bahan Baku", "Mie Instan", "Rokok"}
        total = sum(p["nilai"] for p in produk)
        assert total == 1_200_000.0 + 1_000_000.0 + 450_000.0