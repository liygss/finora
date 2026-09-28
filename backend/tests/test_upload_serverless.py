"""Regresi upload di serverless (Vercel): file harus bisa diproses tanpa disk.

Bug yang dikunci test ini: `POST /upload/file` menulis file ke disk, lalu
`POST /upload/{id}/commit` membacanya kembali. Di Vercel /tmp tidak bertahan
antar request, jadi commit kedua yang mendarat di instance lain gagal dengan
`FileNotFoundError` -> HTTP 500, dan status file jadi FAILED permanen karena
`commit` hanya menerima status STAGED.

Perbaikannya: isi file disimpan di kolom `uploaded_files.file_bytes`, jadi
commit tidak bergantung file di disk sama sekali.
"""

import csv
import io
from pathlib import Path

import pytest

from app.database.models import StatusUpload, UploadedFile

CSV_TRANSAKSI = (
    "Tanggal,Keterangan,Debit,Kredit\n"
    "2026-01-05,Penjualan tunai,5000000,\n"
    "2026-01-06,Pembelian persediaan,,1500000\n"
    "2026-01-07,Gaji karyawan,2000000,\n"
    "2026-01-08,Bayar listrik,,750000\n"
).encode()


def _seed_coa(db) -> None:
    """Seed chart of accounts supaya auto-jurnal bisa membuat jurnal.

    Pola yang sama dipakai tests/test_csv_tolerant.py.
    """
    from app.config.settings import settings
    from app.database.models import Akun, KategoriAkun, SaldoNormal

    coa_path = Path(settings.KNOWLEDGE_DIR) / "datasets" / "coa.csv"
    with open(coa_path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            db.add(Akun(
                kode_akun=row["kode_akun"].strip(),
                nama_akun=row["nama_akun"].strip(),
                kategori=KategoriAkun(row["kategori"].strip()),
                sub_kategori=row.get("sub_kategori") or None,
                saldo_normal=SaldoNormal(row["saldo_normal"].strip()),
                is_active=True,
            ))
    db.commit()


@pytest.fixture(autouse=True)
def seeded_coa(db):
    """Setiap tes butuh akun ada, kalau tidak auto-jurnal menghasilkan 0 baris."""
    _seed_coa(db)


@pytest.fixture()
def no_disk_file(monkeypatch):
    """Paksa `stored_path` jadi file yang tidak pernah ada di disk.

    Ini mensimulasikan kondisi Vercel setelah instance di-freeze: metadata file
    masih ada di database, tapi file fisiknya hilang.
    """
    monkeypatch.setattr(
        UploadedFile,
        "stored_path",
        "/tmp/finora/uploads/00000000-0000-0000-0000-000000000000_hilang.csv",
    )
    yield


@pytest.fixture()
def stub_rag(monkeypatch):
    """Matikan thread RAG supaya tes tidak bergantung scheduling/embedding."""
    from app.services.ingestion import ingestion_pipeline

    calls: list[str] = []
    monkeypatch.setattr(
        ingestion_pipeline,
        "_rag_background",
        lambda *a, **k: calls.append(a[0] if a else ""),
    )
    return calls


# ---------------------------------------------------------------------------
# Regresi inti
# ---------------------------------------------------------------------------
def test_commit_berhasil_walau_file_disk_sudah_hilang(auth_client, db, stub_rag):
    """INI regresi utama: file di /tmp hilang total, commit tetap harus jalan.

    Versi lama gagal di sini dengan HTTP 500 FileNotFoundError.
    """
    files = {"file": ("trx.csv", io.BytesIO(CSV_TRANSAKSI), "text/csv")}
    resp = auth_client.post("/upload/file", files=files)
    assert resp.status_code == 201, resp.text
    upload_id = resp.json()["id"]

    # Hapus file fisik: simulasi instance Vercel yang di-freeze/recycle.
    row = db.query(UploadedFile).filter(UploadedFile.id == upload_id).first()
    assert row.file_bytes == CSV_TRANSAKSI, "isi file harus tersimpan di database"
    stored = row.stored_path
    if stored and Path(stored).exists():
        Path(stored).unlink()

    commit = auth_client.post(f"/upload/{upload_id}/commit")
    assert commit.status_code == 200, f"commit gagal: {commit.text}"
    body = commit.json()
    assert body["status"] == StatusUpload.POSTED.value
    assert body["journal_count"] == 4


def test_commit_ulang_berhasil_setelah_gagal(auth_client, db, monkeypatch, stub_rag):
    """Status FAILED harus bisa di-commit ulang, bukan dead-end."""
    from app.services.ingestion import ingestion_pipeline

    files = {"file": ("trx.csv", io.BytesIO(CSV_TRANSAKSI), "text/csv")}
    upload_id = auth_client.post("/upload/file", files=files).json()["id"]

    # Paksa kegagalan pertama.
    def _boom(*a, **k):
        raise RuntimeError("gagal sementara")

    monkeypatch.setattr(ingestion_pipeline, "load_file", _boom)
    gagal = auth_client.post(f"/upload/{upload_id}/commit")
    assert gagal.status_code == 500
    db.expire_all()
    row = db.query(UploadedFile).filter(UploadedFile.id == upload_id).first()
    assert row.status == StatusUpload.FAILED

    # Percobaan kedua harus diterima (versi lama membalas 400 STAGED-only).
    monkeypatch.undo()
    kedua = auth_client.post(f"/upload/{upload_id}/commit")
    assert kedua.status_code == 200, kedua.text
    assert kedua.json()["status"] == StatusUpload.POSTED.value


def test_pesan_error_tidak_membocorkan_path_internal(auth_client, db, monkeypatch, stub_rag):
    """str(exc) bisa berisi path/errno; user harus dapat pesan yang lebih berguna."""
    from app.services.ingestion import ingestion_pipeline

    files = {"file": ("trx.csv", io.BytesIO(CSV_TRANSAKSI), "text/csv")}
    upload_id = auth_client.post("/upload/file", files=files).json()["id"]

    secret_path = "/tmp/finora/uploads/rahasia-uuid_trx.csv"

    def _boom(*a, **k):
        raise FileNotFoundError(2, f"No such file or directory: '{secret_path}'")

    monkeypatch.setattr(ingestion_pipeline, "load_file", _boom)
    resp = auth_client.post(f"/upload/{upload_id}/commit")

    assert resp.status_code == 500
    detail = resp.json()["detail"]
    assert secret_path not in detail
    assert "rahasia-uuid" not in detail


# ---------------------------------------------------------------------------
# Penyimpanan bytes & best-effort disk
# ---------------------------------------------------------------------------
def test_upload_simpan_bytes_walau_disk_tidak_writable(auth_client, db, monkeypatch):
    """Gagal tulis disk tidak lagi membatalkan upload."""
    from app.routers import upload as upload_router

    def _gagal_tulis(*a, **k):
        raise OSError(28, "No space left on device")

    monkeypatch.setattr(upload_router, "resolve_writable_dir", _gagal_tulis)
    files = {"file": ("trx.csv", io.BytesIO(CSV_TRANSAKSI), "text/csv")}
    resp = auth_client.post("/upload/file", files=files)

    assert resp.status_code == 201, resp.text
    upload_id = resp.json()["id"]
    row = db.query(UploadedFile).filter(UploadedFile.id == upload_id).first()
    assert row.file_bytes == CSV_TRANSAKSI
    assert row.stored_path == ""


def test_file_bytes_dibaca_sebagai_bytes_bukan_path(db, auth_client):
    """file_bytes harus benar-benar nyimpan byte, bukan string path."""
    files = {"file": ("trx.csv", io.BytesIO(CSV_TRANSAKSI), "text/csv")}
    upload_id = auth_client.post("/upload/file", files=files).json()["id"]

    db.expire_all()
    row = db.query(UploadedFile).filter(UploadedFile.id == upload_id).first()
    assert isinstance(row.file_bytes, (bytes, bytearray))
    assert row.file_size_bytes == len(CSV_TRANSAKSI)


def test_upload_lama_tanpa_bytes_tetap_bisa_diproses_via_path(db, auth_client, tmp_path, stub_rag):
    """File yang dibuat sebelum kolom file_bytes ada harus tetap bisa di-commit."""
    from app.middleware.auth import decode_access_token
    from app.database.models import User

    path = tmp_path / "lama.csv"
    path.write_bytes(CSV_TRANSAKSI)

    user_id = db.query(User).filter(User.email == "test@example.com").first().id
    assert decode_access_token(auth_client.cookies.get("access_token")) == user_id

    row = UploadedFile(
        original_filename="lama.csv",
        stored_path=str(path),
        file_bytes=None,  # baris lama: tidak ada bytes
        file_type="csv",
        file_size_bytes=len(CSV_TRANSAKSI),
        uploaded_by_id=user_id,
        status=StatusUpload.STAGED,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    resp = auth_client.post(f"/upload/{row.id}/commit")
    assert resp.status_code == 200, resp.text
    assert resp.json()["journal_count"] == 4


# ---------------------------------------------------------------------------
# file_loader menerima bytes
# ---------------------------------------------------------------------------
def test_load_file_dari_bytes_semua_tipe():
    import pandas as pd

    from app.services.ingestion.file_loader import load_file

    doc = load_file(CSV_TRANSAKSI, "csv")
    assert doc.file_type == "csv"
    assert doc.tables[0].dataframe.shape[0] == 4

    buf = io.BytesIO()
    pd.DataFrame({"Tanggal": ["2026-01-01"], "Debit": [1]}).to_excel(buf, index=False)
    doc_x = load_file(buf.getvalue(), "xlsx")
    assert doc_x.file_type == "xlsx"


def test_load_file_tetap_menerima_path(tmp_path):
    from app.services.ingestion.file_loader import load_file

    p = tmp_path / "trx.csv"
    p.write_bytes(CSV_TRANSAKSI)
    doc = load_file(str(p), "csv")
    assert doc.tables[0].dataframe.shape[0] == 4


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------
def test_upload_dibatasi_rate_limit(auth_client):
    """Upload dibatasi 5/menit; request ke-6 harus ditolak."""
    files = {"file": ("trx.csv", io.BytesIO(CSV_TRANSAKSI), "text/csv")}
    statuses = [
        auth_client.post("/upload/file", files=files).status_code for _ in range(7)
    ]
    assert 429 in statuses, f"rate limit tidak aktif: {statuses}"


def test_commit_melepas_file_bytes_setelah_diproses(auth_client, db, stub_rag):
    """Isi file harus dibuang dari DB setelah jurnal terbentuk.

    Kalau dibiarkan, tiap upload menambah MB ke database dan kuota provider
    gratis habis — sempat membuat seluruh aplikasi mati dengan error
    "Your account or project has exceeded the quota".
    """
    files = {"file": ("trx.csv", io.BytesIO(CSV_TRANSAKSI), "text/csv")}
    upload_id = auth_client.post("/upload/file", files=files).json()["id"]

    db.expire_all()
    before = db.query(UploadedFile).filter(UploadedFile.id == upload_id).first()
    assert before.file_bytes == CSV_TRANSAKSI

    resp = auth_client.post(f"/upload/{upload_id}/commit")
    assert resp.status_code == 200, resp.text

    db.expire_all()
    after = db.query(UploadedFile).filter(UploadedFile.id == upload_id).first()
    assert after.file_bytes is None, "file_bytes harus dilepas setelah commit sukses"
    # Metadata tetap ada supaya UI masih bisa menampilkan riwayat file.
    assert after.original_filename == "trx.csv"
    assert after.status == StatusUpload.POSTED


def test_file_bytes_tetap_ada_bila_commit_gagal(auth_client, db, monkeypatch, stub_rag):
    """Kalau commit gagal, bytes harus disimpan supaya user bisa retry."""
    from app.services.ingestion import ingestion_pipeline

    files = {"file": ("trx.csv", io.BytesIO(CSV_TRANSAKSI), "text/csv")}
    upload_id = auth_client.post("/upload/file", files=files).json()["id"]

    def _boom(*a, **k):
        raise RuntimeError("gagal sementara")

    monkeypatch.setattr(ingestion_pipeline, "load_file", _boom)
    assert auth_client.post(f"/upload/{upload_id}/commit").status_code == 500

    db.expire_all()
    row = db.query(UploadedFile).filter(UploadedFile.id == upload_id).first()
    assert row.file_bytes == CSV_TRANSAKSI, "bytes wajib disimpan untuk retry"
    assert row.status == StatusUpload.FAILED


# ---------------------------------------------------------------------------
# Bootsafe
# ---------------------------------------------------------------------------
def test_create_tables_gagal_tidak_mematikan_app(monkeypatch):
    """Kegagalan DDL di lifespan tidak boleh membuat total outage."""
    import asyncio

    from app.main import lifespan

    import app.database.migration as migration

    def _boom():
        raise RuntimeError("koneksi database mati total")

    monkeypatch.setattr(migration, "create_tables", _boom)

    async def _run():
        from app.main import app

        # Tidak boleh melempar exception keluar dari lifespan.
        async with lifespan(app):
            pass

    asyncio.run(_run())
