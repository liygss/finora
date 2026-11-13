import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import client from '../api/client'
import toast from 'react-hot-toast'
import { extractError } from '../api/extractError'
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) {
      toast.error('Konfirmasi kata sandi tidak cocok')
      return
    }
    if (!token) {
      toast.error('Link reset tidak valid. Mohon minta link baru.')
      return
    }
    setLoading(true)
    try {
      await client.post('/auth/reset-password', { token, password })
      setDone(true)
    } catch (err) {
      toast.error(extractError(err, 'Gagal mereset kata sandi'))
    } finally {
      setLoading(false)
    }
  }

  const passOk = /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && password.length >= 8

  return (
    <div className="relative flex min-h-screen overflow-hidden items-center justify-center p-6" style={{ background: 'var(--color-surface-0)' }}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(148,163,184,0.05) 1px, transparent 0)', backgroundSize: '36px 36px' }} />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="flex items-center justify-between mb-6 animate-fade-in">
          <Link to="/login" className="inline-flex items-center gap-2 text-sm font-medium transition hover:opacity-80" style={{ color: 'var(--color-slate-body)' }}>
            <ArrowLeft size={16} /> Kembali ke Login
          </Link>
          <ThemeToggle compact />
        </div>

        <div className="rounded-3xl p-8 animate-fade-in" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-soft)', backdropFilter: 'blur(24px)', boxShadow: '0 24px 80px rgba(0, 0, 0, 0.2)' }}>
          {done ? (
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl animate-float-gentle" style={{ background: 'linear-gradient(135deg, #059669, #059669)', boxShadow: '0 8px 32px rgba(15,23,42,0.12)' }}>
                <CheckCircle2 size={28} className="text-white" />
              </div>
              <h2 className="mt-5 text-xl font-[900] tracking-tight" style={{ color: 'var(--color-slate-heading)' }}>Kata Sandi Berhasil Diubah</h2>
              <p className="mt-2 text-sm" style={{ color: 'var(--color-slate-body)' }}>
                Silakan masuk dengan kata sandi baru Anda.
              </p>
              <Link to="/login" className="mt-6 inline-flex items-center justify-center gap-2 btn-primary w-full !py-3">
                Masuk Sekarang
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold mb-4" style={{ background: 'rgba(37,99,235,0.14)', color: 'var(--color-accent-blue)', border: '1px solid rgba(96,165,250,0.28)' }}>
                  <Lock size={12} /> Buat Kata Sandi Baru
                </div>
                <h2 className="text-2xl font-[900] tracking-tight" style={{ color: 'var(--color-slate-heading)' }}>Atur Ulang Kata Sandi</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--color-slate-body)' }}>
                  Buat kata sandi baru untuk akun Anda.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="animate-slide-up">
                  <label className="label">Kata Sandi Baru</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} className="input-field pr-10" placeholder="Minimal 8 karakter" />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 transition" style={{ color: 'var(--color-slate-body)' }}>
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: passOk ? 'var(--color-accent-emerald)' : 'var(--color-slate-muted)' }}>
                    {['Min. 8 karakter', 'Huruf besar', 'Huruf kecil', 'Angka'].map((r) => (
                      <span key={r} className="inline-flex items-center gap-1">
                        {passOk ? <CheckCircle2 size={11} /> : <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-slate-muted)' }} />} {r}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="animate-slide-up delay-100">
                  <label className="label">Konfirmasi Kata Sandi</label>
                  <input type={showPw ? 'text' : 'password'} required value={confirm} onChange={e => setConfirm(e.target.value)} className="input-field" placeholder="Ulangi kata sandi baru" />
                </div>
                <button type="submit" disabled={loading || !passOk || !token} className="btn-primary w-full !py-3 animate-slide-up delay-200">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Menyimpan...
                    </span>
                  ) : (
                    <>Simpan Kata Sandi</>
                  )}
                </button>
              </form>

              {!token && (
                <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs" style={{ color: 'var(--color-accent-red)' }}>
                  <ShieldCheck size={13} /> Link reset tidak valid — minta link baru via "Lupa Kata Sandi".
                </p>
              )}

              <p className="mt-6 text-center text-sm" style={{ color: 'var(--color-slate-body)' }}>
                Sudah ingat?{' '}
                <Link to="/login" className="font-semibold transition hover:opacity-80" style={{ color: 'var(--color-brand-soft)' }}>Masuk</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
