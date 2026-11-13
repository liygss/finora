import { useState, useEffect } from 'react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Send, Users, Sparkles, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { extractError } from '../api/extractError'

const LINK_PRESETS = [
  { value: '', label: 'Tidak ada (tanpa navigasi)' },
  { value: '/dashboard', label: 'Dashboard' },
  { value: '/jurnal', label: 'Jurnal Umum' },
  { value: '/laporan', label: 'Laporan Keuangan' },
  { value: '/upload', label: 'Upload File' },
  { value: '/spt', label: 'SPT Tahunan' },
  { value: '/pajak', label: 'Kalkulator Pajak' },
]

export default function NotifAdminPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [form, setForm] = useState({
    user_id: '',
    title: '',
    message: '',
    link: '',
  })

  useEffect(() => {
    setLoading(true)
    client
      .get('/notifications/admin/users')
      .then(({ data }) => {
        setUsers(data)
        if (data.length > 0) setForm((f) => ({ ...f, user_id: f.user_id || data[0].id }))
      })
      .catch(() => toast.error('Gagal memuat daftar user'))
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.user_id) return toast.error('Pilih user penerima')
    if (!form.title.trim() || !form.message.trim()) return toast.error('Judul dan pesan wajib diisi')
    setSending(true)
    try {
      await client.post('/notifications/send', {
        user_id: form.user_id,
        title: form.title.trim(),
        message: form.message.trim(),
        link: form.link || null,
        type: 'ADMIN',
      })
      toast.success('Notifikasi terkirim')
      setForm((f) => ({ ...f, title: '', message: '', link: '' }))
    } catch (err) {
      toast.error(extractError(err, 'Gagal mengirim'))
    } finally {
      setSending(false)
    }
  }

  const handleMonthlyAll = async () => {
    if (!users.length) return
    let ok = 0
    let skipped = 0
    for (const u of users) {
      try {
        const { data } = await client.post('/notifications/monthly', {
          user_id: u.id,
          year: null,
          month: null,
        })
        if (data) ok += 1
        else skipped += 1
      } catch {
        skipped += 1
      }
    }
    toast.success(`Ringkasan bulanan dibuat untuk ${ok} user${skipped ? ` (${skipped} dilewati)` : ''}`)
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)', boxShadow: '0 4px 14px rgba(15,23,42,0.12)' }}
        >
          <Send size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-slate-heading)' }}>Kirim Notifikasi</h1>
          <p className="text-sm" style={{ color: 'var(--color-slate-muted)' }}>Kirim pesan ke user tertentu — muncul di lonceng notifikasi mereka</p>
        </div>
      </div>

      {/* Form */}
      <div className="card p-6 space-y-5">
        <div>
          <label className="label">Penerima</label>
          <div className="relative">
            <Users size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-slate-muted)' }} />
            <select
              value={form.user_id}
              onChange={(e) => setForm({ ...form, user_id: e.target.value })}
              className="input-field pl-10 appearance-none"
              disabled={loading}
            >
              <option value="" disabled>{loading ? 'Memuat...' : 'Pilih user'}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} — {u.email} ({u.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Judul</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="input-field"
            placeholder="cth: Tambahkan transaksi terbaru"
            maxLength={150}
          />
        </div>

        <div>
          <label className="label">Pesan</label>
          <textarea
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="input-field resize-none"
            rows={4}
            placeholder="Tulis pesan untuk user..."
          />
        </div>

        <div>
          <label className="label">Tujuan Klik (opsional)</label>
          <select
            value={form.link}
            onChange={(e) => setForm({ ...form, link: e.target.value })}
            className="input-field appearance-none"
          >
            {LINK_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSubmit}
          disabled={sending}
          className="btn-primary w-full"
        >
          <Send size={16} /> {sending ? 'Mengirim...' : 'Kirim Notifikasi'}
        </button>
      </div>

      {/* Ringkasan Bulanan */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={16} style={{ color: '#6EE7B7' }} />
              <h3 className="text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }}>Ringkasan Bulanan</h3>
            </div>
            <p className="text-xs" style={{ color: 'var(--color-slate-muted)' }}>
              Buat ringkasan otomatis (pendapatan/beban/laba rugi bulan lalu) untuk semua user sekaligus. Hanya dibuat bila belum ada untuk bulan itu dan user punya transaksi.
            </p>
          </div>
          <button onClick={handleMonthlyAll} className="btn-secondary shrink-0">
            <CheckCircle2 size={16} /> Buat untuk Semua
          </button>
        </div>
      </div>
    </div>
  )
}
