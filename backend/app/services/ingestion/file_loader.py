"""
Baca isi file mentah (csv/xlsx/xls/pdf) jadi representasi perantara yang seragam,
supaya markdown_generator.py tidak perlu tahu format aslinya.

Loader menerima `bytes` maupun `str` (path). Alur `bytes` dipakai di serverless
(Vercel): file disimpan di database, bukan di disk, karena /tmp tidak bertahan
antar request. `pd.read_csv`, `pd.read_excel`, dan `PdfReader` semuanya menerima
file-like object, jadi tidak perlu tempfile sama sekali.
"""

import io
import os
import re
from dataclasses import dataclass, field
from datetime import date, datetime

import pandas as pd
from pypdf import PdfReader


def _as_source(source: bytes | str) -> bytes | str:
    """Normalisasi input jadi bytes atau path yang bisa dibaca pandas/pypdf."""
    if isinstance(source, (bytes, bytearray, memoryview)):
        return bytes(source)
    return str(source)


@dataclass
class LoadedTable:
    """Untuk csv/xlsx: data tabular mentah."""

    sheet_name: str
    dataframe: pd.DataFrame


@dataclass
class LoadedDocument:
    file_type: str  # csv | xlsx | pdf
    tables: list[LoadedTable] = field(default_factory=list)
    raw_text_pages: list[str] = field(default_factory=list)  # untuk pdf, satu string per halaman

    def get_transaction_dataframe(self):
        """Ambil DataFrame sheet yang paling mirip data transaksi (bukan sekadar
        sheet pertama). Workbook multi-sheet dengan transaksi di sheet mana pun
        tetap bisa diproses jadi jurnal otomatis.
        Mengembalikan salinan DataFrame atau None bila tak ada sheet transaksi."""
        best_df = None
        best_score = -1.0
        for table in self.tables:
            score = _sheet_transaction_score(table.dataframe)
            if score > best_score:
                best_score = score
                best_df = table.dataframe
        return best_df.copy() if best_df is not None else None


def _looks_like_date_series(series) -> bool:
    """Cek apakah suatu kolom berisi tanggal (termasuk sel datetime/date dari Excel)."""
    sample = [v for v in series.dropna().head(20)]
    if not sample:
        return False
    date_formats = (
        "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d", "%d.%m.%Y",
        "%d/%m/%Y %H:%M", "%d-%m-%Y %H:%M", "%Y-%m-%d %H:%M",
    )
    for raw in sample:
        if isinstance(raw, (datetime, date)):
            continue
        s = str(raw).strip().replace("T", " ").replace("Z", "")
        if s.lower() in ("nan", "none", "nat", "na", "null"):
            continue
        if not any(_try_parse_date(s, fmt) for fmt in date_formats):
            return False
    return True


def _try_parse_date(value: str, fmt: str) -> bool:
    try:
        datetime.strptime(value, fmt)
        return True
    except ValueError:
        return False


def _looks_like_amount_series(series) -> bool:
    """Cek apakah suatu kolom berisi nilai uang/numerik."""
    sample = [str(v).strip() for v in series.dropna().head(20) if str(v).strip()]
    if not sample:
        return False
    for raw in sample:
        s = re.sub(r"(?i)\b(?:rp|idr)\b", "", raw)
        s = s.replace(" ", "").replace("\u00a0", "")
        s = s.replace(".", "").replace(",", "")
        if not s:
            return False
        try:
            float(s)
        except ValueError:
            return False
    return True


def _sheet_transaction_score(df: pd.DataFrame) -> float:
    """Skor ke-mirip-an transaksi sebuah sheet.
    +2 bila ada kolom tanggal, +2 bila ada kolom nominal; bonus kecil untuk
    jumlah baris agar sheet yang lebih berisi dipilih."""
    if df is None or df.empty:
        return -1.0
    has_date = has_amount = False
    for col in df.columns:
        if _looks_like_date_series(df[col]):
            has_date = True
        if _looks_like_amount_series(df[col]):
            has_amount = True
    if not (has_date or has_amount):
        return -1.0
    score = 0.0
    if has_date:
        score += 2.0
    if has_amount:
        score += 2.0
    score += len(df) * 0.001
    return score


def load_csv(source: bytes | str) -> LoadedDocument:
    df = _read_csv_tolerant(source)
    return LoadedDocument(file_type="csv", tables=[LoadedTable(sheet_name="Sheet1", dataframe=df)])


def _read_csv_tolerant(source: bytes | str) -> pd.DataFrame:
    """Baca CSV dengan fallback encoding (utf-8-sig -> latin-1) supaya file
    dari Excel/Windows dengan BOM atau encoding lama tetap bisa diproses."""
    stream = source if isinstance(source, bytes) else None
    for encoding in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
        try:
            if stream is not None:
                # Buffer baru tiap percobaan: stream pandas sudah habis dibaca.
                return pd.read_csv(io.BytesIO(stream), encoding=encoding)
            return pd.read_csv(source, encoding=encoding)
        except (UnicodeDecodeError, pd.errors.ParserError):
            continue
    raise ValueError(f"Tidak bisa membaca file CSV (encoding tidak dikenal): {_describe(source)}")


def _xlsx_engine(source: bytes | str) -> str:
    """Pilih engine Excel.

    File .xls (Excel 97-2003) hanya bisa dibaca xlrd; .xlsx/.xlsm pakai openpyxl.
    Saat sumber berupa bytes, nama file tidak tersedia, jadi ekstensi dideteksi dari
    magic bytes: .xls adalah kontainer OLE2 (D0 CF 11 E0), sedangkan .xlsx itu
    arsip ZIP (PK\\x03\\x04).
    """
    if isinstance(source, bytes):
        if source[:8] == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1":
            return "xlrd"
        return "openpyxl"
    return "xlrd" if str(source).lower().endswith(".xls") else "openpyxl"


def load_xlsx(source: bytes | str) -> LoadedDocument:
    engine = _xlsx_engine(source)
    try:
        raw = io.BytesIO(source) if isinstance(source, bytes) else source
        sheets = pd.read_excel(raw, sheet_name=None, engine=engine)
    except ImportError as exc:
        raise ValueError(
            f"Gagal membaca file Excel: engine '{engine}' tidak tersedia. "
            "Pastikan dependensi openpyxl (xlsx) atau xlrd (xls) terpasang."
        ) from exc
    except Exception as exc:  # noqa: BLE001
        # Fallback: biarkan pandas memilih engine sendiri (mis. ekstensi tak
        # standar / file ringan yang sedikit rusak).
        try:
            raw = io.BytesIO(source) if isinstance(source, bytes) else source
            sheets = pd.read_excel(raw, sheet_name=None)
        except Exception as inner:
            raise ValueError(f"Tidak bisa membaca file Excel: {inner}") from inner
    tables = [LoadedTable(sheet_name=name, dataframe=df) for name, df in sheets.items()]
    return LoadedDocument(file_type="xlsx", tables=tables)


def load_pdf(source: bytes | str) -> LoadedDocument:
    reader = PdfReader(io.BytesIO(source) if isinstance(source, bytes) else source)
    pages = [page.extract_text() or "" for page in reader.pages]
    return LoadedDocument(file_type="pdf", raw_text_pages=pages)


def _describe(source) -> str:
    """Label aman untuk pesan error (jangan bocorkan path/isi file ke user)."""
    return "<file dari database>" if isinstance(source, bytes) else os.path.basename(str(source))


def load_file(source: bytes | str, file_type: str) -> LoadedDocument:
    """Baca file dari `bytes` (serverless) atau `str` path (lokal/desktop)."""
    source = _as_source(source)
    loaders = {"csv": load_csv, "xlsx": load_xlsx, "pdf": load_pdf}
    if file_type not in loaders:
        raise ValueError(f"Tipe file tidak dikenal: {file_type}")
    return loaders[file_type](source)
