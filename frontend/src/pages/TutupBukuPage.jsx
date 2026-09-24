import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import client from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'
import { extractError } from '../api/extractError'
import { formatRupiah } from '../utils/formatters'
import { BookMarked, CheckCircle2, Lock, LockOpen, Loader2, X, TrendingUp, TrendingDown, Info, Sparkles } from 'lucide-react'

function formatTanggal(v) {
  if (!v) return '-'
  try {
    return new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return v
  }
}

function BadgeClosed({ closed }) {
  const style = closed
    ? { background: 'rgba(16, 185, 129, 0.12)', color: '#34D399', border: '1px solid rgba(16, 185, 129, 0.3)' }
    : { background: 'rgba(245, 158, 11, 0.12)', color: '#FBBF24', border: '1px solid rgba(245, 158, 11, 0.3)' }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={style}>
      {closed ? <Lock size={12} /> : <LockOpen size={12} />}
      {closed ? 'Ditutup' : 'Terbuka'}
    </span>
  )
}

function Ac({ kode, nama, saldo }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="font-mono text-[11px] w-14 shrink-0" style={{ color: 'var(--color-brand-soft)' }}>{kode}</span>
      <span className="flex-1 text-xs min-w-0 truncate" style={{ color: 'var(--color-slate-text)' }}>{nama}</span>
      <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--color-slate-heading)' }}>{formatRupiah(saldo)}</span>
    </div>
  )
}

export default function TutupBukuPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [review, setReview] = useState(null)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    client.get('/accounting/tutup-buku/status')
      .then(r => setRows(r.data || []))
      .catch(() => toast.error('Gagal memuat status tutup buku'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const openModal = (tahun) => {
    setSelected(tahun)
    setReview(null)
    setReviewLoading(true)
    client.get(`/accounting/tutup-buku/${tahun}/review`)
      .then(r => setReview(r.data))
      .catch((err) => toast.error(extractError(err, 'Gagal memuat ringkasan')))
      .finally(() => setReviewLoading(false))
  }

  const confirm = () => {
    if (!selected || submitting) return
    setSubmitting(true)
    client.post('/accounting/tutup-buku', { tahun: selected })
      .then((r) => {
        toast.success(`Tutup buku ${r.data.tahun} berhasil — jurnal ${r.data.jurnal_penutup_no_bukti}`)
        setSelected(null)
        load()
      })
      .catch((err) => toast.error(extractError(err, 'Gagal menutup buku')))
      .finally(() => setSubmitting(false))
  }

  const hasData = rows.length > 0
  const sorted = [...rows].sort((a, b) => b.tahun - a.tahun)
  const isRugi = review != null && review.laba_bersih < 0

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.25)', color: 'var(--color-brand-soft)' }}>
          <BookMarked size={22} />
        </div>
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: 'var(--color-slate-heading)' }}>Tutup Buku</h1>
          <p className="text-sm mt-1 max-w-2xl" style={{ color: 'var(--color-slate-body)' }}>
            Tutup buku menutup periode tahunan pembukuan: akun Pendapatan dan Beban dipindahkan ke <b>Laba Ditahan</b>,
            saldo Prive ditutup ke Modal Pemilik, lalu seluruh jurnal di tahun tersebut dikunci agar tidak bisa diubah lagi.
          </p>
        </div>
      </div>

      {/* List tahun */}
      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : !hasData ? (
        <div className="card flex flex-col items-center gap-3 py-16 text-center" style={{ border: '1px solid var(--color-border-subtle)' }}>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(148, 163, 184, 0.1)', color: 'var(--color-slate-muted)' }}>
            <BookMarked size={26} />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-slate-heading)' }}>Belum ada jurnal</p>
          <p className="text-xs max-w-sm" style={{ color: 'var(--color-slate-muted)' }}>
            Catat atau upload transaksi dulu supaya Finora bisa menyusun pembukuan. Setelah ada jurnal, tahun fiskalnya akan muncul di sini untuk ditutup.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(row => (
            <div key={row.tahun} className="card flex flex-col sm:flex-row sm:items-center gap-3 !p-4" style={{ border: '1px solid var(--color-border-subtle)' }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)', boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)' }}>
                  <span className="text-sm font-extrabold">{String(row.tahun).slice(2)}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }}>Tahun {row.tahun}</span>
                    <BadgeClosed closed={row.is_closed} />
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-slate-muted)' }}>
                    {row.is_closed
                      ? `Ditutup per ${formatTanggal(row.tanggal_tutup)}`
                      : 'Periode masih terbuka'}
                  </p>
                </div>
              </div>

              <div className="sm:ml-auto flex items-center gap-3 sm:gap-4">
                {row.is_closed ? (
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-slate-muted)' }}>Laba Bersih</p>
                    <p className="text-sm font-extrabold tabular-nums" style={{ color: (row.laba_bersih ?? 0) >= 0 ? '#34D399' : '#F87171' }}>
                      {formatRupiah(row.laba_bersih ?? 0)}
                    </p>
                  </div>
                ) : (
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-slate-muted)' }}>Status</p>
                    <p className="text-sm font-semibold" style={{ color: '#FBBF24' }}>Siap ditutup</p>
                  </div>
                )}
                {!row.is_closed && (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => openModal(row.tahun)}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl text-white"
                    style={{ background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)', boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)' }}
                  >
                    <Lock size={14} />
                    Tutup Buku
                  </motion.button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info penting */}
      {hasData && (
        <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-xs" style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', color: 'var(--color-slate-body)' }}>
          <Info size={15} className="shrink-0 mt-0.5" style={{ color: 'var(--color-brand-soft)' }} />
          <p>
            Tutup buku bersifat <b>permanen dan tidak bisa dibatalkan</b>. Setelah ditutup, semua jurnal di tahun tersebut dikunci —
            pastikan saldo sudah sesuai (misal sudah menjalankan jurnal penyesuaian) sebelum melanjutkan.
          </p>
        </div>
      )}

      {/* Modal konfirmasi */}
      <AnimatePresence>
        {selected != null && (
          <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[8vh] pb-8" onClick={() => !submitting && setSelected(null)}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
              style={{ background: 'rgba(2, 6, 18, 0.62)', backdropFilter: 'blur(6px)' }}
            />
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="relative w-full max-w-lg overflow-hidden rounded-2xl"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-soft)', boxShadow: '0 32px 80px var(--color-shadow)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(59, 130, 246, 0.12)', color: 'var(--color-brand-soft)' }}>
                  <Lock size={16} />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }}>Tutup Buku Tahun {selected}</h3>
                  <p className="text-[11px]" style={{ color: 'var(--color-slate-muted)' }}>Per tanggal 31 Desember {selected}</p>
                </div>
                <button onClick={() => !submitting && setSelected(null)} className="p-1.5 rounded-lg transition hover:bg-white/5" style={{ color: 'var(--color-slate-muted)' }}>
                  <X size={16} />
                </button>
              </div>

              <div className="max-h-[52vh] overflow-y-auto px-5 py-4 space-y-4">
                {reviewLoading || !review ? (
                  <div className="flex justify-center py-10"><LoadingSpinner /></div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl px-3 py-2.5 text-center" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.22)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-accent-emerald)' }}>Pendapatan</p>
                        <p className="text-sm font-extrabold tabular-nums" style={{ color: '#34D399' }}>{formatRupiah(review.total_pendapatan)}</p>
                      </div>
                      <div className="rounded-xl px-3 py-2.5 text-center" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.22)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#F87171' }}>Beban</p>
                        <p className="text-sm font-extrabold tabular-nums" style={{ color: '#F87171' }}>{formatRupiah(review.total_beban)}</p>
                      </div>
                      <div className="rounded-xl px-3 py-2.5 text-center" style={{ background: isRugi ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', border: `1px solid ${isRugi ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}` }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: isRugi ? '#F87171' : '#34D399' }}>{isRugi ? 'Rugi' : 'Laba'}</p>
                        <p className="text-sm font-extrabold tabular-nums" style={{ color: isRugi ? '#F87171' : '#34D399' }}>{formatRupiah(Math.abs(review.laba_bersih))}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--color-accent-emerald)' }}>
                          <TrendingUp size={13} /> Akun Pendapatan
                        </p>
                        {review.pendapatan.length ? (
                          review.pendapatan.map(a => <Ac key={a.kode_akun} kode={a.kode_akun} nama={a.nama_akun} saldo={a.saldo} />)
                        ) : (
                          <p className="text-xs py-1.5" style={{ color: 'var(--color-slate-muted)' }}>Tidak ada</p>
                        )}
                      </div>
                      <div>
                        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: '#F87171' }}>
                          <TrendingDown size={13} /> Akun Beban
                        </p>
                        {review.beban.length ? (
                          review.beban.map(a => <Ac key={a.kode_akun} kode={a.kode_akun} nama={a.nama_akun} saldo={a.saldo} />)
                        ) : (
                          <p className="text-xs py-1.5" style={{ color: 'var(--color-slate-muted)' }}>Tidak ada</p>
                        )}
                      </div>
                    </div>

                    {review.prive > 0 && (
                      <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', color: 'var(--color-slate-body)' }}>
                        Prive sebesar <b>{formatRupiah(review.prive)}</b> akan ditutup ke Modal Pemilik.
                      </p>
                    )}

                    <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs" style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', color: 'var(--color-slate-body)' }}>
                      <Sparkles size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--color-brand-soft)' }} />
                      <p>
                        Sistem akan membuat <b>Jurnal Penutup</b> (nomor otomatis) yang memindahkan saldo ke Laba Ditahan,
                        lalu <b>mengunci semua jurnal</b> tahun {selected}. Tindakan ini tidak bisa dibatalkan.
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 justify-end px-5 py-4" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                <button
                  onClick={() => setSelected(null)}
                  disabled={submitting}
                  className="text-xs font-semibold px-4 py-2.5 rounded-xl transition hover:bg-white/5 disabled:opacity-40"
                  style={{ color: 'var(--color-slate-body)' }}
                >
                  Batal
                </button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={confirm}
                  disabled={submitting || reviewLoading || !review}
                  className="flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl text-white disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #047857, #10B981)', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)' }}
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  {submitting ? 'Memproses...' : `Ya, Tutup Buku ${selected}`}
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}