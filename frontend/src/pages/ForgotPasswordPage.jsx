import { useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import toast from 'react-hot-toast'
import { extractError } from '../api/extractError'
import { ArrowLeft, ArrowRight, Mail, MailCheck, Landmark } from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await client.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err) {
      toast.error(extractError(err, 'Gagal mengirim link reset password'))
    } finally {
      setLoading(false)
    }
  }

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
          {sent ? (
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl animate-float-gentle" style={{ background: 'linear-gradient(135deg, #059669, #059669)', boxShadow: '0 8px 32px rgba(15,23,42,0.12)' }}>
                <MailCheck size={28} className="text-white" />
              </div>
              <h2 className="mt-5 text-xl font-[900] tracking-tight" style={{ color: 'var(--color-slate-heading)' }}>Cek Email Anda</h2>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--color-slate-body)' }}>
                Jika <span className="font-semibold" style={{ color: 'var(--color-slate-text)' }}>{email}</span> terdaftar,
                kami telah mengirimkan link untuk mereset kata sandi. Link berlaku selama 30 menit.
              </p>
              <Link to="/login" className="mt-6 inline-flex items-center justify-center gap-2 btn-primary w-full !py-3">
                Kembali ke Login <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold mb-4" style={{ background: 'rgba(37,99,235,0.14)', color: 'var(--color-accent-blue)', border: '1px solid rgba(96,165,250,0.28)' }}>
                  <Mail size={12} /> Lupa Kata Sandi
                </div>
                <h2 className="text-2xl font-[900] tracking-tight" style={{ color: 'var(--color-slate-heading)' }}>Reset Kata Sandi</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--color-slate-body)' }}>
                  Masukkan email Anda. Kami akan mengirim link untuk mereset kata sandi.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="animate-slide-up">
                  <label className="label">Email</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="input-field" placeholder="email@contoh.com" />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full !py-3 animate-slide-up delay-100">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Mengirim...
                    </span>
                  ) : (
                    <>Kirim Link Reset <ArrowRight size={16} /></>
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-sm" style={{ color: 'var(--color-slate-body)' }}>
                Sudah ingat?{' '}
                <Link to="/login" className="font-semibold transition hover:opacity-80" style={{ color: 'var(--color-brand-soft)' }}>Masuk</Link>
              </p>
            </>
          )}
        </div>

        <p className="mt-6 text-center flex items-center justify-center gap-1.5 text-xs" style={{ color: 'var(--color-slate-muted)' }}>
          <Landmark size={13} /> Finora
        </p>
      </div>
    </div>
  )
}
