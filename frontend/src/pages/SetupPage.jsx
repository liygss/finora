import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import SetupStepCompany from '../components/setup/SetupStepCompany'
import SetupStepChat from '../components/setup/SetupStepChat'
import SetupStepUpload from '../components/setup/SetupStepUpload'
import BuddySetupWelcome from '../components/setup/BuddySetupWelcome'
import BuddyFormTips from '../components/BuddyFormTips'
import { setupHints } from '../data/setupHints'


const STEPS = [
  { id: 1, label: 'Profil Usaha & COA', description: 'Atur data usaha dan pilih bagan akun' },
  { id: 2, label: 'Input Data via Chat', description: 'Catat transaksi dengan bantuan AI' },
  { id: 3, label: 'Upload Data', description: 'Upload file CSV/XLSX transaksi' },
]

export default function SetupPage() {
  const [step, setStep] = useState(1)
  const [welcomeDismissed, setWelcomeDismissed] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuth()

  const nextStep = useCallback(() => {
    setStep(prev => Math.min(prev + 1, 3))
  }, [])

  const prevStep = useCallback(() => {
    setStep(prev => Math.max(prev - 1, 1))
  }, [])

  const finishSetup = useCallback(async () => {
    try {
      await client.post('/setup/complete')
      localStorage.setItem('user', JSON.stringify({ ...user, setup_completed: true }))
      window.location.href = '/dashboard'
    } catch {
      navigate('/dashboard')
    }
  }, [user, navigate])

  const handleWelcomeDismiss = useCallback(() => {
    setWelcomeDismissed(true)
  }, [])

  if (step === 2) {
    return (
      <div className="app-bg h-screen overflow-hidden flex flex-col">
        <SetupStepChat onNext={nextStep} onBack={prevStep} />
        {welcomeDismissed && <BuddyFormTips hints={setupHints[2]} step={2} onDone={() => {}} />}
      </div>
    )
  }

  return (
    <div className="app-bg min-h-screen flex flex-col">
      <BuddySetupWelcome onDismiss={handleWelcomeDismiss} />
      {welcomeDismissed && <BuddyFormTips hints={setupHints[step]} step={step} onDone={() => {}} />}

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.14)' }}
      >
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.05, rotate: -2 }}
            whileTap={{ scale: 0.95 }}
            className="flex h-10 w-10 items-center justify-center overflow-hidden"
            style={{ borderRadius: '0.75rem', boxShadow: '0 4px 14px rgba(15,23,42,0.12)' }}
          >
            <img src="/finora_logo.jpeg" alt="Finora" className="h-full w-full object-cover" />
          </motion.div>
          <div>
            <span className="text-lg font-bold" style={{ color: 'var(--color-slate-heading)' }}>Finora</span>
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 20 }}
              className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(37, 99, 235, 0.12)', color: 'var(--color-accent-blue)' }}
            >
              Setup
            </motion.span>
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="text-xs font-medium px-3 py-1.5 rounded-full"
          style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-slate-muted)' }}
        >
          Langkah {step} dari 3
        </motion.div>
      </motion.header>

      {/* Stepper */}
      <div className="px-6 pt-6 pb-2 max-w-3xl mx-auto w-full">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 * i + 0.2 }}
              className="flex items-center flex-1"
            >
              <div className="flex items-center gap-2">
                <motion.div
                  animate={step === s.id ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300"
                  style={{
                    background: step >= s.id
                      ? 'linear-gradient(135deg, #1D4ED8, #2563EB)'
                      : 'var(--color-surface-card)',
                    color: step >= s.id ? '#fff' : 'var(--color-slate-muted)',
                    border: step >= s.id ? 'none' : '1px solid rgba(148, 163, 184, 0.2)',
                    boxShadow: step >= s.id ? '0 4px 12px rgba(37, 99, 235, 0.3)' : 'none',
                  }}
                >
                  {step > s.id ? '✓' : s.id}
                </motion.div>
                <div className="hidden sm:block">
                  <p className="text-xs font-semibold" style={{ color: step >= s.id ? 'var(--color-slate-heading)' : 'var(--color-slate-muted)' }}>{s.label}</p>
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.15 * i + 0.4, duration: 0.4 }}
                  className="flex-1 mx-3 h-0.5 rounded-full origin-left"
                  style={{ background: step > s.id ? 'var(--color-brand-soft)' : 'rgba(148, 163, 184, 0.15)' }}
                />
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="max-w-3xl mx-auto"
          >
            {step === 1 && <SetupStepCompany onNext={nextStep} />}
            {step === 3 && <SetupStepUpload onBack={prevStep} onFinish={finishSetup} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
