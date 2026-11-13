import { useState, useEffect, useCallback, useRef } from 'react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'
import { buildAllReportsFullHtml } from '../utils/reportPdfBuilder'
import { formatRupiah, localDateStr } from '../utils/formatters'
import DatePickerField from '../components/DatePickerField'
import DateRangeField from '../components/DateRangeField'
import toast from 'react-hot-toast'
import { extractError } from '../api/extractError'
import { FileDown, FileSpreadsheet, FileText, TrendingUp, TrendingDown, Scale, AlertCircle, Loader2 } from 'lucide-react'

const TABS = [
  { key: 'neraca-saldo', label: 'Neraca Saldo', icon: Scale },
  { key: 'laba-rugi', label: 'Laba Rugi', icon: TrendingUp },
  { key: 'posisi-keuangan', label: 'Posisi Keuangan', icon: TrendingDown },
  { key: 'calk', label: 'CALK', icon: AlertCircle },
]

function usePdfDownload(date, user, startDate, endDate) {
  const [generating, setGenerating] = useState(false)

  const handleDownload = useCallback(async () => {
    setGenerating(true)

    try {
      const reports = ['neraca-saldo', 'laba-rugi', 'posisi-keuangan', 'calk']
      const results = await Promise.all(
        reports.map(rt => {
          const params = { tanggal_per: date }
          if (rt === 'laba-rugi' && startDate && endDate) {
            params.tanggal_mulai = startDate
            params.tanggal_akhir = endDate
          }
          return client.get(`/accounting/laporan/${rt}`, { params }).then(r => [rt, r.data])
        })
      )
      const allData = Object.fromEntries(results)

      const fullHtml = buildAllReportsFullHtml(allData, date, user)

      // Pakai hidden iframe (bukan window.open yang diblokir Electron)
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      document.body.appendChild(iframe)

      const doc = iframe.contentWindow.document
      doc.open()
      doc.write(fullHtml)
      doc.close()

      const waitForRender = () => {
        if (doc.readyState === 'complete') {
          setTimeout(() => {
            try {
              iframe.contentWindow.focus()
              iframe.contentWindow.print()
            } catch (e) {
              console.error('Print error:', e)
            }
            setTimeout(() => {
              document.body.removeChild(iframe)
            }, 1000)
            toast.success('Dialog print siap! Pilih "Save as PDF" untuk simpan.')
            setGenerating(false)
          }, 500)
        } else {
          setTimeout(waitForRender, 100)
        }
      }
      waitForRender()
    } catch (err) {
      console.error('PDF generation error:', err)
      toast.error('Gagal membuat PDF. Coba lagi.')
      setGenerating(false)
    }
  }, [date, user, startDate, endDate])

  return { handleDownload, generating }
}

function useExportDownload(date, startDate, endDate) {
  const [exporting, setExporting] = useState(false)

  const handleExport = useCallback(async (format) => {
    setExporting(true)
    try {
      const token = localStorage.getItem('token') || ''
      const baseURL = import.meta.env.VITE_API_URL || '/api'
      const ext = format === 'xlsx' ? 'xlsx' : 'csv'
      let url = `${baseURL}/accounting/laporan/export-all?format=${format}&tanggal_per=${date}`
      if (startDate && endDate) {
        url += `&tanggal_mulai=${startDate}&tanggal_akhir=${endDate}`
      }
      url += `&token=${encodeURIComponent(token)}`

      // Pakai direct <a> link (bukan blob) — otomatis trigger download
      // di browser maupun Electron (lewat will-download handler).
      const link = document.createElement('a')
      link.href = url
      link.download = `laporan-keuangan-semua-${date}.${ext}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setTimeout(() => {
        toast.success(`${ext.toUpperCase()} berhasil diunduh!`)
        setExporting(false)
      }, 1500)
    } catch (err) {
      console.error('Export error:', err)
      toast.error(`Gagal export ${format.toUpperCase()}. Coba lagi.`)
      setExporting(false)
    }
  }, [date, startDate, endDate])

  return { handleExport, exporting }
}

export default function ReportsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('neraca-saldo')
  const [date, setDate] = useState(localDateStr(new Date()))
  const [debouncedDate, setDebouncedDate] = useState(date)
  const debounceRef = useRef(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [debouncedStart, setDebouncedStart] = useState('')
  const [debouncedEnd, setDebouncedEnd] = useState('')

  const handleDateChange = (newDate) => {
    setDate(newDate)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedDate(newDate), 300)
  }

  const handleStartDateChange = (v) => {
    setStartDate(v)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedStart(v), 300)
  }

  const handleEndDateChange = (v) => {
    setEndDate(v)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedEnd(v), 300)
  }

  const { handleDownload: downloadPdf, generating: pdfGenerating } = usePdfDownload(debouncedDate, user, debouncedStart, debouncedEnd)
  const { handleExport, exporting } = useExportDownload(debouncedDate, debouncedStart, debouncedEnd)

  const load = useCallback(() => {
    setLoading(true)
    setData(null)
    setError(null)
    const params = { tanggal_per: debouncedDate }
    if (tab === 'laba-rugi' && debouncedStart && debouncedEnd) {
      params.tanggal_mulai = debouncedStart
      params.tanggal_akhir = debouncedEnd
    }
    const url = `/accounting/laporan/${tab}`
    client.get(url, { params })
      .then(r => setData(r.data))
      .catch((err) => {
        const msg = extractError(err, 'Gagal memuat laporan')
        setError(msg)
        toast.error(msg)
      })
      .finally(() => setLoading(false))
  }, [tab, debouncedDate, debouncedStart, debouncedEnd])

  useEffect(() => { load() }, [load])

  const isBusy = pdfGenerating || exporting

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">
            <span className="gradient-text">Laporan Keuangan</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-slate-body)' }}>Neraca saldo, laba rugi, posisi keuangan & CALK</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DatePickerField
            value={date}
            onChange={v => handleDateChange(v)}
            label="Tanggal Laporan"
            placeholder="Pilih tanggal laporan"
            compact
            className="w-auto"
          />
          {tab === 'laba-rugi' && (
            <DateRangeField
              startDate={startDate}
              endDate={endDate}
              onStartChange={handleStartDateChange}
              onEndChange={handleEndDateChange}
              label="Periode"
              className="w-auto"
            />
          )}
          <button
            onClick={() => {
              const today = localDateStr(new Date())
              setDate(today)
              setDebouncedDate(today)
            }}
            className="text-xs font-medium px-2.5 py-2 rounded-lg transition-all duration-200"
            style={{ color: 'var(--color-brand-soft)', background: 'rgba(37, 99, 235, 0.12)' }}
          >
            Hari Ini
          </button>
          <div className="flex items-center gap-1 rounded-xl p-1 shadow-sm" style={{ background: 'var(--color-surface-card)', border: '1px solid rgba(148, 163, 184, 0.14)' }}>
            <button
              onClick={() => downloadPdf()}
              disabled={isBusy}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200"
              style={{
                background: !isBusy ? 'linear-gradient(135deg, #1D4ED8, #2563EB)' : 'rgba(148, 163, 184, 0.12)',
                color: !isBusy ? 'white' : 'var(--color-slate-muted)',
                cursor: !isBusy ? 'pointer' : 'not-allowed',
                boxShadow: !isBusy ? '0 4px 12px rgba(37, 99, 235, 0.3)' : 'none',
              }}
              title="Download semua laporan (Neraca Saldo, Laba Rugi, Posisi Keuangan, CALK)"
            >
              {pdfGenerating ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
              PDF (Semua)
            </button>
            <button
              onClick={() => handleExport('xlsx')}
              disabled={isBusy}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200"
              style={{
                background: !isBusy ? 'linear-gradient(135deg, #059669, #059669)' : 'rgba(148, 163, 184, 0.12)',
                color: !isBusy ? 'white' : 'var(--color-slate-muted)',
                cursor: !isBusy ? 'pointer' : 'not-allowed',
              }}
              title="Download semua laporan (Neraca Saldo, Laba Rugi, Posisi Keuangan, CALK)"
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
              Excel (Semua)
            </button>
            <button
              onClick={() => handleExport('csv')}
              disabled={isBusy}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200"
              style={{
                background: !isBusy ? 'linear-gradient(135deg, #D97706, #D97706)' : 'rgba(148, 163, 184, 0.12)',
                color: !isBusy ? 'white' : 'var(--color-slate-muted)',
                cursor: !isBusy ? 'pointer' : 'not-allowed',
              }}
              title="Download semua laporan (Neraca Saldo, Laba Rugi, Posisi Keuangan, CALK)"
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              CSV (Semua)
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-1 rounded-xl p-1 shadow-sm" style={{ background: 'var(--color-surface-card)', border: '1px solid rgba(148, 163, 184, 0.14)' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setData(null); setTab(t.key) }}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200"
            style={tab === t.key ? {
              background: 'linear-gradient(135deg, #1D4ED8, #2563EB)',
              color: 'white',
              boxShadow: '0 4px 14px rgba(15,23,42,0.12)',
            } : {
              color: 'var(--color-slate-body)',
            }}
          >
            <t.icon size={14} />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {data && tab === 'neraca-saldo' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
          <div className="card !p-4 flex items-center gap-3 hover:-translate-y-0.5">
            <div className="rounded-xl p-2.5" style={{ background: 'rgba(5, 150, 105, 0.12)' }}>
              <TrendingUp size={18} style={{ color: 'var(--color-accent-emerald)' }} />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--color-slate-body)' }}>Total Debit</p>
              <p className="text-lg font-extrabold tabular-nums" style={{ color: 'var(--color-slate-heading)' }}>{formatRupiah(data.total_debit)}</p>
            </div>
          </div>
          <div className="card !p-4 flex items-center gap-3 hover:-translate-y-0.5">
            <div className="rounded-xl p-2.5" style={{ background: 'rgba(220, 38, 38, 0.12)' }}>
              <TrendingDown size={18} style={{ color: '#F87171' }} />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--color-slate-body)' }}>Total Kredit</p>
              <p className="text-lg font-extrabold tabular-nums" style={{ color: 'var(--color-slate-heading)' }}>{formatRupiah(data.total_kredit)}</p>
            </div>
          </div>
          <div className="card !p-4 flex items-center gap-3 hover:-translate-y-0.5">
            <div className="rounded-xl p-2.5" style={{ background: data.is_balance ? 'rgba(5, 150, 105, 0.12)' : 'rgba(220, 38, 38, 0.12)' }}>
              <Scale size={18} style={{ color: data.is_balance ? 'var(--color-accent-emerald)' : '#F87171' }} />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--color-slate-body)' }}>Status</p>
              <p className="text-lg font-extrabold" style={{ color: data.is_balance ? 'var(--color-accent-emerald)' : '#F87171' }}>
                {data.is_balance ? 'Balance' : 'Tidak Balance'}
              </p>
            </div>
          </div>
        </div>
      )}

      {loading ? <LoadingSpinner className="mt-10" /> : !data ? (
        error ? (
          <div className="card text-center py-10">
            <AlertCircle size={32} className="mx-auto mb-3" style={{ color: '#DC2626' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--color-slate-heading)' }}>{error}</p>
            <button onClick={load} className="btn-primary mt-4 !px-4 !py-2 text-sm">Coba Lagi</button>
          </div>
        ) : null
      ) : (
        <div className="card page-enter">
          {tab === 'neraca-saldo' && <NeracaSaldoView data={data} />}
          {tab === 'laba-rugi' && <LabaRugiView data={data} />}
          {tab === 'posisi-keuangan' && <PosisiKeuanganView data={data} />}
          {tab === 'calk' && <CalkView data={data} />}
        </div>
      )}
    </div>
  )
}

/* ================================================================
   Screen Views (for on-page display)
   ================================================================ */

function KategoriBadge({ kategori }) {
  const map = {
    ASET: 'badge-aset',
    LIABILITAS: 'badge-liabilitas',
    MODAL: 'badge-modal',
    PENDAPATAN: 'badge-pendapatan',
    BEBAN: 'badge-beban',
  }
  const cls = map[kategori]
  if (!cls) return (
    <span className="badge" style={{ background: 'rgba(148,163,184,0.12)', color: 'var(--color-slate-body)', border: '1px solid rgba(148,163,184,0.2)' }}>
      {kategori}
    </span>
  )
  return <span className={`badge ${cls}`}>{kategori}</span>
}

function NeracaSaldoView({ data }) {
  if (!data) return null
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold" style={{ color: 'var(--color-slate-heading)' }}>Neraca Saldo</h3>
        <span className="badge" style={{ background: data.is_balance ? 'rgba(5, 150, 105, 0.12)' : 'rgba(220, 38, 38, 0.12)', color: data.is_balance ? 'var(--color-accent-emerald)' : '#F87171' }}>
          {data.is_balance ? 'Balance' : 'Tidak Balance'}
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(148, 163, 184, 0.12)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '2px solid rgba(148, 163, 184, 0.2)' }}>
              <th className="tbl-header">Kode</th>
              <th className="tbl-header">Nama Akun</th>
              <th className="tbl-header">Kategori</th>
              <th className="tbl-header num-cell">Debit</th>
              <th className="tbl-header num-cell">Kredit</th>
            </tr>
          </thead>
          <tbody>
            {(data.baris || []).map((r, i) => (
              <tr key={i} className="tbl-row" style={{ animationDelay: `${i * 30}ms` }}>
                <td className="tbl-cell font-mono text-xs font-semibold" style={{ color: 'var(--color-brand-soft)' }}>{r.kode_akun}</td>
                <td className="tbl-cell font-medium" style={{ color: 'var(--color-slate-heading)' }}>{r.nama_akun}</td>
                <td className="tbl-cell"><KategoriBadge kategori={r.kategori} /></td>
                <td className="tbl-cell num-cell font-mono text-xs">{r.debit > 0 ? formatRupiah(r.debit) : '-'}</td>
                <td className="tbl-cell num-cell font-mono text-xs">{r.kredit > 0 ? formatRupiah(r.kredit) : '-'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold" style={{ borderTop: '2px solid rgba(37, 99, 235, 0.4)', background: 'rgba(37, 99, 235, 0.1)' }}>
              <td colSpan={3} className="py-3 px-6 uppercase tracking-wider text-xs" style={{ color: 'var(--color-accent-blue)' }}>Total</td>
              <td className="py-3 px-6 num-cell font-mono text-sm font-extrabold" style={{ color: 'var(--color-slate-heading)' }}>{formatRupiah(data.total_debit)}</td>
              <td className="py-3 px-6 num-cell font-mono text-sm font-extrabold" style={{ color: 'var(--color-slate-heading)' }}>{formatRupiah(data.total_kredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function LabaRugiView({ data }) {
  if (!data) return null
  return (
    <div className="space-y-5">
      <h3 className="font-bold" style={{ color: 'var(--color-slate-heading)' }}>Laporan Laba Rugi</h3>
      <Section title="Pendapatan" items={data.pendapatan || []} />
      <Section title="HPP" items={data.hpp || []} />
      <div className="flex justify-between pt-3 font-semibold text-sm" style={{ borderTop: '1px solid rgba(148, 163, 184, 0.12)' }}>
        <span className="text-[var(--color-slate-text)]">Laba Kotor</span>
        <span className="font-mono tabular-nums text-[var(--color-slate-heading)]">{formatRupiah(data.laba_kotor)}</span>
      </div>
      <Section title="Beban Operasional" items={data.beban_operasional || []} />
      <div className="flex justify-between pt-3 font-bold text-lg rounded-2xl p-4 -mx-4" style={{ borderTop: '2px solid rgba(37, 99, 235, 0.4)', background: 'rgba(37, 99, 235, 0.1)' }}>
        <span className="uppercase tracking-wider text-xs" style={{ color: 'var(--color-accent-blue)' }}>Laba Bersih</span>
        <span className="font-mono tabular-nums" style={{ color: data.laba_bersih >= 0 ? 'var(--color-accent-emerald)' : '#F87171' }}>{formatRupiah(data.laba_bersih)}</span>
      </div>
    </div>
  )
}

function PosisiKeuanganView({ data }) {
  if (!data) return null
  return (
    <div className="space-y-5">
      <h3 className="font-bold" style={{ color: 'var(--color-slate-heading)' }}>Laporan Posisi Keuangan</h3>
      <Section title="Aset" items={data.aset || []} total={data.total_aset} />
      <Section title="Liabilitas" items={data.liabilitas || []} total={data.total_liabilitas} />
      <Section title="Modal" items={data.modal || []} />
      <div className="flex justify-between pt-3 text-sm" style={{ borderTop: '1px solid rgba(148, 163, 184, 0.12)' }}>
        <span className="text-[var(--color-slate-text)]">Laba/Rugi Berjalan</span>
        <span className="font-mono font-medium tabular-nums text-[var(--color-slate-heading)]">{formatRupiah(data.laba_rugi_berjalan)}</span>
      </div>
      <div className="flex justify-between pt-3 font-bold text-lg rounded-2xl p-4 -mx-4" style={{ borderTop: '2px solid rgba(37, 99, 235, 0.4)', background: 'rgba(37, 99, 235, 0.1)' }}>
        <span className="uppercase tracking-wider text-xs" style={{ color: 'var(--color-accent-blue)' }}>Total Liabilitas + Modal</span>
        <span className="font-mono tabular-nums text-[var(--color-slate-heading)]">{formatRupiah(data.total_liabilitas_dan_modal)}</span>
      </div>
      <span className="badge" style={{ background: data.is_balance ? 'rgba(5, 150, 105, 0.12)' : 'rgba(220, 38, 38, 0.12)', color: data.is_balance ? 'var(--color-accent-emerald)' : '#F87171' }}>
        {data.is_balance ? 'Balance' : 'Tidak Balance'}
      </span>
    </div>
  )
}

function CalkView({ data }) {
  if (!data) return <p className="text-sm" style={{ color: 'var(--color-slate-muted)' }}>Tidak ada data CALK</p>
  return (
    <div className="space-y-5">
      <h3 className="font-bold" style={{ color: 'var(--color-slate-heading)' }}>Catatan Atas Laporan Keuangan (CALK)</h3>
      {data.kebijakan_akuntansi?.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-slate-text)' }}>Kebijakan Akuntansi</h4>
          <ul className="list-disc list-inside text-sm space-y-1 rounded-2xl p-4" style={{ color: 'var(--color-slate-body)', background: 'var(--color-surface-card)', border: '1px solid rgba(148, 163, 184, 0.14)' }}>
            {data.kebijakan_akuntansi.map((k, i) => <li key={i}>{k}</li>)}
          </ul>
        </div>
      )}
      <Section title="Rincian Aset" items={data.rincian_aset || []} showNote />
      <Section title="Rincian Liabilitas" items={data.rincian_liabilitas || []} showNote />
      <Section title="Rincian Pendapatan" items={data.rincian_pendapatan || []} showNote />
      <Section title="Rincian Beban" items={data.rincian_beban || []} showNote />
      {data.catatan_tambahan?.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-slate-text)' }}>Catatan Tambahan</h4>
          <ul className="list-disc list-inside text-sm space-y-1 rounded-2xl p-4" style={{ color: 'var(--color-slate-body)', background: 'var(--color-surface-card)', border: '1px solid rgba(148, 163, 184, 0.14)' }}>
            {data.catatan_tambahan.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

function Section({ title, items, total, showNote }) {
  if (!items || items.length === 0) return null
  return (
    <div>
      <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-slate-text)' }}>{title}</h4>
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(148, 163, 184, 0.12)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '2px solid rgba(148, 163, 184, 0.2)' }}>
              <th className="tbl-header">Kode</th>
              <th className="tbl-header">Nama Akun</th>
              {showNote && <th className="tbl-header">Catatan</th>}
              <th className="tbl-header num-cell">Nilai</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r, i) => (
              <tr key={i} className="tbl-row" style={{ animationDelay: `${i * 30}ms` }}>
                <td className="tbl-cell font-mono text-xs font-semibold" style={{ color: 'var(--color-brand-soft)' }}>{r.kode_akun}</td>
                <td className="tbl-cell font-medium" style={{ color: 'var(--color-slate-heading)' }}>{r.nama_akun}</td>
                {showNote && <td className="tbl-cell text-xs italic" style={{ color: 'var(--color-slate-body)' }}>{r.catatan || '-'}</td>}
                <td className="tbl-cell num-cell font-mono text-xs">{formatRupiah(r.nilai)}</td>
              </tr>
            ))}
          </tbody>
          {total !== undefined && (
            <tfoot>
              <tr className="font-bold" style={{ borderTop: '2px solid rgba(37, 99, 235, 0.4)', background: 'rgba(37, 99, 235, 0.1)' }}>
                <td colSpan={showNote ? 3 : 2} className="px-6 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--color-accent-blue)' }}>Total {title}</td>
                <td className="px-6 py-3 num-cell font-mono text-sm font-extrabold" style={{ color: 'var(--color-slate-heading)' }}>{formatRupiah(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
