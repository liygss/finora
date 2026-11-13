"""
Laporan Posisi Keuangan (Balance Sheet) sesuai format SAK EMKM:
    ASET = LIABILITAS + MODAL

Laba/rugi tahun berjalan (dari Laporan Laba Rugi) otomatis ditambahkan
ke sisi Modal supaya laporan tetap balance, sesuai prinsip bahwa laba
menambah modal pemilik.
"""

from dataclasses import dataclass, field
from datetime import date

from sqlalchemy.orm import Session

from app.accounting.laporan_laba_rugi import get_laporan_laba_rugi
from app.accounting.neraca_saldo import get_neraca_saldo
from app.database.models import KategoriAkun


@dataclass
class BarisLaporan:
    kode_akun: str
    nama_akun: str
    nilai: float


@dataclass
class LaporanPosisiKeuangan:
    tanggal_per: date | None
    aset: list[BarisLaporan] = field(default_factory=list)
    liabilitas: list[BarisLaporan] = field(default_factory=list)
    modal: list[BarisLaporan] = field(default_factory=list)
    laba_rugi_berjalan: float = 0.0

    @property
    def total_aset(self) -> float:
        return round(sum(b.nilai for b in self.aset), 2)

    @property
    def total_liabilitas(self) -> float:
        return round(sum(b.nilai for b in self.liabilitas), 2)

    @property
    def total_modal(self) -> float:
        return round(sum(b.nilai for b in self.modal) + self.laba_rugi_berjalan, 2)

    @property
    def total_liabilitas_dan_modal(self) -> float:
        return round(self.total_liabilitas + self.total_modal, 2)

    @property
    def is_balance(self) -> bool:
        return round(self.total_aset, 2) == self.total_liabilitas_dan_modal


def get_laporan_posisi_keuangan(
    db: Session,
    tanggal_per: date | None = None,
    user_id: str | None = None,
    upload_id: str | None = None,
) -> LaporanPosisiKeuangan:
    neraca_saldo = get_neraca_saldo(db, tanggal_per, user_id=user_id, upload_id=upload_id)
    laba_rugi = get_laporan_laba_rugi(db, tanggal_per, user_id=user_id, upload_id=upload_id)

    laporan = LaporanPosisiKeuangan(tanggal_per=tanggal_per, laba_rugi_berjalan=laba_rugi.laba_bersih)

    for baris in neraca_saldo.baris:
        if baris.kategori == KategoriAkun.ASET.value:
            # Akun kontra-aset (mis. Akumulasi Penyusutan) bersaldo normal kredit,
            # jadi nilainya perlu dikurangkan (negatif) dari total aset.
            is_kontra_aset = baris.debit == 0 and baris.kredit > 0
            nilai = -baris.kredit if is_kontra_aset else baris.debit
            laporan.aset.append(BarisLaporan(baris.kode_akun, baris.nama_akun, nilai))
        elif baris.kategori == KategoriAkun.LIABILITAS.value:
            laporan.liabilitas.append(BarisLaporan(baris.kode_akun, baris.nama_akun, baris.kredit))
        elif baris.kategori == KategoriAkun.MODAL.value:
            # Prive bersaldo normal debit (mengurangi modal), akun modal lain bersaldo kredit
            is_pengurang_modal = baris.debit > 0 and baris.kredit == 0
            nilai = -baris.debit if is_pengurang_modal else baris.kredit
            laporan.modal.append(BarisLaporan(baris.kode_akun, baris.nama_akun, nilai))

    return laporan
