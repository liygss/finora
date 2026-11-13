import { Play, Sparkles, LayoutDashboard, MessageSquare, FileText, BarChart3, X } from 'lucide-react'

export default function DemoWelcomeModal({ onClose, onLaunch }) {
  const perks = [
    { icon: LayoutDashboard, label: 'Dashboard', color: '#2563EB' },
    { icon: MessageSquare, label: 'Chatbot', color: '#059669' },
    { icon: FileText, label: 'Jurnal', color: '#D97706' },
    { icon: BarChart3, label: 'Laporan', color: '#7C3AED' },
  ]

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose} style={{ background: 'rgba(2, 6, 18, 0.7)', backdropFilter: 'blur(10px)' }}>
      <div className="relative w-full max-w-lg card overflow-hidden animate-bounce-in" onClick={(e) => e.stopPropagation()}>
        <div className="pointer-events-none absolute inset-0">
        </div>

        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 rounded-xl transition-all duration-300 hover:bg-white/10" style={{ color: 'var(--color-slate-body)' }} aria-label="Tutup">
          <X size={18} />
        </button>

        <div className="relative p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl animate-float-gentle" style={{ background: 'linear-gradient(135deg, #1D4ED8, #2563EB)', boxShadow: '0 8px 32px rgba(15,23,42,0.12)', animationDelay: '0.3s' }}>
            <Sparkles size={28} className="text-white" />
          </div>

          <h2 className="mt-5 text-2xl font-black animate-slide-up" style={{ color: 'var(--color-slate-heading)', letterSpacing: '-0.02em' }}>
            Selamat Datang!
          </h2>
          <p className="mt-2 text-sm leading-relaxed animate-slide-up delay-100" style={{ color: 'var(--color-slate-body)' }}>
            Akun Anda sudah siap. Tonton demo singkat untuk melihat cara
            kerja Finora — dari dashboard hingga laporan keuangan.
          </p>

          <div className="mt-6 grid grid-cols-4 gap-3 animate-slide-up delay-200">
            {perks.map((p, i) => (
              <div key={p.label} className="rounded-2xl px-2 py-3.5 transition-all duration-300 hover:-translate-y-1" style={{ background: 'var(--color-surface-faint)', border: '1px solid rgba(148,163,184,0.14)', animationDelay: `${i * 60}ms` }}>
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl animate-fade-in" style={{ background: `${p.color}1f`, border: `1px solid ${p.color}45`, animationDelay: `${300 + i * 150}ms` }}>
                  <p.icon size={16} style={{ color: p.color }} />
                </div>
                <div className="mt-2 text-[10px] font-bold" style={{ color: 'var(--color-slate-text)' }}>{p.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-7 flex flex-col sm:flex-row gap-3 animate-slide-up delay-300">
            <button onClick={onLaunch} className="group btn-primary flex-1 !py-3.5">
              <Play size={16} className="transition-transform duration-300 group-hover:scale-125" />
              Lihat Demo
            </button>
            <button onClick={onClose} className="btn-ghost flex-1 !py-3.5">
              Langsung Mulai
            </button>
          </div>
          <p className="mt-4 text-[11px] animate-fade-in" style={{ color: 'var(--color-slate-muted)', animationDelay: '600ms' }}>
            Demo hanya ~45 detik • Bisa diulang kapan saja dari sidebar
          </p>
        </div>
      </div>
    </div>
  )
}
