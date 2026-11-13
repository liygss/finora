import { useState, useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import client from '../api/client'
import { extractError } from '../api/extractError'
import { formatDateTime } from '../utils/formatters'
import { fadeUp, staggerContainer, itemStagger } from '../utils/motionPresets'
import {
  MessageSquareWarning, Search, Filter, Send,
  Clock, CheckCircle2, XCircle, MessageCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'

const CATEGORIES = {
  COMPLAINT: { label: 'Komplain', color: '#DC2626' },
  QUESTION: { label: 'Pertanyaan', color: '#2563EB' },
  SUGGESTION: { label: 'Saran', color: '#059669' },
  OTHER: { label: 'Lainnya', color: '#7C3AED' },
}

const STATUS_CONFIG = {
  OPEN: { label: 'Menunggu', icon: Clock, color: '#D97706', bg: 'rgba(217,119,6,0.12)' },
  REPLIED: { label: 'Dijawab', icon: CheckCircle2, color: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
  CLOSED: { label: 'Selesai', icon: XCircle, color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
}

const STATUS_FILTERS = [
  { value: '', label: 'Semua' },
  { value: 'OPEN', label: 'Menunggu' },
  { value: 'REPLIED', label: 'Dijawab' },
  { value: 'CLOSED', label: 'Selesai' },
]

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
  const cat = CATEGORIES[category] || CATEGORIES.OTHER
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: `${cat.color}18`, color: cat.color }}
    >
      {cat.label}
    </span>
  )
}

function DetailModal({ item, onClose, onReply }) {
  const [reply, setReply] = useState(item.admin_reply || '')
  const [replyStatus, setReplyStatus] = useState('REPLIED')
  const [sending, setSending] = useState(false)

  const handleReply = async () => {
    if (!reply.trim()) return toast.error('Balasan wajib diisi')
    setSending(true)
    try {
      await client.patch(`/feedback/admin/${item.id}`, {
        admin_reply: reply.trim(),
        status: replyStatus,
      })
      toast.success('Balasan terkirim')
      onReply()
      onClose()
    } catch (err) {
      toast.error(extractError(err, 'Gagal mengirim balasan'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(2,6,12,0.72)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="card w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 space-y-5"
        style={{ background: 'var(--color-surface-1)', border: '1px solid rgba(148,163,184,0.14)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <StatusBadge status={item.status} />
              <CategoryBadge category={item.category} />
            </div>
            <h3 className="text-base font-bold" style={{ color: 'var(--color-slate-heading)' }}>{item.subject}</h3>
            <p className="text-xs mt-1" style={{ color: 'var(--color-slate-muted)' }}>
              {item.user_name} ({item.user_email}) — {formatDateTime(item.created_at)}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{ color: 'var(--color-slate-muted)' }}>
            <XCircle size={18} />
          </button>
        </div>

        {/* Message */}
        <div className="rounded-xl p-4 text-sm whitespace-pre-wrap" style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate-body)' }}>
          {item.message}
        </div>

        {/* Previous Reply */}
        {item.admin_reply && (
          <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.15)' }}>
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle size={13} style={{ color: 'var(--color-accent-blue)' }} />
              <span className="text-xs font-bold" style={{ color: 'var(--color-accent-blue)' }}>
                Balasan Sebelumnya {item.replied_by_name ? `(${item.replied_by_name})` : ''}
              </span>
            </div>
            <p className="whitespace-pre-wrap" style={{ color: 'var(--color-slate-body)' }}>{item.admin_reply}</p>
          </div>
        )}

        {/* Reply Form */}
        <div className="space-y-3" style={{ borderTop: '1px solid rgba(148,163,184,0.12)', paddingTop: '1rem' }}>
          <h4 className="text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }}>Balas</h4>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            className="input-field resize-none"
            rows={3}
            placeholder="Tulis balasan..."
          />
          <div className="flex items-center gap-3">
            <label className="label mb-0">Ubah Status:</label>
            <select
              value={replyStatus}
              onChange={(e) => setReplyStatus(e.target.value)}
              className="input-field appearance-none text-xs py-1.5"
            >
              <option value="REPLIED">Dijawab</option>
              <option value="CLOSED">Selesai</option>
              <option value="OPEN">Menunggu</option>
            </select>
          </div>
          <button onClick={handleReply} disabled={sending} className="btn-primary w-full">
            <Send size={16} /> {sending ? 'Mengirim...' : 'Kirim Balasan'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function AdminFeedbackPage() {
  const [items, setItems] = useState([])
  const [stats, setStats] = useState({ total: 0, open: 0, replied: 0, closed: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    const params = {}
    if (statusFilter) params.status = statusFilter
    if (search) params.search = search
    client.get('/feedback/admin/all', { params })
      .then(({ data }) => setItems(data.items || []))
      .catch(() => toast.error('Gagal memuat feedback'))
      .finally(() => setLoading(false))
  }, [statusFilter, search])

  const fetchStats = () => {
    client.get('/feedback/admin/stats')
      .then(({ data }) => setStats(data))
      .catch(() => {})
  }

  useEffect(() => { fetchData(); fetchStats() }, [fetchData])

  useEffect(() => {
    const timer = setTimeout(() => { fetchData() }, 350)
    return () => clearTimeout(timer)
  }, [search, fetchData])

  const handleReply = () => {
    fetchData()
    fetchStats()
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #DC2626 0%, #F87171 100%)', boxShadow: '0 4px 14px rgba(15,23,42,0.12)' }}
        >
          <MessageSquareWarning size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-slate-heading)' }}>Kelola Feedback</h1>
          <p className="text-sm" style={{ color: 'var(--color-slate-muted)' }}>Lihat dan balas komplain dari pengguna</p>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.05 }} className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'var(--color-slate-heading)', icon: MessageSquareWarning },
          { label: 'Menunggu', value: stats.open, color: '#D97706', icon: Clock },
          { label: 'Dijawab', value: stats.replied, color: '#2563EB', icon: CheckCircle2 },
          { label: 'Selesai', value: stats.closed, color: '#6B7280', icon: XCircle },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon size={14} style={{ color: s.color }} />
              <span className="text-xs font-medium" style={{ color: 'var(--color-slate-muted)' }}>{s.label}</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </motion.div>

      {/* Search & Filter */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.1 }} className="card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-slate-muted)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
              placeholder="Cari subjek, pesan, nama..."
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} style={{ color: 'var(--color-slate-muted)' }} />
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: statusFilter === f.value ? 'rgba(37,99,235,0.15)' : 'var(--color-surface-2)',
                  color: statusFilter === f.value ? 'var(--color-accent-blue)' : 'var(--color-slate-muted)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.15 }} className="card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-xl skeleton" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquareWarning size={36} className="mx-auto mb-3" style={{ color: 'var(--color-slate-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--color-slate-muted)' }}>Tidak ada feedback ditemukan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.12)' }}>
                  <th className="px-4 py-3 text-left text-xs font-bold" style={{ color: 'var(--color-slate-muted)' }}>Status</th>
                  <th className="px-4 py-3 text-left text-xs font-bold" style={{ color: 'var(--color-slate-muted)' }}>Kategori</th>
                  <th className="px-4 py-3 text-left text-xs font-bold" style={{ color: 'var(--color-slate-muted)' }}>Subjek</th>
                  <th className="px-4 py-3 text-left text-xs font-bold" style={{ color: 'var(--color-slate-muted)' }}>Pengirim</th>
                  <th className="px-4 py-3 text-left text-xs font-bold" style={{ color: 'var(--color-slate-muted)' }}>Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-bold" style={{ color: 'var(--color-slate-muted)' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                <motion.div variants={staggerContainer(0.04)} initial="hidden" animate="visible" component="tbody">
                  {items.map((item) => (
                    <motion.tr
                      key={item.id}
                      variants={itemStagger}
                      className="transition-colors hover:bg-white/[0.02] cursor-pointer"
                      style={{ borderBottom: '1px solid rgba(148,163,184,0.08)' }}
                      onClick={() => setSelectedItem(item)}
                    >
                      <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                      <td className="px-4 py-3"><CategoryBadge category={item.category} /></td>
                      <td className="px-4 py-3 font-semibold truncate max-w-[200px]" style={{ color: 'var(--color-slate-heading)' }}>
                        {item.subject}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-slate-body)' }}>
                        <div className="text-xs font-medium">{item.user_name}</div>
                        <div className="text-[10px]" style={{ color: 'var(--color-slate-muted)' }}>{item.user_email}</div>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-slate-muted)' }}>
                        {formatDateTime(item.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedItem(item) }}
                          className="btn-secondary text-xs py-1 px-2.5"
                        >
                          {item.admin_reply ? 'Lihat' : 'Balas'}
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </motion.div>
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Detail Modal */}
      {selectedItem && (
        <DetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onReply={handleReply}
        />
      )}
    </div>
  )
}
