"""
Ringkasan metrik untuk dashboard: saldo kas & bank, pendapatan/beban bulan
berjalan, laba/rugi berjalan, dan jumlah transaksi.
"""

from dataclasses import dataclass, field
from datetime import date, timedelta
import re

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.accounting.laporan_laba_rugi import get_laporan_laba_rugi
from app.accounting.neraca_saldo import get_neraca_saldo
from app.config.settings import settings
from app.database.models import Akun, JurnalDetail, JurnalUmum, JenisJurnal, KategoriAkun

KODE_AKUN_KAS = "1-1000"
KODE_AKUN_BANK = "1-1100"


@dataclass
class DashboardSummary:
    tanggal_per: date
    saldo_kas: float = 0.0
    saldo_bank: float = 0.0
    pendapatan_bulan_ini: float = 0.0
    beban_bulan_ini: float = 0.0
    laba_rugi_bulan_ini: float = 0.0
    total_pendapatan_tahun_berjalan: float = 0.0
    total_beban_tahun_berjalan: float = 0.0
    laba_rugi_tahun_berjalan: float = 0.0
    jumlah_transaksi_bulan_ini: int = 0

    @property
    def total_kas_dan_bank(self) -> float:
        return round(self.saldo_kas + self.saldo_bank, 2)


def _saldo_akun(neraca_saldo, kode_akun: str) -> float:
    for baris in neraca_saldo.baris:
        if baris.kode_akun == kode_akun:
            return baris.debit if baris.debit > 0 else -baris.kredit
    return 0.0


def get_dashboard_summary(
    db: Session,
    tanggal_per: date | None = None,
    user_id: str | None = None,
    tanggal_mulai: date | None = None,
    upload_id: str | None = None,
) -> DashboardSummary:
    tanggal_per = tanggal_per or date.today()
    if tanggal_mulai:
        awal_bulan = tanggal_mulai
    else:
        awal_bulan = tanggal_per.replace(day=1)
    awal_tahun = tanggal_per.replace(month=1, day=1)
    akhir_bulan_lalu = awal_bulan - timedelta(days=1)
    akhir_tahun_lalu = awal_tahun - timedelta(days=1)

    neraca_saldo_keseluruhan = get_neraca_saldo(
        db, tanggal_per, user_id=user_id, upload_id=upload_id,
    )

    # Kumulatif s/d tanggal_per (sejak awal usaha)
    laba_rugi_sekarang = get_laporan_laba_rugi(db, tanggal_per, user_id=user_id, upload_id=upload_id)
    # Kumulatif s/d akhir bulan lalu (supaya tanggal 1 tetap masuk bulan ini)
    laba_rugi_sebelum_bulan = get_laporan_laba_rugi(db, akhir_bulan_lalu, user_id=user_id, upload_id=upload_id)
    # Kumulatif s/d akhir tahun lalu (supaya tanggal 1 Jan tetap masuk tahun ini)
    laba_rugi_sebelum_tahun = get_laporan_laba_rugi(db, akhir_tahun_lalu, user_id=user_id, upload_id=upload_id)

    # Bulan ini = kumulatif s/d sekarang - kumulatif s/d akhir bulan lalu
    pendapatan_bulan_ini = round(
        laba_rugi_sekarang.total_pendapatan - laba_rugi_sebelum_bulan.total_pendapatan, 2
    )
    beban_bulan_ini = round(
        (laba_rugi_sekarang.total_hpp + laba_rugi_sekarang.total_beban_operasional)
        - (laba_rugi_sebelum_bulan.total_hpp + laba_rugi_sebelum_bulan.total_beban_operasional),
        2,
    )

    # Tahun berjalan = kumulatif s/d sekarang - kumulatif s/d akhir tahun lalu
    total_pendapatan_tahun = round(
        laba_rugi_sekarang.total_pendapatan - laba_rugi_sebelum_tahun.total_pendapatan, 2
    )
    total_beban_tahun = round(
        (laba_rugi_sekarang.total_hpp + laba_rugi_sekarang.total_beban_operasional)
        - (laba_rugi_sebelum_tahun.total_hpp + laba_rugi_sebelum_tahun.total_beban_operasional),
        2,
    )

    transaksi_query = (
        db.query(JurnalUmum)
        .filter(JurnalUmum.tanggal >= awal_bulan, JurnalUmum.tanggal <= tanggal_per)
    )
    if user_id:
        transaksi_query = transaksi_query.filter(JurnalUmum.created_by_id == user_id)
    if upload_id:
        transaksi_query = transaksi_query.filter(JurnalUmum.sumber_upload_id == upload_id)
    jumlah_transaksi_bulan_ini = transaksi_query.count()

    return DashboardSummary(
        tanggal_per=tanggal_per,
        saldo_kas=_saldo_akun(neraca_saldo_keseluruhan, KODE_AKUN_KAS),
        saldo_bank=_saldo_akun(neraca_saldo_keseluruhan, KODE_AKUN_BANK),
        pendapatan_bulan_ini=pendapatan_bulan_ini,
        beban_bulan_ini=beban_bulan_ini,
        laba_rugi_bulan_ini=round(pendapatan_bulan_ini - beban_bulan_ini, 2),
        total_pendapatan_tahun_berjalan=total_pendapatan_tahun,
        total_beban_tahun_berjalan=total_beban_tahun,
        laba_rugi_tahun_berjalan=round(total_pendapatan_tahun - total_beban_tahun, 2),
        jumlah_transaksi_bulan_ini=jumlah_transaksi_bulan_ini,
    )


@dataclass
class BarisPendapatanBebanBulanan:
    bulan: str  # format YYYY-MM
    label: str  # nama bulan pendek (mis. "Apr")
    pendapatan: float = 0.0
    beban: float = 0.0

    @property
    def laba_rugi(self) -> float:
        return round(self.pendapatan - self.beban, 2)


def _geser_bulan(bulan: date, delta: int) -> date:
    """Geser `delta` bulan dari tanggal yang dijamin di tanggal 1 (dua arah)."""
    total = bulan.year * 12 + (bulan.month - 1) + delta
    return date(total // 12, total % 12 + 1, 1)


def get_pendapatan_beban_bulanan(
    db: Session,
    tanggal_per: date | None = None,
    user_id: str | None = None,
    jumlah_bulan: int = 6,
    tanggal_mulai: date | None = None,
    upload_id: str | None = None,
) -> list[BarisPendapatanBebanBulanan]:
    """
    Pendapatan & beban per bulan untuk N bulan terakhir (default 6) sampai bulan
    tanggal_per, supaya chart "Pendapatan vs Beban" di dashboard menampilkan
    tren dan kedua serinya terlihat jelas. Saat tanggal_mulai diberikan (custom
    date range), bar chart hanya menampilkan bulan-bulan di dalam rentang tsb —
    bukan lagi 6 bulan terakhir.

    Konsisten dengan neraca saldo: pendapatan = saldo kredit akun PENDAPATAN,
    beban = saldo debit akun BEBAN (net dari debit/kredit per akun).
    """
    tanggal_per = tanggal_per or date.today()
    bulan_terakhir = tanggal_per.replace(day=1)
    if tanggal_mulai:
        bulan_awal = tanggal_mulai.replace(day=1)
    else:
        bulan_awal = _geser_bulan(bulan_terakhir, -(jumlah_bulan - 1))

    # date_trunc hanya ada di PostgreSQL; SQLite pakai strftime.
    if settings.is_sqlite:
        bulan_expr = func.strftime("%Y-%m-01", JurnalUmum.tanggal).label("bulan")
    else:
        bulan_expr = func.date_trunc("month", JurnalUmum.tanggal).label("bulan")

    query = (
        db.query(
            bulan_expr,
            Akun.kategori,
            func.coalesce(func.sum(JurnalDetail.debit), 0).label("total_debit"),
            func.coalesce(func.sum(JurnalDetail.kredit), 0).label("total_kredit"),
        )
        .join(JurnalDetail, JurnalDetail.akun_id == Akun.id)
        .join(JurnalUmum, JurnalUmum.id == JurnalDetail.jurnal_id)
        .filter(Akun.is_active.is_(True))
        .filter(
            Akun.kategori.in_([KategoriAkun.PENDAPATAN, KategoriAkun.BEBAN]),
            JurnalUmum.tanggal <= tanggal_per,
        )
    )
    if tanggal_mulai:
        query = query.filter(JurnalUmum.tanggal >= tanggal_mulai)
    else:
        query = query.filter(JurnalUmum.tanggal >= bulan_awal)
    if user_id:
        query = query.filter(JurnalUmum.created_by_id == user_id)
    if upload_id:
        query = query.filter(JurnalUmum.sumber_upload_id == upload_id)
    rows = query.group_by("bulan", Akun.kategori).all()

    per_bulan: dict[date, BarisPendapatanBebanBulanan] = {}
    for r in rows:
        # SQLite: strftime → string "YYYY-MM-01"; PostgreSQL: date_trunc → datetime
        raw = r.bulan
        if isinstance(raw, str):
            bulan = date.fromisoformat(raw)
        elif hasattr(raw, "date"):
            bulan = raw.date()
        else:
            bulan = raw
        baris = per_bulan.setdefault(
            bulan,
            BarisPendapatanBebanBulanan(
                bulan=bulan.strftime("%Y-%m"),
                label=bulan.strftime("%b"),
            ),
        )
        if r.kategori == KategoriAkun.PENDAPATAN:
            baris.pendapatan = round(float(r.total_kredit) - float(r.total_debit), 2)
        elif r.kategori == KategoriAkun.BEBAN:
            baris.beban = round(float(r.total_debit) - float(r.total_kredit), 2)

    # Isi bulan kosong dengan nol supaya chart selalu menampilkan semua bulan
    hasil: list[BarisPendapatanBebanBulanan] = []
    cursor = bulan_awal
    while cursor <= bulan_terakhir:
        if cursor in per_bulan:
            hasil.append(per_bulan[cursor])
        else:
            hasil.append(
                BarisPendapatanBebanBulanan(
                    bulan=cursor.strftime("%Y-%m"),
                    label=cursor.strftime("%b"),
                )
            )
        cursor = _geser_bulan(cursor, 1)
    return hasil


@dataclass
class StatistikProduk:
    produk: str
    nilai: float = 0.0
    jumlah: int = 0


# Awalan kata kerja transaksi yang dipangkas dari deskripsi untuk mengekstrak
# produk/barang (mis. "Penjualan Rokok" -> "Rokok").
_PRODUK_PREFIX_PATTERN = re.compile(
    r"^(?:\s*(?:penjualan|pembelian|pembayaran|setoran|penerimaan|pengeluaran|"
    r"pendapatan|beban|belanja)\s+)+",
    re.IGNORECASE,
)


def _normalisasi_produk(deskripsi: str) -> str:
    """Ekstrak nama produk/barang dari deskripsi transaksi dengan memangkas
    awalan kata kerja (penjualan/pembelian/pembayaran/dst.). Bila hasil kosong,
    gunakan deskripsi utuh supaya tidak kehilangan informasi."""
    if not deskripsi:
        return "Transaksi"
    bersih = _PRODUK_PREFIX_PATTERN.sub("", deskripsi).strip()
    return bersih or deskripsi.strip()


def get_statistik_produk(
    db: Session,
    tanggal_per: date | None = None,
    user_id: str | None = None,
    limit: int = 10,
    upload_id: str | None = None,
) -> list[StatistikProduk]:
    """
    Ranking produk/barang (diekstrak dari deskripsi transaksi) berdasarkan:
      - nilai  : total nominal transaksi yang memuat produk tsb (terbesar)
      - jumlah : frekuensi transaksi produk tsb (terbanyak)

    Nilai per jurnal = total debit (setara kredit untuk jurnal seimbang), jadi
    transaksi multi-baris tidak menggandakan nominal. Hanya jurnal UMUM yang
    dihitung (penyesuaian/penutup diabaikan).
    """
    tanggal_per = tanggal_per or date.today()
    sub = (
        db.query(
            JurnalUmum.id.label("jurnal_id"),
            JurnalUmum.deskripsi.label("deskripsi"),
            func.coalesce(func.sum(JurnalDetail.debit), 0).label("amt"),
        )
        .join(JurnalDetail, JurnalDetail.jurnal_id == JurnalUmum.id)
        .filter(JurnalUmum.jenis == JenisJurnal.UMUM, JurnalUmum.tanggal <= tanggal_per)
    )
    if user_id:
        sub = sub.filter(JurnalUmum.created_by_id == user_id)
    if upload_id:
        sub = sub.filter(JurnalUmum.sumber_upload_id == upload_id)
    rows = sub.group_by(JurnalUmum.id).all()

    agregat: dict[str, dict] = {}
    for r in rows:
        amt = float(r.amt)
        if amt <= 0:
            continue
        nama = _normalisasi_produk(str(r.deskripsi or ""))
        agg = agregat.setdefault(nama, {"nilai": 0.0, "jumlah": 0})
        agg["nilai"] += amt
        agg["jumlah"] += 1

    hasil = [
        StatistikProduk(produk=nama, nilai=round(agg["nilai"], 2), jumlah=agg["jumlah"])
        for nama, agg in agregat.items()
    ]
    hasil.sort(key=lambda p: p.nilai, reverse=True)
    return hasil[:limit]
