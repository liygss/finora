import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import StatCard from '../components/StatCard'
import DataTable from '../components/DataTable'
import { fadeUp, staggerContainer, EASE_GENTLE } from '../utils/motionPresets'
import { formatDate, formatDateTime } from '../utils/formatters'
import toast from 'react-hot-toast'
import { extractError } from '../api/extractError'
import { Users, Wrench, UserPlus, Search, RefreshCw, Database, CheckCircle2, XCircle, X, Activity, UserCheck, MessageSquare, AlertCircle, CheckCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const PLAN_BADGE = {
  MAINTENANCE: { label: 'Maintenance', bg: 'rgba(5, 150, 105, 0.14)', fg: '#10B981', border: 'rgba(5, 150, 105, 0.35)' },
  FREE: { label: 'Gratis', bg: 'rgba(148, 163, 184, 0.1)', fg: '#CBD5E1', border: 'rgba(148, 163, 184, 0.25)' },
}

const ROLE_BADGE = {
  ADMIN: { label: 'Admin', bg: 'rgba(124, 58, 237, 0.14)', fg: '#C4B5FD', border: 'rgba(124, 58, 237, 0.35)' },
  OWNER: { label: 'Owner', bg: 'rgba(37, 99, 235, 0.12)', fg: 'var(--color-accent-blue)', border: 'rgba(37, 99, 235, 0.3)' },
  STAFF: { label: 'Staff', bg: 'rgba(217, 119, 6, 0.12)', fg: '#FCD34D', border: 'rgba(217, 119, 6, 0.3)' },
}

function Badge({ kind, value }) {
  const cfg = kind === 'plan' ? PLAN_BADGE[value] : ROLE_BADGE[value]
  if (!cfg) return <span className="text-xs" style={{ color: 'var(--color-slate-muted)' }}>{value || '-'}</span>
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{ background: cfg.bg, color: cfg.fg, border: `1px solid ${cfg.border}` }}>
      {kind === 'plan' && value === 'MAINTENANCE' && <Wrench size={11} />}
      {cfg.label}
    </span>
  )
}

function PlanChart({ data }) {
  return (
    <div className="space-y-2.5">
      {data.map((entry) => {
        const color = entry.name === 'Maintenance' ? '#059669' : '#64748B'
        return (
          <div key={entry.name} className="rounded-xl px-3.5 py-2.5" style={{ background: 'rgba(148, 163, 184, 0.06)', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2.5 text-sm font-semibold" style={{ color: 'var(--color-slate-text)' }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}66` }} />
                {entry.name}
              </span>
              <span className="text-sm font-extrabold" style={{ color: 'var(--color-slate-heading)' }}>
                {entry.value}
                <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: `${color}1f`, color }}>{entry.pct}%</span>
              </span>
            </div>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(148, 163, 184, 0.12)' }}>
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${entry.pct}%` }}
                transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                style={{ background: `linear-gradient(90deg, ${color}cc, ${color})` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ManageModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({ role: user.role, plan: user.plan, is_active: user.is_active })
  const [saving, setSaving] = useState(false)
  const isSelf = user.isSelf

  const save = async () => {
    setSaving(true)
    try {
      await client.patch(`/admin/users/${user.id}`, form)
      toast.success('Perubahan disimpan')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(extractError(err, 'Gagal menyimpan'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(3, 7, 18, 0.65)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl p-6 animate-fade-in" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-soft)', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold" style={{ color: 'var(--color-slate-heading)' }}>Kelola User</h3>
            <p className="text-xs mt-0.5 truncate max-w-[230px]" style={{ color: 'var(--color-slate-muted)' }}>{user.full_name} — {user.email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/5 transition" style={{ color: 'var(--color-slate-body)' }}><X size={16} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} disabled={isSelf} className="input-field appearance-none">
              <option value="OWNER">Owner</option>
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
            </select>
            {isSelf && <p className="text-[11px] mt-1" style={{ color: 'var(--color-slate-muted)' }}>Role Anda sendiri tidak bisa diubah.</p>}
          </div>

          <div>
            <label className="label">Paket</label>
            <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} className="input-field appearance-none">
              <option value="FREE">Gratis</option>
              <option value="MAINTENANCE">Maintenance</option>
            </select>
          </div>

          <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-soft)' }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-slate-heading)' }}>Akun Aktif</p>
              <p className="text-[11px]" style={{ color: 'var(--color-slate-muted)' }}>Nonaktifkan untuk blokir login</p>
            </div>
            <button
              onClick={() => setForm({ ...form, is_active: !form.is_active })}
              className="relative h-7 w-12 rounded-full transition-colors duration-200"
              style={{ background: form.is_active ? '#059669' : 'rgba(148,163,184,0.3)' }}
            >
              <span className="absolute top-1 h-5 w-5 rounded-full transition-all duration-200" style={{ left: form.is_active ? 24 : 4, background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }} />
            </button>
          </div>

          <button onClick={save} disabled={saving} className="btn-primary w-full !py-2.5">
            <CheckCircle2 size={15} /> {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </div>
  )
}

const EMPTY_CREATE = { full_name: '', email: '', password: '', company_name: '', role: 'OWNER', plan: 'FREE' }

function CreateModal({ onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_CREATE)
  const [saving, setSaving] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const create = async () => {
    if (!form.full_name.trim() || !form.email.trim()) return toast.error('Nama dan email wajib diisi')
    if (form.password.length < 8) return toast.error('Password minimal 8 karakter')
    setSaving(true)
    try {
      await client.post('/admin/users', { ...form, password: form.password, company_name: form.company_name || null })
      toast.success('User berhasil dibuat')
      onCreated()
      onClose()
    } catch (err) {
      toast.error(extractError(err, 'Gagal membuat user'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(3, 7, 18, 0.65)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl p-6 animate-fade-in overflow-y-auto max-h-[90vh]" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-soft)', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold" style={{ color: 'var(--color-slate-heading)' }}>Tambah User</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-slate-muted)' }}>Buat akun langsung dari dashboard admin</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/5 transition" style={{ color: 'var(--color-slate-body)' }}><X size={16} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Nama Lengkap</label>
            <input type="text" value={form.full_name} onChange={set('full_name')} className="input-field" placeholder="Budi Santoso" />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" value={form.email} onChange={set('email')} className="input-field" placeholder="budi@toko.com" />
          </div>
          <div>
            <label className="label">Password <span className="font-normal" style={{ color: 'var(--color-slate-muted)' }}>min. 8 karakter, huruf besar/kecil & angka</span></label>
            <input type="password" value={form.password} onChange={set('password')} className="input-field" placeholder="••••••••" />
          </div>
          <div>
            <label className="label">Nama Usaha</label>
            <input type="text" value={form.company_name} onChange={set('company_name')} className="input-field" placeholder="Toko Berkah" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Role</label>
              <select value={form.role} onChange={set('role')} className="input-field appearance-none">
                <option value="OWNER">Owner</option>
                <option value="STAFF">Staff</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div>
              <label className="label">Paket</label>
              <select value={form.plan} onChange={set('plan')} className="input-field appearance-none">
                <option value="FREE">Gratis</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            </div>
          </div>
          <button onClick={create} disabled={saving} className="btn-primary w-full !py-2.5">
            <UserPlus size={15} /> {saving ? 'Membuat...' : 'Buat User'}
          </button>
        </div>
      </div>
    </div>
  )
}

function HealthCard() {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    client.get('/admin/health')
      .then(r => setHealth(r.data))
      .catch(() => setHealth(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const rows = [
    { label: 'Database', ok: health?.database === 'connected' },
    { label: 'Qdrant (vector)', ok: health?.qdrant === 'connected' },
    {
      label: 'Seed Knowledge Base',
      ok: health?.seed_status?.completed === true,
      info: health?.seed_status?.running ? 'Sedang berjalan...' : health?.seed_status?.error || undefined,
    },
  ]

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database size={16} style={{ color: 'var(--color-brand-soft)' }} />
          <h3 className="text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }}>Kesehatan Sistem</h3>
        </div>
        <button onClick={() => load()} disabled={loading} title="Periksa ulang" className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-xl transition-all hover:bg-white/5 disabled:opacity-50" style={{ color: 'var(--color-brand-soft)', background: 'var(--color-surface-card)', border: '1px solid rgba(148, 163, 184, 0.14)' }}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Cek
        </button>
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between rounded-xl px-3.5 py-3" style={{ background: 'rgba(148, 163, 184, 0.06)', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
            <div className="flex items-center gap-2.5">
              {r.ok
                ? <CheckCircle2 size={16} style={{ color: '#10B981' }} />
                : <XCircle size={16} style={{ color: '#F87171' }} />}
              <span className="text-sm font-semibold" style={{ color: 'var(--color-slate-text)' }}>{r.label}</span>
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded-full" style={r.ok
              ? { background: 'rgba(5,150,105,0.14)', color: '#10B981', border: '1px solid rgba(5,150,105,0.3)' }
              : { background: 'rgba(220,38,38,0.14)', color: '#F87171', border: '1px solid rgba(220,38,38,0.3)' }}>
              {health ? (r.ok ? 'OK' : 'Gangguan') : 'Memuat...'}
            </span>
            {r.info && (
              <p className="text-[11px] w-full mt-1" style={{ color: 'var(--color-slate-muted)' }}>{r.info}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminDashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [manageTarget, setManageTarget] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [feedbackStats, setFeedbackStats] = useState(null)
  const [recentFeedback, setRecentFeedback] = useState([])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchSummary = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    client.get('/admin/summary')
      .then(r => setSummary(r.data))
      .catch(() => toast.error('Gagal memuat statistik'))
    client.get('/admin/users', { params: { s: debouncedSearch || undefined, plan: planFilter || undefined } })
      .then(r => setUsers(r.data))
      .catch(() => toast.error('Gagal memuat daftar user'))
    // Fetch feedback stats & recent
    client.get('/feedback/admin/stats')
      .then(r => setFeedbackStats(r.data))
      .catch(() => {})
    client.get('/feedback/admin/all', { params: { limit: 5 } })
      .then(r => setRecentFeedback(r.data?.items || []))
      .catch(() => {})
      .finally(() => { if (!silent) setLoading(false) })
  }, [debouncedSearch, planFilter])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  const refresh = () => {
    fetchSummary()
    toast.success('Data disegarkan')
  }

  if (user?.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-lg font-bold" style={{ color: 'var(--color-slate-heading)' }}>Akses Ditolak</p>
          <p className="text-sm mt-2" style={{ color: 'var(--color-slate-muted)' }}>Halaman ini hanya untuk admin.</p>
        </div>
      </div>
    )
  }

  const planDist = (() => {
    const total = summary?.total_users || 0
    const maint = summary?.maintenance_users || 0
    return [
      { name: 'Maintenance', value: maint, pct: total ? Math.round((maint / total) * 100) : 0 },
      { name: 'Gratis', value: summary?.free_users || 0, pct: total ? Math.round((summary.free_users / total) * 100) : 0 },
    ]
  })()

  const columns = [
    {
      header: 'User',
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)', boxShadow: '0 4px 10px rgba(15,23,42,0.12)' }}>
            {u.full_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate" style={{ color: 'var(--color-slate-heading)' }}>{u.full_name}</div>
            <div className="text-xs truncate" style={{ color: 'var(--color-slate-muted)' }}>{u.email}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Perusahaan',
      render: (u) => <span className="text-sm" style={{ color: 'var(--color-slate-body)' }}>{u.company_name || '-'}</span>,
    },
    {
      header: 'Role',
      render: (u) => <Badge kind="role" value={u.role} />,
    },
    {
      header: 'Paket',
      render: (u) => <Badge kind="plan" value={u.plan} />,
    },
    {
      header: 'Status',
      render: (u) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: u.is_active ? '#10B981' : '#F87171' }}>
          <span className="h-2 w-2 rounded-full" style={{ background: u.is_active ? '#059669' : '#DC2626', boxShadow: u.is_active ? '0 0 8px rgba(5,150,105,0.7)' : 'none' }} />
          {u.is_active ? 'Aktif' : 'Nonaktif'}
        </span>
      ),
    },
    {
      header: 'Terakhir Aktif',
      render: (u) => <span className="text-xs" style={{ color: 'var(--color-slate-body)' }}>{u.last_seen_at ? formatDateTime(u.last_seen_at) : 'Belum pernah'}</span>,
    },
    {
      header: 'Bergabung',
      render: (u) => <span className="text-xs" style={{ color: 'var(--color-slate-body)' }}>{formatDate(u.created_at)}</span>,
    },
    {
      header: 'Aksi',
      render: (u) => (
        <button
          onClick={() => setManageTarget({ ...u, isSelf: u.id === user.id })}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-200 hover:bg-blue-500/10"
          style={{ color: 'var(--color-brand-soft)', background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(96,165,250,0.25)' }}
        >
          Kelola
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)', boxShadow: '0 4px 14px rgba(15,23,42,0.12)' }}>
            <Users size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-slate-heading)' }}>Dashboard Admin</h1>
            <p className="text-sm" style={{ color: 'var(--color-slate-muted)' }}>Pantau pertumbuhan user & anggota paket maintenance</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-200 hover:bg-blue-500/10" style={{ color: 'var(--color-brand-soft)', background: 'var(--color-surface-card)', border: '1px solid rgba(148,163,184,0.14)' }}>
            <RefreshCw size={13} /> Segarkan
          </button>
          <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200 hover:shadow-lg" style={{ background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)', color: '#fff', boxShadow: '0 4px 12px rgba(15,23,42,0.12)' }}>
            <UserPlus size={14} /> Tambah User
          </button>
        </div>
      </motion.div>

      {/* Stat cards */}
      <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="visible" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total User" value={summary?.total_users ?? '—'} icon={Users} color="indigo" animate={false} />
        <StatCard title="Paket Maintenance" value={summary?.maintenance_users ?? '—'} icon={Wrench} color="emerald" animate={false} />
        <StatCard title="User Gratis" value={summary?.free_users ?? '—'} icon={UserCheck} color="blue" animate={false} />
        <StatCard title="User Baru Bulan Ini" value={summary?.new_this_month ?? '—'} icon={Activity} color="amber" animate={false} />
      </motion.div>

      {/* Feedback Stats & Recent */}
      <motion.div variants={staggerContainer(0.1)} initial="hidden" animate="visible" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Feedback stat cards */}
        <motion.div variants={fadeUp} className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare size={15} style={{ color: 'var(--color-brand-soft)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }}>Feedback & CS</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="card !p-3">
              <div className="text-[10px] font-medium" style={{ color: 'var(--color-slate-muted)' }}>Total</div>
              <div className="text-xl font-extrabold mt-0.5" style={{ color: 'var(--color-slate-heading)' }}>{feedbackStats?.total ?? '—'}</div>
            </div>
            <div className="card !p-3">
              <div className="text-[10px] font-medium" style={{ color: 'var(--color-slate-muted)' }}>Menunggu</div>
              <div className="text-xl font-extrabold mt-0.5" style={{ color: '#D97706' }}>{feedbackStats?.open ?? '—'}</div>
            </div>
            <div className="card !p-3">
              <div className="text-[10px] font-medium" style={{ color: 'var(--color-slate-muted)' }}>Dijawab</div>
              <div className="text-xl font-extrabold mt-0.5" style={{ color: '#10B981' }}>{feedbackStats?.replied ?? '—'}</div>
            </div>
            <div className="card !p-3">
              <div className="text-[10px] font-medium" style={{ color: 'var(--color-slate-muted)' }}>Selesai</div>
              <div className="text-xl font-extrabold mt-0.5" style={{ color: 'var(--color-slate-body)' }}>{feedbackStats?.closed ?? '—'}</div>
            </div>
          </div>
          <button
            onClick={() => navigate('/admin/feedback')}
            className="w-full text-xs font-semibold px-3 py-2 rounded-xl transition-all hover:bg-blue-500/10"
            style={{ color: 'var(--color-brand-soft)', background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(96,165,250,0.25)' }}
          >
            Lihat Semua →
          </button>
        </motion.div>

        {/* Recent feedback list */}
        <motion.div variants={fadeUp} className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }}>Pesan Terbaru</h3>
          </div>
          {recentFeedback.length === 0 ? (
            <p className="text-xs py-4 text-center" style={{ color: 'var(--color-slate-muted)' }}>Belum ada pesan</p>
          ) : (
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {recentFeedback.map((fb) => (
                <div key={fb.id} className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/[0.03]" style={{ border: '1px solid rgba(148,163,184,0.1)' }}>
                  <div className="shrink-0 mt-0.5">
                    {fb.status === 'OPEN'
                      ? <AlertCircle size={15} style={{ color: '#D97706' }} />
                      : fb.status === 'REPLIED'
                        ? <CheckCircle size={15} style={{ color: '#10B981' }} />
                        : <CheckCircle2 size={15} style={{ color: 'var(--color-slate-muted)' }} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold truncate" style={{ color: 'var(--color-slate-heading)' }}>{fb.subject}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{
                        background: fb.status === 'OPEN' ? 'rgba(217,119,6,0.12)' : fb.status === 'REPLIED' ? 'rgba(5,150,105,0.12)' : 'rgba(148,163,184,0.1)',
                        color: fb.status === 'OPEN' ? '#D97706' : fb.status === 'REPLIED' ? '#10B981' : 'var(--color-slate-muted)',
                      }}>
                        {fb.status === 'OPEN' ? 'Baru' : fb.status === 'REPLIED' ? 'Dijawab' : 'Selesai'}
                      </span>
                    </div>
                    <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--color-slate-muted)' }}>
                      {fb.user_name || 'User'} — {fb.message?.slice(0, 60)}{fb.message?.length > 60 ? '...' : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Charts + health */}
      <motion.div variants={staggerContainer(0.1)} initial="hidden" animate="visible" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div variants={fadeUp} whileHover={{ y: -4, transition: EASE_GENTLE }} className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }}>Pertumbuhan User (6 Bulan)</h3>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={summary?.monthly_growth || []} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-slate-body)' }} axisLine={{ stroke: 'rgba(148,163,184,0.2)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-slate-body)' }} allowDecimals={false} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                cursor={{ fill: 'rgba(148,163,184,0.06)' }}
                contentStyle={{ background: 'var(--color-tooltip-bg)', border: '1px solid var(--color-tooltip-border)', borderRadius: 12 }}
                labelStyle={{ color: 'var(--color-slate-heading)' }}
                itemStyle={{ color: 'var(--color-slate-text)' }}
              />
              <Bar dataKey="free" name="Gratis" stackId="a" fill="#2563EB" radius={[0, 0, 0, 0]} maxBarSize={46} />
              <Bar dataKey="maintenance" name="Maintenance" stackId="a" fill="#059669" radius={[8, 8, 0, 0]} maxBarSize={46} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-5 mt-3">
            <span className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--color-slate-text)' }}><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#2563EB' }} /> Gratis</span>
            <span className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--color-slate-text)' }}><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#059669', boxShadow: '0 0 8px rgba(15,23,42,0.12)' }} /> Maintenance</span>
          </div>
        </motion.div>

        <div className="space-y-4">
          <motion.div variants={fadeUp}>
            <HealthCard />
          </motion.div>
          <motion.div variants={fadeUp} className="card">
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--color-slate-heading)' }}>Komposisi Paket</h3>
            <PlanChart data={planDist} />
          </motion.div>
        </div>
      </motion.div>

      {/* Users table */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-slate-muted)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-9"
              placeholder="Cari nama, email, atau nama usaha..."
            />
          </div>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="input-field sm:w-56 appearance-none"
          >
            <option value="">Semua Paket</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="FREE">Gratis</option>
          </select>
        </div>
        {loading && users.length === 0 ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
          </div>
        ) : (
          <DataTable columns={columns} data={users} emptyMessage="Belum ada user" pageSize={10} />
        )}
      </motion.div>

      {manageTarget && <ManageModal user={manageTarget} onClose={() => setManageTarget(null)} onSaved={refresh} />}
      {createOpen && <CreateModal onClose={() => setCreateOpen(false)} onCreated={refresh} />}
    </div>
  )
}