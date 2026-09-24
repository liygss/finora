"""
Helper penutupan buku: penguncian periode agar jurnal tidak bisa dicatat di
tahun yang sudah ditutup (tutup buku).

Diletakkan di modul terpisah supaya bisa dipakai oleh jurnal_umum (input
manual + template jurnal penyesuaian), upload batch, dan service tutup_buku
tanpa menimbulkan circular import.
"""

from datetime import date

from sqlalchemy.orm import Session

from app.database.models import TutupBuku


def get_tahun_tertutup(db: Session, user_id: str) -> set[int]:
    """Tahun-tahun yang sudah ditutup bukunya untuk user tertentu."""
    if not user_id:
        return set()
    return {
        r[0] for r in db.query(TutupBuku.tahun).filter(TutupBuku.user_id == user_id).all()
    }


def ensure_periode_belum_ditutup(db: Session, tanggal: date, user_id: str) -> None:
    """
    Tolak pencatatan jurnal yang tanggalnya jatuh di tahun yang sudah ditutup.
    Membandingkan dengan tahun >= tahun jurnal supaya backdating ke periode lama
    juga ditolak setelah tahun yang lebih baru ditutup.
    """
    if not user_id:
        return
    tutup = (
        db.query(TutupBuku.tahun)
        .filter(TutupBuku.user_id == user_id, TutupBuku.tahun >= tanggal.year)
        .first()
    )
    if tutup is None:
        return
    from app.accounting.jurnal_umum import JurnalError

    raise JurnalError(
        f"Periode {tutup[0]} sudah ditutup (tutup buku). "
        f"Tidak bisa mencatat transaksi bertanggal {tanggal.isoformat()}."
    )