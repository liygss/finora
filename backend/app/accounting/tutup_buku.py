"""
Tutup Buku (Closing Entries) Tahunan.

Prinsip sesuai siklus akuntansi yang sudah dirancang di codebase (SAK EMKM):
    1. Hitung saldo akun Pendapatan & Beban sepanjang tahun fiskal.
    2. Buat Jurnal Penutup (jenis = PENUTUP) yang "men-nol-kan" akun tersebut:
       - D semua akun Pendapatan (menghilangkan saldo kreditnya)
       - K semua akun Beban (menghilangkan saldo debitnya)
       - selisihnya (laba/rugi bersih) dipindah ke Laba Ditahan (3-3000)
    3. Bila ada saldo Prive (3-2000): tutup ke Modal Pemilik (3-1000).
    4. Kunci (is_locked=True) semua jurnal bertanggal di tahun tersebut.
    5. Catat satu record tutup_buku per (user, tahun) agar tidak dobel.
"""

from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.accounting.jurnal_umum import JurnalDetailInputDTO, JurnalError, buat_jurnal
from app.accounting.periode import get_tahun_tertutup
from app.database.models import (
    Akun,
    JenisJurnal,
    JurnalDetail,
    JurnalUmum,
    KategoriAkun,
    SaldoNormal,
    TutupBuku,
)

KODE_LABA_DITAHAN = "3-3000"
KODE_PRIVE = "3-2000"
KODE_MODAL_PEMILIK = "3-1000"


@dataclass
class TutupBukuStatusRow:
    tahun: int
    is_closed: bool
    laba_bersih: float | None = None
    tanggal_tutup: date | None = None


@dataclass
class TutupBukuAkunSaldo:
    kode_akun: str
    nama_akun: str
    saldo: float  # saldo bersih pada sisi saldo normal akun (biasanya positif)


@dataclass
class TutupBukuReview:
    tahun: int
    tanggal_per: date
    pendapatan: list[TutupBukuAkunSaldo] = field(default_factory=list)
    beban: list[TutupBukuAkunSaldo] = field(default_factory=list)
    total_pendapatan: float = 0.0
    total_beban: float = 0.0
    laba_bersih: float = 0.0
    prive: float = 0.0


@dataclass
class TutupBukuResult:
    tahun: int
    tanggal_tutup: date
    laba_bersih: float
    jurnal_penutup_id: str
    jurnal_penutup_no_bukti: str
    jurnal_prive_id: str | None = None
    jurnal_prive_no_bukti: str | None = None


def _tahun_mulai(tahun: int) -> date:
    return date(tahun, 1, 1)


def _tahun_akhir(tahun: int) -> date:
    return date(tahun, 12, 31)


def _saldo_akun_kategori(
    db: Session, user_id: str, tahun: int, kategori: KategoriAkun
) -> list[TutupBukuAkunSaldo]:
    """
    Saldo bersih tiap akun dalam satu kategori pada satu tahun fiskal.
    Saldo dihitung pada sisi saldo normal akun (Aset/Beban -> debit, sisanya -> kredit).
    """
    start, end = _tahun_mulai(tahun), _tahun_akhir(tahun)
    rows = (
        db.query(
            Akun.kode_akun,
            Akun.nama_akun,
            Akun.saldo_normal,
            func.coalesce(func.sum(JurnalDetail.debit), 0).label("total_debit"),
            func.coalesce(func.sum(JurnalDetail.kredit), 0).label("total_kredit"),
        )
        .join(JurnalDetail, JurnalDetail.akun_id == Akun.id)
        .join(JurnalUmum, JurnalUmum.id == JurnalDetail.jurnal_id)
        .filter(
            JurnalUmum.created_by_id == user_id,
            JurnalUmum.tanggal >= start,
            JurnalUmum.tanggal <= end,
        )
        .filter(Akun.is_active.is_(True), Akun.kategori == kategori)
        .group_by(Akun.kode_akun, Akun.nama_akun, Akun.saldo_normal)
        .order_by(Akun.kode_akun)
        .all()
    )
    hasil: list[TutupBukuAkunSaldo] = []
    for row in rows:
        total_d = float(row.total_debit)
        total_k = float(row.total_kredit)
        if row.saldo_normal == SaldoNormal.DEBIT:
            saldo = total_d - total_k
        else:
            saldo = total_k - total_d
        if round(saldo, 2) == 0:
            continue
        hasil.append(
            TutupBukuAkunSaldo(kode_akun=row.kode_akun, nama_akun=row.nama_akun, saldo=round(saldo, 2))
        )
    return hasil


def _saldo_akun(db: Session, user_id: str, tahun: int, kode_akun: str) -> float:
    """
    Saldo bersih satu akun (pada sisi saldo normalnya) untuk satu tahun fiskal.
    Dipakai untuk Prive dan modal.
    """
    start, end = _tahun_mulai(tahun), _tahun_akhir(tahun)
    akun = db.query(Akun).filter(Akun.kode_akun == kode_akun).first()
    if akun is None:
        return 0.0
    row = (
        db.query(
            func.coalesce(func.sum(JurnalDetail.debit), 0).label("total_debit"),
            func.coalesce(func.sum(JurnalDetail.kredit), 0).label("total_kredit"),
        )
        .join(JurnalUmum, JurnalUmum.id == JurnalDetail.jurnal_id)
        .filter(
            JurnalDetail.akun_id == akun.id,
            JurnalUmum.created_by_id == user_id,
            JurnalUmum.tanggal >= start,
            JurnalUmum.tanggal <= end,
        )
        .first()
    )
    total_d = float(row.total_debit)
    total_k = float(row.total_kredit)
    if akun.saldo_normal == SaldoNormal.DEBIT:
        return round(total_d - total_k, 2)
    return round(total_k - total_d, 2)


def _next_no_bukti(db: Session, prefix: str, tahun: int) -> str:
    """Buat no. bukti urut (PBK-{tahun}-001, dst.) yang belum dipakai."""
    for seq in range(1, 10_000):
        no_bukti = f"{prefix}-{tahun}-{seq:03d}"
        exists = db.query(JurnalUmum.id).filter(JurnalUmum.no_bukti == no_bukti).first()
        if not exists:
            return no_bukti
    raise JurnalError("Gagal membuat nomor bukti jurnal penutup (habis).")


def get_status(db: Session, user_id: str) -> list[TutupBukuStatusRow]:
    """Status tutup buku per tahun fiskal (dari jurnal yang tercatat)."""
    tahun_rows = (
        db.query(func.strftime("%Y", JurnalUmum.tanggal))
        .filter(JurnalUmum.created_by_id == user_id)
        .distinct()
        .all()
    )
    tahun_list = sorted(int(r[0]) for r in tahun_rows)
    tercatat: dict[int, TutupBuku] = {}
    if user_id:
        for tb in db.query(TutupBuku).filter(TutupBuku.user_id == user_id).all():
            tercatat[tb.tahun] = tb
    return [
        TutupBukuStatusRow(
            tahun=t,
            is_closed=t in tercatat,
            laba_bersih=float(tercatat[t].laba_bersih) if t in tercatat else None,
            tanggal_tutup=tercatat[t].tanggal_tutup if t in tercatat else None,
        )
        for t in tahun_list
    ]


def review_tutup_buku(db: Session, user_id: str, tahun: int) -> TutupBukuReview:
    """Ringkasan yang perlu ditutup untuk satu tahun: pendapatan, beban, laba, prive."""
    pendapatan = _saldo_akun_kategori(db, user_id, tahun, KategoriAkun.PENDAPATAN)
    beban = _saldo_akun_kategori(db, user_id, tahun, KategoriAkun.BEBAN)
    prive = _saldo_akun(db, user_id, tahun, KODE_PRIVE)

    total_pendapatan = round(sum(p.saldo for p in pendapatan), 2)
    total_beban = round(sum(b.saldo for b in beban), 2)

    return TutupBukuReview(
        tahun=tahun,
        tanggal_per=_tahun_akhir(tahun),
        pendapatan=pendapatan,
        beban=beban,
        total_pendapatan=total_pendapatan,
        total_beban=total_beban,
        laba_bersih=round(total_pendapatan - total_beban, 2),
        prive=prive,
    )


def tutup_buku(
    db: Session,
    user_id: str,
    tahun: int,
    kode_laba_ditahan: str = KODE_LABA_DITAHAN,
    kode_prive: str = KODE_PRIVE,
    kode_modal_pemilik: str = KODE_MODAL_PEMILIK,
) -> TutupBukuResult:
    """Jalankan penutupan buku untuk satu tahun fiskal (idempotence via unique user+tahun)."""
    if not user_id:
        raise JurnalError("User tidak dikenal.")

    sudah = get_tahun_tertutup(db, user_id)
    if tahun in sudah:
        raise JurnalError(f"Tahun {tahun} sudah ditutup.")

    review = review_tutup_buku(db, user_id, tahun)
    if review.total_pendapatan == 0 and review.total_beban == 0:
        raise JurnalError(
            f"Tidak ada transaksi pendapatan/beban pada tahun {tahun}, "
            "sehingga tutup buku tidak dapat dilakukan."
        )

    tanggal_tutup = _tahun_akhir(tahun)

    # --- Susun baris Jurnal Penutup: nol-kan Pendapatan (D) & Beban (K) ---
    detail: list[JurnalDetailInputDTO] = []
    debit_total = 0.0
    kredit_total = 0.0
    for p in review.pendapatan:  # bersaldo normal KREDIT → di-nol-kan pakai debit
        if p.saldo > 0:
            detail.append(JurnalDetailInputDTO(p.kode_akun, debit=p.saldo, kredit=0))
            debit_total += p.saldo
        elif p.saldo < 0:
            detail.append(JurnalDetailInputDTO(p.kode_akun, debit=0, kredit=-p.saldo))
            kredit_total += -p.saldo
    for b in review.beban:  # bersaldo normal DEBIT → di-nol-kan pakai kredit
        if b.saldo > 0:
            detail.append(JurnalDetailInputDTO(b.kode_akun, debit=0, kredit=b.saldo))
            kredit_total += b.saldo
        elif b.saldo < 0:
            detail.append(JurnalDetailInputDTO(b.kode_akun, debit=-b.saldo, kredit=0))
            debit_total += -b.saldo

    laba_bersih = round(debit_total - kredit_total, 2)
    if laba_bersih > 0:
        detail.append(JurnalDetailInputDTO(kode_laba_ditahan, debit=0, kredit=laba_bersih))
    elif laba_bersih < 0:
        detail.append(JurnalDetailInputDTO(kode_laba_ditahan, debit=-laba_bersih, kredit=0))

    jurnal_penutup = buat_jurnal(
        db,
        no_bukti=_next_no_bukti(db, "PBK", tahun),
        tanggal=tanggal_tutup,
        deskripsi=f"Tutup Buku Tahun {tahun}",
        detail=detail,
        created_by_id=user_id,
        jenis=JenisJurnal.PENUTUP,
    )

    # --- Tutup Prive ke Modal Pemilik (bila ada) ---
    jurnal_prive_id = None
    jurnal_prive_no_bukti = None
    if review.prive > 0:
        jurnal_prive = buat_jurnal(
            db,
            no_bukti=_next_no_bukti(db, "PBK", tahun),
            tanggal=tanggal_tutup,
            deskripsi=f"Penutupan Prive Tahun {tahun}",
            detail=[
                JurnalDetailInputDTO(kode_modal_pemilik, debit=review.prive, kredit=0),
                JurnalDetailInputDTO(kode_prive, debit=0, kredit=review.prive),
            ],
            created_by_id=user_id,
            jenis=JenisJurnal.PENUTUP,
        )
        jurnal_prive_id = jurnal_prive.id
        jurnal_prive_no_bukti = jurnal_prive.no_bukti

    # --- Kunci semua jurnal di tahun tersebut ---
    db.query(JurnalUmum).filter(
        JurnalUmum.created_by_id == user_id,
        JurnalUmum.tanggal >= _tahun_mulai(tahun),
        JurnalUmum.tanggal <= tanggal_tutup,
    ).update({JurnalUmum.is_locked: True}, synchronize_session=False)

    record = TutupBuku(
        user_id=user_id,
        tahun=tahun,
        tanggal_tutup=tanggal_tutup,
        laba_bersih=laba_bersih,
        jurnal_penutup_id=jurnal_penutup.id,
        jurnal_penutup_no_bukti=jurnal_penutup.no_bukti,
        jurnal_prive_id=jurnal_prive_id,
        jurnal_prive_no_bukti=jurnal_prive_no_bukti,
    )
    db.add(record)
    db.commit()

    return TutupBukuResult(
        tahun=tahun,
        tanggal_tutup=tanggal_tutup,
        laba_bersih=laba_bersih,
        jurnal_penutup_id=jurnal_penutup.id,
        jurnal_penutup_no_bukti=jurnal_penutup.no_bukti,
        jurnal_prive_id=jurnal_prive_id,
        jurnal_prive_no_bukti=jurnal_prive_no_bukti,
    )