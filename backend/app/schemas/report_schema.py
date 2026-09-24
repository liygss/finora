"""Schema response untuk laporan-laporan hasil accounting engine."""

from datetime import date

from pydantic import BaseModel, ConfigDict


class ORMCompatibleModel(BaseModel):
    """Base yang bisa langsung memvalidasi dataclass hasil accounting engine (bukan cuma dict)."""

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Buku Besar
# ---------------------------------------------------------------------------
class BukuBesarBarisResponse(ORMCompatibleModel):
    tanggal: date
    no_bukti: str
    deskripsi: str
    keterangan: str | None = None
    debit: float
    kredit: float
    saldo_berjalan: float


class BukuBesarResponse(BaseModel):
    kode_akun: str
    nama_akun: str
    saldo_awal: float
    saldo_akhir: float
    baris: list[BukuBesarBarisResponse]


# ---------------------------------------------------------------------------
# Neraca Saldo
# ---------------------------------------------------------------------------
class NeracaSaldoBarisResponse(ORMCompatibleModel):
    kode_akun: str
    nama_akun: str
    kategori: str
    debit: float
    kredit: float


class NeracaSaldoResponse(BaseModel):
    tanggal_per: date | None
    baris: list[NeracaSaldoBarisResponse]
    total_debit: float
    total_kredit: float
    is_balance: bool


# ---------------------------------------------------------------------------
# Laporan Laba Rugi
# ---------------------------------------------------------------------------
class BarisLaporanResponse(ORMCompatibleModel):
    kode_akun: str
    nama_akun: str
    nilai: float


class LaporanLabaRugiResponse(BaseModel):
    tanggal_per: date | None
    tanggal_mulai: date | None = None
    tanggal_akhir: date | None = None
    pendapatan: list[BarisLaporanResponse]
    hpp: list[BarisLaporanResponse]
    beban_operasional: list[BarisLaporanResponse]
    total_pendapatan: float
    total_hpp: float
    laba_kotor: float
    total_beban_operasional: float
    laba_bersih: float


# ---------------------------------------------------------------------------
# Laporan Posisi Keuangan
# ---------------------------------------------------------------------------
class LaporanPosisiKeuanganResponse(BaseModel):
    tanggal_per: date | None
    aset: list[BarisLaporanResponse]
    liabilitas: list[BarisLaporanResponse]
    modal: list[BarisLaporanResponse]
    laba_rugi_berjalan: float
    total_aset: float
    total_liabilitas: float
    total_modal: float
    total_liabilitas_dan_modal: float
    is_balance: bool


# ---------------------------------------------------------------------------
# CALK
# ---------------------------------------------------------------------------
class RincianAkunResponse(ORMCompatibleModel):
    kode_akun: str
    nama_akun: str
    nilai: float
    catatan: str = ""


class CalkResponse(BaseModel):
    tanggal_per: date | None
    kebijakan_akuntansi: list[str]
    rincian_aset: list[RincianAkunResponse]
    rincian_liabilitas: list[RincianAkunResponse]
    rincian_pendapatan: list[RincianAkunResponse]
    rincian_beban: list[RincianAkunResponse]
    catatan_tambahan: list[str]


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
class DashboardSummaryResponse(BaseModel):
    tanggal_per: date
    saldo_kas: float
    saldo_bank: float
    total_kas_dan_bank: float
    pendapatan_bulan_ini: float
    beban_bulan_ini: float
    laba_rugi_bulan_ini: float
    total_pendapatan_tahun_berjalan: float
    total_beban_tahun_berjalan: float
    laba_rugi_tahun_berjalan: float
    jumlah_transaksi_bulan_ini: int


class MonthlyTrendResponse(BaseModel):
    bulan: str  # YYYY-MM
    label: str
    pendapatan: float
    beban: float
    laba_rugi: float


class KategoriBreakdown(ORMCompatibleModel):
    kode_akun: str
    nama_akun: str
    nilai: float


class StatistikProdukItem(BaseModel):
    produk: str
    nilai: float
    jumlah: int


class DashboardInsightResponse(BaseModel):
    insight: str
    generated_at: date
    has_data: bool


class AlertItem(BaseModel):
    level: str  # danger | warning | info
    judul: str
    deskripsi: str


class DashboardAlertsResponse(BaseModel):
    alerts: list[AlertItem]


class PiutangUtangResponse(BaseModel):
    tanggal_per: date
    piutang_usaha: float
    utang_usaha: float
    utang_pajak: float
    utang_bank: float
    selisih: float


class ProyeksiBulan(BaseModel):
    bulan: str  # YYYY-MM
    label: str
    proyeksi_laba: float
    kas_akhir: float


class ProyeksiResponse(BaseModel):
    tanggal_per: date
    proyeksi: list[ProyeksiBulan]


class DashboardOverviewResponse(BaseModel):
    summary: DashboardSummaryResponse
    monthly: list[MonthlyTrendResponse]
    alerts: list[AlertItem]
    piutang_utang: PiutangUtangResponse
    kategori: list[KategoriBreakdown]
    produk: list[StatistikProdukItem] = []


# ---------------------------------------------------------------------------
# Jurnal Penyesuaian (input)
# ---------------------------------------------------------------------------
class PenyesuaianPerlengkapanInput(BaseModel):
    no_bukti: str
    tanggal: date
    nilai_terpakai: float
    kode_akun_perlengkapan: str = "1-1400"
    kode_akun_beban_perlengkapan: str = "5-2300"


class PenyesuaianPenyusutanInput(BaseModel):
    no_bukti: str
    tanggal: date
    harga_perolehan: float
    nilai_residu: float
    umur_ekonomis_tahun: float
    kode_akun_beban_penyusutan: str = "5-2400"
    kode_akun_akumulasi_penyusutan: str = "1-2100"
    bulan_penyusutan: float = 1


# ---------------------------------------------------------------------------
# Tax
# ---------------------------------------------------------------------------
class PPhFinalUMKMRequest(BaseModel):
    omzet_bulan_ini: float
    omzet_kumulatif_sebelum_bulan_ini: float = 0
    wp_orang_pribadi: bool = True


class PPhFinalUMKMResponse(BaseModel):
    omzet_bulan_ini: float
    omzet_kumulatif_tahun_berjalan: float
    omzet_kena_pajak: float
    pph_final_terutang: float
    catatan: str


class PPNRequest(BaseModel):
    nilai: float
    sudah_termasuk_ppn: bool = False
    barang_mewah: bool = False


class PPNResponse(BaseModel):
    dasar_pengenaan_pajak: float
    tarif_digunakan: float
    ppn: float
    harga_termasuk_ppn: float
    catatan: str = ""


# ---------------------------------------------------------------------------
# Tutup Buku (penutupan buku tahunan)
# ---------------------------------------------------------------------------
class TutupBukuStatusRow(ORMCompatibleModel):
    tahun: int
    is_closed: bool
    laba_bersih: float | None = None
    tanggal_tutup: date | None = None


class TutupBukuAkunSaldo(ORMCompatibleModel):
    kode_akun: str
    nama_akun: str
    saldo: float


class TutupBukuReviewResponse(ORMCompatibleModel):
    tahun: int
    tanggal_per: date
    pendapatan: list[TutupBukuAkunSaldo]
    beban: list[TutupBukuAkunSaldo]
    total_pendapatan: float
    total_beban: float
    laba_bersih: float
    prive: float


class TutupBukuRequest(BaseModel):
    tahun: int


class TutupBukuResultResponse(ORMCompatibleModel):
    tahun: int
    tanggal_tutup: date
    laba_bersih: float
    jurnal_penutup_id: str
    jurnal_penutup_no_bukti: str
    jurnal_prive_id: str | None = None
    jurnal_prive_no_bukti: str | None = None
