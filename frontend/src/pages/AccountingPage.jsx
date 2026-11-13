import { useState, useEffect } from 'react'
import client from '../api/client'
import DataTable from '../components/DataTable'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'
import { extractError } from '../api/extractError'
import { Plus, X, Search } from 'lucide-react'
import { formatRupiah } from '../utils/formatters'

const KATEGORI = ['ASET', 'LIABILITAS', 'MODAL', 'PENDAPATAN', 'BEBAN']
const SALDO = ['DEBIT', 'KREDIT']

const KATEGORI_BADGE = {
  ASET: 'badge-aset',
  LIABILITAS: 'badge-liabilitas',
  MODAL: 'badge-modal',
  PENDAPATAN: 'badge-pendapatan',
  BEBAN: 'badge-beban',
}

export default function AccountingPage() {
  const [akun, setAkun] = useState([])
  const [saldoMap, setSaldoMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ kode_akun: '', nama_akun: '', kategori: 'ASET', saldo_normal: 'DEBIT', sub_kategori: '' })

  const load = () => {
    setLoading(true)
    client.get('/accounting/akun')
      .then(r => setAkun(r.data))
      .catch(() => toast.error('Gagal memuat akun'))
      .finally(() => setLoading(false))
  }

  const loadSaldo = () => {
    client.get('/accounting/laporan/neraca-saldo')
      .then(r => {
        const map = {}
        for (const b of r.data.baris || []) map[b.kode_akun] = { debit: b.debit || 0, kredit: b.kredit || 0 }
        setSaldoMap(map)
      })
      .catch(() => setSaldoMap({}))
  }

  useEffect(() => { load(); loadSaldo() }, [])

  let filtered = filter ? akun.filter(a => a.kategori === filter) : akun
  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(a => a.nama_akun.toLowerCase().includes(q) || a.kode_akun.toLowerCase().includes(q))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await client.post('/accounting/akun', form)
      toast.success('Akun berhasil ditambahkan')
      setShowForm(false)
      setForm({ kode_akun: '', nama_akun: '', kategori: 'ASET', saldo_normal: 'DEBIT', sub_kategori: '' })
      load()
    } catch (err) {
      toast.error(extractError(err, 'Gagal menambah akun'))
    }
  }

  const columns = [
    { header: 'Kode', accessor: 'kode_akun', render: r => <span className="font-mono font-semibold" style={{ color: 'var(--color-brand-soft)' }}>{r.kode_akun}</span> },
    { header: 'Nama Akun', accessor: 'nama_akun', render: r => <span className="font-medium" style={{ color: 'var(--color-slate-heading)' }}>{r.nama_akun}</span> },
    { header: 'Kategori', accessor: 'kategori', render: r => (
      <span className={`badge ${KATEGORI_BADGE[r.kategori] || ''}`} style={!KATEGORI_BADGE[r.kategori] ? { background: 'rgba(148,163,184,0.12)', color: 'var(--color-slate-body)' } : undefined}>{r.kategori}</span>
    )},
    { header: 'Saldo Normal', accessor: 'saldo_normal', render: r => (
      <span className="badge" style={{ background: r.saldo_normal === 'DEBIT' ? 'rgba(5, 150, 105, 0.12)' : 'rgba(37, 99, 235, 0.12)', color: r.saldo_normal === 'DEBIT' ? '#10B981' : 'var(--color-accent-blue)' }}>{r.saldo_normal}</span>
    )},
    {
      header: 'Saldo', accessor: 'saldo', render: r => {
        const s = saldoMap[r.kode_akun]
        if (!s || (!s.debit && !s.kredit)) {
          return <span className="font-mono tabular-nums text-xs" style={{ color: 'var(--color-slate-muted)' }}>Rp 0</span>
        }
        const isDebit = s.debit > 0
        const nilai = isDebit ? s.debit : s.kredit
        return (
          <span className="inline-flex items-center font-mono tabular-nums text-sm font-semibold num-cell" style={{ color: isDebit ? '#10B981' : 'var(--color-accent-blue)' }}>
            {formatRupiah(nilai)}
          </span>
        )
      }
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">
            <span className="gradient-text">Chart of Accounts</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-slate-body)' }}>Daftar akun sesuai SAK EMKM</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={16} /> Tambah Akun</button>
      </div>

      {/* Filters & Search */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilter('')} className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200" style={!filter ? { background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)', color: 'white', boxShadow: '0 4px 12px rgba(15,23,42,0.12)' } : { background: 'var(--color-surface-card)', color: 'var(--color-slate-body)', border: '1px solid rgba(148, 163, 184, 0.14)' }}>Semua</button>
          {KATEGORI.map(k => (
            <button key={k} onClick={() => setFilter(k)} className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200" style={filter === k ? { background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)', color: 'white', boxShadow: '0 4px 12px rgba(15,23,42,0.12)' } : { background: 'var(--color-surface-card)', color: 'var(--color-slate-body)', border: '1px solid rgba(148, 163, 184, 0.14)' }}>{k}</button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-slate-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari akun..."
            className="input-field !pl-9 !py-2 !text-xs w-48"
          />
        </div>
      </div>

      {loading ? <LoadingSpinner className="mt-10" /> : (
        <DataTable columns={columns} data={filtered} emptyMessage="Belum ada akun" />
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)} style={{ background: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-md card animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: 'var(--color-slate-heading)' }}>Tambah Akun Baru</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-xl transition hover:bg-white/10" style={{ color: 'var(--color-slate-body)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Kode Akun</label>
                <input required value={form.kode_akun} onChange={e => setForm({...form, kode_akun: e.target.value})} className="input-field" placeholder="1-1100" />
              </div>
              <div>
                <label className="label">Nama Akun</label>
                <input required value={form.nama_akun} onChange={e => setForm({...form, nama_akun: e.target.value})} className="input-field" placeholder="Kas" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Kategori</label>
                  <select value={form.kategori} onChange={e => setForm({...form, kategori: e.target.value})} className="input-field">
                    {KATEGORI.map(k => <option key={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Saldo Normal</label>
                  <select value={form.saldo_normal} onChange={e => setForm({...form, saldo_normal: e.target.value})} className="input-field">
                    {SALDO.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Sub Kategori <span className="font-normal" style={{ color: 'var(--color-slate-muted)' }}>(opsional)</span></label>
                <input value={form.sub_kategori} onChange={e => setForm({...form, sub_kategori: e.target.value})} className="input-field" placeholder="Kas & Bank" />
              </div>
              <button type="submit" className="btn-primary w-full !py-3">Simpan Akun</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
