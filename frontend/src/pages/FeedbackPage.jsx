import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import client from '../api/client'
import { extractError } from '../api/extractError'
import { formatDateTime } from '../utils/formatters'
import { fadeUp, staggerContainer, itemStagger } from '../utils/motionPresets'
import {
  MessageSquareWarning, Send, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'

const CATEGORIES = [
  { value: 'COMPLAINT', label: 'Komplain', color: '#DC2626' },
  { value: 'QUESTION', label: 'Pertanyaan', color: '#2563EB' },
  { value: 'SUGGESTION', label: 'Saran', color: '#059669' },
  { value: 'OTHER', label: 'Lainnya', color: '#7C3AED' },
]

const STATUS_CONFIG = {
  OPEN: { label: 'Menunggu', icon: Clock, color: '#D97706', bg: 'rgba(217,119,6,0.12)' },
  REPLIED: { label: 'Dijawab', icon: CheckCircle2, color: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
  CLOSED: { label: 'Selesai', icon: XCircle, color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.OPEN
  const Icon = cfg.icon
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <Icon size={12} />
      {cfg.label}
    </span>
  )
}

function CategoryBadge({ category }) {
  const cat = CATEGORIES.find((c) => c.value === category) || CATEGORIES[3]
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: `${cat.color}18`, color: cat.color }}
    >
      {cat.label}
    </span>
  )
}

function FeedbackItem({ item }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      variants={itemStagger}
      className="card overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-4 p-5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <StatusBadge status={item.status} />
            <CategoryBadge category={item.category} />
            <span className="text-xs" style={{ color: 'var(--color-slate-muted)' }}>
              {formatDateTime(item.created_at)}
            </span>
          </div>
          <h3 className="text-sm font-bold truncate" style={{ color: 'var(--color-slate-heading)' }}>
            {item.subject}
          </h3>
        </div>
        {expanded ? (
          <ChevronUp size={16} className="mt-1 shrink-0" style={{ color: 'var(--color-slate-muted)' }} />
        ) : (
          <ChevronDown size={16} className="mt-1 shrink-0" style={{ color: 'var(--color-slate-muted)' }} />
        )}
      </button>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="px-5 pb-5 space-y-4"
        >
          <div
            className="rounded-xl p-4 text-sm whitespace-pre-wrap"
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate-body)' }}
          >
            {item.message}
          </div>

          {item.admin_reply && (
            <div
              className="rounded-xl p-4 text-sm"
              style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.15)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #1D4ED8, #2563EB)' }}
                >
                  A
                </div>
                <span className="text-xs font-bold" style={{ color: 'var(--color-accent-blue)' }}>
                  Balasan Admin {item.replied_by_name ? `(${item.replied_by_name})` : ''}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--color-slate-muted)' }}>
                  {formatDateTime(item.replied_at)}
                </span>
              </div>
              <p className="whitespace-pre-wrap" style={{ color: 'var(--color-slate-body)' }}>
                {item.admin_reply}
              </p>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}

export default function FeedbackPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ category: 'COMPLAINT', subject: '', message: '' })

  const fetchFeedbacks = () => {
    setLoading(true)
    client.get('/feedback')
      .then(({ data }) => setItems(data.items || []))
      .catch(() => toast.error('Gagal memuat feedback'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchFeedbacks() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.subject.trim() || !form.message.trim()) {
      return toast.error('Subjek dan pesan wajib diisi')
    }
    setSubmitting(true)
    try {
      await client.post('/feedback', {
        category: form.category,
        subject: form.subject.trim(),
        message: form.message.trim(),
      })
      toast.success('Feedback terkirim! Admin akan segera merespon.')
      setForm({ category: 'COMPLAINT', subject: '', message: '' })
      fetchFeedbacks()
    } catch (err) {
      toast.error(extractError(err, 'Gagal mengirim feedback'))
    } finally {
      setSubmitting(false)
    }
  }

  const openCount = items.filter((i) => i.status === 'OPEN').length
  const repliedCount = items.filter((i) => i.status === 'REPLIED').length

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)', boxShadow: '0 4px 14px rgba(15,23,42,0.12)' }}
        >
          <MessageSquareWarning size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-slate-heading)' }}>Feedback & Komplain</h1>
          <p className="text-sm" style={{ color: 'var(--color-slate-muted)' }}>
            Kirim komplain, pertanyaan, atau saran — admin akan segera merespon
          </p>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.05 }} className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: items.length, color: 'var(--color-slate-heading)' },
          { label: 'Menunggu', value: openCount, color: '#D97706' },
          { label: 'Dijawab', value: repliedCount, color: '#2563EB' },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-slate-muted)' }}>{s.label}</div>
          </div>
        ))}
      </motion.div>

      {/* Form Submit */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.1 }} className="card p-6 space-y-4">
        <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-slate-heading)' }}>
          <Send size={14} style={{ color: 'var(--color-accent-blue)' }} />
          Kirim Feedback Baru
        </h2>

        <div>
          <label className="label">Kategori</label>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setForm({ ...form, category: cat.value })}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: form.category === cat.value ? `${cat.color}20` : 'var(--color-surface-2)',
                  color: form.category === cat.value ? cat.color : 'var(--color-slate-muted)',
                  border: `1px solid ${form.category === cat.value ? `${cat.color}40` : 'transparent'}`,
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Subjek</label>
          <input
            type="text"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="input-field"
            placeholder="cth: Error saat upload file CSV"
            maxLength={200}
          />
        </div>

        <div>
          <label className="label">Pesan</label>
          <textarea
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="input-field resize-none"
            rows={4}
            placeholder="Jelaskan masalah, pertanyaan, atau saran Anda..."
          />
        </div>

        <button onClick={handleSubmit} disabled={submitting} className="btn-primary w-full">
          <Send size={16} /> {submitting ? 'Mengirim...' : 'Kirim Feedback'}
        </button>
      </motion.div>

      {/* Daftar Feedback */}
      <div>
        <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--color-slate-heading)' }}>
          Riwayat Feedback ({items.length})
        </h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="h-4 w-32 rounded skeleton mb-2" />
                <div className="h-3 w-48 rounded skeleton" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="card p-8 text-center">
            <MessageSquareWarning size={36} className="mx-auto mb-3" style={{ color: 'var(--color-slate-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--color-slate-muted)' }}>Belum ada feedback</p>
          </div>
        ) : (
          <motion.div
            variants={staggerContainer(0.06)}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            {items.map((item) => (
              <FeedbackItem key={item.id} item={item} />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}
