// Cache dashboard level-modul supaya komponen yang di-mount ulang saat
// navigasi SPA tidak perlu fetch ulang / menampilkan skeleton lagi.
// State hidup selama app tidak di-reload penuh (F5) dan dibersihkan
// otomatis tiap kali ada data baru (upload, jurnal baru, hapus file).

let state = {
  key: null,
  data: null,
  barAnimDone: false,
  isAuto: true,
  selectedMonth: '',
  uploadId: '',
}

const insightCache = new Map()

export function getDashboardState() {
  return state
}

export function setDashboardState(next) {
  state = { ...state, ...next }
}

export function getInsight(key) {
  return insightCache.get(key) || null
}

export function setInsight(key, insight) {
  insightCache.clear()
  insightCache.set(key, insight)
}

// Panggil di titik mutasi data (upload sukses, hapus file, jurnal baru) —
// baik karena dashboard terpasang ataupun tidak, cache harus dibuang supaya
// saat balik ke dashboard datanya di-refetch sekali saja.
export function clearDashboard() {
  state = { key: null, data: null, barAnimDone: false, isAuto: true, selectedMonth: '', uploadId: '' }
  insightCache.clear()
}

// Satu helper untuk semua aksi yang mengubah data: buang cache dashboard +
// beri tahu halaman lain (dashboard/upload) supaya ambil data segar.
export function notifyDataChanged() {
  clearDashboard()
  window.dispatchEvent(new Event('data-changed'))
}