"""
Konversi data transaksi CSV/XLSX menjadi Jurnal Umum otomatis.

Membaca file keyword_mapping.csv (knowledge/datasets/keyword_mapping.csv)
untuk memetakan deskripsi transaksi ke kode akun debit/kredit, lalu membuat
JurnalUmum + JurnalDetail dengan BATCH INSERT (satu commit untuk semua baris).

Mendukung 2 format CSV:
  Format A (contoh_transaksi.csv):
    tanggal, deskripsi, jumlah, jenis, kategori
  Format B (dataset_transaksi_umkm.csv):
    tanggal, ..., tipe, ..., total, ..., akun_debit, akun_kredit
    -> tipe dipetakan ke jenis (Modal/Penjualan -> masuk, Beban -> keluar)
    -> total dipetakan ke jumlah
    -> akun_debit/akun_kredit (nama) dipetakan ke kode_akun via DB
"""

from __future__ import annotations

import csv
import math
import re
from datetime import date, datetime, timedelta
from pathlib import Path

from sqlalchemy.orm import Session

from app.config.logging import get_logger
from app.config.settings import settings
from app.database.models import Akun, JurnalDetail, JurnalUmum, JenisJurnal, TutupBuku

logger = get_logger(__name__)

_DEFAULT_KEYWORD_PATH = Path(settings.KNOWLEDGE_DIR) / "datasets" / "keyword_mapping.csv"

# Format A columns
COL_TANGGAL = "tanggal"
COL_DESKRIPSI = "deskripsi"
COL_JUMLAH = "jumlah"
COL_JENIS = "jenis"
COL_KATEGORI = "kategori"

# Format baku kolom Debit/Kredit (laporan bank tanpa kolom jumlah)
COL_DEBIT = "debit"
COL_KREDIT = "kredit"

# Format baku kolom Pemasukan/Pengeluaran (bisa berdampingan, tanpa kolom jumlah)
COL_MASUK = "pemasukan"
COL_KELUAR = "pengeluaran"

# Format B column aliases
ALIAS_TIPE = "tipe"
ALIAS_TOTAL = "total"
ALIAS_AKUN_DEBIT = "akun_debit"
ALIAS_AKUN_KREDIT = "akun_kredit"

AKUN_KAS_DEFAULT = "1-1000"
AKUN_BANK_DEFAULT = "1-1100"

# Semua kolom kanonik yang bisa dikenali (dipakai untuk exact + fuzzy match).
CANONICAL_COLUMNS = [
    COL_TANGGAL, COL_DESKRIPSI, COL_JUMLAH, COL_JENIS, COL_KATEGORI,
    COL_DEBIT, COL_KREDIT, COL_MASUK, COL_KELUAR,
    ALIAS_AKUN_DEBIT, ALIAS_AKUN_KREDIT,
]

# Sinonim nama kolom (dalam bentuk ternormalisasi) -> kolom kanonik.
# Dipakai supaya berbagai format CSV/xlsx tetap bisa diproses.
ALIAS_KOLOM: dict[str, set[str]] = {
    COL_TANGGAL: {
        "tanggal", "tgl", "date", "dates", "tanggal_transaksi", "tgl_transaksi",
        "tanggal_jurnal", "tanggal_bukti", "tgl_bukti", "hari", "hari_tanggal",
        "periode", "tgl_periode", "tanggal_periode", "tanggal_pembukuan",
        "transaction_date", "trans_date", "transactiondate", "journal_date",
        "posting_date", "post_date", "tgl_posting", "tgl_km", "tgl_nota",
        "tanggal_nota", "tanggal_invoice", "invoice_date", "tgl_invoice",
        "tanggal_waktu", "datetime", "waktu", "tgl_trans", "transaksi_tanggal",
    },
    COL_DESKRIPSI: {
        "deskripsi", "keterangan", "uraian", "nama", "transaksi", "deskripsi_transaksi",
        "keterangan_transaksi", "nama_transaksi", "uraian_transaksi", "description",
        "descriptions", "item", "items", "memo", "note", "notes", "catatan", "detail",
        "keterangan_penjualan", "keterangan_pembelian", "item_description",
        "description_item", "itemdescription", "transaction_description",
        "deskripsi_kegiatan", "rincian", "remarks", "comment", "comments",
    },
    COL_JUMLAH: {
        "jumlah", "nominal", "nilai", "total", "amount", "amounts", "harga",
        "harga_total", "total_harga", "jumlah_uang", "nilai_transaksi",
        "jumlah_transaksi", "subtotal", "total_transaksi", "total_pembayaran",
        "pembayaran", "uang", "jml", "jmlh", "besar",
        "total_bayar", "bayar", "nilai_bayar", "amount_transaction",
        "transaction_amount", "nominal_transaksi",
    },
    COL_JENIS: {
        "jenis", "tipe", "type", "jenis_transaksi", "kategori_transaksi",
        "arus_kas", "cash_flow", "aliran", "jenis_arus_kas", "tipe_transaksi",
    },
    COL_KATEGORI: {
        "kategori", "category", "categories", "grup", "kelompok", "kategori_akun",
        "golongan", "label",
    },
    COL_DEBIT: {
        "debit", "debet", "d", "debit_uang", "jumlah_debit", "nominal_debit",
        "debit_amount", "debet_amount", "uang_debit", "jml_debit", "total_debit",
    },
    COL_KREDIT: {
        "kredit", "credit", "k", "kredit_uang", "jumlah_kredit", "nominal_kredit",
        "kredit_amount", "credit_amount", "uang_kredit", "jml_kredit", "total_kredit",
    },
    COL_MASUK: {
        "pemasukan", "penerimaan", "masuk", "uang_masuk", "jumlah_masuk",
        "total_masuk", "jumlah_penerimaan", "debit_masuk", "income", "inflow",
        "nominal_pemasukan", "pemasukan_rp",
    },
    COL_KELUAR: {
        "pengeluaran", "keluar", "uang_keluar", "jumlah_keluar", "total_keluar",
        "jumlah_pengeluaran", "kredit_keluar", "expense", "outflow",
        "nominal_pengeluaran", "pengeluaran_rp",
    },
    ALIAS_AKUN_DEBIT: {
        "akun_debit", "debit_akun", "akun_debet", "debet_akun", "account_debit",
        "debit_account", "nama_akun_debit", "nama_debit", "no_akun_debit",
        "kode_akun_debit", "akun_pengeluaran", "akun_beban",
    },
    ALIAS_AKUN_KREDIT: {
        "akun_kredit", "kredit_akun", "account_kredit", "credit_account",
        "nama_akun_kredit", "nama_kredit", "no_akun_kredit",
        "kode_akun_kredit", "akun_penerimaan", "akun_pendapatan",
    },
}

# Sinonim nilai kolom "jenis" -> nilai kanonik.
JENIS_MASUK_VALUES = {
    "masuk", "pemasukan", "pendapatan", "penerimaan", "income", "debit",
    "uang_masuk", "uang masuk", "in",
}
JENIS_KELUAR_VALUES = {
    "keluar", "pengeluaran", "beban", "biaya", "expense", "out",
    "uang_keluar", "uang keluar", "pembayaran", "kredit", "cost",
}

# Semua alias non-deskripsi (untuk deteksi kolom deskripsi dari isi data).
_NON_DESKRIPSI_ALIASES = frozenset(
    alias
    for key, aliases in ALIAS_KOLOM.items()
    if key != COL_DESKRIPSI
    for alias in aliases
)

# tipe (Format B) -> jenis (Format A)
TIPE_TO_JENIS: dict[str, str] = {
    "modal": "masuk",
    "penjualan": "masuk",
    "beban": "keluar",
    "beban operasional": "keluar",
    "pembelian": "keluar",
    "penyesuaian": "penyesuaian",
}

KATEGORI_FALLBACK: dict[str, tuple[str, str]] = {
    "modal": ("1-1000", "3-1000"),
    "pendapatan": ("1-1000", "4-1000"),
    "beban_operasional": ("5-9000", "1-1000"),
    "pembelian": ("1-1300", "2-1000"),
    "pembelian_aset": ("1-1400", "1-1000"),
    "pelunasan_piutang": ("1-1000", "1-1200"),
    "pelunasan_utang": ("2-1000", "1-1000"),
    "prive": ("3-2000", "1-1000"),
    "pajak": ("2-1200", "1-1000"),
    "penyesuaian": ("5-2300", "1-1400"),
}

# Kolom yang isinya jelas bukan nominal (method pembayaran dsb.) tidak boleh
# menempati peran "jumlah" — walau kolomnya kebetulan berisi angka.
_AMOUNT_EXCLUDE_TOKENS = {"metode", "cara", "payment", "method", "channel"}

# Token header yang tidak layak jadi kolom uang (qty, satuan, pajak, saldo, dsb.).
_AMOUNT_BAD_TOKENS = {
    "qty", "kuantitas", "quantity", "unit", "satuan", "diskon", "discount",
    "disc", "ppn", "pajak", "tax", "saldo", "balance", "stok", "stock",
    "bonus", "no", "nomor", "kode", "id", "jenis", "tipe", "nama", "golongan",
    "kategori", "kelompok", "label",
}

# Bobot prioritas nama kolom uang (dari hint header, sebelum tiebreak std).
_AMOUNT_HINT_WEIGHTS = {
    "total": 2.0, "nominal": 2.0, "jumlah": 2.0, "amount": 2.0,
    "pemasukan": 2.0, "penerimaan": 2.0, "inflow": 2.0,
    "subtotal": 1.0, "bayar": 1.0, "pengeluaran": 1.0, "keluar": 1.0,
    "nilai": 1.0, "debit": 1.0, "kredit": 1.0, "masuk": 0.5, "uang": 0.5,
    "harga": 0.5,
}

# Kolom kanonik yang wajib berisi angka; bila tidak, mapping dibatalkan
# (kolom "dibuang" saat upload supaya tidak merampas peran jumlah).
_AMOUNT_CANONICALS = (COL_JUMLAH, COL_DEBIT, COL_KREDIT, COL_MASUK, COL_KELUAR)

# Jumlah pesan error/warning baris maksimum di-jaga & yang lain dirangkum.
_MAX_ERROR_MSGS = 40


def _normalize_header(value) -> str:
    """Normalisasi nama kolom: lowercase, buang BOM, spasi & tanda baca -> underscore."""
    normalized = str(value).strip().lstrip("\ufeff").lower()
    normalized = re.sub(r"[\s\u00a0]+", "_", normalized)
    normalized = re.sub(r"[()\[\]{}:;.,/\\|*?<>\"'!@#%^&+=~`-]+", "_", normalized)
    normalized = re.sub(r"_+", "_", normalized)
    return normalized.strip("_")


def _normalize_jenis(value) -> str:
    v = str(value).strip().lower()
    if v in JENIS_MASUK_VALUES:
        return "masuk"
    if v in JENIS_KELUAR_VALUES:
        return "keluar"
    if v in TIPE_TO_JENIS:
        return TIPE_TO_JENIS[v]
    return v


# Kata kunci untuk mengklasifikasikan arah arus kas (pemasukan/pengeluaran).
_KLASIFIKASI_INCOME = (
    "penjualan", "jual", "omzet", "pendapatan", "pemasukan", "penerimaan",
    "income", "revenue", "sales", "terima",
)
_KLASIFIKASI_EXPENSE = (
    "pembelian", "beban", "pengeluaran", "expense", "bayar", "belanja",
    "gaji", "sewa", "listrik", "pajak", "operasional", "cost", "hpp",
    "prive", "uang keluar",
)


def _classify_jenis(value) -> str | None:
    """
    Klasifikasi nilai kolom jenis/tipe menjadi 'masuk' / 'keluar' / 'penyesuaian'
    / 'modal' / 'prive'. Pakai pencocokan kata kunci (contains) supaya nilai
    deskriptif seperti 'Penjualan F&B' atau 'Pengeluaran tunai' tetap terbaca,
    dan tidak jatuh ke default beban (yang membuat pendapatan/keuntungan hilang).
    """
    v = str(value).strip().lower()
    if not v:
        return None
    if v in JENIS_MASUK_VALUES or v in JENIS_KELUAR_VALUES:
        return _normalize_jenis(v)
    if v in TIPE_TO_JENIS:
        return TIPE_TO_JENIS[v]
    if "penyesuaian" in v or "adjust" in v:
        return "penyesuaian"
    if "modal" in v or "setoran" in v:
        return "modal"
    if "prive" in v or "ambil" in v or "penarikan" in v:
        return "prive"
    if any(k in v for k in _KLASIFIKASI_INCOME):
        return "masuk"
    if any(k in v for k in _KLASIFIKASI_EXPENSE):
        return "keluar"
    return None


def _classify_by_text(deskripsi: str, kategori: str) -> str | None:
    """Fallback klasifikasi arah arus kas dari teks deskripsi & kategori transaksi."""
    text = f"{deskripsi} {kategori}".lower()
    if any(k in text for k in _KLASIFIKASI_INCOME):
        return "masuk"
    if any(k in text for k in _KLASIFIKASI_EXPENSE):
        return "keluar"
    return None


def _is_excluded_amount_header(norm: str) -> bool:
    """Header yang jelas menunjuk ke cara/metode pembayaran (bukan nominal)."""
    tokens = [t for t in norm.split("_") if t]
    return any(t in _AMOUNT_EXCLUDE_TOKENS for t in tokens)


def _amount_header_score(header) -> float:
    """Skor prioritas header sebagai kolom uang. -1 = dilarang."""
    norm = _normalize_header(header)
    tokens = [t for t in norm.split("_") if t]
    if _is_excluded_amount_header(norm):
        return -1.0
    if any(t in _AMOUNT_BAD_TOKENS for t in tokens):
        return -1.0
    return max((_AMOUNT_HINT_WEIGHTS[t] for t in tokens if t in _AMOUNT_HINT_WEIGHTS), default=0.0)


def _build_column_map(columns) -> dict[str, str]:
    """Petakan header asli -> kolom kanonik via nama kanonik, alias, atau fuzzy.

    Kolom jumlah dipilih dari SEMUA calon yang cocok: yang paling "berbentuk
    uang" per nama (total > subtotal > nominal > ...) menang, jadi file dengan
    banyak kolom uang (subtotal + ppn + total) tidak asal memakai yang pertama.
    """
    result: dict[str, str] = {}
    used: set[str] = set()
    jumlah_candidates: list[tuple[str, float]] = []
    for col in columns:
        norm = _normalize_header(col)
        canonical = _exact_column_match(norm, used)
        if canonical is None:
            canonical = _fuzzy_column_match(norm, used)
        if canonical is None:
            continue
        if canonical == COL_JUMLAH:
            jumlah_candidates.append((col, _amount_header_score(col)))
            continue
        result[col] = canonical
        used.add(canonical)
    if jumlah_candidates:
        best = max(enumerate(jumlah_candidates), key=lambda e: (e[1][1], -e[0]))
        result[best[1][0]] = COL_JUMLAH
        used.add(COL_JUMLAH)
    return result


def _exact_column_match(norm: str, used: set[str]) -> str | None:
    if norm in CANONICAL_COLUMNS and norm not in used:
        return norm
    for key in CANONICAL_COLUMNS:
        if key in used:
            continue
        if key == COL_JUMLAH and _is_excluded_amount_header(norm):
            continue
        if norm in ALIAS_KOLOM[key]:
            return key
    return None


def _fuzzy_column_match(norm: str, used: set[str]) -> str | None:
    """Cocokkan header dengan alias via substring. Skor berbobot: alias yang
    paling panjang & paling spesifik menang (mis. 'transaction_date',
    'item_desc', 'tgl_trx' tetap terbaca)."""
    best: str | None = None
    best_score = 0.0
    for key in CANONICAL_COLUMNS:
        if key in used:
            continue
        if key == COL_JUMLAH and _is_excluded_amount_header(norm):
            continue
        score = 0.0
        for alias in ALIAS_KOLOM[key]:
            a = alias.lower()
            if len(a) < 4:
                continue
            if a in norm:
                score += len(a)
            elif len(norm) >= 4 and norm in a:
                score += len(norm) * 0.5
        if key in norm:
            score += 5.0
        if score > best_score:
            best, best_score = key, score
    return best if best_score >= 4 else None


def _looks_like_date_column(series) -> bool:
    sample = series.dropna().head(20)
    if sample.empty:
        return False
    for v in sample:
        if isinstance(v, (datetime, date)):
            continue
        try:
            _parse_date(str(v))
        except Exception:
            return False
    return True


def _try_float(value) -> float | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        result = float(value)
        if not math.isfinite(result):
            return None
        return result
    s = str(value).strip()
    if not s:
        return None
    s = re.sub(r"(?i)\b(?:rp|idr)\b", "", s)
    s = s.replace(" ", "").replace("\u00a0", "").replace(",", "")
    if not s:
        return None
    try:
        result = float(s)
    except ValueError:
        return None
    return result if math.isfinite(result) else None


def _looks_like_amount_column(series) -> bool:
    sample = series.dropna().head(20)
    if sample.empty:
        return False
    return all(_try_float(v) is not None for v in sample)


def _amount_ratio(series) -> float:
    """Proporsi sel yang terbaca sebagai angka (untuk memvalidasi isi kolom)."""
    sample = series.dropna().head(40)
    if sample.empty:
        return 0.0
    ok = sum(1 for v in sample if _try_float(v) is not None)
    return ok / len(sample)


def _detect_date_column(dataframe) -> str | None:
    for col in dataframe.columns:
        if _looks_like_date_column(dataframe[col]):
            return col
    return None


def _detect_amount_column(dataframe) -> str | None:
    """Deteksi kolom uang dari isi data bila nama header tidak terbaca.

    Aturan: kolom wajib punya >=3 angka dengan rasio terbaca >=50%; kolom yang
    namanya jelas bukan uang (qty/diskon/ppn/harga_satuan/saldo/metode bayar)
    dikecualikan; pemenang dipilih dari bobot nama (total > nominal > ...) lalu
    "bentuk uang" (negatif/desimal) dan std sebagai tiebreak.
    """
    candidates: list[tuple[str, float, float]] = []  # (col, hint, shape_score)
    for col in dataframe.columns:
        norm = _normalize_header(col)
        hint = _amount_header_score(col)
        if hint < 0:
            continue
        series = dataframe[col].dropna()
        nonnum = series.head(30)
        if nonnum.empty:
            continue
        nums = [_try_float(v) for v in nonnum if _try_float(v) is not None]
        if len(nums) < 3 or len(nums) / len(nonnum) < 0.5:
            continue
        nums50 = [_try_float(v) for v in dataframe[col].dropna().head(50) if _try_float(v) is not None]
        has_neg = any(n < 0 for n in nums50)
        has_dec = any(n != int(n) for n in nums50)
        shape_score = (10 if has_neg else 0) + (5 if has_dec else 0) + (pd_std(nums50) if nums50 else 0.0)
        candidates.append((col, hint, shape_score))
    if not candidates:
        return None
    return max(candidates, key=lambda c: (c[1], c[2]))[0]


def pd_std(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / (len(values) - 1)
    return variance ** 0.5


def _detect_description_column(dataframe) -> str | None:
    _desc_hints = (
        "nama", "deskripsi", "keterangan", "uraian", "rincian", "catatan",
        "item", "kegiatan", "remark", "note", "barang", "transaksi",
    )
    best_col = None
    best_score = -1.0
    for col in dataframe.columns:
        norm = _normalize_header(col)
        if norm in _NON_DESKRIPSI_ALIASES:
            continue
        if _looks_like_date_column(dataframe[col]) or _looks_like_amount_column(dataframe[col]):
            continue
        strings = [str(v).strip() for v in dataframe[col].dropna().head(50) if str(v).strip()]
        if not strings:
            continue
        avg_len = sum(len(s) for s in strings) / len(strings)
        unique_ratio = len(set(strings)) / len(strings)
        hint = sum(2 for h in _desc_hints if len(h) >= 3 and h in norm)
        score = avg_len + unique_ratio * 5 + hint
        if score > best_score:
            best_score = score
            best_col = col
    return best_col


class JurnalMappingError(Exception):
    pass


def _load_keyword_mapping(path: str | Path | None = None) -> list[dict]:
    mapping_path = Path(path) if path else _DEFAULT_KEYWORD_PATH
    if not mapping_path.exists():
        logger.warning("Keyword mapping tidak ditemukan di %s, fallback ke kategori", mapping_path)
        return []

    rows = []
    with open(mapping_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append({
                "kata_kunci": row["kata_kunci"].strip().lower(),
                "debit": row["kemungkinan_akun_debit"].strip(),
                "kredit": row["kemungkinan_akun_kredit"].strip(),
                "kategori": row["kategori_transaksi"].strip(),
            })
    return rows


def _match_keyword(deskripsi: str, keyword_mapping: list[dict]) -> dict | None:
    deskripsi_lower = deskripsi.lower()
    for entry in keyword_mapping:
        if entry["kata_kunci"] in deskripsi_lower:
            return entry
    return None


_DATE_FORMATS = (
    "%Y-%m-%d", "%Y/%m/%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y",
    "%m/%d/%Y", "%Y%m%d", "%d/%m/%y", "%d-%m-%y", "%d.%m.%y",
    "%d %m %Y", "%d %b %Y", "%d %B %Y", "%b %d %Y", "%b %d, %Y", "%B %d, %Y",
    "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S.%f",
    "%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M",
    "%d-%m-%Y %H:%M:%S", "%d-%m-%Y %H:%M",
    "%Y/%m/%d %H:%M:%S", "%Y/%m/%d %H:%M",
    "%d.%m.%Y %H:%M:%S", "%d.%m.%Y %H:%M",
    "%d %b %Y %H:%M:%S", "%d %B %Y %H:%M",
)

_BULAN_ID = {
    "januari": "01", "februari": "02", "maret": "03", "april": "04",
    "mei": "05", "juni": "06", "juli": "07", "agustus": "08",
    "september": "09", "oktober": "10", "november": "11", "desember": "12",
}


def _parse_date(val) -> date:
    """
    Parse tanggal secara toleran: objek datetime/date/Timestamp, serial Excel,
    format ISO/ID/US dengan/tanpa waktu, dan bulan berbahasa Indonesia.
    Melempar JurnalMappingError bila nilai benar-benar bukan tanggal.
    """
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val

    raw = str(val).strip()
    if not raw or raw.lower() in ("nan", "none", "nat", "na", "null"):
        raise JurnalMappingError("Tanggal kosong")

    # Serial number Excel (mis. 44567) -> 1899-12-30 + n hari.
    try:
        serial = float(raw.replace(",", "."))
        if 20000 <= serial <= 60000 and serial.is_integer():
            return date(1899, 12, 30) + timedelta(days=int(serial))
    except ValueError:
        pass

    # ISO datetime64: "2026-08-29T10:30:00.000000Z" / penanda zona lokal.
    s = raw.replace("T", " ", 1).replace("Z", "").strip()
    s = re.sub(r"(?i)\s*(wib|wit|wita|utc|\+0\d00|\+07:00|\+08:00|\+09:00)\s*$", "", s).strip()
    s = s.lower()
    for bulan, angka in _BULAN_ID.items():
        s = s.replace(bulan, angka)

    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    raise JurnalMappingError(f"Gagal parse tanggal: {raw}")


def _parse_float(val: str) -> float:
    if isinstance(val, (int, float)) and not isinstance(val, bool):
        result = float(val)
    else:
        cleaned = str(val).strip()
        cleaned = re.sub(r"(?i)\b(?:rp|idr)\b", "", cleaned)
        cleaned = cleaned.replace(" ", "").replace("\u00a0", "")

        if "," in cleaned and "." in cleaned:
            # Format Indonesia: 1.234.567,89 -> buang titik, koma jadi desimal
            cleaned = cleaned.replace(".", "").replace(",", ".")
        elif "," in cleaned:
            # Koma sebagai desimal: 10,5 -> 10.5
            cleaned = cleaned.replace(",", ".")
        elif "." in cleaned:
            # Titik sebagai ribuan kalau selalu grup 3 digit: 10.000 -> 10000; 10.5 -> 10.5
            parts = cleaned.split(".")
            if len(parts) > 1 and all(len(p) == 3 for p in parts[1:]) and len(parts[-1]) == 3:
                cleaned = cleaned.replace(".", "")

        if not cleaned:
            raise JurnalMappingError(f"Gagal parse angka: {val}")
        try:
            result = float(cleaned)
        except ValueError:
            raise JurnalMappingError(f"Tidak bisa baca nominal '{val}'") from None

    if not math.isfinite(result):
        raise JurnalMappingError(f"Gagal parse angka: {val}")
    return result


def _try_parse_float(value) -> float | None:
    """Parse nominal tapi toleran terhadap sel kosong (None -> None)."""
    try:
        return _parse_float(value)
    except JurnalMappingError:
        return None


def _determine_akun_pair(
    jenis: str,
    kategori: str,
    keyword_entry: dict | None,
) -> tuple[str, str]:
    jenis_lower = jenis.strip().lower()

    if jenis_lower == "penyesuaian" and keyword_entry:
        return keyword_entry["debit"], keyword_entry["kredit"]

    if jenis_lower == "modal":
        # Setoran modal: kas bertambah, kredit akun Modal Pemilik (3-1000)
        if keyword_entry:
            return AKUN_KAS_DEFAULT, keyword_entry["kredit"]
        return AKUN_KAS_DEFAULT, "3-1000"

    if jenis_lower == "prive":
        # Penarikan prive pemilik: debit Prive (3-2000), kredit kas
        return "3-2000", AKUN_KAS_DEFAULT

    if jenis_lower == "masuk":
        if keyword_entry:
            return AKUN_KAS_DEFAULT, keyword_entry["kredit"]
        fallback = KATEGORI_FALLBACK.get(kategori, ("1-1000", "4-1000"))
        return AKUN_KAS_DEFAULT, fallback[1]

    if keyword_entry:
        return keyword_entry["debit"], AKUN_KAS_DEFAULT
    fallback = KATEGORI_FALLBACK.get(kategori, ("5-9000", "1-1000"))
    return fallback[0], AKUN_KAS_DEFAULT


def _build_name_to_code_map(akun_rows: list[Akun]) -> dict[str, str]:
    """Build lowercase nama_akun -> kode_akun mapping."""
    return {a.nama_akun.strip().lower(): a.kode_akun for a in akun_rows}


def _resolve_akun_name(name: str, name_to_code: dict[str, str], akun_map: dict[str, str]) -> str | None:
    """Resolve account name to account code. Exact match first, then fuzzy contains."""
    name_lower = name.strip().lower()
    if not name_lower:
        return None

    # Exact match
    code = name_to_code.get(name_lower)
    if code and code in akun_map:
        return code

    # Fuzzy contains match
    candidates = []
    for nama, kode in name_to_code.items():
        if kode not in akun_map:
            continue
        if name_lower in nama or nama in name_lower:
            candidates.append((nama, kode))

    if candidates:
        best = min(candidates, key=lambda x: len(x[0]))
        return best[1]

    return None


def auto_journal_from_dataframe(
    db: Session,
    dataframe,
    uploaded_file_id: str,
    user_id: str,
    filename_stem: str,
    keyword_mapping_path: str | Path | None = None,
) -> tuple[int, list[str]]:
    """
    Buat jurnal otomatis dari DataFrame transaksi via batch insert.

    Mendukung 3 format:
      - Format A: kolom tanggal, deskripsi, jumlah, jenis, kategori
      - Format B: kolom tanggal, tipe, total, akun_debit, akun_kredit (+ kolom lain)
      - Format baku Debit/Kredit: kolom tanggal, keterangan, debit, kredit

    Toleran terhadap nama kolom: header dicocokkan lewat alias & substring
    fuzzy, dan bila gagal, kolom dideteksi lewat isi data. File tidak pernah
    dibatalkan hanya karena nama kolom berbeda — baris yang tidak bisa diproses
    dilewati dan dicatat sebagai warning.

    Returns: tuple (jumlah jurnal yang berhasil dibuat, daftar warning/error baris).
    """
    keyword_mapping = _load_keyword_mapping(keyword_mapping_path)

    # --- 1. Normalisasi header & petakan ke kolom kanonik (alias/fuzzy) ---
    column_map = _build_column_map(dataframe.columns)
    # Validasi isi kolom hasil mapping: kolom yang dipetakan ke peran jumlah/
    # tanggal tapi isinya tidak sesuai ("metode pembayaran" dst.) dibuang dari
    # proses supaya tidak merampas peran jumlah dan upload tetap jalan.
    validated_map: dict[str, str] = {}
    for header, canonical in column_map.items():
        if canonical == COL_TANGGAL and not _looks_like_date_column(dataframe[header]):
            logger.info("Kolom tanggal '%s' dibuang: isi tidak berupa tanggal", header)
            continue
        if canonical in _AMOUNT_CANONICALS and _amount_ratio(dataframe[header]) < 0.6:
            logger.info("Kolom nominal '%s' dibuang: isi tidak berupa angka", header)
            continue
        validated_map[header] = canonical
    if validated_map:
        dataframe = dataframe.rename(columns=validated_map)

    # --- 2. Fallback deteksi kolom lewat isi data (bukan nama header) ---
    cols = set(dataframe.columns)
    has_columnar_debit_kredit = COL_DEBIT in cols and COL_KREDIT in cols
    has_columnar_masuk_keluar = COL_MASUK in cols and COL_KELUAR in cols

    if COL_TANGGAL not in cols:
        detected = _detect_date_column(dataframe)
        if detected:
            dataframe = dataframe.rename(columns={detected: COL_TANGGAL})

    if COL_JUMLAH not in dataframe.columns and not has_columnar_debit_kredit and not has_columnar_masuk_keluar:
        detected = _detect_amount_column(dataframe)
        if detected:
            dataframe = dataframe.rename(columns={detected: COL_JUMLAH})

    if COL_DESKRIPSI not in dataframe.columns:
        detected = _detect_description_column(dataframe)
        if detected:
            dataframe = dataframe.rename(columns={detected: COL_DESKRIPSI})

    cols = set(dataframe.columns)

    # --- Normalize column aliases ---
    has_akun_cols = ALIAS_AKUN_DEBIT in cols and ALIAS_AKUN_KREDIT in cols
    has_jenis = COL_JENIS in cols
    columnar_debit_kredit = COL_DEBIT in cols and COL_KREDIT in cols and COL_JUMLAH not in cols
    columnar_masuk_keluar = COL_MASUK in cols and COL_KELUAR in cols and COL_JUMLAH not in cols

    if COL_TANGGAL not in cols:
        logger.info("Kolom tanggal tidak ditemukan; baris tanpa tanggal akan dilewati.")
    if COL_JUMLAH not in cols and not columnar_debit_kredit and not columnar_masuk_keluar:
        logger.info("Kolom jumlah/nominal tidak ditemukan; baris tanpa nominal akan dilewati.")
    if not has_jenis and not has_akun_cols and not columnar_debit_kredit and not columnar_masuk_keluar:
        logger.info("Kolom 'jenis' tidak ditemukan, default ke 'masuk' per transaksi.")

    # --- Pre-fetch: semua akun aktif ---
    akun_rows: list[Akun] = db.query(Akun).filter(Akun.is_active.is_(True)).all()
    akun_map: dict[str, str] = {a.kode_akun: a.id for a in akun_rows}
    name_to_code: dict[str, str] = _build_name_to_code_map(akun_rows)

    # --- Pre-fetch: no_bukti yang sudah ada (scoped ke user ini saja) ---
    existing_bukti: set[str] = {
        r[0] for r in db.query(JurnalUmum.no_bukti).filter(JurnalUmum.created_by_id == user_id).all()
    }

    # --- Pre-fetch: tahun yang sudah ditutup (tutup buku) supaya tidak diisi ulang ---
    tutup_tahun: set[int] = {
        r[0] for r in db.query(TutupBuku.tahun).filter(TutupBuku.user_id == user_id).all()
    }

    # --- Translate tipe -> jenis values if needed ---
    if has_jenis and not has_akun_cols:
        sample_values = set(str(v).strip().lower() for v in dataframe[COL_JENIS].head(20))
        if sample_values & set(TIPE_TO_JENIS.keys()):
            dataframe[COL_JENIS] = dataframe[COL_JENIS].apply(
                lambda v: TIPE_TO_JENIS.get(str(v).strip().lower(), str(v).strip().lower())
            )

    # --- Build semua jurnal di memory ---
    all_jurnals: list[JurnalUmum] = []
    errors: list[str] = []
    used_bukti: set[str] = set()

    for row_num, row in enumerate(dataframe.itertuples(index=False), start=1):
        try:
            if COL_TANGGAL not in cols:
                errors.append(f"Baris {row_num + 1}: Tidak ada kolom tanggal, dilewati")
                continue

            tanggal = _parse_date(getattr(row, COL_TANGGAL))
            if tutup_tahun and tanggal.year in tutup_tahun:
                errors.append(
                    f"Baris {row_num + 1}: Tanggal {tanggal.isoformat()} berada di tahun "
                    f"{tanggal.year} yang sudah ditutup (tutup buku), dilewati"
                )
                continue
            deskripsi = str(getattr(row, COL_DESKRIPSI)).strip() if COL_DESKRIPSI in cols else "Transaksi"

            debit_val = kredit_val = masuk_val = keluar_val = 0.0
            if columnar_debit_kredit:
                debit_val = _try_parse_float(getattr(row, COL_DEBIT)) or 0.0
                kredit_val = _try_parse_float(getattr(row, COL_KREDIT)) or 0.0
                jumlah = max(debit_val, kredit_val)
            elif columnar_masuk_keluar:
                masuk_val = _try_parse_float(getattr(row, COL_MASUK)) or 0.0
                keluar_val = _try_parse_float(getattr(row, COL_KELUAR)) or 0.0
                jumlah = max(masuk_val, keluar_val)
            elif COL_JUMLAH in cols:
                jumlah = _parse_float(getattr(row, COL_JUMLAH))
            else:
                errors.append(f"Baris {row_num + 1}: Tidak ada kolom jumlah/nominal, dilewati")
                continue

            if jumlah == 0:
                continue
            if jumlah < 0:
                jumlah = abs(jumlah)
                negatif = True
            else:
                negatif = False

            # no_bukti unik per upload (masukkan cuplikan upload_id) supaya file
            # dengan nama sama bisa diupload ulang tanpa bentrok nomor bukti
            no_bukti = f"AUTO-{filename_stem[:6].upper()}-{str(uploaded_file_id)[:8]}-{row_num:04d}"
            if no_bukti in existing_bukti or no_bukti in used_bukti:
                errors.append(f"Baris {row_num + 1}: No. bukti {no_bukti} sudah ada")
                continue
            used_bukti.add(no_bukti)

            # --- Determine akun pair ---
            if has_akun_cols:
                raw_debit = str(getattr(row, ALIAS_AKUN_DEBIT)).strip()
                raw_kredit = str(getattr(row, ALIAS_AKUN_KREDIT)).strip()

                akun_debit = _resolve_akun_name(raw_debit, name_to_code, akun_map)
                akun_kredit = _resolve_akun_name(raw_kredit, name_to_code, akun_map)

                if not akun_debit:
                    errors.append(f"Baris {row_num + 1}: Akun debit '{raw_debit}' tidak ditemukan di chart of accounts")
                    continue
                if not akun_kredit:
                    errors.append(f"Baris {row_num + 1}: Akun kredit '{raw_kredit}' tidak ditemukan di chart of accounts")
                    continue
            else:
                raw_jenis = str(getattr(row, COL_JENIS)).strip() if has_jenis else ""
                has_kategori = COL_KATEGORI in cols
                kategori = str(getattr(row, COL_KATEGORI)).strip().lower() if has_kategori else ""
                jenis = _classify_jenis(raw_jenis)
                if jenis is None:
                    jenis = _classify_by_text(deskripsi, kategori)
                if jenis is None and columnar_debit_kredit:
                    jenis = "keluar" if debit_val > 0 else "masuk"
                if jenis is None and columnar_masuk_keluar:
                    jenis = "masuk" if masuk_val > 0 else "keluar"
                if jenis is None:
                    jenis = "masuk"
                if negatif and jenis == "masuk":
                    jenis = "keluar"
                keyword_entry = _match_keyword(deskripsi, keyword_mapping)
                akun_debit, akun_kredit = _determine_akun_pair(jenis, kategori, keyword_entry)

            if akun_debit not in akun_map:
                errors.append(f"Baris {row_num + 1}: Kode akun debit '{akun_debit}' tidak ada di DB")
                continue
            if akun_kredit not in akun_map:
                errors.append(f"Baris {row_num + 1}: Kode akun kredit '{akun_kredit}' tidak ada di DB")
                continue

            jurnal = JurnalUmum(
                no_bukti=no_bukti,
                tanggal=tanggal,
                deskripsi=deskripsi,
                jenis=JenisJurnal.UMUM,
                created_by_id=user_id,
                sumber_upload_id=uploaded_file_id,
            )
            jurnal.detail.append(
                JurnalDetail(
                    akun_id=akun_map[akun_debit],
                    urutan=0,
                    debit=jumlah,
                    kredit=0,
                    keterangan=deskripsi,
                )
            )
            jurnal.detail.append(
                JurnalDetail(
                    akun_id=akun_map[akun_kredit],
                    urutan=1,
                    debit=0,
                    kredit=jumlah,
                    keterangan=deskripsi,
                )
            )
            all_jurnals.append(jurnal)

        except Exception as exc:
            errors.append(f"Baris {row_num + 1}: {exc}")

    # Single batch insert + single commit
    if all_jurnals:
        db.add_all(all_jurnals)
        db.commit()
        logger.info("Batch auto-jurnal selesai: %d jurnal dari %d baris transaksi.", len(all_jurnals), len(dataframe))
    else:
        logger.warning("Tidak ada jurnal yang dibuat dari %d baris transaksi.", len(dataframe))

    # Jaga ukuran pesan error/warning tetap terbatas; sisanya dirangkum.
    if len(errors) > _MAX_ERROR_MSGS:
        kept = _MAX_ERROR_MSGS - 1
        extra = len(errors) - kept
        errors = errors[:kept]
        errors.append(f"… dan {extra} baris lainnya dilewati")

    if errors:
        logger.warning(
            "Auto-jurnal selesai dengan %d error dari %d baris: %s",
            len(errors), len(dataframe), "; ".join(errors[:5]),
        )

    return len(all_jurnals), errors
