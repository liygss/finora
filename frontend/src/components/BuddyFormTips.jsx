import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronRight, ChevronLeft, Check, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { BUDDY_HINT_STORAGE_PREFIX } from '../data/tourSteps'

const GAP = 14
const TOOLTIP_WIDTH = 300
const AUTO_ADVANCE_MS = 7000

function trySelect(selector) {
  try { return document.querySelector(selector) } catch { return null }
}

export default function BuddyFormTips({ hints, open, onDone, step }) {
  const { user } = useAuth()
  const [tipIndex, setTipIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const [tipBox, setTipBox] = useState({ w: TOOLTIP_WIDTH, h: 120 })
  const [show, setShow] = useState(false)
  const tipRef = useRef(null)
  const measuringRef = useRef(false)
  const timerRef = useRef(null)

  const tip = hints?.[Math.min(tipIndex, (hints?.length || 1) - 1)]
  const isLast = tipIndex === (hints?.length || 1) - 1

  const resolveTarget = useCallback(() => {
    if (!tip) { setRect(null); return }
    const el = trySelect(tip.target)
    if (!el) { setRect(null); return }
    const r = el.getBoundingClientRect()
    setRect({ left: r.left, top: r.top, width: r.width, height: r.height })
  }, [tip])

  useEffect(() => {
    if (!open) { setTipIndex(0); setShow(false); return }
    try {
      if (localStorage.getItem(BUDDY_HINT_STORAGE_PREFIX + user?.id + '_' + step) === 'true') {
        setShow(false)
        return
      }
    } catch {}
    const t = setTimeout(() => setShow(true), 400)
    return () => clearTimeout(t)
  }, [open, user?.id, step])

  useEffect(() => {
    if (!show) return
    setTipIndex(0)
  }, [show])

  useEffect(() => {
    if (!show) return
    resolveTarget()
  }, [show, tipIndex, resolveTarget])

  useEffect(() => {
    if (!show) return
    const onScroll = () => resolveTarget()
    const onResize = () => resolveTarget()
    const t = setTimeout(resolveTarget, 150)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(t)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [show, resolveTarget])

  useEffect(() => {
    if (tipRef.current && !measuringRef.current) {
      measuringRef.current = true
      requestAnimationFrame(() => {
        if (tipRef.current) {
          const { width, height } = tipRef.current.getBoundingClientRect()
          setTipBox({ w: width, h: height })
        }
        measuringRef.current = false
      })
    }
  }, [tipIndex, show])

  const finish = useCallback(() => {
    try {
      if (user?.id) localStorage.setItem(BUDDY_HINT_STORAGE_PREFIX + user.id + '_' + step, 'true')
    } catch {}
    setShow(false)
    onDone?.()
  }, [user?.id, step, onDone])

  useEffect(() => {
    if (!show || !rect) { clearTimeout(timerRef.current); return }
    timerRef.current = setTimeout(() => {
      if (isLast) finish()
      else setTipIndex(i => i + 1)
    }, AUTO_ADVANCE_MS)
    return () => clearTimeout(timerRef.current)
  }, [show, tipIndex, rect, isLast, finish])

  const next = () => {
    clearTimeout(timerRef.current)
    if (isLast) finish()
    else setTipIndex(i => i + 1)
  }

  const prev = () => {
    clearTimeout(timerRef.current)
    setTipIndex(i => Math.max(0, i - 1))
  }

  if (!show || !tip) return null

  const computeTipPos = () => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const { w, h } = tipBox
    if (!rect) {
      return {
        left: Math.max(GAP, Math.round(vw / 2 - w / 2)),
        top: Math.max(GAP, Math.round(vh / 2 - h / 2 - 24)),
        arrow: null,
        maxWidth: Math.min(w, vw - GAP * 2),
      }
    }
    const placement = tip.placement || 'right'
    let pos = null
    if (placement === 'right' && rect.left + rect.width + GAP + w <= vw - GAP) {
      pos = { left: rect.left + rect.width + GAP, top: rect.top + rect.height / 2 - h / 2, arrow: 'left' }
    } else if (placement === 'left' && rect.left - GAP - w >= GAP) {
      pos = { left: rect.left - GAP - w, top: rect.top + rect.height / 2 - h / 2, arrow: 'right' }
    } else if (placement === 'bottom' && rect.top + rect.height + GAP + h <= vh - GAP) {
      pos = { left: Math.min(Math.max(GAP, rect.left + rect.width / 2 - w / 2), vw - w - GAP), top: rect.top + rect.height + GAP, arrow: 'top' }
    } else if (placement === 'top' && rect.top - GAP - h >= GAP) {
      pos = { left: Math.min(Math.max(GAP, rect.left + rect.width / 2 - w / 2), vw - w - GAP), top: rect.top - GAP - h, arrow: 'bottom' }
    } else {
      const side = rect.left + rect.width + GAP + w <= vw - GAP ? 'right' : 'bottom'
      pos = side === 'right'
        ? { left: rect.left + rect.width + GAP, top: Math.max(GAP, rect.top + rect.height / 2 - h / 2), arrow: 'left' }
        : { left: Math.min(Math.max(GAP, rect.left + rect.width / 2 - w / 2), vw - w - GAP), top: rect.top + rect.height + GAP, arrow: 'top' }
    }
    pos.left = Math.max(GAP, Math.min(pos.left, vw - w - GAP))
    pos.top = Math.max(GAP, Math.min(pos.top, vh - h - GAP))
    return { ...pos, maxWidth: Math.min(w, vw - GAP * 2) }
  }

  const tipPos = computeTipPos()

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[72]" aria-modal="true">
          {/* Highlight ring with smooth entrance */}
          <AnimatePresence mode="wait">
            {rect && (
              <motion.div
                key={`ring-${tipIndex}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                style={{
                  position: 'fixed',
                  left: rect.left - 6,
                  top: rect.top - 6,
                  width: rect.width + 12,
                  height: rect.height + 12,
                  borderRadius: 18,
                  border: '2px solid rgba(96, 165, 250, 0.8)',
                  boxShadow: '0 0 0 6px rgba(15,23,42,0.12), 0 0 30px rgba(15,23,42,0.12)',
                  zIndex: 1,
                  pointerEvents: 'none',
                }}
              />
            )}
          </AnimatePresence>

          {/* Pulsing glow behind highlight */}
          {rect && (
            <motion.div
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                position: 'fixed',
                left: rect.left - 16,
                top: rect.top - 16,
                width: rect.width + 32,
                height: rect.height + 32,
                borderRadius: 24,
                background: 'rgba(37, 99, 235, 0.08)',
                filter: 'blur(16px)',
                zIndex: 0,
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Tooltip */}
          <motion.div
            key={`tip-${tipIndex}`}
            ref={tipRef}
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            className="fixed rounded-2xl p-4"
            style={{
              left: tipPos.left,
              top: tipPos.top,
              maxWidth: tipPos.maxWidth,
              width: TOOLTIP_WIDTH,
              zIndex: 3,
              background: 'var(--color-tooltip-bg)',
              border: '1px solid var(--color-tooltip-border)',
              boxShadow: '0 20px 56px var(--color-shadow), 0 0 0 1px rgba(15,23,42,0.12)',
            }}
          >
            {/* Arrow */}
            {tipPos.arrow === 'left' && (
              <motion.div
                initial={{ opacity: 0, x: 4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                style={{ position: 'absolute', left: -6, top: '50%', width: 12, height: 12, background: 'var(--color-tooltip-bg)', borderLeft: '1px solid var(--color-tooltip-border)', borderBottom: '1px solid var(--color-tooltip-border)', transform: 'translateY(-50%) rotate(45deg)' }}
              />
            )}
            {tipPos.arrow === 'right' && (
              <motion.div
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                style={{ position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%) rotate(45deg)', width: 12, height: 12, background: 'var(--color-tooltip-bg)', borderRight: '1px solid var(--color-tooltip-border)', borderTop: '1px solid var(--color-tooltip-border)' }}
              />
            )}
            {tipPos.arrow === 'top' && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                style={{ position: 'absolute', top: -6, left: rect ? rect.left + rect.width / 2 - 6 : '50%', width: 12, height: 12, background: 'var(--color-tooltip-bg)', borderTop: '1px solid var(--color-tooltip-border)', borderLeft: '1px solid var(--color-tooltip-border)', transform: 'rotate(45deg)' }}
              />
            )}
            {tipPos.arrow === 'bottom' && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                style={{ position: 'absolute', bottom: -6, left: rect ? rect.left + rect.width / 2 - 6 : '50%', width: 12, height: 12, background: 'var(--color-tooltip-bg)', borderRight: '1px solid var(--color-tooltip-border)', borderBottom: '1px solid var(--color-tooltip-border)', transform: 'rotate(45deg)' }}
              />
            )}

            <div className="flex items-start gap-2.5">
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.15 }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg overflow-hidden"
                style={{ background: 'rgba(37, 99, 235, 0.15)' }}
              >
                <img src={`/assets/buddy/${tip.emotion || 'buddy-happy'}.png`} alt="Buddy" className="h-full w-full object-contain" />
              </motion.div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-[13px] leading-relaxed flex-1"
                style={{ color: 'var(--color-slate-body)' }}
              >
                {tip.text}
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mt-3 flex items-center justify-between gap-3"
            >
              {/* Progress dots */}
              <div className="flex items-center gap-1.5">
                {hints.map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ width: i === tipIndex ? 16 : 6 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className="h-1.5 rounded-full"
                    style={{ background: i === tipIndex ? 'var(--color-brand-soft)' : i < tipIndex ? 'rgba(37, 99, 235, 0.4)' : 'var(--color-border-subtle)' }}
                  />
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                {tipIndex > 0 && (
                  <button
                    onClick={prev}
                    className="rounded-lg px-2 py-1 text-[11px] font-medium transition-all duration-200 hover:bg-[var(--color-hover)]"
                    style={{ color: 'var(--color-slate-body)' }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                )}
                <button
                  onClick={finish}
                  className="rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all duration-200 hover:bg-[var(--color-hover)]"
                  style={{ color: 'var(--color-slate-body)' }}
                >
                  Lewati
                </button>
                <motion.button
                  onClick={next}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1 text-[11px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #1D4ED8, #2563EB)', boxShadow: '0 4px 12px rgba(15,23,42,0.12)' }}
                >
                  {isLast ? 'Selesai' : 'Berikutnya'} {isLast ? <Check size={12} /> : <ChevronRight size={12} />}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export function BuddyHintChip({ step, onOpen }) {
  const { user } = useAuth()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!user?.id) { setVisible(false); return }
    try {
      if (localStorage.getItem(BUDDY_HINT_STORAGE_PREFIX + user.id + '_' + step) === 'true') {
        setVisible(true)
        return
      }
    } catch {}
  }, [user?.id, step])

  if (!visible) return null

  return (
    <motion.button
      onClick={onOpen}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      className="fixed bottom-6 right-6 z-[60] flex h-12 w-12 items-center justify-center rounded-full"
      style={{ background: 'linear-gradient(135deg, #1D4ED8, #2563EB)', boxShadow: '0 6px 24px rgba(15,23,42,0.12)' }}
      aria-label="Tampilkan petunjuk Buddy"
    >
      <Sparkles size={18} className="text-white" />
    </motion.button>
  )
}
