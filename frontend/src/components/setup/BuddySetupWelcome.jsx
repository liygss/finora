import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { useAuth } from '../../context/AuthContext'
import { BUDDY_HINT_STORAGE_PREFIX } from '../../data/tourSteps'
import { Sparkles, ArrowRight } from 'lucide-react'

const SETUP_WELCOME_KEY = 'setup_welcome'

const STAGGER_CHILDREN = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } },
}

const popUp = {
  hidden: { opacity: 0, y: 24, scale: 0.9 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 22 } },
}

export default function BuddySetupWelcome({ onDismiss }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!user?.id) { setOpen(false); return }
    try {
      if (localStorage.getItem(BUDDY_HINT_STORAGE_PREFIX + user.id + '_' + SETUP_WELCOME_KEY) === 'true') {
        onDismiss?.()
        return
      }
    } catch {}
    const t = setTimeout(() => setOpen(true), 300)
    return () => clearTimeout(t)
  }, [user?.id, onDismiss])

  const handleStart = () => {
    try {
      if (user?.id) localStorage.setItem(BUDDY_HINT_STORAGE_PREFIX + user.id + '_' + SETUP_WELCOME_KEY, 'true')
    } catch {}
    setOpen(false)
    setTimeout(() => onDismiss?.(), 150)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[73] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Selamat datang di setup Finora">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0"
        style={{ background: 'rgba(2, 6, 18, 0.7)', backdropFilter: 'blur(12px)' }}
        onClick={handleStart}
      />

      {/* Floating particles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 100 }}
            animate={{
              opacity: [0, 0.4, 0],
              y: [-20, -200],
              x: [0, (i % 2 === 0 ? 1 : -1) * (30 + i * 15)],
            }}
            transition={{
              duration: 3 + i * 0.5,
              repeat: Infinity,
              delay: i * 0.6,
              ease: 'easeOut',
            }}
            className="absolute rounded-full"
            style={{
              width: 4 + i * 2,
              height: 4 + i * 2,
              left: `${15 + i * 14}%`,
              bottom: '20%',
              background: `rgba(37, 99, 235, ${0.3 + i * 0.05})`,
              boxShadow: `0 0 ${8 + i * 4}px rgba(37, 99, 235, 0.4)`,
            }}
          />
        ))}
      </div>

      <motion.div
        variants={STAGGER_CHILDREN}
        initial="hidden"
        animate="visible"
        className="relative w-full max-w-md"
      >
        <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(15,23,42,0.12), 0 0 120px rgba(15,23,42,0.12)' }}>

          {/* Buddy image area with ambient glow */}
          <div className="relative flex items-center justify-center pt-10 pb-6 overflow-hidden" style={{ background: 'linear-gradient(180deg, rgba(37,99,235,0.15) 0%, rgba(37,99,235,0.04) 60%, transparent 100%)' }}>
            {/* Background glow orbs */}
            <div className="absolute inset-0 pointer-events-none">
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.25, 0.15] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute top-0 right-4 h-40 w-40 rounded-full blur-3xl"
                style={{ background: 'rgba(37,99,235,0.25)' }}
              />
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.2, 0.1] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="absolute bottom-0 left-4 h-32 w-32 rounded-full blur-3xl"
                style={{ background: 'rgba(124,58,237,0.2)' }}
              />
            </div>

            {/* Buddy character */}
            <motion.div
              variants={popUp}
              className="relative z-10"
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <div className="relative">
                  <img src="/assets/buddy/buddy-happy.png" alt="Buddy" className="h-44 w-44 object-contain drop-shadow-2xl" />
                  {/* Sparkle accents */}
                  <motion.div
                    animate={{ rotate: 360, scale: [0.8, 1.2, 0.8] }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                    className="absolute -top-2 -right-2"
                  >
                    <Sparkles size={20} style={{ color: 'var(--color-accent-amber)' }} />
                  </motion.div>
                  <motion.div
                    animate={{ rotate: -360, scale: [1, 0.7, 1] }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                    className="absolute -bottom-1 -left-3"
                  >
                    <Sparkles size={14} style={{ color: 'var(--color-accent-blue)' }} />
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* Content */}
          <div className="px-7 pb-8">
            {/* Speech bubble */}
            <motion.div variants={popUp} className="rounded-2xl p-5 mb-5 relative" style={{ background: 'var(--color-surface-faint)', border: '1px solid var(--color-border-subtle)' }}>
              <div className="absolute -top-2 left-12 w-4 h-4 rotate-45" style={{ background: 'var(--color-surface-faint)', borderLeft: '1px solid var(--color-border-subtle)', borderTop: '1px solid var(--color-border-subtle)' }} />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <motion.div
                    animate={{ rotate: [0, 15, -15, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Sparkles size={14} style={{ color: 'var(--color-accent-blue)' }} />
                  </motion.div>
                  <span className="text-sm font-bold" style={{ color: 'var(--color-accent-blue)' }}>Siap lanjut?</span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-slate-body)' }}>
                  Aku bantu isi data usahamu dulu. Nggak perlu bingung — ada <strong style={{ color: 'var(--color-accent-blue)' }}>petunjuk interaktif</strong> yang akan muncul di setiap langkah!
                </p>
              </div>
            </motion.div>

            {/* Features preview */}
            <motion.div variants={popUp} className="grid grid-cols-3 gap-2 mb-6">
              {[
                { emoji: '🏢', label: 'Data Usaha' },
                { emoji: '💬', label: 'Input Chat' },
                { emoji: '📁', label: 'Upload' },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.1 }}
                  className="flex flex-col items-center gap-1.5 rounded-xl py-3"
                  style={{ background: 'var(--color-surface-faint)', border: '1px solid var(--color-border-subtle)' }}
                >
                  <span className="text-xl">{item.emoji}</span>
                  <span className="text-[10px] font-semibold" style={{ color: 'var(--color-slate-muted)' }}>{item.label}</span>
                </motion.div>
              ))}
            </motion.div>

            {/* CTA Button */}
            <motion.div variants={popUp}>
              <motion.button
                onClick={handleStart}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 text-sm font-bold text-white transition-all duration-200"
                style={{ background: 'linear-gradient(135deg, #1D4ED8, #2563EB)', boxShadow: '0 6px 24px rgba(15,23,42,0.12), inset 0 1px 1px rgba(255,255,255,0.2)' }}
              >
                <span>Mulai Isi Data</span>
                <motion.span
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                >
                  <ArrowRight size={16} />
                </motion.span>
              </motion.button>
              <button
                onClick={handleStart}
                className="w-full mt-2 rounded-xl px-4 py-2 text-xs font-medium transition-all duration-200"
                style={{ color: 'var(--color-slate-muted)' }}
              >
                Lewati
              </button>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
