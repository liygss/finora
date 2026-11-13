"""
Router dashboard: ringkasan keuangan UMKM (saldo kas/bank, pendapatan &
beban bulan berjalan, laba/rugi), dihitung langsung dari accounting engine.
"""

import asyncio
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.accounting.dashboard_metrics import (
    DashboardSummary,
    get_dashboard_summary,
    get_pendapatan_beban_bulanan,
    get_statistik_produk,
)
from app.accounting.laporan_laba_rugi import get_laporan_laba_rugi
from app.accounting.laporan_posisi_keuangan import get_laporan_posisi_keuangan
from app.config.logging import get_logger
from app.database.database import get_db
from app.database.models import JurnalUmum, StatusUpload, UploadedFile, User
from app.llm.ollama_service import OllamaError, chat_completion
from app.middleware.auth import require_active_user
from app.schemas.report_schema import (
    AlertItem,
    DashboardAlertsResponse,
    DashboardInsightResponse,
    DashboardOverviewResponse,
    DashboardSummaryResponse,
    KategoriBreakdown,
    MonthlyTrendResponse,
    PiutangUtangResponse,
    ProyeksiBulan,
    ProyeksiResponse,
    StatistikProdukItem,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])
logger = get_logger(__name__)

INSIGHT_TIMEOUT_SECONDS = 90


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "module": "dashboard"}


def _resolve_upload_scope(db: Session, user_id: str, upload_id: str | None) -> UploadedFile | None:
    if not upload_id:
        return None
    uploaded_file = (
        db.query(UploadedFile)
        .filter(
            UploadedFile.id == upload_id,
            UploadedFile.uploaded_by_id == user_id,
            UploadedFile.status == StatusUpload.POSTED,
        )
        .first()
    )
    if uploaded_file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File upload tidak ditemukan atau belum committed")
    return uploaded_file


def _latest_data_date(db: Session, user_id: str, upload_id: str | None = None) -> date:
    """Tanggal transaksi terbaru milik user atau upload terpilih."""
    query = db.query(func.max(JurnalUmum.tanggal)).filter(JurnalUmum.created_by_id == user_id)
    if upload_id:
        query = query.filter(JurnalUmum.sumber_upload_id == upload_id)
    return query.scalar() or date.today()


@router.get("/summary", response_model=DashboardSummaryResponse)
def summary(
    tanggal_per: date | None = None,
    upload_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
) -> DashboardSummaryResponse:
    _resolve_upload_scope(db, current_user.id, upload_id)
    # Kalau tidak ada tanggal yang dipilih, otomatis ikut data terbaru user/upload.
    if tanggal_per is None:
        tanggal_per = _latest_data_date(db, current_user.id, upload_id)
    hasil = get_dashboard_summary(db, tanggal_per, user_id=current_user.id, upload_id=upload_id)
    return DashboardSummaryResponse(
        tanggal_per=hasil.tanggal_per,
        saldo_kas=hasil.saldo_kas,
        saldo_bank=hasil.saldo_bank,
        total_kas_dan_bank=hasil.total_kas_dan_bank,
        pendapatan_bulan_ini=hasil.pendapatan_bulan_ini,
        beban_bulan_ini=hasil.beban_bulan_ini,
        laba_rugi_bulan_ini=hasil.laba_rugi_bulan_ini,
        total_pendapatan_tahun_berjalan=hasil.total_pendapatan_tahun_berjalan,
        total_beban_tahun_berjalan=hasil.total_beban_tahun_berjalan,
        laba_rugi_tahun_berjalan=hasil.laba_rugi_tahun_berjalan,
        jumlah_transaksi_bulan_ini=hasil.jumlah_transaksi_bulan_ini,
    )


@router.get("/monthly", response_model=list[MonthlyTrendResponse])
def monthly(
    tanggal_per: date | None = None,
    tanggal_mulai: date | None = None,
    jumlah_bulan: int = 6,
    upload_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
) -> list[MonthlyTrendResponse]:
    """Pendapatan vs beban per bulan (default 6 bulan terakhir) untuk chart."""
    _resolve_upload_scope(db, current_user.id, upload_id)
    if tanggal_per is None:
        tanggal_per = _latest_data_date(db, current_user.id, upload_id)
    hasil = get_pendapatan_beban_bulanan(
        db, tanggal_per, user_id=current_user.id, jumlah_bulan=jumlah_bulan,
        tanggal_mulai=tanggal_mulai, upload_id=upload_id,
    )
    return [
        MonthlyTrendResponse(
            bulan=h.bulan,
            label=h.label,
            pendapatan=h.pendapatan,
            beban=h.beban,
            laba_rugi=h.laba_rugi,
        )
        for h in hasil
    ]


def _beban_per_akun_bulan_ini(
    db: Session,
    tanggal_per: date,
    user_id: str,
    limit: int = 10,
    tanggal_mulai: date | None = None,
    upload_id: str | None = None,
) -> list[KategoriBreakdown]:
    """Beban periode per akun = kumulatif s/d tanggal_per dikurangi kumulatif
    s/d sehari sebelum awal periode. Tanpa tanggal_mulai, awal periode = tanggal 1
    bulan berjalan (pola yang sama dengan /summary biar konsisten). Dengan
    tanggal_mulai (custom range), hasil mengikuti rentang yang dipilih."""
    if tanggal_mulai:
        akhir_sebelum_awal = tanggal_mulai - timedelta(days=1)
    else:
        akhir_sebelum_awal = tanggal_per.replace(day=1) - timedelta(days=1)

    def _map(lr):
        return {b.kode_akun: (b.nama_akun, b.nilai) for b in (lr.hpp + lr.beban_operasional)}

    sekarang = _map(get_laporan_laba_rugi(db, tanggal_per, user_id=user_id, upload_id=upload_id))
    sebelum_periode = _map(get_laporan_laba_rugi(db, akhir_sebelum_awal, user_id=user_id, upload_id=upload_id))

    hasil = []
    for kode, (nama_akun, nilai) in sekarang.items():
        nilai_sebelum = sebelum_periode.get(kode, (None, 0.0))[1]
        diff = round(nilai - nilai_sebelum, 2)
        if diff > 0:
            hasil.append(KategoriBreakdown(kode_akun=kode, nama_akun=nama_akun, nilai=diff))
    hasil.sort(key=lambda b: b.nilai, reverse=True)
    return hasil[:limit]


@router.get("/kategori", response_model=list[KategoriBreakdown])
def kategori(
    tanggal_per: date | None = None,
    tanggal_mulai: date | None = None,
    upload_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
) -> list[KategoriBreakdown]:
    """Top pengeluaran periode per akun (HPP + beban operasional), mengikuti
    rentang tanggal_mulai s/d tanggal_per bila diberikan."""
    _resolve_upload_scope(db, current_user.id, upload_id)
    if tanggal_per is None:
        tanggal_per = _latest_data_date(db, current_user.id, upload_id)
    return _beban_per_akun_bulan_ini(
        db, tanggal_per, current_user.id, tanggal_mulai=tanggal_mulai, upload_id=upload_id,
    )


def _fmt_rp(value: float) -> str:
    if value == int(value):
        return f"Rp {value:,.0f}".replace(",", ".")
    return f"Rp {value:,.2f}".replace(",", ".")


def _build_insight_context(
    db: Session,
    tanggal_per: date,
    user_id: str,
    upload_id: str | None = None,
) -> str:
    summary = get_dashboard_summary(db, tanggal_per, user_id=user_id, upload_id=upload_id)
    label_bulan = tanggal_per.strftime("%B %Y")

    lines = [
        f"Periode: {label_bulan}",
        f"- Pendapatan bulan ini: {_fmt_rp(summary.pendapatan_bulan_ini)}",
        f"- Beban bulan ini: {_fmt_rp(summary.beban_bulan_ini)}",
        f"- Laba/Rugi bulan ini: {_fmt_rp(summary.laba_rugi_bulan_ini)}",
        f"- Laba/Rugi tahun berjalan: {_fmt_rp(summary.laba_rugi_tahun_berjalan)}",
        f"- Saldo Kas: {_fmt_rp(summary.saldo_kas)}, Saldo Bank: {_fmt_rp(summary.saldo_bank)}",
        f"- Jumlah transaksi bulan ini: {summary.jumlah_transaksi_bulan_ini}",
    ]

    rincian = _beban_per_akun_bulan_ini(db, tanggal_per, user_id, limit=5, upload_id=upload_id)
    if rincian:
        lines.append("- Beban terbesar bulan ini: " + "; ".join(
            f"{b.nama_akun} ({_fmt_rp(b.nilai)})" for b in rincian
        ))

    tren = get_pendapatan_beban_bulanan(
        db, tanggal_per, user_id=user_id, jumlah_bulan=3, upload_id=upload_id,
    )
    if len(tren) >= 2:
        laju_last, laju_prev = tren[-1], tren[-2]
        if laju_prev.pendapatan > 0:
            pct = (laju_last.pendapatan - laju_prev.pendapatan) / laju_prev.pendapatan * 100
            lines.append(f"- Pendapatan vs bulan sebelumnya: {pct:+.1f}%")
        if laju_prev.beban > 0:
            pct = (laju_last.beban - laju_prev.beban) / laju_prev.beban * 100
            lines.append(f"- Beban vs bulan sebelumnya: {pct:+.1f}%")

    beban_avg = sum(m.beban for m in tren) / max(len(tren), 1)
    if beban_avg > 0:
        lines.append(f"- Rata-rata beban bulanan: {_fmt_rp(beban_avg)}")

    return "\n".join(lines)


@router.get("/insight", response_model=DashboardInsightResponse)
async def insight(
    tanggal_per: date | None = None,
    upload_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
) -> DashboardInsightResponse:
    """Ringkasan bulanan otomatis (Insight AI) berbasis LLM.

    Tidak memanggil LLM bila belum ada data sama sekali — return pesan statis
    supaya tidak membuang waktu/kuota saat dashboard masih kosong.
    """
    _resolve_upload_scope(db, current_user.id, upload_id)
    if tanggal_per is None:
        tanggal_per = _latest_data_date(db, current_user.id, upload_id)

    summary = get_dashboard_summary(db, tanggal_per, user_id=current_user.id, upload_id=upload_id)
    if summary.jumlah_transaksi_bulan_ini == 0 and summary.total_kas_dan_bank == 0:
        return DashboardInsightResponse(
            insight=(
                "Belum ada data transaksi untuk dianalisis. Upload file transaksi "
                "atau buat jurnal baru, lalu Insight AI akan otomatis merangkum "
                "kondisi keuangan usaha Anda."
            ),
            generated_at=date.today(),
            has_data=False,
        )

    context = _build_insight_context(db, tanggal_per, current_user.id, upload_id=upload_id)
    messages = [
        {
            "role": "system",
            "content": (
                "Kamu adalah penasihat keuangan untuk pemilik usaha mikro (UMKM) di Indonesia. "
                "Ringkas kondisi keuangan mereka dalam bahasa Indonesia yang hangat, jelas, dan praktis. "
                "Sebutkan angka persis seperti yang diberikan."
            ),
        },
        {
            "role": "user",
            "content": (
                f"{context}\n\n"
                "Tulis insight singkat (maksimal 110 kata) dengan format: "
                "3 poin berisi hal yang perlu diperhatikan (tiap poin diawali '- '), "
                "lalu akhiri dengan satu baris 'Saran: <aksi konkret>'."
            ),
        },
    ]

    try:
        hasil = await asyncio.wait_for(
            asyncio.to_thread(chat_completion, messages, temperature=0.3),
            timeout=INSIGHT_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Insight AI terlalu lama merespons. Silakan coba lagi nanti.",
        )
    except OllamaError as exc:
        logger.warning("Insight AI gagal: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Layanan AI sedang sibuk. Silakan coba lagi.",
        ) from exc

    return DashboardInsightResponse(
        insight=hasil.strip() or "Belum ada insight yang bisa disusun.",
        generated_at=date.today(),
        has_data=True,
    )


def _geser_bulan(bulan: date, delta: int) -> date:
    """Geser `delta` bulan dari tanggal yang dijamin di tanggal 1 (dua arah)."""
    total = bulan.year * 12 + (bulan.month - 1) + delta
    return date(total // 12, total % 12 + 1, 1)


def _hitung_piutang_utang(
    db: Session, tanggal_per: date, user_id: str, upload_id: str | None = None
) -> PiutangUtangResponse:
    """Pilah saldo piutang & utang dari laporan posisi keuangan.

    Asumsi penamaan akun standar chart of account UMKM:
      - Piutang  : akun aset yang namanya memuat "Piutang" (mis. 1-1200)
      - Utang    : akun liabilitas; "Utang Pajak..." → pajak,
                   "... Bank" → utang bank, selebihnya → utang usaha.
    """
    laporan = get_laporan_posisi_keuangan(db, tanggal_per, user_id=user_id, upload_id=upload_id)

    def _jumlah(baris_list, pred):
        return round(sum(b.nilai for b in baris_list if pred(b)), 2)

    piutang = _jumlah(laporan.aset, lambda b: "piutang" in b.nama_akun.lower())

    def _is_pajak(b):
        return "pajak" in b.nama_akun.lower()

    def _is_bank(b):
        return "bank" in b.nama_akun.lower()

    utang_pajak = _jumlah(laporan.liabilitas, _is_pajak)
    utang_bank = _jumlah(laporan.liabilitas, lambda b: _is_bank(b) and not _is_pajak(b))
    utang_usaha = _jumlah(
        laporan.liabilitas,
        lambda b: "utang" in b.nama_akun.lower() and not _is_pajak(b) and not _is_bank(b),
    )
    selisih = round(piutang - (utang_usaha + utang_pajak + utang_bank), 2)

    return PiutangUtangResponse(
        tanggal_per=tanggal_per,
        piutang_usaha=piutang,
        utang_usaha=utang_usaha,
        utang_pajak=utang_pajak,
        utang_bank=utang_bank,
        selisih=selisih,
    )


@router.get("/piutang-utang", response_model=PiutangUtangResponse)
def piutang_utang(
    tanggal_per: date | None = None,
    upload_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
) -> PiutangUtangResponse:
    """Ringkasan piutang & utang (usaha, pajak, bank) dari laporan posisi keuangan."""
    _resolve_upload_scope(db, current_user.id, upload_id)
    if tanggal_per is None:
        tanggal_per = _latest_data_date(db, current_user.id, upload_id)
    return _hitung_piutang_utang(db, tanggal_per, current_user.id, upload_id=upload_id)


@router.get("/proyeksi", response_model=ProyeksiResponse)
def proyeksi(
    tanggal_per: date | None = None,
    upload_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
) -> ProyeksiResponse:
    """Proyeksi laba bersih & saldo kas 3 bulan ke depan (estimasi sederhana).

    Proyeksi laba bulanan memakai rata-rata laba bersih 3 bulan terakhir;
    saldo kas akhir bulan = saldo kas/bank sekarang + akumulasi proyeksi.
    """
    _resolve_upload_scope(db, current_user.id, upload_id)
    if tanggal_per is None:
        tanggal_per = _latest_data_date(db, current_user.id, upload_id)

    summary = get_dashboard_summary(db, tanggal_per, user_id=current_user.id, upload_id=upload_id)
    if summary.jumlah_transaksi_bulan_ini == 0 and summary.total_kas_dan_bank == 0:
        return ProyeksiResponse(tanggal_per=tanggal_per, proyeksi=[])

    tren = get_pendapatan_beban_bulanan(
        db, tanggal_per, user_id=current_user.id, jumlah_bulan=3, upload_id=upload_id,
    )
    # Rata-rata memakai bulan yang benar-benar punya aktivitas (maksimal 3),
    # supaya bulan kosong di awal tidak melemahkan estimasi.
    bulan_aktif = [m for m in tren if m.pendapatan or m.beban][-3:]
    rata_rata_laba = (
        round(sum(m.laba_rugi for m in bulan_aktif) / len(bulan_aktif), 2)
        if bulan_aktif
        else 0.0
    )
    kas = summary.total_kas_dan_bank
    cursor = tanggal_per.replace(day=1)
    hasil: list[ProyeksiBulan] = []
    for i in range(1, 4):
        bulan = _geser_bulan(cursor, i)
        kas = round(kas + rata_rata_laba, 2)
        hasil.append(
            ProyeksiBulan(
                bulan=bulan.strftime("%Y-%m"),
                label=bulan.strftime("%b"),
                proyeksi_laba=rata_rata_laba,
                kas_akhir=kas,
            )
        )
    return ProyeksiResponse(tanggal_per=tanggal_per, proyeksi=hasil)


def _build_alerts(
    db: Session,
    summary: DashboardSummary,
    user_id: str,
    upload_id: str | None = None,
) -> list[AlertItem]:
    """Temuan penting (smart alerts) berbasis aturan sederhana pada akuntansi.

    Prioritas: danger → warning → info. Tidak ada data sama sekali → kosong.
    Memakai summary yang sudah dihitung supaya /alerts dan /overview berbagi
    satu sumber yang sama (tidak menghitung ulang).
    """
    tanggal_per = summary.tanggal_per
    hasil: list[AlertItem] = []
    if summary.jumlah_transaksi_bulan_ini == 0 and summary.total_kas_dan_bank == 0:
        return hasil

    tren = get_pendapatan_beban_bulanan(
        db, tanggal_per, user_id=user_id, jumlah_bulan=4, upload_id=upload_id,
    )

    # danger: laba negatif 2 bulan beruntun
    if len(tren) >= 2 and tren[-1].laba_rugi < 0 and tren[-2].laba_rugi < 0:
        hasil.append(
            AlertItem(
                level="danger",
                judul="Usaha rugi beruntun",
                deskripsi=(
                    f"Laba negatif 2 bulan berturut-turut "
                    f"({tren[-2].label}-{tren[-1].label}: "
                    f"{_fmt_rp(tren[-2].laba_rugi)} dan {_fmt_rp(tren[-1].laba_rugi)}). "
                    "Cek ulang harga pokok dan biaya operasional Anda."
                ),
            )
        )

    # danger: saldo kas + bank negatif
    if summary.total_kas_dan_bank < 0:
        hasil.append(
            AlertItem(
                level="danger",
                judul="Saldo kas & bank negatif",
                deskripsi=(
                    f"Total saldo kas dan bank tercatat {_fmt_rp(summary.total_kas_dan_bank)}. "
                    "Segera pastikan pencatatan maupun arus kas kembali positif."
                ),
            )
        )

    # warning: pendapatan ada tapi HPP tidak tercatat -> margin tidak realistis
    laporan_rugi = get_laporan_laba_rugi(db, tanggal_per, user_id=user_id, upload_id=upload_id)
    total_hpp = laporan_rugi.total_hpp
    if summary.pendapatan_bulan_ini > 0 and total_hpp <= 0:
        hasil.append(
            AlertItem(
                level="warning",
                judul="HPP belum dicatat — margin tampak tidak realistis",
                deskripsi=(
                    f"Pendapatan bulan ini {_fmt_rp(summary.pendapatan_bulan_ini)} tercatat, "
                    "tetapi tidak ada Harga Pokok Penjualan (HPP) sama sekali. "
                    "Akibatnya laba bisa tampak sangat tinggi. Untuk usaha dagang, catat HPP "
                    "pada saat barang terjual: Debit HPP (5-1000), Kredit Persediaan (1-1300) "
                    "sebesar harga pokok barang yang terjual."
                ),
            )
        )
    elif summary.pendapatan_bulan_ini > 0 and total_hpp > 0:
        # cek margin kotor tidak realistis (>=95%) sebagai tanda HPP sangat kecil
        margin_kotor = (summary.pendapatan_bulan_ini - total_hpp) / summary.pendapatan_bulan_ini * 100
        if margin_kotor >= 95:
            hasil.append(
                AlertItem(
                    level="warning",
                    judul="Margin kotor tidak realistis",
                    deskripsi=(
                        f"Margin kotor bulan ini {margin_kotor:.0f}% "
                        f"(Pendapatan {_fmt_rp(summary.pendapatan_bulan_ini)} vs HPP "
                        f"{_fmt_rp(total_hpp)}). Periksa kembali apakah HPP sudah dicatat "
                        "lengkap sesuai barang yang terjual."
                    ),
                )
            )

    # warning: beban naik >20% vs bulan lalu
    if len(tren) >= 2 and tren[-2].beban > 0:
        pct = (tren[-1].beban - tren[-2].beban) / tren[-2].beban * 100
        if pct > 20:
            hasil.append(
                AlertItem(
                    level="warning",
                    judul="Beban naik signifikan",
                    deskripsi=(
                        f"Beban bulan ini naik {pct:.0f}% dibanding bulan lalu "
                        f"({_fmt_rp(tren[-2].beban)} → {_fmt_rp(tren[-1].beban)}). "
                        "Periksa pos beban yang paling membengkak."
                    ),
                )
            )

    # warning: pendapatan turun berturut-turut
    if len(tren) >= 3 and tren[-1].pendapatan < tren[-2].pendapatan < tren[-3].pendapatan:
        hasil.append(
            AlertItem(
                level="warning",
                judul="Pendapatan menurun",
                deskripsi=(
                    f"Pendapatan turun 3 bulan berturut-turut "
                    f"({_fmt_rp(tren[-3].pendapatan)} → {_fmt_rp(tren[-2].pendapatan)} "
                    f"→ {_fmt_rp(tren[-1].pendapatan)}). Pertimbangkan promosi atau "
                    "diversifikasi produk/layanan."
                ),
            )
        )

    # info: satu kategori beban mendominasi >40%
    rincian = _beban_per_akun_bulan_ini(db, tanggal_per, user_id, limit=10, upload_id=upload_id)
    total_beban = sum(b.nilai for b in rincian)
    if rincian and total_beban > 0:
        top = rincian[0]
        porsi = top.nilai / total_beban * 100
        if porsi > 40:
            hasil.append(
                AlertItem(
                    level="info",
                    judul=f"Beban dominan: {top.nama_akun}",
                    deskripsi=(
                        f"{top.nama_akun} menyumbang {porsi:.0f}% dari total beban "
                        f"bulan ini. Evaluasi apakah biaya tersebut masih wajar."
                    ),
                )
            )

    # info: ada kewajiban utang pajak
    piutang_utang = _hitung_piutang_utang(db, tanggal_per, user_id, upload_id=upload_id)
    if piutang_utang.utang_pajak > 0:
        hasil.append(
            AlertItem(
                level="info",
                judul="Ada kewajiban pajak",
                deskripsi=(
                    f"Saldo utang pajak tercatat {_fmt_rp(piutang_utang.utang_pajak)}. "
                    "Siapkan dana untuk pelunasan agar tidak terkena sanksi."
                ),
            )
        )

    return hasil[:5]


@router.get("/alerts", response_model=DashboardAlertsResponse)
def alerts(
    tanggal_per: date | None = None,
    upload_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
) -> DashboardAlertsResponse:
    """Temuan penting (smart alerts). Ringkasan dihitung sekali per request."""
    _resolve_upload_scope(db, current_user.id, upload_id)
    if tanggal_per is None:
        tanggal_per = _latest_data_date(db, current_user.id, upload_id)

    summary = get_dashboard_summary(db, tanggal_per, user_id=current_user.id, upload_id=upload_id)
    return DashboardAlertsResponse(
        alerts=_build_alerts(db, summary, current_user.id, upload_id=upload_id),
    )


@router.get("/overview", response_model=DashboardOverviewResponse)
def overview(
    tanggal_per: date | None = None,
    tanggal_mulai: date | None = None,
    jumlah_bulan: int = 6,
    upload_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
) -> DashboardOverviewResponse:
    """Satu panggilan untuk seluruh widget dashboard (kecuali Insight AI).

    Menghabiskan 1 request saja sehingga halaman tidak menunggu banyak
    endpoint paralel. Semua perhitungan berbagi memo neraca saldo per request,
    jadi query database yang sama tidak dihitung ulang.
    """
    _resolve_upload_scope(db, current_user.id, upload_id)
    if tanggal_per is None:
        tanggal_per = _latest_data_date(db, current_user.id, upload_id)

    summary = get_dashboard_summary(
        db, tanggal_per, user_id=current_user.id,
        tanggal_mulai=tanggal_mulai, upload_id=upload_id,
    )
    tren = get_pendapatan_beban_bulanan(
        db, tanggal_per, user_id=current_user.id, jumlah_bulan=jumlah_bulan,
        tanggal_mulai=tanggal_mulai, upload_id=upload_id,
    )

    return DashboardOverviewResponse(
        summary=DashboardSummaryResponse(
            tanggal_per=summary.tanggal_per,
            saldo_kas=summary.saldo_kas,
            saldo_bank=summary.saldo_bank,
            total_kas_dan_bank=summary.total_kas_dan_bank,
            pendapatan_bulan_ini=summary.pendapatan_bulan_ini,
            beban_bulan_ini=summary.beban_bulan_ini,
            laba_rugi_bulan_ini=summary.laba_rugi_bulan_ini,
            total_pendapatan_tahun_berjalan=summary.total_pendapatan_tahun_berjalan,
            total_beban_tahun_berjalan=summary.total_beban_tahun_berjalan,
            laba_rugi_tahun_berjalan=summary.laba_rugi_tahun_berjalan,
            jumlah_transaksi_bulan_ini=summary.jumlah_transaksi_bulan_ini,
        ),
        monthly=[
            MonthlyTrendResponse(
                bulan=h.bulan,
                label=h.label,
                pendapatan=h.pendapatan,
                beban=h.beban,
                laba_rugi=h.laba_rugi,
            )
            for h in tren
        ],
        alerts=_build_alerts(db, summary, current_user.id, upload_id=upload_id),
        piutang_utang=_hitung_piutang_utang(db, tanggal_per, current_user.id, upload_id=upload_id),
        kategori=_beban_per_akun_bulan_ini(
            db, tanggal_per, current_user.id,
            tanggal_mulai=tanggal_mulai, upload_id=upload_id,
        ),
        produk=[
            StatistikProdukItem(produk=p.produk, nilai=p.nilai, jumlah=p.jumlah)
            for p in get_statistik_produk(db, tanggal_per, current_user.id, upload_id=upload_id)
        ],
    )
