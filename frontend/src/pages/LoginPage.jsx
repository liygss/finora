import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { extractError } from '../api/extractError'
import { Eye, EyeOff, ArrowRight, ArrowLeft, Sparkles, Shield, Zap, CheckCircle2 } from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Berhasil login!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(extractError(err, 'Login gagal'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden" style={{ background: 'var(--color-surface-0)' }}>
      {/* Aurora background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(148,163,184,0.05) 1px, transparent 0)', backgroundSize: '36px 36px' }} />
      </div>

      <div className="relative flex w-full min-h-screen">
        {/* Left decorative panel - Blue gradient */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0B1E50 0%, #1D4ED8 50%, #2563EB 100%)' }}>
          {/* Aurora blobs */}
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '28px 28px' }} />

          {/* Floating icons */}
          <div className="absolute top-32 right-20 animate-float">
            <div className="rounded-2xl p-3" style={{ background: 'rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
              <Sparkles size={20} style={{ color: 'rgba(255, 255, 255, 0.8)' }} />
            </div>
          </div>
          <div className="absolute bottom-40 left-20 animate-float-reverse">
            <div className="rounded-2xl p-3" style={{ background: 'rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
              <Shield size={20} style={{ color: 'rgba(255, 255, 255, 0.8)' }} />
            </div>
          </div>
          <div className="absolute top-1/2 right-32 animate-float delay-500">
            <div className="rounded-2xl p-3" style={{ background: 'rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
              <Zap size={20} style={{ color: 'rgba(255, 255, 255, 0.8)' }} />
            </div>
          </div>

          <div className="relative z-10 flex flex-col justify-center px-16 text-white">
            <div className="flex items-center gap-3 mb-10">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl" style={{ background: 'rgba(255, 255, 255, 0.2)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)' }}>
                <img src="/finora_logo.jpeg" alt="Finora" className="h-full w-full object-cover" />
              </div>
              <div className="leading-tight">
                <div className="text-xl font-[900] tracking-tight">Finora</div>
                <div className="text-[10px] font-medium tracking-widest uppercase opacity-60">Smart Accounting</div>
              </div>
            </div>

            <h1 className="text-4xl font-[900] leading-tight mb-6 animate-slide-in-left" style={{ letterSpacing: '-0.02em' }}>
              Pembukuan Finora<br />
              <span className="gradient-text">Lebih Cerdas</span><br />
              dengan AI
            </h1>
            <p className="text-lg max-w-md leading-relaxed animate-slide-in-left delay-100" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              Catat transaksi, tanya pajak, dan dapatkan laporan keuangan — semuanya dalam satu platform.
            </p>

            <div className="mt-12 space-y-4 animate-slide-in-left delay-200">
              {[
                { icon: Sparkles, text: 'AI Chatbot Akuntansi' },
                { icon: Shield, text: 'Standar SAK EMKM' },
                { icon: Zap, text: 'Proses Instan & Akurat' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-sm" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
                    <item.icon size={14} className="text-white" />
                  </div>
                  {item.text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right form panel - Dark glass card */}
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <div className="flex items-center justify-between mb-6 animate-fade-in">
              <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium transition hover:opacity-80" style={{ color: 'var(--color-slate-body)' }}>
                <ArrowLeft size={16} /> Kembali ke Beranda
              </Link>
              <ThemeToggle compact />
            </div>
            <div className="lg:hidden flex items-center gap-3 mb-8">
              <div
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl"
                style={{ boxShadow: '0 4px 16px rgba(15,23,42,0.12)' }}
              >
                <img src="/finora_logo.jpeg" alt="Finora" className="h-full w-full object-cover" />
              </div>
              <span className="text-lg font-bold" style={{ color: 'var(--color-slate-heading)' }}>Finora</span>
            </div>

            <div
              className="rounded-3xl p-8 animate-fade-in"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-soft)', backdropFilter: 'blur(24px)', boxShadow: '0 24px 80px rgba(0, 0, 0, 0.2)' }}
            >
              <div className="mb-8">
                <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold mb-4" style={{ background: 'rgba(37,99,235,0.14)', color: 'var(--color-accent-blue)', border: '1px solid rgba(96,165,250,0.28)' }}>
                  <CheckCircle2 size={12} /> Selamat Datang Kembali
                </div>
                <h2 className="text-2xl font-[900] tracking-tight" style={{ color: 'var(--color-slate-heading)' }}>Masuk ke Akun</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--color-slate-body)' }}>Lanjutkan mengelola keuangan UMKM Anda</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="animate-slide-up">
                  <label className="label">Email</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="input-field" placeholder="email@contoh.com" />
                </div>
                <div className="animate-slide-up delay-100">
                  <label className="label">Password</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} className="input-field pr-10" placeholder="Masukkan password" />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 transition" style={{ color: 'var(--color-slate-body)' }}>
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end -mt-2 animate-slide-up delay-150">
                  <Link to="/forgot-password" className="text-xs font-medium transition hover:opacity-80" style={{ color: 'var(--color-brand-soft)' }}>
                    Lupa password?
                  </Link>
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full !py-3 animate-slide-up delay-200">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Masuk...
                    </span>
                  ) : (
                    <>Masuk <ArrowRight size={16} /></>
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-sm animate-slide-up delay-300" style={{ color: 'var(--color-slate-body)' }}>
                Belum punya akun?{' '}
                <Link to="/register" className="font-semibold transition hover:opacity-80" style={{ color: 'var(--color-brand-soft)' }}>Daftar Gratis</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
