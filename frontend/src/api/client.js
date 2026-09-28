import axios from 'axios'

// Di web dev: '/api' (di-proxy Vite ke backend).
// Di desktop/built: bisa diarahkan ke URL backend langsung via VITE_API_URL.
const baseURL = import.meta.env.VITE_API_URL || '/api'

let _onUnauthorized = null

export function setUnauthorizedHandler(fn) {
  _onUnauthorized = fn
}

const client = axios.create({
  baseURL,
  withCredentials: true,
  // JANGAN set Content-Type default di sini. Kalau header ini dipaksa jadi
  // 'application/json', axios tidak lagi menebak tipe konten, dan request
  // FormData jadi mengirim 'multipart/form-data' TANPA boundary sehingga
  // server menolak dengan "Missing boundary in multipart".
  // Axios sudah otomatis memakai application/json untuk payload biasa dan
  // membiarkan browser yang sets boundary untuk FormData.
})

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const path = window.location.pathname
      const publicPaths = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/demo']
      if (!publicPaths.includes(path)) {
        localStorage.removeItem('user')
        if (_onUnauthorized) {
          _onUnauthorized()
        } else {
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(err)
  }
)

export default client
