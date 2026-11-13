import { useState, useEffect, useCallback } from 'react'
import client from '../api/client'
import DataTable from '../components/DataTable'
import LoadingSpinner from '../components/LoadingSpinner'
import { formatRupiah, formatDate, localDateStr } from '../utils/formatters'
import DatePickerField from '../components/DatePickerField'
import { notifyDataChanged } from '../utils/dashboardStore'
import toast from 'react-hot-toast'
import { extractError } from '../api/extractError'
import { Plus, Trash2, Send } from 'lucide-react'

export default function JurnalPage() {
  const [jurnal, setJurnal] = useState([])
  const [akunList, setAkunList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ no_bukti: '', tanggal: localDateStr(new Date()), deskripsi: '', detail: [{ kode_akun: '', debit: 0, kredit: 0, keterangan: '' }] })

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      client.get('/accounting/jurnal'),
      client.get('/accounting/akun'),
    ])
      .then(([j, a]) => { setJurnal(j.data); setAkunList(a.data) })
      .catch(() => toast.error('Gagal memuat data'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const addRow = () => setForm({ ...form, detail: [...form.detail, { kode_akun: '', debit: 0, kredit: 0, keterangan: '' }] })
  const removeRow = (i) => setForm({ ...form, detail: form.detail.filter((_, j) => j !== i) })
  const setRow = (i, k, v) => {
    const detail = [...form.detail]
    detail[i] = { ...detail[i], [k]: v }
    setForm({ ...form, detail })
  }

  const totalDebit = form.detail.reduce((s, d) => s + (parseFloat(d.debit) || 0), 0)
  const totalKredit = form.detail.reduce((s, d) => s + (parseFloat(d.kredit) || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalKredit) < 0.01 && totalDebit > 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isBalanced) return toast.error('Jurnal tidak balance!')
    try {
      await client.post('/accounting/jurnal', form)
      toast.success('Jurnal berhasil dibuat')
      setShowForm(false)
      setForm({ no_bukti: '', tanggal: localDateStr(new Date()), deskripsi: '', detail: [{ kode_akun: '', debit: 0, kredit: 0, keterangan: '' }] })
      notifyDataChanged()
      load()
    } catch (err) {
      toast.error(extractError(err, 'Gagal membuat jurnal'))
    }
  }

  const columns = [
    { header: 'No. Bukti', accessor: 'no_bukti', render: r => <span className="font-mono text-xs">{r.no_bukti}</span> },
    { header: 'Tanggal', accessor: 'tanggal', render: r => formatDate(r.tanggal) },
    { header: 'Deskripsi', accessor: 'deskripsi' },
    { header: 'Detail', accessor: 'detail', render: r => (
      <div className="text-xs space-y-0.5">
        {r.detail.map((d, i) => (
          <div key={i} className="flex gap-2">
            <span className="font-mono">{d.kode_akun}</span>
            {d.debit > 0 && <span style={{ color: '#10B981' }}>{formatRupiah(d.debit)}</span>}
            {d.kredit > 0 && <span style={{ color: '#F87171' }}>{formatRupiah(d.kredit)}</span>}
          </div>
        ))}
      </div>
    )},
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-slate-heading)' }}>Jurnal Umum</h1>
          <p className="text-sm" style={{ color: 'var(--color-slate-body)' }}>Pencatatan transaksi harian</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={16} /> Buat Jurnal</button>
      </div>

      {loading ? <LoadingSpinner className="mt-10" /> : (
        <DataTable columns={columns} data={jurnal} emptyMessage="Belum ada jurnal" />
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)} style={{ background: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto card card-frost" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-slate-heading)' }}>Buat Jurnal Baru</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">No. Bukti</label>
                  <input required value={form.no_bukti} onChange={e => setForm({...form, no_bukti: e.target.value})} className="input-field" placeholder="JV-001" />
                </div>
                <div>
                  <DatePickerField
                    label="Tanggal"
                    value={form.tanggal}
                    onChange={v => setForm({...form, tanggal: v})}
                    placeholder="Pilih tanggal transaksi"
                    required
                  />
                </div>
                <div>
                  <label className="label">Deskripsi</label>
                  <input required value={form.deskripsi} onChange={e => setForm({...form, deskripsi: e.target.value})} className="input-field" placeholder="Penjualan tunai" />
                </div>
              </div>

              <div>
                <label className="label">Detail Jurnal</label>
                <div className="space-y-2">
                  {form.detail.map((row, i) => (
                    <div key={i} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <select value={row.kode_akun} onChange={e => setRow(i, 'kode_akun', e.target.value)} className="input-field text-xs" required>
                          <option value="">Pilih Akun</option>
                          {akunList.map(a => <option key={a.id} value={a.kode_akun}>{a.kode_akun} - {a.nama_akun}</option>)}
                        </select>
                      </div>
                      <div className="w-28">
                        <input type="number" min="0" step="any" value={row.debit || ''} onChange={e => setRow(i, 'debit', e.target.value)} className="input-field text-xs" placeholder="Debit" />
                      </div>
                      <div className="w-28">
                        <input type="number" min="0" step="any" value={row.kredit || ''} onChange={e => setRow(i, 'kredit', e.target.value)} className="input-field text-xs" placeholder="Kredit" />
                      </div>
                      <div className="flex-1">
                        <input value={row.keterangan} onChange={e => setRow(i, 'keterangan', e.target.value)} className="input-field text-xs" placeholder="Keterangan" />
                      </div>
                      {form.detail.length > 2 && (
                        <button type="button" onClick={() => removeRow(i)} className="p-2 rounded-xl transition hover:bg-red-500/10" style={{ color: '#F87171' }}><Trash2 size={14} /></button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addRow} className="mt-2 text-xs font-medium transition hover:opacity-80" style={{ color: 'var(--color-brand-soft)' }}>+ Tambah Baris</button>
              </div>

              <div className="flex items-center justify-between rounded-xl p-3 text-sm" style={{ background: 'var(--color-surface-card)', border: '1px solid rgba(148, 163, 184, 0.14)' }}>
                <span className="text-[var(--color-slate-text)]">Total Debit: <strong className="text-[var(--color-slate-heading)]">{formatRupiah(totalDebit)}</strong></span>
                <span className="text-[var(--color-slate-text)]">Total Kredit: <strong className="text-[var(--color-slate-heading)]">{formatRupiah(totalKredit)}</strong></span>
                <span className="font-medium" style={{ color: isBalanced ? '#10B981' : '#F87171' }}>
                  {isBalanced ? 'Balance' : 'Tidak Balance'}
                </span>
              </div>

              <button type="submit" disabled={!isBalanced} className="btn-primary w-full"><Send size={16} /> Simpan Jurnal</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
