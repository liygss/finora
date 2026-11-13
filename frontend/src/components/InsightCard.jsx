import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'motion/react'
import { Sparkles, RefreshCw, AlertCircle, Lightbulb } from 'lucide-react'
import client from '../api/client'
import { getInsight, setInsight as setInsightCache } from '../utils/dashboardStore'
import { fadeUp, EASE_GENTLE } from '../utils/motionPresets'

function parseInsight(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const bullets = []
  let saran = ''
  for (const line of lines) {
    if (/^saran\s*[:：]/i.test(line)) {
      saran = line.replace(/^saran\s*[:：]\s*/i, '')
    } else if (/^[-•*]\s+/.test(line)) {
      bullets.push(line.replace(/^[-•*]\s+/, ''))
    } else if (bullets.length > 0) {
      bullets.push(line)
    }
  }
  return { bullets, saran }
}

export default function InsightCard({ debouncedDate, uploadId }) {
  const cacheKey = `${uploadId || 'all'}:${debouncedDate || 'auto'}`
  // Balik dari halaman lain: tampilkan insight periode ini dari cache tanpa
  // fetch ulang (tidak ada skeleton). Perbarui tetap bisa fetch manual.
  const cachedInsight = getInsight(cacheKey)
  const [insight, setInsight] = useState(cachedInsight)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const cardRef = useRef(null)
  // Jangan panggil LLM saat halaman pertama dimuat: kartu ini berada di bawah
  // fold, jadi fetch didefer sampai mendekati viewport (sekali saja).
  const startedRef = useRef(false)

  const fetchInsight = useCallback(() => {
    setLoading(true)
    setError(false)
    const params = debouncedDate ? { tanggal_per: debouncedDate } : {}
    if (uploadId) params.upload_id = uploadId
    client.get('/dashboard/insight', { params })
      .then((r) => {
        setInsight(r.data)
        setInsightCache(cacheKey, r.data)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [debouncedDate, uploadId, cacheKey])

  const handleFetch = useCallback(() => {
    startedRef.current = true
    fetchInsight()
  }, [fetchInsight])

  useEffect(() => {
    const el = cardRef.current
    if (startedRef.current || !el) return undefined
    // Sudah punya insight tersimpan utk periode ini → pakai langsung, jangan fetch.
    if (getInsight(cacheKey)) {
      startedRef.current = true
      return undefined
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          startedRef.current = true
          observer.disconnect()
          fetchInsight()
        }
      },
      { rootMargin: '250px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [fetchInsight, cacheKey])

  // Kalau periode berubah setelah insight pernah di-fetch, muat ulang —
  // kecuali periode barunya masih punya cache (transisi singkat antarbulan).
  useEffect(() => {
    if (!startedRef.current) return undefined
    if (getInsight(cacheKey)) return undefined
    fetchInsight()
  }, [fetchInsight, cacheKey])

  const { bullets, saran } = parseInsight(insight?.insight || '')

  return (
    <motion.div ref={cardRef} variants={fadeUp} whileHover={{ y: -4, transition: EASE_GENTLE }} className="card flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div
            className="rounded-xl p-2 text-white"
            style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)', boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}
          >
            <Sparkles size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }}>Insight AI</h3>
            <p className="text-[11px]" style={{ color: 'var(--color-slate-body)' }}>Ringkasan otomatis kondisi usaha Anda</p>
          </div>
        </div>
        <button
          onClick={handleFetch}
          disabled={loading}
          title="Perbarui insight"
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-200 hover:bg-violet-500/10 disabled:opacity-50"
          style={{ color: '#8B5CF6', background: 'var(--color-surface-card)', border: '1px solid rgba(148, 163, 184, 0.14)' }}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Perbarui
        </button>
      </div>

      {loading ? (
        <div className="space-y-2.5 flex-1">
          <div className="skeleton h-4 w-full rounded-lg" />
          <div className="skeleton h-4 w-11/12 rounded-lg" />
          <div className="skeleton h-4 w-4/5 rounded-lg" />
          <div className="skeleton h-10 w-full rounded-xl mt-4" />
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center py-6">
          <AlertCircle size={22} style={{ color: 'var(--color-slate-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--color-slate-body)' }}>
            Layanan AI sedang sibuk. Coba lagi sebentar lagi.
          </p>
          <button
            onClick={handleFetch}
            className="btn-ghost text-xs !px-3 !py-1.5"
          >
            Coba Lagi
          </button>
        </div>
      ) : (
        <div className="space-y-3 flex-1">
          {insight?.has_data === false && (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-slate-body)' }}>{insight.insight}</p>
          )}
          {insight?.has_data !== false && bullets.length > 0 && (
            <ul className="space-y-2">
              {bullets.map((b, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed" style={{ color: 'var(--color-slate-text)' }}>
                  <span className="mt-2 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'linear-gradient(135deg, #8B5CF6, #60A5FA)' }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
          {saran && (
            <div
              className="rounded-xl p-3 text-sm leading-relaxed"
              style={{ background: 'rgba(124, 58, 237, 0.08)', border: '1px solid rgba(124, 58, 237, 0.2)' }}
            >
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: '#8B5CF6' }}>
                <Lightbulb size={12} /> Saran
              </span>
              <p className="mt-1" style={{ color: 'var(--color-slate-text)' }}>{saran}</p>
            </div>
          )}
          {insight && <p className="text-[10px] mt-auto pt-2" style={{ color: 'var(--color-slate-muted)' }}>
            Diperbarui {new Date(insight.generated_at + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>}
        </div>
      )}
    </motion.div>
  )
}