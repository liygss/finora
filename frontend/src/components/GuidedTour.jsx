import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { X, ChevronRight, Check, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { tourSteps, TOUR_STORAGE_PREFIX } from '../data/tourSteps'

const GAP = 14
const TOOLTIP_WIDTH = 320

function trySelect(selector) {
  try {
    return document.querySelector(selector)
  } catch {
    return null
  }
}

export default function GuidedTour({ open, onClose }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const [tipBox, setTipBox] = useState({ w: TOOLTIP_WIDTH, h: 120 })
  const tipRef = useRef(null)
  const measuringRef = useRef(false)

  const step = tourSteps[Math.min(stepIndex, tourSteps.length - 1)]
  const isLast = stepIndex === tourSteps.length - 1

  const resolveTarget = useCallback(() => {
    if (!step || step.infoOnly) {
      setRect(null)
      return
    }
    const el = trySelect(step.target)
    if (!el) {
      setRect(null)
      return
    }
    const r = el.getBoundingClientRect()
    setRect({
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
    })
  }, [step])

  useEffect(() => {
    if (!open) return
    setStepIndex(0)
  }, [open])

  useEffect(() => {
    if (!open) return
    resolveTarget()
  }, [open, stepIndex, location.pathname, resolveTarget])

  useEffect(() => {
    if (!open) return
    const onScroll = () => resolveTarget()
    const onResize = () => resolveTarget()
    const t = setTimeout(resolveTarget, 120)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(t)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open, resolveTarget])

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
  }, [stepIndex])

  if (!open || !step) return null

  const finish = () => {
    if (user?.id) {
      try {
        localStorage.setItem(TOUR_STORAGE_PREFIX + user.id, 'true')
      } catch {
        /* ignore */
      }
    }
    onClose()
  }

  const next = () => {
    if (step.navTo && location.pathname !== step.navTo) {
      navigate(step.navTo)
      requestAnimationFrame(() => requestAnimationFrame(resolveTarget))
    }
    if (isLast) {
      finish()
    } else {
      setStepIndex((i) => i + 1)
    }
  }

  const skipAll = () => finish()

  const computeTipPos = () => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const { w, h } = tipBox
    if (!rect || step.infoOnly) {
      return {
        left: Math.max(GAP, Math.round(vw / 2 - w / 2)),
        top: Math.max(GAP, Math.round(vh / 2 - h / 2 - 24)),
        arrow: null,
        maxWidth: Math.min(w, vw - GAP * 2),
      }
    }
    const placement = step.placement || 'right'
    let pos = null
    if (placement === 'right' && rect.left + rect.width + GAP + w <= vw - GAP) {
      pos = {
        left: rect.left + rect.width + GAP,
        top: rect.top + rect.height / 2 - h / 2,
        arrow: 'left',
      }
    } else if (placement === 'left' && rect.left - GAP - w >= GAP) {
      pos = {
        left: rect.left - GAP - w,
        top: rect.top + rect.height / 2 - h / 2,
        arrow: 'right',
      }
    } else if (placement === 'bottom' && rect.top + rect.height + GAP + h <= vh - GAP) {
      pos = {
        left: Math.min(Math.max(GAP, rect.left + rect.width / 2 - w / 2), vw - w - GAP),
        top: rect.top + rect.height + GAP,
        arrow: 'top',
      }
    } else if (placement === 'top' && rect.top - GAP - h >= GAP) {
      pos = {
        left: Math.min(Math.max(GAP, rect.left + rect.width / 2 - w / 2), vw - w - GAP),
        top: rect.top - GAP - h,
        arrow: 'bottom',
      }
    } else {
      // Fallback: place right if space, else below/above
      const side = rect.left + rect.width + GAP + w <= vw - GAP ? 'right' : 'bottom'
      pos =
        side === 'right'
          ? {
              left: rect.left + rect.width + GAP,
              top: Math.max(GAP, rect.top + rect.height / 2 - h / 2),
              arrow: 'left',
            }
          : {
              left: Math.min(Math.max(GAP, rect.left + rect.width / 2 - w / 2), vw - w - GAP),
              top: rect.top + rect.height + GAP,
              arrow: 'top',
            }
    }
    pos.left = Math.max(GAP, Math.min(pos.left, vw - w - GAP))
    pos.top = Math.max(GAP, Math.min(pos.top, vh - h - GAP))
    return { ...pos, maxWidth: Math.min(w, vw - GAP * 2) }
  }

  const tip = computeTipPos()

  return (
    <div className="fixed inset-0 z-[70]" aria-modal="true">
      {/* Dim scrim / spotlight hole */}
      {rect && (
        <div
          style={{
            position: 'fixed',
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            borderRadius: 14,
            boxShadow: '0 0 0 9999px rgba(2, 6, 18, 0.68)',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Highlight ring */}
      {rect && (
        <motion.div
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            left: rect.left - 4,
            top: rect.top - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            borderRadius: 18,
            border: '2px solid rgba(96, 165, 250, 0.9)',
            boxShadow: '0 0 0 4px rgba(15,23,42,0.12), 0 0 24px rgba(15,23,42,0.12)',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Tooltip */}
      <motion.div
        ref={tipRef}
        initial={{ opacity: 0, y: 8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="fixed rounded-2xl p-5"
        style={{
          left: tip.left,
          top: tip.top,
          maxWidth: tip.maxWidth,
          width: TOOLTIP_WIDTH,
          zIndex: 3,
          background: 'var(--color-tooltip-bg)',
          border: '1px solid var(--color-tooltip-border)',
          boxShadow: '0 24px 64px var(--color-shadow)',
        }}
      >
        {tip.arrow === 'left' && (
          <div style={{ position: 'absolute', left: -6, top: '50%', width: 12, height: 12, background: 'var(--color-tooltip-bg)', borderLeft: '1px solid var(--color-tooltip-border)', borderBottom: '1px solid var(--color-tooltip-border)', transform: 'translateY(-50%) rotate(45deg)' }} />
        )}
        {tip.arrow === 'right' && (
          <div style={{ position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%) rotate(45deg)', width: 12, height: 12, background: 'var(--color-tooltip-bg)', borderRight: '1px solid var(--color-tooltip-border)', borderTop: '1px solid var(--color-tooltip-border)' }} />
        )}
        {tip.arrow === 'top' && (
          <div style={{ position: 'absolute', top: -6, left: rect ? rect.left + rect.width / 2 - 6 : '50%', width: 12, height: 12, background: 'var(--color-tooltip-bg)', borderTop: '1px solid var(--color-tooltip-border)', borderLeft: '1px solid var(--color-tooltip-border)', transform: 'rotate(45deg)' }} />
        )}
        {tip.arrow === 'bottom' && (
          <div style={{ position: 'absolute', bottom: -6, left: rect ? rect.left + rect.width / 2 - 6 : '50%', width: 12, height: 12, background: 'var(--color-tooltip-bg)', borderRight: '1px solid var(--color-tooltip-border)', borderBottom: '1px solid var(--color-tooltip-border)', transform: 'rotate(45deg)' }} />
        )}

        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg overflow-hidden" style={{ background: 'rgba(37, 99, 235, 0.15)' }}>
            <img src="/assets/buddy/buddy-happy.png" alt="Buddy" className="h-full w-full object-contain" />
          </div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }}>{step.title}</h3>
          {step.adminOnly && (
            <span className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide" style={{ background: 'rgba(217, 119, 6, 0.15)', color: 'var(--color-accent-amber)' }}>
              Khusus Admin
            </span>
          )}
          <button onClick={skipAll} className="ml-auto p-1 rounded-lg transition hover:bg-[var(--color-hover)]" style={{ color: 'var(--color-slate-muted)' }} aria-label="Tutup tutorial">
            <X size={16} />
          </button>
        </div>

        <p className="mt-2.5 text-[13px] leading-relaxed" style={{ color: 'var(--color-slate-body)' }}>
          {step.description}
        </p>

        {step.navTo && (
          <button
            onClick={() => {
              navigate(step.navTo)
              requestAnimationFrame(() => requestAnimationFrame(resolveTarget))
            }}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: 'var(--color-accent-blue)' }}
          >
            Kunjungi halaman ini <ArrowRight size={12} />
          </button>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold" style={{ color: 'var(--color-slate-muted)' }}>
            {stepIndex + 1} / {tourSteps.length}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={skipAll} className="rounded-lg px-3 py-1.5 text-xs font-medium transition hover:bg-[var(--color-hover)]" style={{ color: 'var(--color-slate-body)' }}>
              Lewati
            </button>
            <button onClick={next} className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #1D4ED8, #2563EB)', boxShadow: '0 4px 14px rgba(15,23,42,0.12)' }}>
              {isLast ? 'Selesai' : 'Berikutnya'} {isLast ? <Check size={13} /> : <ChevronRight size={13} />}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
