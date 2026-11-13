"""
Laporan Laba Rugi (Income Statement) sesuai format SAK EMKM:
    Pendapatan
    (-) Beban Pokok Penjualan (HPP)      -> jika ada usaha dagang
    = Laba Kotor
    (-) Beban Operasional
    = Laba (Rugi) Bersih Sebelum Pajak

Dihitung dari Neraca Saldo (setelah jurnal penyesuaian diinput), bukan
dari tabel tersendiri, supaya selalu konsisten dengan data jurnal terbaru.
"""

from dataclasses import dataclass, field
from datetime import date

from sqlalchemy.orm import Session

from app.accounting.neraca_saldo import get_neraca_saldo
from app.database.models import KategoriAkun

KODE_AKUN_HPP_PREFIX = "5-1"  # konvensi: kode akun HPP dimulai dengan 5-1xxx (lihat migration.py)


@dataclass
class BarisLaporan:
    kode_akun: str
    nama_akun: str
    nilai: float


@dataclass
class LaporanLabaRugi:
    tanggal_per: date | None
    pendapatan: list[BarisLaporan] = field(default_factory=list)
    hpp: list[BarisLaporan] = field(default_factory=list)
    beban_operasional: list[BarisLaporan] = field(default_factory=list)

    @property
    def total_pendapatan(self) -> float:
        return round(sum(b.nilai for b in self.pendapatan), 2)

    @property
    def total_hpp(self) -> float:
        return round(sum(b.nilai for b in self.hpp), 2)

    @property
    def laba_kotor(self) -> float:
        return round(self.total_pendapatan - self.total_hpp, 2)

    @property
    def total_beban_operasional(self) -> float:
        return round(sum(b.nilai for b in self.beban_operasional), 2)

    @property
    def laba_bersih(self) -> float:
        return round(self.laba_kotor - self.total_beban_operasional, 2)


def get_laporan_laba_rugi(
    db: Session,
    tanggal_per: date | None = None,
    user_id: str | None = None,
    tanggal_mulai: date | None = None,
    tanggal_akhir: date | None = None,
    upload_id: str | None = None,
) -> LaporanLabaRugi:
    neraca_saldo = get_neraca_saldo(
        db, tanggal_per, user_id=user_id,
        tanggal_mulai=tanggal_mulai, tanggal_akhir=tanggal_akhir,
        upload_id=upload_id,
    )
    laporan = LaporanLabaRugi(tanggal_per=tanggal_per)

    for baris in neraca_saldo.baris:
        if baris.kategori == KategoriAkun.PENDAPATAN.value:
            # Pendapatan bersaldo normal kredit -> nilainya ada di kolom kredit
            laporan.pendapatan.append(BarisLaporan(baris.kode_akun, baris.nama_akun, baris.kredit))
        elif baris.kategori == KategoriAkun.BEBAN.value:
            nilai = baris.debit  # beban bersaldo normal debit
            if baris.kode_akun.startswith(KODE_AKUN_HPP_PREFIX):
                laporan.hpp.append(BarisLaporan(baris.kode_akun, baris.nama_akun, nilai))
            else:
                laporan.beban_operasional.append(BarisLaporan(baris.kode_akun, baris.nama_akun, nilai))

    return laporan
