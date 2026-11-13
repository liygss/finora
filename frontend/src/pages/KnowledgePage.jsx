import { useState, useEffect } from 'react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'
import { formatDateTime } from '../utils/formatters'
import toast from 'react-hot-toast'
import { extractError } from '../api/extractError'
import { BookOpen, Plus, Trash2, CheckCircle, XCircle, Clock, Loader2, Database } from 'lucide-react'

const KATEGORI_OPTIONS = [
  { value: 'umum', label: 'Umum' },
  { value: 'accounting', label: 'Akuntansi' },
  { value: 'tax', label: 'Pajak' },
  { value: 'sak_emkm', label: 'SAK EMKM' },
  { value: 'regulations', label: 'Peraturan' },
  { value: 'faq', label: 'FAQ' },
]

const STATUS_ICON = {
  UPLOADED: <Clock size={14} style={{ color: '#D97706' }} />,
  PROCESSING: <Loader2 size={14} className="animate-spin" style={{ color: '#D97706' }} />,
  INGESTED: <CheckCircle size={14} style={{ color: '#059669' }} />,
  FAILED: <XCircle size={14} style={{ color: '#DC2626' }} />,
}

const STATUS_LABEL = {
  UPLOADED: 'Menunggu',
  PROCESSING: 'Diproses',
  INGESTED: 'Tersimpan',
  FAILED: 'Gagal',
}

const STATUS_COLOR = {
  UPLOADED: '#F59E0B',
  PROCESSING: '#F59E0B',
  INGESTED: '#10B981',
  FAILED: '#F87171',
}

export default function KnowledgePage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ judul: '', kategori: 'umum', konten: '' })
  const [showForm, setShowForm] = useState(false)

  const isAdmin = user?.role === 'ADMIN'

  const load = () => {
    client.get('/upload/knowledge')
      .then(r => setItems(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.judul.trim() || !form.konten.trim()) {
      toast.error('Judul dan konten tidak boleh kosong')
      return
    }
    setSubmitting(true)
    try {
      await client.post('/upload/knowledge', form)
      toast.success('Knowledge berhasil disimpan & sedang diproses')
      setForm({ judul: '', kategori: 'umum', konten: '' })
      setShowForm(false)
      load()
    } catch (err) {
      toast.error(extractError(err, 'Gagal menyimpan knowledge'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id, judul) => {
    if (!confirm(`Hapus knowledge "${judul}"?`)) return
    try {
      await client.delete(`/upload/knowledge/${id}`)
      toast.success(`${judul} berhasil dihapus`)
      load()
    } catch {
      toast.error('Gagal menghapus knowledge')
    }
  }

  if (!isAdmin) {
    return (
      <div className="card text-center py-16">
        <XCircle size={40} className="mx-auto mb-4" style={{ color: '#F87171' }} />
        <p className="text-lg font-bold" style={{ color: 'var(--color-slate-heading)' }}>Akses Ditolak</p>
        <p className="text-sm mt-2" style={{ color: 'var(--color-slate-body)' }}>Hanya admin yang bisa mengakses halaman ini</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">
            <span className="gradient-text">Knowledge Base</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-slate-body)' }}>Input pengetahuan baru untuk AI chatbot</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary text-sm"
        >
          <Plus size={16} />
          {showForm ? 'Tutup Form' : 'Tambah Knowledge'}
        </button>
      </div>

      {/* Form tambah knowledge */}
      <div
        className="overflow-hidden transition-all duration-500"
        style={{ maxHeight: showForm ? '800px' : '0', opacity: showForm ? 1 : 0 }}
      >
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Judul</label>
              <input
                type="text"
                value={form.judul}
                onChange={e => setForm({ ...form, judul: e.target.value })}
                className="input-field"
                placeholder="Contoh: Aturan PPh Final UMKM 2024"
                required
              />
            </div>
            <div>
              <label className="label">Kategori</label>
              <select
                value={form.kategori}
                onChange={e => setForm({ ...form, kategori: e.target.value })}
                className="input-field"
              >
                {KATEGORI_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Konten Pengetahuan</label>
            <textarea
              value={form.konten}
              onChange={e => setForm({ ...form, konten: e.target.value })}
              className="input-field min-h-[250px] resize-y"
              placeholder="Tulis atau paste konten pengetahuan di sini...&#10;&#10;Contoh:&#10;## PPh Final UMKM&#10;PPh Final UMKM dikenakan tarif 0,5% dari omzet bruto..."
              required
            />
            <p className="text-xs mt-1.5" style={{ color: 'var(--color-slate-muted)' }}>
              Gunakan heading markdown (##, ###) untuk memisahkan bagian konten
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn-secondary text-sm"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary text-sm"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
              {submitting ? 'Menyimpan...' : 'Simpan & Proses'}
            </button>
          </div>
        </form>
      </div>

      {/* Daftar knowledge */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-slate-text)' }}>
          Knowledge yang Sudah Diinput ({items.length})
        </h3>
        {loading ? <LoadingSpinner className="mt-6" /> : items.length === 0 ? (
          <div className="card text-center py-10">
            <BookOpen size={32} className="mx-auto mb-3" style={{ color: '#475569' }} />
            <p className="text-sm" style={{ color: 'var(--color-slate-muted)' }}>Belum ada knowledge yang diinput</p>
            <button onClick={() => setShowForm(true)} className="btn-primary text-sm mt-4">
              <Plus size={14} /> Tambah Knowledge Pertama
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id} className="card flex items-center gap-4 !p-4">
                <div className="rounded-xl p-2.5 shrink-0" style={{ background: 'rgba(37, 99, 235, 0.12)' }}>
                  <BookOpen size={18} style={{ color: 'var(--color-brand-soft)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--color-slate-heading)' }}>
                      {item.original_filename.replace('.md', '')}
                    </p>
                    <span className="badge text-[10px] shrink-0" style={{ background: 'rgba(37, 99, 235, 0.12)', color: 'var(--color-accent-blue)' }}>
                      {item.file_size_bytes} bytes
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-slate-muted)' }}>
                    {formatDateTime(item.created_at)}
                    {item.chunk_count > 0 && <> &middot; {item.chunk_count} chunks</>}
                  </p>
                  {item.error_message && <p className="text-xs mt-0.5" style={{ color: '#F87171' }}>{item.error_message}</p>}
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium shrink-0">
                  {STATUS_ICON[item.status]}
                  <span style={{ color: STATUS_COLOR[item.status] || '#D97706' }}>
                    {STATUS_LABEL[item.status] || item.status}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(item.id, item.original_filename.replace('.md', ''))}
                  className="shrink-0 p-1.5 rounded-xl transition hover:bg-red-500/10 hover:text-red-400"
                  style={{ color: 'var(--color-slate-muted)' }}
                  title="Hapus knowledge"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
