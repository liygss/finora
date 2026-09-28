import { Loader2 } from 'lucide-react'

/**
 * Layar penuh saat app sedang memverifikasi sesi.
 *
 * Sebelumnya ProtectedRoute/SetupRoute/GuestRoute memakai `return null`, jadi
 * selama AuthProvider memanggil /auth/me seluruh halaman benar-benar kosong —
 * di tema gelap itu tampak sebagai layar hitam tanpa Indikasi apa pun.
 */
export default function LoadingScreen({ label = 'Menyiapkan aplikasi…' }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ background: 'var(--color-surface-0, #0f172a)' }}
      role="status"
      aria-live="polite"
    >
      <Loader2
        className="animate-spin"
        size={34}
        style={{ color: 'var(--color-accent, #2563eb)' }}
        aria-hidden="true"
      />
      <p className="text-sm font-medium" style={{ color: 'var(--color-slate-body, #94a3b8)' }}>
        {label}
      </p>
    </div>
  )
}
