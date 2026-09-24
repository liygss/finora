import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import client from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import { formatRupiah, formatDateTime } from '../utils/formatters'
import { notifyDataChanged } from '../utils/dashboardStore'
import toast from 'react-hot-toast'
import { extractError } from '../api/extractError'
import { Upload, FileText, CheckCircle, XCircle, Clock, UploadCloud, Trash2, LayoutDashboard, TrendingUp, TrendingDown, Banknote, BarChart3, Sparkles, FileSpreadsheet, MessageCircle } from 'lucide-react'

const STATUS_ICON = {
  UPLOADED: <Clock size={14} style={{ color: '#F59E0B' }} />,
  STAGED: <Clock size={14} style={{ color: '#F59E0B' }} />,
  PROCESSING: <LoadingSpinner size="sm" />,
  NORMALIZED: <LoadingSpinner size="sm" />,
  INGESTED: <CheckCircle size={14} style={{ color: '#10B981' }} />,
  POSTED: <CheckCircle size={14} style={{ color: '#10B981' }} />,
  FAILED: <XCircle size={14} style={{ color: '#EF4444' }} />,
}

const STATUS_LABEL = {
  UPLOADED: 'Menunggu',
  STAGED: 'Siap Dianalisis',
  PROCESSING: 'Diproses',
  NORMALIZED: 'Dinormalisasi',
  INGESTED: 'Tersimpan',
  POSTED: 'Berhasil',
  FAILED: 'Gagal',
}

const STATUS_COLOR = {
  UPLOADED: '#FBBF24',
  STAGED: '#FBBF24',
  PROCESSING: '#FBBF24',
  NORMALIZED: '#FBBF24',
  INGESTED: '#34D399',
  POSTED: '#34D399',
  FAILED: '#F87171',
}

const PENDING_STATUS = ['UPLOADED', 'PROCESSING', 'NORMALIZED']
const STAGED_STATUS = ['STAGED']
const DONE_STATUS = ['POSTED', 'INGESTED']

function SummaryCard({ summary }) {
  if (!summary) {
    return (
      <div className="card space-y-4">
        <div className="skeleton h-5 w-40 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const labaTahun = summary.laba_rugi_tahun_berjalan
  const labaBulan = summary.laba_rugi_bulan_ini
  const isEmpty = summary.total_kas_dan_bank === 0 && summary.jumlah_transaksi_bulan_ini === 0
  const bulanLabel = summary.tanggal_per
    ? new Date(summary.tanggal_per + 'T00:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
    : 'Bulan Ini'

  return (
    <div className="card relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ background: 'linear-gradient(135deg, #10B981 0%, #2563EB 100%)' }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-slate-heading)' }}>
            <BarChart3 size={16} style={{ color: 'var(--color-brand-soft)' }} />
            Ringkasan Laba/Rugi
          </h3>
          <span className="text-xs px-2 py-1 rounded-xl" style={{ color: 'var(--color-slate-body)', background: 'var(--color-surface-card)' }}>
            Data per {summary.tanggal_per || '-'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl p-4" style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
            <div className="flex items-center gap-2 text-xs font-medium" style={{ color: '#6EE7B7' }}>
              <TrendingUp size={13} /> Pendapatan Tahun Berjalan
            </div>
            <p className="mt-1.5 text-xl font-extrabold tabular-nums" style={{ color: '#34D399' }}>{formatRupiah(summary.total_pendapatan_tahun_berjalan)}</p>
          </div>
          <div className="rounded-2xl p-4" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            <div className="flex items-center gap-2 text-xs font-medium" style={{ color: '#FCA5A5' }}>
              <TrendingDown size={13} /> Beban Tahun Berjalan
            </div>
            <p className="mt-1.5 text-xl font-extrabold tabular-nums" style={{ color: '#F87171' }}>{formatRupiah(summary.total_beban_tahun_berjalan)}</p>
          </div>
          <div className="rounded-2xl p-4" style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
            <div className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--color-accent-blue)' }}>
              <Banknote size={13} /> Laba/Rugi Tahun Berjalan
            </div>
            <p className="mt-1.5 text-xl font-extrabold tabular-nums" style={{ color: labaTahun >= 0 ? 'var(--color-brand-soft)' : '#F87171' }}>{formatRupiah(labaTahun)}</p>
          </div>
          <div className="rounded-2xl p-4" style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
            <div className="flex items-center gap-2 text-xs font-medium" style={{ color: '#FCD34D' }}>
              <Sparkles size={13} /> Laba/Rugi {bulanLabel}
            </div>
            <p className="mt-1.5 text-xl font-extrabold tabular-nums" style={{ color: labaBulan >= 0 ? '#FBBF24' : '#F87171' }}>{formatRupiah(labaBulan)}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs" style={{ color: 'var(--color-slate-body)' }}>
          {isEmpty ? (
            <span className="flex items-center gap-1.5">
              <Clock size={13} /> Belum ada data transaksi. Setelah upload selesai diproses, ringkasan ini langsung terisi.
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <FileText size={13} /> {summary.jumlah_transaksi_bulan_ini} transaksi bulan ini &middot; Saldo kas &amp; bank {formatRupiah(summary.total_kas_dan_bank)}
            </span>
          )}
          <Link to="/" className="ml-auto flex items-center gap-1 font-semibold whitespace-nowrap" style={{ color: 'var(--color-brand-soft)' }}>
            <LayoutDashboard size={13} /> Lihat Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function UploadPage() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [summary, setSummary] = useState(null)
  const navigate = useNavigate()

  const load = () => {
    client.get('/upload/')
      .then(r => setFiles(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const fetchSummary = useCallback(() => {
    client.get('/dashboard/summary')
      .then(r => setSummary(r.data))
      .catch(() => {})
  }, [])

  useEffect(() => { load() }, [])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  // Sinkron summary saat data berubah dari halaman lain (upload/delete/reset)
  useEffect(() => {
    const onDataChanged = () => fetchSummary()
    window.addEventListener('data-changed', onDataChanged)
    return () => window.removeEventListener('data-changed', onDataChanged)
  }, [fetchSummary])

  const pendingCount = files.filter(f => PENDING_STATUS.includes(f.status)).length
  const stagedCount = files.filter(f => STAGED_STATUS.includes(f.status)).length

  // Polling status proses: file yang sedang diproses dipantau terus sampai selesai,
  // supaya user langsung tahu data sudah siap / gagal diproses.
  useEffect(() => {
    if (loading) return
    const allPending = [...files.filter(x => PENDING_STATUS.includes(x.status)), ...files.filter(x => STAGED_STATUS.includes(x.status))]
    if (allPending.length === 0) return
    const poll = async () => {
      for (const f of allPending) {
        try {
          const { data } = await client.get(`/upload/${f.id}`)
          setFiles(prev => prev.map(x => (x.id === data.id ? data : x)))
          if (DONE_STATUS.includes(data.status)) {
            toast.success(`${data.original_filename} berhasil diproses`)
            notifyDataChanged()
            fetchSummary()
          } else if (data.status === 'FAILED') {
            toast.error(`${data.original_filename} gagal diproses: ${data.error_message || 'periksa kembali file Anda'}`)
          }
        } catch {
          /* ignore sementara, coba lagi di tick berikutnya */
        }
      }
    }
    const timer = setInterval(poll, 2000)
    return () => clearInterval(timer)
  }, [loading, files, fetchSummary])

  const deleteFile = async (id, filename) => {
    if (!confirm(`Hapus file "${filename}"?`)) return
    try {
      await client.delete(`/upload/${id}`)
      toast.success(`${filename} dihapus`)
      notifyDataChanged()
      fetchSummary()
      load()
    } catch {
      toast.error('Gagal menghapus file')
    }
  }

  const upload = async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    setUploading(true)
    try {
      const { data } = await client.post('/upload/file', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success(`${file.name} terupload! Siap dianalisis.`)
      notifyDataChanged()
      load()
      // Redirect ke chat dengan upload_id supaya user bisa ngechat data dulu
      navigate(`/dashboard?upload_id=${data.id}`)
    } catch (err) {
      toast.error(extractError(err, `Gagal upload ${file.name}`))
    } finally {
      setUploading(false)
    }
  }

  const resetAll = async () => {
    if (!confirm('Hapus SEMUA data Anda (semua file upload, jurnal, dan data dashboard)? Tindakan ini tidak bisa dibatalkan.')) return
    try {
      await client.delete('/upload/reset')
      toast.success('Semua data berhasil dihapus')
      notifyDataChanged()
      fetchSummary()
      load()
    } catch {
      toast.error('Gagal menghapus semua data')
    }
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }, [])

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) upload(file)
    e.target.value = ''
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  return (
    <div className="space-y-4">
      {/* Header + action buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: 'var(--color-slate-heading)' }}>Upload File</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-slate-muted)' }}>Upload CSV/XLSX/PDF untuk dianalisis oleh AI sebelum masuk jurnal</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/" className="btn-primary text-xs !py-2">
            <LayoutDashboard size={14} /> Dashboard
          </Link>
          <button
            onClick={resetAll}
            className="flex items-center gap-1.5 rounded-lg text-xs font-medium px-2 py-2 transition-all duration-200 hover:bg-red-500/10"
            style={{ color: '#F87171', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)' }}
          >
            <Trash2 size={13} /> Hapus Semua
          </button>
        </div>
      </div>

      {/* ===== HERO BUDDY — chat style ===== */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.1 }}
        className="card relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #10B981 100%)' }} />
        <div className="relative flex items-start gap-4 py-5 px-5">
          {/* Buddy avatar + pulse */}
          <div className="relative shrink-0">
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="h-20 w-20 rounded-full animate-pulse-ring" style={{ border: '2px solid rgba(59, 130, 246, 0.2)' }} />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="h-16 w-16 rounded-full animate-pulse-ring" style={{ border: '1.5px solid rgba(96, 165, 250, 0.15)', animationDelay: '0.5s' }} />
            </div>
            <motion.div
              initial={{ scale: 0, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.2 }}
              className="relative z-10"
            >
              <div className="rounded-2xl p-2.5 overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.25), rgba(59,130,246,0.1))', border: '1px solid rgba(96, 165, 250, 0.3)', boxShadow: '0 8px 30px rgba(59, 130, 246, 0.15)' }}>
                <img src="/assets/buddy/buddy-happy.png" alt="Buddy" className="h-10 w-10 object-contain" />
              </div>
            </motion.div>
          </div>

          {/* Chat bubble */}
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex-1 min-w-0"
          >
            <div className="inline-block rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed" style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-slate-text)' }}>
              <span className="font-bold" style={{ color: 'var(--color-brand-soft)' }}>Halo! 👋</span> Upload file transaksimu di sini, nanti aku <span className="font-semibold">analisis dulu</span> sebelum masuk ke jurnal. Kamu bisa chat tentang datanya dulu!
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* ===== Upload zone — upgraded ===== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className="card border-2 border-dashed cursor-pointer transition-all duration-300"
          style={{ borderColor: dragging ? 'var(--color-brand-soft)' : 'rgba(148, 163, 184, 0.2)', background: dragging ? 'rgba(37, 99, 235, 0.06)' : 'var(--color-surface-faint)' }}
        >
          <label className="flex flex-col items-center gap-3 cursor-pointer py-8">
            <motion.div
              animate={dragging ? { scale: 1.1, y: -4 } : { scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="relative"
            >
              <div className="rounded-2xl p-5 transition-all duration-300" style={{ background: dragging ? 'rgba(37, 99, 235, 0.18)' : 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(16,185,129,0.1))', boxShadow: dragging ? '0 8px 32px rgba(59, 130, 246, 0.2)' : '0 4px 16px rgba(59, 130, 246, 0.08)' }}>
                <UploadCloud size={36} style={{ color: dragging ? '#2563EB' : 'var(--color-brand-soft)' }} />
              </div>
              {dragging && (
                <span className="absolute -inset-1 rounded-3xl animate-pulse-ring" style={{ border: '2px solid rgba(59, 130, 246, 0.3)' }} />
              )}
            </motion.div>
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: 'var(--color-slate-heading)' }}>{uploading ? 'Mengupload...' : 'Seret & lepas file di sini'}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-slate-muted)' }}>atau klik untuk memilih file</p>
            </div>

            {/* Format badges */}
            <div className="flex items-center gap-2">
              {['CSV', 'XLSX', 'PDF'].map(fmt => (
                <span key={fmt} className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg" style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-slate-body)' }}>
                  {fmt === 'XLSX' ? <FileSpreadsheet size={10} /> : <FileText size={10} />}
                  .{fmt.toLowerCase()}
                </span>
              ))}
              <span className="text-[10px]" style={{ color: 'var(--color-slate-muted)' }}>(maks. 25 MB)</span>
            </div>

            <input type="file" className="hidden" accept=".csv,.xlsx,.xls,.pdf" onChange={handleFileSelect} disabled={uploading} />
            {!uploading && (
              <span className="btn-primary text-xs">
                <Upload size={14} /> Pilih File
              </span>
            )}
            {uploading && (
              <div className="w-48 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-card)' }}>
                <div className="h-full rounded-full animate-pulse" style={{ background: 'linear-gradient(90deg, #3B82F6, #10B981)', width: '60%' }} />
              </div>
            )}
          </label>
        </div>
      </motion.div>

      {pendingCount > 0 && (
        <div className="card flex items-center gap-3 text-sm" style={{ color: '#FBBF24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
          <LoadingSpinner size="sm" />
          <span>Sedang memproses {pendingCount} file... Tunggu sampai status berubah.</span>
        </div>
      )}

      {stagedCount > 0 && (
        <div className="card flex items-center gap-3 text-sm" style={{ color: '#3B82F6', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <Sparkles size={14} />
          <span>{stagedCount} file sedang menunggu analisis. <strong>Buka chat</strong> untuk mengeksplorasi datanya sebelum masuk jurnal.</span>
        </div>
      )}

      <SummaryCard summary={summary} />

      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-slate-text)' }}>File yang Sudah Diupload</h3>
        {loading ? <LoadingSpinner className="mt-6" /> : files.length === 0 ? (
          <div className="card text-center py-8" style={{ background: 'var(--color-surface-faint)' }}>
            <img src="/assets/buddy/buddy-sad.png" alt="Buddy" className="h-14 w-14 mx-auto mb-3 object-contain opacity-70" />
            <p className="text-xs font-semibold" style={{ color: 'var(--color-slate-heading)' }}>Belum ada file yang diupload</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--color-slate-muted)' }}>Upload file CSV/XLSX/PDF transaksi untuk dianalisis oleh AI</p>
          </div>
        ) : (
          <div className="space-y-2">
            {files.map(f => (
              <div key={f.id} className="card flex items-center gap-4 !p-4">
                <FileText size={20} className="shrink-0" style={{ color: 'var(--color-slate-muted)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--color-slate-text)' }}>{f.original_filename}</p>
                  <p className="text-xs" style={{ color: 'var(--color-slate-muted)' }}>{f.file_type} &middot; {formatSize(f.file_size_bytes)} &middot; {formatDateTime(f.created_at)}</p>
                  {f.error_message && (
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: DONE_STATUS.includes(f.status) ? '#FBBF24' : '#F87171' }}
                    >
                      {f.error_message}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium shrink-0">
                  {STATUS_ICON[f.status]}
                  <span style={{ color: STATUS_COLOR[f.status] || '#D97706' }}>
                    {STATUS_LABEL[f.status] || f.status}
                  </span>
                </div>
                {STAGED_STATUS.includes(f.status) && (
                  <Link
                    to={`/dashboard?upload_id=${f.id}`}
                    className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:scale-105"
                    style={{ color: '#fff', background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)' }}
                  >
                    💬 Chat
                  </Link>
                )}
                <button
                  onClick={() => deleteFile(f.id, f.original_filename)}
                  className="shrink-0 p-1.5 rounded-xl transition hover:bg-red-500/10 hover:text-red-400"
                  style={{ color: 'var(--color-slate-muted)' }}
                  title="Hapus file"
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
