"""
Neraca Saldo (Trial Balance) — daftar semua akun beserta saldo akhirnya
pada tanggal tertentu, untuk memastikan total debit = total kredit
sebelum menyusun laporan keuangan.
"""

from dataclasses import dataclass
from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.accounting.akun import saldo_bertambah_di_debit
from app.database.models import Akun, JurnalDetail, JurnalUmum


@dataclass
class NeracaSaldoBaris:
    kode_akun: str
    nama_akun: str
    kategori: str
    debit: float  # hanya diisi kalau saldo akhir akun ini di sisi debit
    kredit: float  # hanya diisi kalau saldo akhir akun ini di sisi kredit


@dataclass
class NeracaSaldo:
    tanggal_per: date | None
    baris: list[NeracaSaldoBaris]
    total_debit: float
    total_kredit: float

    @property
    def is_balance(self) -> bool:
        return round(self.total_debit, 2) == round(self.total_kredit, 2)


def get_neraca_saldo(
    db: Session,
    tanggal_per: date | None = None,
    user_id: str | None = None,
    tanggal_mulai: date | None = None,
    tanggal_akhir: date | None = None,
    upload_id: str | None = None,
) -> NeracaSaldo:
    """
    Hitung neraca saldo per tanggal tertentu (default: semua transaksi s/d hari ini).
    Menjumlahkan seluruh debit & kredit per akun langsung lewat SQL aggregate
    (lebih efisien daripada memuat semua baris jurnal ke Python).

    Kalau user_id diberikan, hanya jurnal milik user tersebut yang dihitung.
    tanggal_mulai/tanggal_akhir: filter rentang transaksi (opsional).

    Hasil di-cache per-request pada session (db.info) karena laporan lain
    (laba rugi, posisi keuangan, dashboard) kerap memanggil fungsi ini dengan
    kombinasi (tanggal_per, user_id) yang sama. Session request read-only,
    jadi cache tidak pernah basi di dalam satu request.
    """
    cache = db.info.setdefault("neraca_saldo_cache", {})
    key = (tanggal_per, user_id, tanggal_mulai, tanggal_akhir, upload_id)
    if key in cache:
        return cache[key]

    query = (
        db.query(
            Akun.id,
            Akun.kode_akun,
            Akun.nama_akun,
            Akun.kategori,
            Akun.saldo_normal,
            func.coalesce(func.sum(JurnalDetail.debit), 0).label("total_debit"),
            func.coalesce(func.sum(JurnalDetail.kredit), 0).label("total_kredit"),
        )
        .outerjoin(JurnalDetail, JurnalDetail.akun_id == Akun.id)
        .outerjoin(JurnalUmum, JurnalUmum.id == JurnalDetail.jurnal_id)
        .filter(Akun.is_active.is_(True))
    )
    if user_id:
        query = query.filter(
            (JurnalUmum.created_by_id == user_id) | (JurnalUmum.created_by_id.is_(None))
        )
    if upload_id:
        query = query.filter(JurnalUmum.sumber_upload_id == upload_id)
    if tanggal_mulai:
        query = query.filter((JurnalUmum.tanggal >= tanggal_mulai) | (JurnalUmum.tanggal.is_(None)))
    if tanggal_akhir:
        query = query.filter((JurnalUmum.tanggal <= tanggal_akhir) | (JurnalUmum.tanggal.is_(None)))
    elif tanggal_per:
        # baris akun tanpa transaksi tetap ikut (outer join), makanya filter tanggal
        # digabung dengan OR is NULL supaya tidak ke-exclude
        query = query.filter((JurnalUmum.tanggal <= tanggal_per) | (JurnalUmum.tanggal.is_(None)))

    rows = query.group_by(Akun.id, Akun.kode_akun, Akun.nama_akun, Akun.kategori, Akun.saldo_normal).order_by(
        Akun.kode_akun
    ).all()

    baris_list: list[NeracaSaldoBaris] = []
    total_debit = 0.0
    total_kredit = 0.0

    for row in rows:
        total_d = float(row.total_debit)
        total_k = float(row.total_kredit)
        if total_d == 0 and total_k == 0:
            continue  # akun tanpa transaksi tidak perlu muncul di neraca saldo

        bertambah_di_debit = saldo_bertambah_di_debit(row.saldo_normal)
        saldo = (total_d - total_k) if bertambah_di_debit else (total_k - total_d)
        saldo = round(saldo, 2)

        debit_col = saldo if saldo > 0 and bertambah_di_debit else 0.0
        kredit_col = saldo if saldo > 0 and not bertambah_di_debit else 0.0
        # Kalau saldo negatif (kondisi tidak normal, misal kas minus), taruh di sisi lawannya
        # supaya neraca saldo tetap merepresentasikan angka riil dan gampang terlihat janggal.
        if saldo < 0:
            if bertambah_di_debit:
                kredit_col = abs(saldo)
            else:
                debit_col = abs(saldo)

        baris_list.append(
            NeracaSaldoBaris(
                kode_akun=row.kode_akun,
                nama_akun=row.nama_akun,
                kategori=row.kategori.value,
                debit=debit_col,
                kredit=kredit_col,
            )
        )
        total_debit += debit_col
        total_kredit += kredit_col

    hasil = NeracaSaldo(
        tanggal_per=tanggal_per,
        baris=baris_list,
        total_debit=round(total_debit, 2),
        total_kredit=round(total_kredit, 2),
    )
    cache[key] = hasil
    return hasil
