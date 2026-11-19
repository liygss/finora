from collections import defaultdict
from dataclasses import dataclass
from datetime import date
import re
from statistics import median

from sqlalchemy.orm import Session

from app.database.models import JurnalDetail, JurnalUmum, UploadedFile

MAX_JURNAL_DIPERIKSA = 500
MAX_TEMUAN = 20


@dataclass
class TemuanAnomali:
    jenis: str
    tingkat: str
    no_bukti: str
    tanggal: str
    deskripsi: str
    detail: str
    nominal: float | None = None


def _fmt_rp(value: float) -> str:
    if value == int(value):
        return f"Rp {value:,.0f}".replace(",", ".")
    return f"Rp {value:,.2f}".replace(",", ".")


def _normal_deskripsi(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def _to_float(value) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).lower().replace("rp", "").replace(" ", "").strip()
    if not text:
        return None
    if "." in text and "," in text:
        text = text.replace(",", "") if text.rfind(".") > text.rfind(",") else text.replace(".", "").replace(",", ".")
    elif re.fullmatch(r"\d{1,3}(\.\d{3})+", text):
        text = text.replace(".", "")
    elif re.fullmatch(r"\d{1,3}(,\d{3})+", text):
        text = text.replace(",", "")
    else:
        text = text.replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return None


def _tambah(daftar: list[TemuanAnomali], temuan: TemuanAnomali) -> None:
    if len(daftar) < MAX_TEMUAN:
        daftar.append(temuan)


def _batas_outlier(values: list[float]) -> tuple[float, float] | None:
    if len(values) < 5:
        return None
    tengah = median(values)
    deviasi = [abs(value - tengah) for value in values]
    mad = median(deviasi)
    if mad == 0:
        mad = max(deviasi) or 1.0
    rentang = 3 * 1.4826 * mad
    return tengah - rentang, tengah + rentang


def detect_from_journals(
    db: Session,
    user_id: str,
    upload_id: str | None = None,
) -> list[TemuanAnomali]:
    query = db.query(JurnalUmum).filter(JurnalUmum.created_by_id == user_id)
    if upload_id:
        query = query.filter(JurnalUmum.sumber_upload_id == upload_id)
    jurnals = query.order_by(JurnalUmum.tanggal.asc()).limit(MAX_JURNAL_DIPERIKSA).all()
    if not jurnals:
        return []

    temuan: list[TemuanAnomali] = []
    grup_duplikat: dict[tuple, list[JurnalUmum]] = defaultdict(list)
    nilai_jurnal: dict[str, float] = {}
    hari_ini = date.today()

    for jurnal in jurnals:
        details = jurnal.detail
        total_debit = sum(float(d.debit or 0) for d in details)
        total_kredit = sum(float(d.kredit or 0) for d in details)
        nilai_jurnal[jurnal.id] = round(total_debit, 2)
        tanggal = jurnal.tanggal.isoformat() if jurnal.tanggal else "-"

        if round(total_debit, 2) != round(total_kredit, 2):
            selisih = abs(total_debit - total_kredit)
            _tambah(temuan, TemuanAnomali(
                jenis="Jurnal tidak balance",
                tingkat="TINGGI",
                no_bukti=jurnal.no_bukti,
                tanggal=tanggal,
                deskripsi=jurnal.deskripsi,
                detail=f"Debit {_fmt_rp(total_debit)} vs kredit {_fmt_rp(total_kredit)}, selisih {_fmt_rp(selisih)}",
                nominal=selisih,
            ))

        if len(details) < 2:
            _tambah(temuan, TemuanAnomali(
                jenis="Jumlah baris tidak lazim",
                tingkat="SEDANG",
                no_bukti=jurnal.no_bukti,
                tanggal=tanggal,
                deskripsi=jurnal.deskripsi,
                detail=f"Jurnal hanya memiliki {len(details)} baris detail",
            ))

        for detail in details:
            debit = float(detail.debit or 0)
            kredit = float(detail.kredit or 0)
            nama_akun = detail.akun.nama_akun if detail.akun else "Unknown"
            if (debit > 0 and kredit > 0) or (debit <= 0 and kredit <= 0):
                _tambah(temuan, TemuanAnomali(
                    jenis="Baris debit/kredit tidak valid",
                    tingkat="TINGGI",
                    no_bukti=jurnal.no_bukti,
                    tanggal=tanggal,
                    deskripsi=jurnal.deskripsi,
                    detail=f"Akun {nama_akun} memiliki debit {_fmt_rp(debit)} dan kredit {_fmt_rp(kredit)}",
                ))
            if detail.akun is not None and not detail.akun.is_active:
                _tambah(temuan, TemuanAnomali(
                    jenis="Akun nonaktif digunakan",
                    tingkat="SEDANG",
                    no_bukti=jurnal.no_bukti,
                    tanggal=tanggal,
                    deskripsi=jurnal.deskripsi,
                    detail=f"Akun {nama_akun} berstatus nonaktif",
                ))

        if jurnal.tanggal and jurnal.tanggal > hari_ini:
            _tambah(temuan, TemuanAnomali(
                jenis="Tanggal di masa depan",
                tingkat="SEDANG",
                no_bukti=jurnal.no_bukti,
                tanggal=tanggal,
                deskripsi=jurnal.deskripsi,
                detail=f"Tanggal jurnal {tanggal} lebih baru dari hari ini ({hari_ini.isoformat()})",
            ))

        kunci = (jurnal.tanggal, _normal_deskripsi(jurnal.deskripsi), round(total_debit, 2))
        grup_duplikat[kunci].append(jurnal)

    for (tanggal, deskripsi, nominal), grup in grup_duplikat.items():
        if len(grup) < 2:
            continue
        no_bukti = ", ".join(j.no_bukti for j in grup[:5])
        tanggal_str = tanggal.isoformat() if tanggal else "-"
        _tambah(temuan, TemuanAnomali(
            jenis="Transaksi duplikat",
            tingkat="SEDANG",
            no_bukti=no_bukti,
            tanggal=tanggal_str,
            deskripsi=deskripsi or "-",
            detail=f"{len(grup)} transaksi dengan tanggal, deskripsi, dan nominal sama",
            nominal=float(nominal),
        ))

    batas = _batas_outlier(list(nilai_jurnal.values()))
    if batas:
        bawah, atas = batas
        for jurnal in jurnals:
            nilai = nilai_jurnal.get(jurnal.id, 0.0)
            if nilai < bawah or nilai > atas:
                tanggal = jurnal.tanggal.isoformat() if jurnal.tanggal else "-"
                _tambah(temuan, TemuanAnomali(
                    jenis="Nominal outlier",
                    tingkat="SEDANG",
                    no_bukti=jurnal.no_bukti,
                    tanggal=tanggal,
                    deskripsi=jurnal.deskripsi,
                    detail=f"Nominal di luar rentang wajar {_fmt_rp(max(bawah, 0))} – {_fmt_rp(atas)}",
                    nominal=nilai,
                ))

    return temuan


def detect_from_staged_file(uploaded_file: UploadedFile) -> list[TemuanAnomali]:
    try:
        from app.services.ingestion.file_loader import load_file
        from app.services.ingestion.csv_to_jurnal import (
            COL_DESKRIPSI,
            COL_JUMLAH,
            COL_TANGGAL,
            _build_column_map,
        )

        source = uploaded_file.file_bytes or uploaded_file.stored_path
        if not source:
            return []
        doc = load_file(source, uploaded_file.file_type)
        df = doc.get_transaction_dataframe()
        if df is None or df.empty:
            return []

        columns = _build_column_map(list(df.columns))
        kolom_tanggal = next((k for k, v in columns.items() if v == COL_TANGGAL), None)
        kolom_deskripsi = next((k for k, v in columns.items() if v == COL_DESKRIPSI), None)
        kolom_jumlah = next((k for k, v in columns.items() if v == COL_JUMLAH), None)
        if kolom_jumlah is None:
            return []

        temuan: list[TemuanAnomali] = []
        grup_duplikat: dict[tuple, int] = defaultdict(int)
        nilai: list[float] = []

        for _, row in df.iterrows():
            nominal = _to_float(row.get(kolom_jumlah))
            if nominal is not None:
                nilai.append(abs(nominal))
            tanggal = str(row.get(kolom_tanggal, "-")) if kolom_tanggal else "-"
            deskripsi = _normal_deskripsi(str(row.get(kolom_deskripsi, "-"))) if kolom_deskripsi else "-"
            grup_duplikat[(tanggal, deskripsi, round(nominal or 0, 2))] += 1

        for (tanggal, deskripsi, nominal), jumlah in grup_duplikat.items():
            if jumlah < 2:
                continue
            _tambah(temuan, TemuanAnomali(
                jenis="Baris duplikat",
                tingkat="SEDANG",
                no_bukti=uploaded_file.original_filename,
                tanggal=tanggal,
                deskripsi=deskripsi or "-",
                detail=f"{jumlah} baris dengan tanggal, deskripsi, dan nominal sama",
                nominal=float(nominal),
            ))

        batas = _batas_outlier(nilai)
        if batas:
            bawah, atas = batas
            for idx, row in df.iterrows():
                nominal = _to_float(row.get(kolom_jumlah))
                if nominal is None or (bawah <= abs(nominal) <= atas):
                    continue
                tanggal = str(row.get(kolom_tanggal, "-")) if kolom_tanggal else "-"
                deskripsi = str(row.get(kolom_deskripsi, "-")) if kolom_deskripsi else "-"
                _tambah(temuan, TemuanAnomali(
                    jenis="Nominal outlier",
                    tingkat="SEDANG",
                    no_bukti=uploaded_file.original_filename,
                    tanggal=tanggal,
                    deskripsi=deskripsi,
                    detail=f"Nominal di luar rentang wajar {_fmt_rp(max(bawah, 0))} – {_fmt_rp(atas)}",
                    nominal=abs(nominal),
                ))

        return temuan
    except Exception:
        return []


def render_anomaly_context(temuan: list[TemuanAnomali], sumber: str) -> str:
    lines = [
        "## Hasil Pemeriksaan Anomali",
        f"Sumber: {sumber}",
        "Pemeriksaan terbatas: jurnal tidak balance, nominal outlier, transaksi duplikat, tanggal/akun/baris tidak valid.",
        "Daftar ini bersifat tertutup. Jangan menambah temuan di luar daftar berikut.",
        "",
    ]
    if not temuan:
        lines.append("Tidak ditemukan anomali dari pemeriksaan di atas.")
        return "\n".join(lines)

    lines.append("| Jenis | Tingkat | No. Bukti | Tanggal | Deskripsi | Detail | Nominal |")
    lines.append("|-------|---------|-----------|---------|-----------|--------|---------|")
    for item in temuan:
        nominal = _fmt_rp(item.nominal) if item.nominal is not None else "-"
        lines.append(
            f"| {item.jenis} | {item.tingkat} | {item.no_bukti} | {item.tanggal} | "
            f"{item.deskripsi} | {item.detail} | {nominal} |"
        )
    return "\n".join(lines)
