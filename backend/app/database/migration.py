"""
Helper untuk membuat tabel dan mengisi data awal (seed).

Untuk prototyping cukup jalankan:
    python -m app.database.migration

Untuk production, sebaiknya migrasi skema pakai Alembic (bukan create_all),
supaya perubahan skema tercatat dan reversible:
    alembic init alembic
    alembic revision --autogenerate -m "init schema"
    alembic upgrade head
create_all() di bawah tetap aman dipanggil bersamaan dengan Alembic karena
ia hanya membuat tabel yang belum ada (idempotent), tapi begitu Alembic
dipakai, jadikan Alembic sebagai satu-satunya sumber kebenaran skema.
"""

from app.config.logging import get_logger, setup_logging
from app.config.settings import settings
from app.database.database import Base, SessionLocal, engine
from app.database.models import Akun, KategoriAkun, RoleUser, SaldoNormal, User
from app.middleware.auth import hash_password

logger = get_logger(__name__)

# Daftar akun standar minimal untuk UMKM sesuai SAK EMKM.
# (kode_akun, nama_akun, kategori, sub_kategori, saldo_normal)
# ---------------------------------------------------------------------------
# COA Templates per sektor usaha
# ---------------------------------------------------------------------------
COA_TEMPLATES: dict[str, dict] = {
    "perdagangan": {
        "id": "perdagangan",
        "name": "Perdagangan / Retail",
        "description": "Cocok untuk usaha jual-beli barang dagang, toko, warung, dan retail.",
        "accounts": [
            ("1-1000", "Kas", KategoriAkun.ASET, "Aset Lancar", SaldoNormal.DEBIT),
            ("1-1100", "Bank", KategoriAkun.ASET, "Aset Lancar", SaldoNormal.DEBIT),
            ("1-1200", "Piutang Usaha", KategoriAkun.ASET, "Aset Lancar", SaldoNormal.DEBIT),
            ("1-1300", "Persediaan Barang Dagang", KategoriAkun.ASET, "Aset Lancar", SaldoNormal.DEBIT),
            ("1-1400", "Perlengkapan", KategoriAkun.ASET, "Aset Lancar", SaldoNormal.DEBIT),
            ("1-2000", "Peralatan", KategoriAkun.ASET, "Aset Tetap", SaldoNormal.DEBIT),
            ("1-2100", "Akumulasi Penyusutan Peralatan", KategoriAkun.ASET, "Aset Tetap", SaldoNormal.KREDIT),
            ("2-1000", "Utang Usaha", KategoriAkun.LIABILITAS, "Liabilitas Jangka Pendek", SaldoNormal.KREDIT),
            ("2-1100", "Utang Bank Jangka Pendek", KategoriAkun.LIABILITAS, "Liabilitas Jangka Pendek", SaldoNormal.KREDIT),
            ("2-1200", "Utang Pajak", KategoriAkun.LIABILITAS, "Liabilitas Jangka Pendek", SaldoNormal.KREDIT),
            ("2-2000", "Utang Bank Jangka Panjang", KategoriAkun.LIABILITAS, "Liabilitas Jangka Panjang", SaldoNormal.KREDIT),
            ("3-1000", "Modal Pemilik", KategoriAkun.MODAL, "Ekuitas", SaldoNormal.KREDIT),
            ("3-2000", "Prive", KategoriAkun.MODAL, "Ekuitas", SaldoNormal.DEBIT),
            ("3-3000", "Laba Ditahan", KategoriAkun.MODAL, "Ekuitas", SaldoNormal.KREDIT),
            ("4-1000", "Pendapatan Penjualan", KategoriAkun.PENDAPATAN, "Pendapatan Usaha", SaldoNormal.KREDIT),
            ("4-9000", "Pendapatan Lain-lain", KategoriAkun.PENDAPATAN, "Pendapatan Lain-lain", SaldoNormal.KREDIT),
            ("5-1000", "Harga Pokok Penjualan", KategoriAkun.BEBAN, "Beban Pokok", SaldoNormal.DEBIT),
            ("5-2000", "Beban Gaji", KategoriAkun.BEBAN, "Beban Operasional", SaldoNormal.DEBIT),
            ("5-2100", "Beban Sewa", KategoriAkun.BEBAN, "Beban Operasional", SaldoNormal.DEBIT),
            ("5-2200", "Beban Listrik, Air, dan Telepon", KategoriAkun.BEBAN, "Beban Operasional", SaldoNormal.DEBIT),
            ("5-2300", "Beban Perlengkapan", KategoriAkun.BEBAN, "Beban Operasional", SaldoNormal.DEBIT),
            ("5-2400", "Beban Penyusutan", KategoriAkun.BEBAN, "Beban Operasional", SaldoNormal.DEBIT),
            ("5-2500", "Beban Pajak", KategoriAkun.BEBAN, "Beban Operasional", SaldoNormal.DEBIT),
            ("5-9000", "Beban Lain-lain", KategoriAkun.BEBAN, "Beban Lain-lain", SaldoNormal.DEBIT),
        ],
    },
    "jasa": {
        "id": "jasa",
        "name": "Jasa / Konsultasi",
        "description": "Cocok untuk usaha jasa, konsultan, agensi, salon, bengkel, dan sejenisnya.",
        "accounts": [
            ("1-1000", "Kas", KategoriAkun.ASET, "Aset Lancar", SaldoNormal.DEBIT),
            ("1-1100", "Bank", KategoriAkun.ASET, "Aset Lancar", SaldoNormal.DEBIT),
            ("1-1200", "Piutang Usaha", KategoriAkun.ASET, "Aset Lancar", SaldoNormal.DEBIT),
            ("1-1300", "Uang Muka Pelanggan", KategoriAkun.ASET, "Aset Lancar", SaldoNormal.DEBIT),
            ("1-1400", "Perlengkapan", KategoriAkun.ASET, "Aset Lancar", SaldoNormal.DEBIT),
            ("1-2000", "Peralatan", KategoriAkun.ASET, "Aset Tetap", SaldoNormal.DEBIT),
            ("1-2100", "Akumulasi Penyusutan Peralatan", KategoriAkun.ASET, "Aset Tetap", SaldoNormal.KREDIT),
            ("1-2200", "Kendaraan", KategoriAkun.ASET, "Aset Tetap", SaldoNormal.DEBIT),
            ("1-2300", "Akumulasi Penyusutan Kendaraan", KategoriAkun.ASET, "Aset Tetap", SaldoNormal.KREDIT),
            ("2-1000", "Utang Usaha", KategoriAkun.LIABILITAS, "Liabilitas Jangka Pendek", SaldoNormal.KREDIT),
            ("2-1200", "Utang Pajak", KategoriAkun.LIABILITAS, "Liabilitas Jangka Pendek", SaldoNormal.KREDIT),
            ("2-1300", "Pendapatan Diterima Di Muka", KategoriAkun.LIABILITAS, "Liabilitas Jangka Pendek", SaldoNormal.KREDIT),
            ("2-2000", "Utang Bank Jangka Panjang", KategoriAkun.LIABILITAS, "Liabilitas Jangka Panjang", SaldoNormal.KREDIT),
            ("3-1000", "Modal Pemilik", KategoriAkun.MODAL, "Ekuitas", SaldoNormal.KREDIT),
            ("3-2000", "Prive", KategoriAkun.MODAL, "Ekuitas", SaldoNormal.DEBIT),
            ("3-3000", "Laba Ditahan", KategoriAkun.MODAL, "Ekuitas", SaldoNormal.KREDIT),
            ("4-1000", "Pendapatan Jasa", KategoriAkun.PENDAPATAN, "Pendapatan Usaha", SaldoNormal.KREDIT),
            ("4-2000", "Pendapatan Proyek", KategoriAkun.PENDAPATAN, "Pendapatan Usaha", SaldoNormal.KREDIT),
            ("4-9000", "Pendapatan Lain-lain", KategoriAkun.PENDAPATAN, "Pendapatan Lain-lain", SaldoNormal.KREDIT),
            ("5-2000", "Beban Gaji", KategoriAkun.BEBAN, "Beban Operasional", SaldoNormal.DEBIT),
            ("5-2100", "Beban Sewa", KategoriAkun.BEBAN, "Beban Operasional", SaldoNormal.DEBIT),
            ("5-2200", "Beban Listrik, Air, dan Telepon", KategoriAkun.BEBAN, "Beban Operasional", SaldoNormal.DEBIT),
            ("5-2300", "Beban Perlengkapan", KategoriAkun.BEBAN, "Beban Operasional", SaldoNormal.DEBIT),
            ("5-2400", "Beban Penyusutan", KategoriAkun.BEBAN, "Beban Operasional", SaldoNormal.DEBIT),
            ("5-2500", "Beban Pajak", KategoriAkun.BEBAN, "Beban Operasional", SaldoNormal.DEBIT),
            ("5-2600", "Beban Transport & Perjalanan Dinas", KategoriAkun.BEBAN, "Beban Operasional", SaldoNormal.DEBIT),
            ("5-9000", "Beban Lain-lain", KategoriAkun.BEBAN, "Beban Lain-lain", SaldoNormal.DEBIT),
        ],
    },
    "manufaktur": {
        "id": "manufaktur",
        "name": "Manufaktur / Produksi",
        "description": "Cocok untuk usaha produksi, pabrik kecil, home industry, dan UMKM manufaktur.",
        "accounts": [
            ("1-1000", "Kas", KategoriAkun.ASET, "Aset Lancar", SaldoNormal.DEBIT),
            ("1-1100", "Bank", KategoriAkun.ASET, "Aset Lancar", SaldoNormal.DEBIT),
            ("1-1200", "Piutang Usaha", KategoriAkun.ASET, "Aset Lancar", SaldoNormal.DEBIT),
            ("1-1300", "Persediaan Bahan Baku", KategoriAkun.ASET, "Aset Lancar", SaldoNormal.DEBIT),
            ("1-1310", "Persediaan Barang Dalam Proses", KategoriAkun.ASET, "Aset Lancar", SaldoNormal.DEBIT),
            ("1-1320", "Persediaan Barang Jadi", KategoriAkun.ASET, "Aset Lancar", SaldoNormal.DEBIT),
            ("1-1400", "Perlengkapan", KategoriAkun.ASET, "Aset Lancar", SaldoNormal.DEBIT),
            ("1-2000", "Peralatan Produksi", KategoriAkun.ASET, "Aset Tetap", SaldoNormal.DEBIT),
            ("1-2100", "Akumulasi Penyusutan Peralatan", KategoriAkun.ASET, "Aset Tetap", SaldoNormal.KREDIT),
            ("1-2200", "Kendaraan", KategoriAkun.ASET, "Aset Tetap", SaldoNormal.DEBIT),
            ("1-2300", "Akumulasi Penyusutan Kendaraan", KategoriAkun.ASET, "Aset Tetap", SaldoNormal.KREDIT),
            ("2-1000", "Utang Usaha", KategoriAkun.LIABILITAS, "Liabilitas Jangka Pendek", SaldoNormal.KREDIT),
            ("2-1100", "Utang Bank Jangka Pendek", KategoriAkun.LIABILITAS, "Liabilitas Jangka Pendek", SaldoNormal.KREDIT),
            ("2-1200", "Utang Pajak", KategoriAkun.LIABILITAS, "Liabilitas Jangka Pendek", SaldoNormal.KREDIT),
            ("2-2000", "Utang Bank Jangka Panjang", KategoriAkun.LIABILITAS, "Liabilitas Jangka Panjang", SaldoNormal.KREDIT),
            ("3-1000", "Modal Pemilik", KategoriAkun.MODAL, "Ekuitas", SaldoNormal.KREDIT),
            ("3-2000", "Prive", KategoriAkun.MODAL, "Ekuitas", SaldoNormal.DEBIT),
            ("3-3000", "Laba Ditahan", KategoriAkun.MODAL, "Ekuitas", SaldoNormal.KREDIT),
            ("4-1000", "Pendapatan Penjualan", KategoriAkun.PENDAPATAN, "Pendapatan Usaha", SaldoNormal.KREDIT),
            ("4-9000", "Pendapatan Lain-lain", KategoriAkun.PENDAPATAN, "Pendapatan Lain-lain", SaldoNormal.KREDIT),
            ("5-1000", "Harga Pokok Penjualan", KategoriAkun.BEBAN, "Beban Pokok", SaldoNormal.DEBIT),
            ("5-1010", "Beban Bahan Baku", KategoriAkun.BEBAN, "Beban Produksi", SaldoNormal.DEBIT),
            ("5-1020", "Beban Tenaga Kerja Langsung", KategoriAkun.BEBAN, "Beban Produksi", SaldoNormal.DEBIT),
            ("5-1030", "Beban Overhead Pabrik", KategoriAkun.BEBAN, "Beban Produksi", SaldoNormal.DEBIT),
            ("5-2000", "Beban Gaji", KategoriAkun.BEBAN, "Beban Operasional", SaldoNormal.DEBIT),
            ("5-2100", "Beban Sewa", KategoriAkun.BEBAN, "Beban Operasional", SaldoNormal.DEBIT),
            ("5-2200", "Beban Listrik, Air, dan Telepon", KategoriAkun.BEBAN, "Beban Operasional", SaldoNormal.DEBIT),
            ("5-2300", "Beban Perlengkapan", KategoriAkun.BEBAN, "Beban Operasional", SaldoNormal.DEBIT),
            ("5-2400", "Beban Penyusutan", KategoriAkun.BEBAN, "Beban Operasional", SaldoNormal.DEBIT),
            ("5-2500", "Beban Pajak", KategoriAkun.BEBAN, "Beban Operasional", SaldoNormal.DEBIT),
            ("5-9000", "Beban Lain-lain", KategoriAkun.BEBAN, "Beban Lain-lain", SaldoNormal.DEBIT),
        ],
    },
}

# Daftar akun standar minimal untuk UMKM sesuai SAK EMKM.
# (kode_akun, nama_akun, kategori, sub_kategori, saldo_normal)
DEFAULT_CHART_OF_ACCOUNTS: list[tuple[str, str, KategoriAkun, str, SaldoNormal]] = [
    # ASET
    ("1-1000", "Kas", KategoriAkun.ASET, "Aset Lancar", SaldoNormal.DEBIT),
    ("1-1100", "Bank", KategoriAkun.ASET, "Aset Lancar", SaldoNormal.DEBIT),
    ("1-1200", "Piutang Usaha", KategoriAkun.ASET, "Aset Lancar", SaldoNormal.DEBIT),
    ("1-1300", "Persediaan Barang Dagang", KategoriAkun.ASET, "Aset Lancar", SaldoNormal.DEBIT),
    ("1-1400", "Perlengkapan", KategoriAkun.ASET, "Aset Lancar", SaldoNormal.DEBIT),
    ("1-2000", "Peralatan", KategoriAkun.ASET, "Aset Tetap", SaldoNormal.DEBIT),
    ("1-2100", "Akumulasi Penyusutan Peralatan", KategoriAkun.ASET, "Aset Tetap", SaldoNormal.KREDIT),
    ("1-2200", "Kendaraan", KategoriAkun.ASET, "Aset Tetap", SaldoNormal.DEBIT),
    ("1-2300", "Akumulasi Penyusutan Kendaraan", KategoriAkun.ASET, "Aset Tetap", SaldoNormal.KREDIT),
    # LIABILITAS
    ("2-1000", "Utang Usaha", KategoriAkun.LIABILITAS, "Liabilitas Jangka Pendek", SaldoNormal.KREDIT),
    ("2-1100", "Utang Bank Jangka Pendek", KategoriAkun.LIABILITAS, "Liabilitas Jangka Pendek", SaldoNormal.KREDIT),
    ("2-1200", "Utang Pajak", KategoriAkun.LIABILITAS, "Liabilitas Jangka Pendek", SaldoNormal.KREDIT),
    ("2-2000", "Utang Bank Jangka Panjang", KategoriAkun.LIABILITAS, "Liabilitas Jangka Panjang", SaldoNormal.KREDIT),
    # MODAL
    ("3-1000", "Modal Pemilik", KategoriAkun.MODAL, "Ekuitas", SaldoNormal.KREDIT),
    ("3-2000", "Prive", KategoriAkun.MODAL, "Ekuitas", SaldoNormal.DEBIT),
    ("3-3000", "Laba Ditahan", KategoriAkun.MODAL, "Ekuitas", SaldoNormal.KREDIT),
    # PENDAPATAN
    ("4-1000", "Pendapatan Penjualan", KategoriAkun.PENDAPATAN, "Pendapatan Usaha", SaldoNormal.KREDIT),
    ("4-2000", "Pendapatan Jasa", KategoriAkun.PENDAPATAN, "Pendapatan Usaha", SaldoNormal.KREDIT),
    ("4-9000", "Pendapatan Lain-lain", KategoriAkun.PENDAPATAN, "Pendapatan Lain-lain", SaldoNormal.KREDIT),
    # BEBAN
    ("5-1000", "Harga Pokok Penjualan", KategoriAkun.BEBAN, "Beban Pokok", SaldoNormal.DEBIT),
    ("5-2000", "Beban Gaji", KategoriAkun.BEBAN, "Beban Operasional", SaldoNormal.DEBIT),
    ("5-2100", "Beban Sewa", KategoriAkun.BEBAN, "Beban Operasional", SaldoNormal.DEBIT),
    ("5-2200", "Beban Listrik, Air, dan Telepon", KategoriAkun.BEBAN, "Beban Operasional", SaldoNormal.DEBIT),
    ("5-2300", "Beban Perlengkapan", KategoriAkun.BEBAN, "Beban Operasional", SaldoNormal.DEBIT),
    ("5-2400", "Beban Penyusutan", KategoriAkun.BEBAN, "Beban Operasional", SaldoNormal.DEBIT),
    ("5-2500", "Beban Pajak", KategoriAkun.BEBAN, "Beban Operasional", SaldoNormal.DEBIT),
    ("5-9000", "Beban Lain-lain", KategoriAkun.BEBAN, "Beban Lain-lain", SaldoNormal.DEBIT),
]


def _sqlite_typecompilation(col_type):
    t = str(col_type).upper()
    # PENTING: kolom binary harus jadi BLOB (SQLite) / BYTEA (Postgres).
    # Kalau jatuh ke TEXT di bawah, isi file upload rusak diam-diam: tidak ada
    # error, tapi tidak terbaca sebagai bytes.
    # Catatan: SQLite memberi BLOB affinity hanya kalau nama tipenya mengandung
    # "BLOB", jadi "BYTEA" tidak boleh dipakai di SQLite.
    if "LARGEBINARY" in t or "BYTEA" in t or "BLOB" in t:
        return "BYTEA" if not settings.is_sqlite else "BLOB"
    if "STRING" in t or "VARCHAR" in t or "TEXT" in t:
        return "TEXT"
    if "BOOLEAN" in t:
        return "INTEGER"
    if "DATETIME" in t or "TIMESTAMP" in t:
        return "TEXT"
    if "DATE" in t:
        return "TEXT"
    if "NUMERIC" in t or "FLOAT" in t or "DOUBLE" in t:
        return "REAL"
    return "TEXT"


def _safe_default(col):
    t = str(col.type).upper()
    if "BOOLEAN" in t:
        return "0"
    if "INTEGER" in t or "NUMERIC" in t or "FLOAT" in t or "DOUBLE" in t:
        return "0"
    if "DATETIME" in t or "DATE" in t or "TIMESTAMP" in t:
        if col.nullable:
            return "NULL"
        return "''"
    if col.nullable:
        return "NULL"
    return "''"


def _auto_migrate() -> None:
    """Tambah kolom yang hilang pada tabel yang sudah ada (forward-only)."""
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    migrations_done = 0
    for table_name, table in Base.metadata.tables.items():
        if not inspector.has_table(table_name):
            continue
        existing = {col["name"] for col in inspector.get_columns(table_name)}
        for col in table.columns:
            if col.name not in existing:
                col_type = _sqlite_typecompilation(col.type)
                default_val = _safe_default(col)
                nullable = "" if col.nullable else " NOT NULL"
                with engine.begin() as conn:
                    conn.execute(text(
                        f'ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type} DEFAULT {default_val}{nullable}'
                    ))
                logger.info("Migration: added column %s.%s", table_name, col.name)
                migrations_done += 1
    if migrations_done:
        logger.info("Auto-migration selesai: %d kolom ditambahkan.", migrations_done)
    else:
        logger.info("Tidak ada kolom yang perlu dimigrasi.")


def _repair_plan_column() -> None:
    """Baris lama hasil ALTER TABLE ADD COLUMN berisi plan='' -> normalisasi ke FREE."""
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    if not inspector.has_table("users"):
        return
    columns = {col["name"] for col in inspector.get_columns("users")}
    if "plan" not in columns:
        return
    with engine.begin() as conn:
        conn.execute(text(
            "UPDATE users SET plan = 'FREE' WHERE plan IS NULL OR plan NOT IN ('FREE', 'MAINTENANCE')"
        ))


def _ensure_indexes() -> None:
    """Pastikan index penting ada (idempotent) — terutama untuk DB lama yang
    dibuat sebelum index deklaratif ditambahkan di model.

    Dashboard & laporan hampir selalu memfilter (created_by_id, tanggal),
    jadi index komposit ini mencegah full-scan jurnal_umum per request.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    if not inspector.has_table("jurnal_umum"):
        return
    with engine.begin() as conn:
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_jurnal_umum_created_tanggal "
            "ON jurnal_umum (created_by_id, tanggal)"
        ))
    if not inspector.has_table("jurnal_detail"):
        return
    with engine.begin() as conn:
        # Jurnal detail selalu di-join via jurnal_id & di-agregasi per akun_id;
        # tanpa index ini query dashboard/laporan full-scan puluhan ribu baris.
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_jurnal_detail_jurnal_id "
            "ON jurnal_detail (jurnal_id)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_jurnal_detail_akun_id "
            "ON jurnal_detail (akun_id)"
        ))


def create_tables() -> None:
    logger.info("Membuat tabel database (jika belum ada)...")
    Base.metadata.create_all(bind=engine)
    _auto_migrate()
    _repair_plan_column()
    _ensure_indexes()
    logger.info("Tabel database siap.")


def seed_bootstrap_admin(db: "Session | None" = None) -> None:
    """Pastikan email BOOTSTRAP_ADMIN_EMAIL menjadi ADMIN.

    - Bila user sudah ada: role di-upgrade ke ADMIN, aktif, dan ditandai
      email terverifikasi (akun milik pengelola server).
    - Bila belum ada: dibuat dengan password acak (bisa di-reset lewat
      fitur lupa password). Idempotent — aman dipanggil tiap startup.
    """
    email = settings.BOOTSTRAP_ADMIN_EMAIL.strip().lower()
    if not email:
        return

    import secrets

    if db is not None:
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            db.add(User(
                email=email,
                hashed_password=hash_password(secrets.token_urlsafe(24)),
                full_name="Administrator",
                role=RoleUser.ADMIN,
                is_active=True,
                email_verified=True,
            ))
            logger.info("Bootstrap admin dibuat: %s", email)
        else:
            if user.role != RoleUser.ADMIN:
                user.role = RoleUser.ADMIN
                logger.info("Bootstrap admin: role %s di-upgrade ke ADMIN", email)
            if not user.is_active:
                user.is_active = True
            if not user.email_verified:
                user.email_verified = True
        db.commit()
        return

    _db = SessionLocal()
    try:
        seed_bootstrap_admin(db=_db)
    finally:
        _db.close()


def seed_chart_of_accounts() -> None:
    """Isi akun default kalau tabel akun masih kosong. Aman dipanggil berulang kali."""
    db = SessionLocal()
    try:
        existing_codes = {a.kode_akun for a in db.query(Akun.kode_akun).all()}
        new_accounts = [
            Akun(
                kode_akun=kode,
                nama_akun=nama,
                kategori=kategori,
                sub_kategori=sub,
                saldo_normal=saldo_normal,
            )
            for kode, nama, kategori, sub, saldo_normal in DEFAULT_CHART_OF_ACCOUNTS
            if kode not in existing_codes
        ]
        if new_accounts:
            db.add_all(new_accounts)
            db.commit()
            logger.info("Menambahkan %d akun default (SAK EMKM).", len(new_accounts))
        else:
            logger.info("Chart of accounts sudah terisi, skip seeding.")
    finally:
        db.close()


def run() -> None:
    setup_logging()
    create_tables()
    seed_chart_of_accounts()
    seed_bootstrap_admin()


if __name__ == "__main__":
    run()
