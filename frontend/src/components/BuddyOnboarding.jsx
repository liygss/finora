import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronRight, X, Sparkles } from 'lucide-react'

const STEPS = [
  {
    emotion: '/assets/buddy/buddy-happy.png',
    title: 'Hai, kenalkan!',
    text: 'Aku Buddy, asisten pribadimu di Finora! Senang bisa ketemu kamu. Aku bakal bantu kenalan sama aplikasi ini biar kamu makin nyaman.',
  },
  {
    emotion: '/assets/buddy/buddy-thinking.png',
    title: 'Tenang aja...',
    text: 'Finora dirancang khusus untuk UMKM Indonesia. Nggak perlu jago akuntansi — aku dan AI di dalamnya siap bantu catat transaksi, hitung pajak, sampai bikin laporan.',
  },
  {
    emotion: '/assets/buddy/buddy-shock.png',
    title: 'Wah, banyak fiturnya!',
    text: 'Dashboard keuangan real-time, jurnal otomatis, laporan neraca & laba/rugi, kalkulator PPh & PPN, SPT Tahunan, bahkan upload transaksi dari Excel. Semua ada!',
  },
  {
    emotion: '/assets/buddy/buddy-happy.png',
    title: 'Aku di sini buat kamu',
    text: 'Kalau bingung, tanya aja aku lewat panel "Ask Finora" di sisi kanan. Aku online 24/7 — siap jawab pertanyaan seputar akuntansi & pajak kapan saja.',
  },
  {
    emotion: '/assets/buddy/buddy-happy.png',
    title: 'Siap menjelajah?',
    text: 'Mau lihat gambaran cepatnya? Aku kasih demo singkat ~40 detik biar kamu langsung paham fitur-fiturnya. Atau langsung mulai aja!',
  },
]

const TYPE_SPEED = 22

export default function BuddyOnboarding({ open, onStartDemo, onContinue, onSkip }) {
  const [step, setStep] = useState(0)
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [emotionKey, setEmotionKey] = useState(0)
  const [showCta, setShowCta] = useState(false)

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  useEffect(() => {
    if (!open) {
      setStep(0)
      setDisplayedText('')
      setIsTyping(false)
      setEmotionKey(0)
      setShowCta(false)
    }
  }, [open])

  useEffect(() => {
    if (!open || !current) return
    setIsTyping(true)
    setDisplayedText('')
    setEmotionKey((k) => k + 1)
    setShowCta(false)
    let i = 0
    const text = current.text
    const id = setInterval(() => {
      i++
      setDisplayedText(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(id)
        setIsTyping(false)
      }
    }, TYPE_SPEED)
    return () => clearInterval(id)
  }, [open, step, current])

  const advance = useCallback(() => {
    if (isTyping) return
    if (isLast) {
      setShowCta(true)
    } else {
      setStep((s) => s + 1)
    }
  }, [isTyping, isLast])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (!showCta) advance()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, advance, showCta])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Selamat datang dari Buddy">
      <div className="absolute inset-0" style={{ background: 'rgba(2, 6, 18, 0.82)', backdropFilter: 'blur(12px)' }} onClick={onSkip} />

      <div className="relative w-full max-w-lg">
        <button onClick={onSkip} className="absolute -top-3 -right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300 hover:scale-110" style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-soft)', color: 'var(--color-slate-muted)' }} aria-label="Tutup">
          <X size={16} />
        </button>

        <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-soft)', boxShadow: '0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(15,23,42,0.12)' }}>
          {/* Buddy image area */}
          <div className="relative flex items-center justify-center pt-8 pb-4" style={{ background: 'linear-gradient(180deg, rgba(37,99,235,0.12) 0%, transparent 100%)' }}>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-2 right-6 h-32 w-32 rounded-full blur-3xl" style={{ background: 'rgba(37,99,235,0.18)' }} />
              <div className="absolute bottom-0 left-8 h-24 w-24 rounded-full blur-2xl" style={{ background: 'rgba(124,58,237,0.12)' }} />
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={emotionKey}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 18 }}
                className={`relative z-10 ${isTyping ? 'animate-buddy-talk' : ''}`}
              >
                <img src={current.emotion} alt="Buddy" className="h-40 w-40 object-contain drop-shadow-2xl" />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Content */}
          <div className="px-7 pb-7">
            {/* Speech bubble */}
            <div className="rounded-2xl p-5 mb-5 relative" style={{ background: 'var(--color-surface-faint)', border: '1px solid var(--color-border-subtle)' }}>
              <div className="absolute -top-2 left-10 w-4 h-4 rotate-45" style={{ background: 'var(--color-surface-faint)', borderLeft: '1px solid var(--color-border-subtle)', borderTop: '1px solid var(--color-border-subtle)' }} />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} style={{ color: 'var(--color-accent-blue)' }} />
                  <span className="text-xs font-bold" style={{ color: 'var(--color-accent-blue)' }}>{current.title}</span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-slate-body)' }}>
                  {displayedText}
                  {isTyping && <span className="animate-typing-cursor" style={{ color: 'var(--color-accent-blue)' }}>|</span>}
                </p>
              </div>
            </div>

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-2 mb-5">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === step ? 20 : 8,
                    height: 8,
                    background: i === step ? 'linear-gradient(135deg, #1D4ED8, #2563EB)' : i < step ? 'var(--color-accent-blue)' : 'var(--color-border-soft)',
                    opacity: i > step && !isLast ? 0.4 : 1,
                  }}
                />
              ))}
            </div>

            {/* Buttons */}
            {!showCta ? (
              <div className="flex items-center justify-between gap-3">
                <button onClick={onSkip} className="rounded-xl px-4 py-2.5 text-xs font-medium transition-all duration-300 hover:bg-[var(--color-hover)]" style={{ color: 'var(--color-slate-muted)' }}>
                  Lewati
                </button>
                <button
                  onClick={advance}
                  disabled={isTyping}
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white transition-all duration-300 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #1D4ED8, #2563EB)', boxShadow: '0 4px 14px rgba(15,23,42,0.12)' }}
                >
                  <span>{isLast ? 'Lihat Pilihan' : 'Selanjutnya'}</span> <ChevronRight size={14} />
                </button>
              </div>
            ) : (
              <div className="animate-slide-up space-y-2.5">
                <button
                  onClick={onStartDemo}
                  className="w-full flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition-all duration-300 hover:scale-[1.01]"
                  style={{ background: 'linear-gradient(135deg, #1D4ED8, #2563EB)', boxShadow: '0 4px 14px rgba(15,23,42,0.12)' }}
                >
                  <span>▶</span>
                  <span>Lihat Demo Singkat (~40 detik)</span>
                </button>
                <button
                  onClick={onContinue}
                  className="w-full flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all duration-300 hover:bg-[var(--color-hover)]"
                  style={{ background: 'var(--color-surface-faint)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-slate-body)' }}
                >
                  <span>Mulai Langsung</span>
                  <ChevronRight size={14} />
                </button>
                <button onClick={onSkip} className="w-full rounded-xl px-4 py-2 text-xs font-medium transition-all duration-300 hover:bg-[var(--color-hover)]" style={{ color: 'var(--color-slate-muted)' }}>
                  Lewati Semua
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
