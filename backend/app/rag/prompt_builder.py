"""Rakit system prompt + konteks retrieval + histori chat + pertanyaan jadi messages untuk LLM."""

import re

from app.llm.prompt_template import (
    get_accounting_prompt_addon,
    get_system_prompt,
    get_tax_prompt_addon,
)
from app.rag.context_builder import BuiltContext

MAX_FINANCIAL_CONTEXT_CHARS = 80_000  # batasi agar total prompt tidak melebihi context window model (131K tokens ~524K chars)

TAX_KEYWORDS = [
    "pajak", "pph", "ppn", "npwp", "faktur pajak", "spt", "spt masa", "spt tahunan",
    "umkm final", "pph final", "tarif pajak", "formulir pajak", "lapor pajak",
    "pelaporan pajak", "billing", "e-billing", "kode billing", "ntpn", "bpn", "coretax",
    "djp", "pajak.go.id", "pph21", "pph 21", "pph23", "pph 23", "pph25", "pph 25",
    "pph29", "pph 29", "ppn12", "ppn 12", "pkp", "pengusaha kena pajak", "bupot",
    "e-bupot", "ebupot", "restitusi", "keberatan pajak", "banding pajak", "pemeriksaan pajak",
    "sanksi pajak", "denda pajak", "bunga pajak", "ptkp", "kredit pajak", "omzet kena pajak",
    "konsultasi pajak", "1770", "1770s", "1771",
]
ACCOUNTING_KEYWORDS = [
    "jurnal", "neraca", "laba rugi", "buku besar", "akun", "penyusutan",
    "pembukuan", "modal", "arus kas", "debit", "kredit",
]
FINANCE_KEYWORDS = [
    "keuangan", "uang", "kas", "piutang", "utang", "beban", "pendapatan",
    "penjualan", "belanja", "biaya", "laba", " rugi", "aset", "barang",
    "inventaris", "stok", "persediaan", "gaji", "upah", " THR",
    "omset", " revenue", "profit", "cashflow", "laporan", "report",
    "transaksi", "bayar", "tagihan", "invoice", "bon", "kwitansi",
    "budget", "anggaran", "forecast", "proyeksi",
]
ANALYSIS_KEYWORDS = [
    "jelaskan", "analisis", "ringkas", "summary", "dataset", "data ini",
    "data saya", "file ini", "file saya", "penjualan", "pembelian",
    "meningkatkan", "menaikkan", "omset", "laba", "strategi", "saran",
    "rekomendasi", "insight", "pola", "tren", "trend", "perbandingan",
    "kategori", "terbanyak", "tertinggi", "terendah", "total",
    "berapa", "berapa banyak", "berapa total", "berapa banyak",
]
APP_KEYWORDS = [
    "finora", "aplikasi", "fitur", "cara pakai", "cara gunakan",
    "cara menggunakan", "cara pakai", "fungsi", "halaman", "menu",
    "navigasi", "sidebar", "registrasi", "login", "daftar akun",
    "profil", "electron", "unduh", "download", "install", "versi",
    "dashboard", "upload", "jurnal umum", "laporan", "pajak",
    "spt", "chatbot", "asisten", "knowledge", "feedback",
    "kalkulator", "kalkulasi", "formulir", "export", "eksport",
    "cetak", "pdf", "excel", "csv", "draft", "simpan",
    "apa itu finora", "tentang finora", "tentang aplikasi",
    "fitur finora", "fitur aplikasi", "guna", "kegunaan",
    "langkah", "tutorial", "panduan", "cara membuat",
    "cara melihat", "cara menghitung", "cara mengisi",
    "cara mengelola", "cara mengirim", "cara menghapus",
]
ALL_TOPIC_KEYWORDS = TAX_KEYWORDS + ACCOUNTING_KEYWORDS + FINANCE_KEYWORDS + APP_KEYWORDS + ANALYSIS_KEYWORDS


def _contains_keyword(text: str, keyword: str) -> bool:
    """Cocokkan keyword sebagai kata/frasa, bukan substring sembarang."""
    pattern = rf"(?<!\w){re.escape(keyword.lower())}(?!\w)"
    return re.search(pattern, text) is not None


def _matches_any(text: str, keywords: list[str]) -> bool:
    return any(_contains_keyword(text, keyword) for keyword in keywords)


def detect_domain(pertanyaan: str) -> str:
    """Deteksi topik pertanyaan: "tax", "accounting", "app", atau "" (umum)."""
    lowered = pertanyaan.lower()
    # Prioritaskan domain spesifik (tax/accounting) sebelum umum (app)
    if _matches_any(lowered, TAX_KEYWORDS):
        return "tax"
    if _matches_any(lowered, ACCOUNTING_KEYWORDS):
        return "accounting"
    if _matches_any(lowered, APP_KEYWORDS):
        return "app"
    return ""


def is_out_of_topic(pertanyaan: str) -> bool:
    """Cek apakah pertanyaan di luar topik akuntansi/keuangan/pajak."""
    lowered = pertanyaan.lower().strip()
    if not lowered:
        return False
    return not _matches_any(lowered, ALL_TOPIC_KEYWORDS)


def _pilih_prompt_addon(pertanyaan: str) -> str:
    domain = detect_domain(pertanyaan)
    if domain == "tax":
        return get_tax_prompt_addon()
    if domain == "accounting":
        return get_accounting_prompt_addon()
    return ""


def build_messages(
    pertanyaan: str,
    context: BuiltContext,
    histori_chat: list[dict[str, str]] | None = None,
    financial_context: str | None = None,
    page: str | None = None,
    context_label: str | None = None,
) -> list[dict[str, str]]:
    """
    histori_chat: list of {"role": "user"|"assistant", "content": "..."} dari
    ChatMessage sebelumnya di sesi yang sama (dibatasi beberapa pesan terakhir
    oleh pemanggil supaya prompt tidak membengkak).
    financial_context: data keuangan user dari PostgreSQL (opsional).
    page: label halaman aktif user (opsional) agar jawaban lebih kontekstual.
    """
    system_prompt = get_system_prompt()
    addon = _pilih_prompt_addon(pertanyaan)
    if addon:
        system_prompt = f"{system_prompt}\n\n{addon}"

    if page:
        system_prompt += (
            f"\n\nLokasi pengguna saat ini: halaman {page}. "
            "Jika relevan, arahkan jawaban pada fitur/perintah yang ada di "
            "halaman tersebut."
        )

    # Tambahkan financial context (data keuangan user) jika ada
    if financial_context:
        # Batasi panjang financial context agar prompt tidak overflow
        if len(financial_context) > MAX_FINANCIAL_CONTEXT_CHARS:
            financial_context = (
                financial_context[:MAX_FINANCIAL_CONTEXT_CHARS]
                + f"\n\n... (dipotong, data asli {len(financial_context):,} karakter, "
                f"dibatasi {MAX_FINANCIAL_CONTEXT_CHARS:,} karakter agar sesuai context window LLM)"
            )
        # Deteksi apakah ini konteks analisis upload
        is_upload_analysis = "Analisis File:" in financial_context
        context_label = context_label or (
            "## Data File Upload Pengguna:\n\n"
            if is_upload_analysis
            else "## Data Keuangan Pengguna yang Tersedia:\n\n"
        )
        analysis_hint = (
            "\n\nKamu sedang menganalisis file upload pengguna. Berikan analisis yang "
            "mendalam, jelaskan pola data, berikan insight bisnis, dan saran/actionable "
            "recommendations. Gunakan tabel markdown untuk menampilkan data dengan rapi. "
            "Jika pengguna bertanya tentang cara meningkatkan penjualan/omset/laba, "
            "berikan rekomendasi spesifik berdasarkan data yang tersedia."
            if is_upload_analysis
            else ""
        )
        system_prompt += (
            f"\n\n{context_label}"
            f"{financial_context}\n\n"
            "Gunakan data di atas untuk menjawab pertanyaan pengguna tentang "
            "kondisi keuangan usahanya. Sajikan angka dengan format Rupiah yang "
            "jelas. Jika data tidak lengkap untuk menjawab sepenuhnya, "
            "keterangkan bagian mana yang tidak tersedia."
            f"{analysis_hint}"
        )

    # Tambahkan knowledge base context (dari Qdrant/RAG)
    if context.context_text:
        context_text = context.context_text
        max_knowledge_chars = 40_000
        if len(context_text) > max_knowledge_chars:
            context_text = context_text[:max_knowledge_chars] + "\n\n... (konteks dokumen dipotong agar sesuai context window)"
        system_prompt += (
            "\n\n## Konteks Dokumen Pengetahuan:\n\n"
            f"{context_text}"
        )
    else:
        system_prompt += (
            "\n\nTidak ada dokumen pengetahuan spesifik yang ditemukan untuk "
            "pertanyaan ini. Bila pertanyaan menyangkut keuangan/pajak "
            "pengguna, gunakan data keuangan yang tersedia bila ada. "
            "Jika pertanyaan menyangkut penggunaan aplikasi Finora, berikan "
            "penjelasan umum berdasarkan pemahaman kamu tentang aplikasi. "
            "Jika pertanyaan di luar topik akuntansi/keuangan/pajak/aplikasi, "
            "tolak dengan sopan dan arahkan pengguna untuk bertanya "
            "seputar pembukuan, laporan keuangan, perpajakan UMKM, atau "
            "penggunaan aplikasi Finora."
        )

    messages = [{"role": "system", "content": system_prompt}]
    if histori_chat:
        messages.extend(histori_chat)
    messages.append({"role": "user", "content": pertanyaan})
    return messages
