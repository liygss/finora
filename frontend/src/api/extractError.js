/**
 * Extract a human-readable error message from an Axios error.
 * Handles FastAPI's validation errors (422 detail array),
 * plain HTTPException strings, dan respons non-JSON.
 */

/** Pesan yang lebih jujur per kode status, supaya user tidak mengira salahannya input mereka. */
const STATUS_MESSAGE = {
  401: 'Sesi berakhir. Silakan masuk kembali.',
  403: 'Kamu tidak punya akses ke aksi ini.',
  404: 'Data tidak ditemukan.',
  413: 'Ukuran file terlalu besar. Maksimal 4MB.',
  429: 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.',
}

/** Body respons serverless (Vercel/Neon) sering teks biasa, bukan JSON. */
function plainText(data) {
  if (typeof data === 'string') return data.slice(0, 200).trim()
  return null
}

export function extractError(err, fallback = 'Terjadi kesalahan') {
  const status = err?.response?.status
  const data = err?.response?.data

  // 1) FastAPI: {"detail": "..."} atau 422 dengan array
  const raw = data?.detail
  if (typeof raw === 'string' && raw.trim()) return raw
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((e) => e.msg || e.detail).filter(Boolean).join('; ')
  }

  // 2) Respons non-JSON (proxy/platform): "Internal Server Error" dsb.
  const text = plainText(data)
  if (text) return text

  // 3) Timeout / tidak ada respons sama sekali
  if (err?.code === 'ECONNABORTED' || /timeout/i.test(err?.message || '')) {
    return 'Permintaan terlalu lama. Server mungkin sedang sibuk — coba lagi.'
  }
  if (!err?.response) {
    return 'Tidak dapat terhubung ke server. Periksa koneksi internetmu.'
  }

  // 4) 5xx: jangan tunjukkan "Internal Server Error" apa adanya — jelaskan
  //    ini masalah server, bukan kesalahan pengguna.
  if (status >= 500) {
    return 'Server sedang mengalami masalah. Registrasi/data belum tersimpan — coba lagi beberapa saat lagi.'
  }

  // 5) Status spesifik lainnya
  if (STATUS_MESSAGE[status]) return STATUS_MESSAGE[status]

  return fallback
}
