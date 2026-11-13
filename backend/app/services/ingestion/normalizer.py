"""
Normalisasi teks/tabel mentah hasil file_loader.py:
- Rapikan whitespace berlebih di teks pdf
- Hapus baris kosong/duplikat berulang (header/footer halaman)
- Normalisasi nama kolom tabel (biar konsisten dipakai di markdown_generator)
"""

import re

import pandas as pd

from app.services.ingestion.file_loader import LoadedDocument


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)          # spasi/tab berlebih
    text = re.sub(r"\n{3,}", "\n\n", text)        # baris kosong berlebih
    return text.strip()


def unescape_markdown(text: str) -> str:
    """Kembalikan karakter markdown yang tidak sengaja di-escape."""
    return re.sub(r"\\([#*_`\[\]~-])", r"\1", text)


def normalize_column_names(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
    return df


def _remove_repeated_lines(pages: list[str], min_repeat: int = 3) -> list[str]:
    """Hapus baris yang muncul berulang di banyak halaman (biasanya header/footer)."""
    if len(pages) < min_repeat:
        return pages

    line_counts: dict[str, int] = {}
    for page in pages:
        for line in set(page.split("\n")):
            line_stripped = line.strip()
            if line_stripped:
                line_counts[line_stripped] = line_counts.get(line_stripped, 0) + 1

    repeated = {line for line, count in line_counts.items() if count >= min_repeat}

    cleaned_pages = []
    for page in pages:
        kept_lines = [line for line in page.split("\n") if line.strip() not in repeated]
        cleaned_pages.append("\n".join(kept_lines))
    return cleaned_pages


def normalize_document(doc: LoadedDocument) -> LoadedDocument:
    if doc.file_type == "pdf":
        cleaned_pages = [normalize_text(p) for p in doc.raw_text_pages]
        cleaned_pages = _remove_repeated_lines(cleaned_pages)
        doc.raw_text_pages = cleaned_pages
    else:
        for table in doc.tables:
            table.dataframe = normalize_column_names(table.dataframe)
            # Buang baris yang semua kolomnya kosong
            table.dataframe = table.dataframe.dropna(how="all").reset_index(drop=True)
    return doc
