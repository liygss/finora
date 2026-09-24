import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import client from '../../api/client'
import { formatDateTime } from '../../utils/formatters'
import toast from 'react-hot-toast'
import { extractError } from '../../api/extractError'
import LoadingSpinner from '../LoadingSpinner'
import { Upload, FileText, CheckCircle, XCircle, Clock, UploadCloud, ChevronLeft, Trash2, Sparkles, FileSpreadsheet, MessageCircle } from 'lucide-react'

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

const SUGGESTIONS = [
  { text: 'Jelaskan isi file ini', icon: FileText },
  { text: 'Berapa total transaksi?', icon: FileSpreadsheet },
  { text: 'Akun mana yang paling besar?', icon: Sparkles },
]

export default function SetupStepUpload({ onBack, onFinish }) {
  const navigate = useNavigate()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [completing, setCompleting] = useState(false)

  const load = () => {
    client.get('/upload/')
      .then(r => setFiles(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const pendingCount = files.filter(f => PENDING_STATUS.includes(f.status)).length
  const stagedCount = files.filter(f => STAGED_STATUS.includes(f.status)).length
  const doneCount = files.filter(f => DONE_STATUS.includes(f.status)).length
  const failedCount = files.filter(f => f.status === 'FAILED').length
  const stagedFile = files.find(f => STAGED_STATUS.includes(f.status))

  // Polling status
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
          } else if (data.status === 'FAILED') {
            toast.error(`${data.original_filename} gagal: ${data.error_message || 'periksa file'}`)
          }
        } catch { /* ignore */ }
      }
    }
    const timer = setInterval(poll, 2000)
    return () => clearInterval(timer)
  }, [loading, files])

  const upload = async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    setUploading(true)
    try {
      const { data } = await client.post('/upload/file', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success(`${file.name} terupload! Siap dianalisis.`)
      load()
      navigate(`/dashboard?upload_id=${data.id}`)
    } catch (err) {
      toast.error(extractError(err, `Gagal upload ${file.name}`))
    } finally {
      setUploading(false)
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

  const deleteFile = async (id, filename) => {
    try {
      await client.delete(`/upload/${id}`)
      toast.success(`${filename} dihapus`)
      load()
    } catch {
      toast.error('Gagal menghapus file')
    }
  }

  const handleSuggestion = (text) => {
    if (stagedFile) {
      navigate(`/dashboard?upload_id=${stagedFile.id}`)
    } else {
      toast('Upload file dulu ya, nanti aku bantu analisis! 💡', { icon: '📎' })
    }
  }

  const handleFinish = async () => {
    setCompleting(true)
    try {
      await client.post('/setup/complete')
      onFinish()
    } catch {
      onFinish()
    } finally {
      setCompleting(false)
    }
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl transition hover:bg-white/5" style={{ color: 'var(--color-slate-body)' }}>
          <ChevronLeft size={18} />
        </button>
        <div>
          <h2 className="text-lg font-extrabold" style={{ color: 'var(--color-slate-heading)' }}>
            Upload Data Transaksi
          </h2>
          <p className="text-xs" style={{ color: 'var(--color-slate-muted)' }}>
            Upload file CSV/XLSX transaksi untuk dianalisis AI sebelum masuk jurnal
          </p>
        </div>
      </div>

      {/* ===== HERO BUDDY — bergaya chat ===== */}
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
              <span className="font-bold" style={{ color: 'var(--color-brand-soft)' }}>Halo! 👋</span> Aku <span className="font-bold" style={{ color: 'var(--color-brand-soft)' }}>Buddy</span>. Upload file transaksimu di sini, nanti aku <span className="font-semibold">analisis dulu</span> sebelum masuk ke jurnal.
            </div>

            {/* Suggestion chips */}
            <div className="flex flex-wrap gap-2 mt-3">
              {SUGGESTIONS.map((s, i) => (
                <motion.button
                  key={s.text}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + i * 0.08 }}
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleSuggestion(s.text)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all duration-200"
                  style={{
                    background: 'var(--color-surface-faint)',
                    border: '1px solid var(--color-border-subtle)',
                    color: 'var(--color-brand-soft)',
                    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.08)',
                  }}
                >
                  <s.icon size={11} />
                  {s.text}
                </motion.button>
              ))}
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
          data-hint="upload-zone"
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
                  {fmt === 'CSV' ? <FileText size={10} /> : fmt === 'XLSX' ? <FileSpreadsheet size={10} /> : <FileText size={10} />}
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

      {/* Staged banner */}
      {stagedCount > 0 && (
        <div className="card flex items-center gap-3 text-sm" style={{ color: '#3B82F6', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <MessageCircle size={14} />
          <span>{stagedCount} file siap dianalisis. <strong>Buka chat</strong> untuk mengeksplorasi datanya sebelum masuk jurnal.</span>
          {stagedFile && (
            <a href={`/dashboard?upload_id=${stagedFile.id}`} className="ml-auto shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:scale-105" style={{ color: '#fff', background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)' }}>
              💬 Chat
            </a>
          )}
        </div>
      )}

      {/* Processing indicator */}
      {pendingCount > 0 && (
        <div className="card flex items-center gap-3 text-sm" style={{ color: '#FBBF24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
          <LoadingSpinner size="sm" />
          <span className="text-xs">Sedang memproses {pendingCount} file...</span>
        </div>
      )}

      {/* Status summary */}
      {(doneCount > 0 || failedCount > 0) && (
        <div className="flex items-center gap-3 text-xs">
          {doneCount > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10B981' }}>
              <CheckCircle size={12} /> {doneCount} berhasil
            </span>
          )}
          {failedCount > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#EF4444' }}>
              <XCircle size={12} /> {failedCount} gagal
            </span>
          )}
          {pendingCount > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B' }}>
              <Clock size={12} /> {pendingCount} diproses
            </span>
          )}
        </div>
      )}

      {/* File list */}
      {!loading && files.length > 0 && (
        <div data-hint="upload-list" className="space-y-1.5">
          {files.map(f => (
            <div key={f.id} className="card flex items-center gap-3 !p-3">
              <FileText size={16} className="shrink-0" style={{ color: 'var(--color-slate-muted)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--color-slate-text)' }}>{f.original_filename}</p>
                <p className="text-[10px]" style={{ color: 'var(--color-slate-muted)' }}>{f.file_type} · {formatSize(f.file_size_bytes)} · {formatDateTime(f.created_at)}</p>
                {f.error_message && <p className="text-[10px] mt-0.5" style={{ color: '#F87171' }}>{f.error_message}</p>}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-medium shrink-0">
                {STATUS_ICON[f.status]}
                <span style={{ color: STATUS_COLOR[f.status] || '#D97706' }}>{STATUS_LABEL[f.status] || f.status}</span>
              </div>
              {STAGED_STATUS.includes(f.status) && (
                <a
                  href={`/dashboard?upload_id=${f.id}`}
                  className="shrink-0 flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-all hover:scale-105"
                  style={{ color: '#fff', background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)' }}
                >
                  💬 Chat
                </a>
              )}
              <button onClick={() => deleteFile(f.id, f.original_filename)} className="shrink-0 p-1 rounded-lg transition hover:bg-red-500/10" style={{ color: 'var(--color-slate-muted)' }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Empty state — buddy-sad */}
      {!loading && files.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card text-center py-8"
          style={{ background: 'var(--color-surface-faint)' }}
        >
          <img src="/assets/buddy/buddy-sad.png" alt="Buddy" className="h-14 w-14 mx-auto mb-3 object-contain opacity-70" />
          <p className="text-xs font-semibold" style={{ color: 'var(--color-slate-heading)' }}>Belum ada file yang diupload</p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--color-slate-muted)' }}>Upload file CSV/XLSX/PDF transaksi atau lewati langkah ini</p>
        </motion.div>
      )}

      {/* Navigation */}
      <div className="flex justify-between items-center pt-2">
        <button onClick={onBack} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition" style={{ color: 'var(--color-slate-body)', background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)' }}>
          <ChevronLeft size={16} /> Kembali
        </button>
        <button
          data-hint="btn-finish"
          onClick={handleFinish}
          disabled={completing || pendingCount > 0}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
          style={{ background: 'linear-gradient(135deg, #059669, #10B981)', boxShadow: '0 6px 20px rgba(16, 185, 129, 0.3)' }}
        >
          {completing ? 'Menyelesaikan...' : <><Sparkles size={16} /> Masuk ke Dashboard</>}
        </button>
      </div>
    </div>
  )
}
