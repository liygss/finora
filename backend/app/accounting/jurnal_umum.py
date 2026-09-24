"""
Service layer untuk Jurnal Umum: membuat & memvalidasi jurnal.
Router (app/routers/accounting.py) memanggil fungsi-fungsi di sini supaya
logikanya bisa dipakai ulang juga oleh jurnal_penyesuaian.py.
"""

from datetime import date

from sqlalchemy.orm import Session, joinedload

from app.accounting.akun import get_akun_by_kode
from app.accounting.periode import ensure_periode_belum_ditutup
from app.config.logging import get_logger
from app.database.models import JenisJurnal, JurnalDetail, JurnalUmum

logger = get_logger(__name__)


class JurnalError(Exception):
    """Dilempar kalau input jurnal tidak valid (dipetakan ke HTTP 400/409/422 di router)."""


class JurnalDetailInputDTO:
    def __init__(self, kode_akun: str, debit: float = 0, kredit: float = 0, keterangan: str | None = None):
        self.kode_akun = kode_akun
        self.debit = debit
        self.kredit = kredit
        self.keterangan = keterangan


def validasi_balance(detail: list[JurnalDetailInputDTO]) -> None:
    if len(detail) < 2:
        raise JurnalError("Jurnal minimal harus punya 2 baris (debit dan kredit)")
    total_debit = round(sum(d.debit for d in detail), 2)
    total_kredit = round(sum(d.kredit for d in detail), 2)
    if total_debit != total_kredit:
        raise JurnalError(
            f"Jurnal tidak balance: total debit ({total_debit}) != total kredit ({total_kredit})"
        )


def buat_jurnal(
    db: Session,
    no_bukti: str,
    tanggal: date,
    deskripsi: str,
    detail: list[JurnalDetailInputDTO],
    created_by_id: str,
    jenis: JenisJurnal = JenisJurnal.UMUM,
    sumber_upload_id: str | None = None,
) -> JurnalUmum:
    """
    Membuat satu jurnal (header + detail). Melempar JurnalError kalau:
    - no_bukti sudah dipakai
    - salah satu kode akun tidak ditemukan
    - jurnal tidak balance
    - tanggal berada di tahun yang sudah ditutup (tutup buku)
    """
    validasi_balance(detail)
    ensure_periode_belum_ditutup(db, tanggal, created_by_id)

    existing = db.query(JurnalUmum).filter(JurnalUmum.no_bukti == no_bukti).first()
    if existing:
        raise JurnalError(f"No. bukti {no_bukti} sudah dipakai")

    akun_map = {}
    missing: list[str] = []
    for d in detail:
        akun = get_akun_by_kode(db, d.kode_akun)
        if akun is None:
            missing.append(d.kode_akun)
        else:
            akun_map[d.kode_akun] = akun
    if missing:
        raise JurnalError(f"Kode akun tidak ditemukan: {', '.join(sorted(set(missing)))}")

    jurnal = JurnalUmum(
        no_bukti=no_bukti,
        tanggal=tanggal,
        deskripsi=deskripsi,
        jenis=jenis,
        created_by_id=created_by_id,
        sumber_upload_id=sumber_upload_id,
    )
    for idx, d in enumerate(detail):
        jurnal.detail.append(
            JurnalDetail(
                akun_id=akun_map[d.kode_akun].id,
                urutan=idx,
                debit=d.debit,
                kredit=d.kredit,
                keterangan=d.keterangan,
            )
        )

    db.add(jurnal)
    db.commit()
    db.refresh(jurnal)
    logger.info("Jurnal %s (%s) dibuat", jurnal.no_bukti, jenis.value)
    return jurnal


def list_jurnal(
    db: Session,
    tanggal_mulai: date | None = None,
    tanggal_akhir: date | None = None,
    jenis: JenisJurnal | None = None,
    user_id: str | None = None,
) -> list[JurnalUmum]:
    query = db.query(JurnalUmum).options(
        joinedload(JurnalUmum.detail).joinedload(JurnalDetail.akun)
    )
    if user_id:
        query = query.filter(JurnalUmum.created_by_id == user_id)
    if tanggal_mulai:
        query = query.filter(JurnalUmum.tanggal >= tanggal_mulai)
    if tanggal_akhir:
        query = query.filter(JurnalUmum.tanggal <= tanggal_akhir)
    if jenis:
        query = query.filter(JurnalUmum.jenis == jenis)
    return query.order_by(JurnalUmum.tanggal, JurnalUmum.created_at).all()
