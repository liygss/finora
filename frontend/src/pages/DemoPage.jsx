import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import MotionNumber from '../components/MotionNumber'
import { MotionBarShape, MotionActiveBar } from '../components/MotionChartShapes'
import { fadeUp, scaleIn, staggerContainer, itemStagger } from '../utils/motionPresets'
import ThemeToggle from '../components/ThemeToggle'
import {
  LayoutDashboard, MessageSquare, FileText, BarChart3, Calculator, UploadCloud,
  ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Pause, Play, Sparkles,
  Bot, Wallet, Banknote, TrendingUp, TrendingDown,
  CheckCircle2, Clock, ShieldCheck, Database, Zap
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { formatRupiah } from '../utils/formatters'
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell,
} from 'recharts'
import {
  DEMO_DASHBOARD, DEMO_JURNAL, DEMO_LAPORAN, DEMO_PAJAK, DEMO_UPLOAD,
} from '../data/demoData'

const SLIDE_DURATION = 6500

const SLIDES = [
  {
    key: 'dashboard',
    icon: LayoutDashboard,
    title: 'Dashboard Real-Time',
    tag: 'Ringkasan Keuangan',
    color: '#2563EB',
    desc: 'Pantau saldo kas & bank, pendapatan, beban, dan laba bersih dalam satu pandangan. Semua angka diperbarui otomatis setiap ada transaksi.',
    bullets: ['Statistik & grafik real-time', 'Filter per bulan / kuartal', 'Akses cepat ke semua fitur'],
  },
  {
    key: 'chatbot',
    icon: MessageSquare,
    title: 'Chatbot AI Akuntansi',
    tag: 'Tanya Jawab Cerdas',
    color: '#059669',
    desc: 'Tanyakan apa saja soal SAK EMKM, pajak, sampai kondisi keuangan bisnis Anda. AI menjawab akurat dengan sumber dari knowledge base.',
    bullets: ['Pahami SAK EMKM & PPh Final', 'Jawaban disertai sumber', 'Akses data keuangan akun'],
  },
  {
    key: 'jurnal',
    icon: FileText,
    title: 'Jurnal Umum Otomatis',
    tag: 'Pencatatan Transaksi',
    color: '#D97706',
    desc: 'Buat jurnal dengan sistem debit-kredit yang otomatis menjaga keseimbangan. Tidak perlu paham akuntansi untuk mencatatnya.',
    bullets: ['Validasi balance otomatis', 'Pilih akun dari Chart of Account', 'Detail multi-baris per transaksi'],
  },
  {
    key: 'laporan',
    icon: BarChart3,
    title: 'Laporan Keuangan',
    tag: 'Neraca & Laba Rugi',
    color: '#7C3AED',
    desc: 'Laba rugi, neraca saldo, posisi keuangan, hingga CALK dibuat otomatis dan siap diunduh dalam berbagai format.',
    bullets: ['Laporan sesuai SAK EMKM', 'Export PDF, Excel & CSV', 'CALK (Catatan atas Laporan) otomatis'],
  },
  {
    key: 'pajak',
    icon: Calculator,
    title: 'Kalkulator Pajak',
    tag: 'PPh Final & PPN',
    color: '#DC2626',
    desc: 'Hitung PPh Final UMKM 0,5% dan PPN secara instan. Lengkap dengan rincian dan catatan perhitungan.',
    bullets: ['PPh Final 0,5% otomatis', 'PPN 11% & barang mewah', 'Rincian perhitungan lengkap'],
  },
  {
    key: 'upload',
    icon: UploadCloud,
    title: 'Upload & Proses',
    tag: 'Knowledge Base',
    color: '#0891B2',
    desc: 'Upload CSV transaksi atau PDF aturan pajak. Sistem otomatis memproses, memvalidasi, dan menyimpannya ke knowledge base AI.',
    bullets: ['Drag & drop file', 'Status proses real-time', 'CSV, XLSX, PDF didukung'],
  },
]

function useCountUp(target, duration = 1600) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let start
    let raf
    const step = (ts) => {
      if (start == null) start = ts
      const p = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(target * eased)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

/* ================= MOCKUP SLIDES ================= */

function DashboardMock() {
  const stats = [
    { label: 'Saldo Kas', value: DEMO_DASHBOARD.saldoKas, icon: Wallet, color: 'var(--color-accent-blue)', bg: 'rgba(37,99,235,0.12)' },
    { label: 'Saldo Bank', value: DEMO_DASHBOARD.saldoBank, icon: Banknote, color: 'var(--color-accent-emerald)', bg: 'rgba(5,150,105,0.12)' },
    { label: 'Pendapatan', value: DEMO_DASHBOARD.pendapatan, icon: TrendingUp, color: 'var(--color-accent-emerald)', bg: 'rgba(5,150,105,0.12)' },
    { label: 'Beban', value: DEMO_DASHBOARD.beban, icon: TrendingDown, color: 'var(--color-accent-red)', bg: 'rgba(220,38,38,0.12)' },
  ]

  return (
    <div className="space-y-4">
      <motion.div
        variants={staggerContainer(0.12)}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-3"
      >
        {stats.map((s) => (
          <motion.div
            key={s.label}
            variants={itemStagger}
            whileHover={{ y: -4, scale: 1.01 }}
            className="rounded-2xl p-3.5"
            style={{ background: 'var(--color-glass-bg)', border: '1px solid rgba(148,163,184,0.12)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-slate-muted)' }}>{s.label}</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: s.bg }}>
                <s.icon size={14} style={{ color: s.color }} />
              </div>
            </div>
            <div className="text-base font-bold truncate" style={{ color: 'var(--color-slate-heading)' }}>
              <MotionNumber value={s.value} format={(v) => formatRupiah(Math.round(v))} />
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        variants={staggerContainer(0.15, 0.2)}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-5 gap-3 rounded-2xl p-4"
        style={{ background: 'var(--color-glass-bg)', border: '1px solid rgba(148,163,184,0.12)' }}
      >
        <motion.div variants={itemStagger} className="col-span-3 h-44">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} style={{ color: 'var(--color-accent-blue)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--color-slate-text)' }}>Pendapatan vs Beban</span>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={DEMO_DASHBOARD.barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fill: 'var(--color-slate-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--color-slate-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--color-surface-0)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: 'var(--color-slate-text)' }}
              />
              <Bar dataKey="Pendapatan" fill="#2563EB" radius={[4, 4, 0, 0]} isAnimationActive={false} shape={MotionBarShape} activeBar={<MotionActiveBar />} />
              <Bar dataKey="Beban" fill="#D97706" radius={[4, 4, 0, 0]} isAnimationActive={false} shape={MotionBarShape} activeBar={<MotionActiveBar />} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
        <motion.div variants={itemStagger} className="col-span-2 h-44">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={14} style={{ color: 'var(--color-accent-emerald)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--color-slate-text)' }}>Kas vs Bank</span>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={DEMO_DASHBOARD.pieData} dataKey="value" innerRadius={32} outerRadius={52} paddingAngle={3} stroke="none">
                {DEMO_DASHBOARD.pieData.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: 'var(--color-surface-0)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: 'var(--color-slate-text)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
      </motion.div>
    </div>
  )
}

function ChatbotMock() {
  return (
    <div className="flex h-full flex-col rounded-2xl overflow-hidden animate-scale-in" style={{ background: 'var(--color-glass-bg)', border: '1px solid rgba(148,163,184,0.12)' }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(148,163,184,0.12)' }}>
        <div className="relative">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #059669, #059669)', boxShadow: '0 0 16px rgba(15,23,42,0.12)' }}>
            <Bot size={18} className="text-white" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--color-surface-deep)]" style={{ background: 'var(--color-accent-emerald)' }} />
        </div>
        <div>
          <div className="text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }}>Asisten Finora</div>
          <div className="text-[10px] font-medium" style={{ color: 'var(--color-accent-emerald)' }}>Online • Menjawab instan</div>
        </div>
        <span className="ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: 'rgba(5,150,105,0.12)', color: 'var(--color-accent-emerald)', border: '1px solid rgba(5,150,105,0.25)' }}>
          SAK EMKM
        </span>
      </div>

      <div className="flex-1 space-y-4 p-4 overflow-hidden">
        <div className="flex justify-end animate-fade-in" style={{ animationDelay: '200ms' }}>
          <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm" style={{ background: 'linear-gradient(135deg, #1D4ED8, #2563EB)', color: '#fff', boxShadow: '0 4px 16px rgba(15,23,42,0.12)' }}>
            Bagaimana mencatat penjualan tunai sesuai SAK EMKM?
          </div>
        </div>

        <div className="flex gap-3 animate-fade-in" style={{ animationDelay: '900ms' }}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, #059669, #059669)' }}>
            <Bot size={15} className="text-white" />
          </div>
          <div className="space-y-2">
            <div className="flex gap-1 items-center rounded-2xl rounded-tl-sm px-4 py-3" style={{ background: 'var(--color-surface-card)', border: '1px solid rgba(148,163,184,0.15)' }}>
              <span className="typing-dot h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-slate-body)' }} />
              <span className="typing-dot h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-slate-body)' }} />
              <span className="typing-dot h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-slate-body)' }} />
            </div>
            <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed animate-fade-in" style={{ background: 'var(--color-surface-card)', border: '1px solid rgba(148,163,184,0.15)', color: 'var(--color-slate-text)', animationDelay: '1600ms' }}>
              <p className="mb-2">Pada SAK EMKM, penjualan tunai dicatat:</p>
              <div className="space-y-1 rounded-xl p-3 text-xs" style={{ background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)' }}>
                <div className="flex justify-between"><span style={{ color: 'var(--color-accent-emerald)' }}>Debit — Kas</span><span className="font-semibold" style={{ color: 'var(--color-accent-emerald)' }}>Rp 1.500.000</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--color-accent-red)' }}>Kredit — Pendapatan</span><span className="font-semibold" style={{ color: 'var(--color-accent-red)' }}>Rp 1.500.000</span></div>
              </div>
              <div className="mt-2 flex items-start gap-1.5 animate-fade-in" style={{ animationDelay: '2400ms' }}>
                <Database size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--color-accent-blue)' }} />
                <span className="text-[11px]" style={{ color: 'var(--color-slate-body)' }}>Sumber: SAK EMKM — Bab 3, ayat 1.2</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function JurnalMock() {
  return (
    <div className="rounded-2xl overflow-hidden animate-fade-in" style={{ background: 'var(--color-glass-bg)', border: '1px solid rgba(148,163,184,0.12)' }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(148,163,184,0.12)' }}>
        <div>
          <div className="text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }}>Jurnal Umum</div>
          <div className="text-[11px]" style={{ color: 'var(--color-slate-muted)' }}>Bulan Maret 2026</div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: 'rgba(5,150,105,0.12)', color: 'var(--color-accent-emerald)', border: '1px solid rgba(5,150,105,0.25)' }}>
          <CheckCircle2 size={13} /> Balance ✓
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.12)' }}>
              <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-slate-muted)' }}>No Bukti</th>
              <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-slate-muted)' }}>Deskripsi</th>
              <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-slate-muted)' }}>Debit</th>
              <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-slate-muted)' }}>Kredit</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_JURNAL.map((row, i) => (
              <tr key={row.no} className="row-in" style={{ borderBottom: '1px solid rgba(148,163,184,0.06)', animationDelay: `${300 + i * 250}ms` }}>
                <td className="px-5 py-3">
                  <span className="rounded-lg px-2 py-0.5 text-[11px] font-bold" style={{ background: 'rgba(37,99,235,0.12)', color: 'var(--color-accent-blue)' }}>{row.no}</span>
                  <div className="mt-0.5 text-[11px]" style={{ color: 'var(--color-slate-muted)' }}>{row.tanggal}</div>
                </td>
                <td className="px-5 py-3 font-medium" style={{ color: 'var(--color-slate-text)' }}>{row.deskripsi}</td>
                <td className="px-5 py-3 text-right font-semibold" style={{ color: 'var(--color-accent-emerald)' }}>{row.debit ? formatRupiah(row.debit) : ''}</td>
                <td className="px-5 py-3 text-right font-semibold" style={{ color: 'var(--color-accent-red)' }}>{row.kredit ? formatRupiah(row.kredit) : ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="row-in" style={{ animationDelay: '1400ms' }}>
              <td className="px-5 py-3 text-xs font-bold" style={{ color: 'var(--color-slate-body)' }} colSpan={2}>TOTAL</td>
              <td className="px-5 py-3 text-right text-xs font-bold" style={{ color: 'var(--color-accent-emerald)' }}>{formatRupiah(3275000)}</td>
              <td className="px-5 py-3 text-right text-xs font-bold" style={{ color: 'var(--color-accent-red)' }}>{formatRupiah(3275000)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function LaporanMock() {
  const aset = useCountUp(DEMO_LAPORAN.totalAset, 2000)
  const liabilitas = useCountUp(DEMO_LAPORAN.totalLiabilitas, 2000)
  const modal = useCountUp(DEMO_LAPORAN.totalModal, 2000)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl px-5 py-4 animate-fade-in" style={{ background: 'var(--color-glass-bg)', border: '1px solid rgba(148,163,184,0.12)' }}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #7C3AED, #7C3AED)', boxShadow: '0 4px 16px rgba(15,23,42,0.12)' }}>
            <BarChart3 size={18} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }}>Neraca Lajur</div>
            <div className="text-[11px]" style={{ color: 'var(--color-slate-muted)' }}>Per 31 Juli 2026</div>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: 'rgba(124,58,237,0.1)', color: 'var(--color-accent-purple)', border: '1px solid rgba(124,58,237,0.25)' }}>
          <ShieldCheck size={13} /> Seimbang
        </span>
      </div>

      {[
        { label: 'Total Aset', value: aset, color: 'var(--color-accent-blue)', bg: 'rgba(37,99,235,0.1)', delay: '200ms' },
        { label: 'Total Liabilitas', value: liabilitas, color: 'var(--color-accent-red)', bg: 'rgba(220,38,38,0.1)', delay: '500ms' },
        { label: 'Total Modal + Laba', value: modal, color: 'var(--color-accent-emerald)', bg: 'rgba(5,150,105,0.1)', delay: '800ms' },
      ].map((row) => (
        <div key={row.label} className="flex items-center justify-between rounded-2xl px-5 py-4 animate-fade-in" style={{ background: 'var(--color-glass-bg)', border: '1px solid rgba(148,163,184,0.12)', animationDelay: row.delay }}>
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.color, boxShadow: `0 0 8px ${row.color}` }} />
            <span className="text-sm font-medium" style={{ color: 'var(--color-slate-text)' }}>{row.label}</span>
          </div>
          <span className="text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }}>{formatRupiah(Math.round(row.value))}</span>
        </div>
      ))}

      <div className="rounded-2xl px-5 py-3.5 text-center animate-fade-in" style={{ background: 'rgba(124,58,237,0.08)', border: '1px dashed rgba(124,58,237,0.35)', animationDelay: '1100ms' }}>
        <span className="text-xs font-bold" style={{ color: 'var(--color-accent-purple)' }}>Aset = Liabilitas + Modal ✓</span>
      </div>
    </div>
  )
}

function PajakMock() {
  const omzet = useCountUp(DEMO_PAJAK.omzet, 2200)
  const pph = useCountUp(DEMO_PAJAK.pphFinal, 2200)

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 animate-fade-in" style={{ background: 'var(--color-glass-bg)', border: '1px solid rgba(148,163,184,0.12)' }}>
        <div className="flex items-center gap-2 mb-1.5">
          <Calculator size={14} style={{ color: 'var(--color-accent-red)' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-slate-muted)' }}>Omzet Bulan Ini</span>
        </div>
        <div className="text-2xl font-black" style={{ color: 'var(--color-slate-heading)' }}>{formatRupiah(Math.round(omzet))}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-lg px-2.5 py-1 text-[11px] font-bold" style={{ background: 'rgba(220,38,38,0.1)', color: 'var(--color-accent-red)', border: '1px solid rgba(220,38,38,0.25)' }}>Tarif: {DEMO_PAJAK.tarif}</span>
          <span className="rounded-lg px-2.5 py-1 text-[11px] font-bold" style={{ background: 'rgba(37,99,235,0.1)', color: 'var(--color-accent-blue)', border: '1px solid rgba(37,99,235,0.25)' }}>Omzet Kumulatif: {formatRupiah(DEMO_PAJAK.omzetKumulatif)}</span>
        </div>
      </div>

      <div className="relative rounded-2xl p-5 overflow-hidden animate-scale-in" style={{ background: 'linear-gradient(135deg, rgba(220,38,38,0.15), rgba(220,38,38,0.05))', border: '1px solid rgba(220,38,38,0.3)', animationDelay: '500ms' }}>
        <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-accent-red)' }}>PPh Final Terutang</div>
        <div className="text-3xl font-black" style={{ color: 'var(--color-accent-red)' }}>{formatRupiah(Math.round(pph))}</div>
        <div className="mt-3 text-[11px] leading-relaxed" style={{ color: 'var(--color-slate-body)' }}>
          <Zap size={11} className="mr-1 inline" style={{ color: 'var(--color-accent-red)' }} />
          {DEMO_PAJAK.catatan}
        </div>
      </div>

      <div className="flex items-center gap-2 animate-fade-in" style={{ animationDelay: '1200ms' }}>
        <Clock size={13} style={{ color: 'var(--color-accent-emerald)' }} />
        <span className="text-[11px] font-medium" style={{ color: 'var(--color-slate-muted)' }}>Perhitungan otomatis & siap untuk SPT Tahunan</span>
      </div>
    </div>
  )
}

function UploadMock() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setProgress((p) => Math.min(p + 6, 100)), 100)
    return () => clearInterval(id)
  }, [])

  const done = progress >= 100

  return (
    <div className="flex h-full flex-col rounded-2xl overflow-hidden animate-fade-in" style={{ background: 'var(--color-glass-bg)', border: '1px solid rgba(148,163,184,0.12)' }}>
      <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(148,163,184,0.12)' }}>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #0891B2, #0891B2)', boxShadow: '0 4px 16px rgba(6,182,212,0.4)' }}>
          <UploadCloud size={18} className="text-white" />
        </div>
        <div>
          <div className="text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }}>Upload File</div>
          <div className="text-[11px]" style={{ color: 'var(--color-slate-muted)' }}>CSV, XLSX, PDF • maks 20MB</div>
        </div>
      </div>

      <div className="flex-1 p-5 space-y-4">
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 animate-fade-in" style={{ borderColor: 'rgba(6,182,212,0.3)', background: 'rgba(6,182,212,0.04)' }}>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl animate-float-gentle" style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)' }}>
            <UploadCloud size={24} style={{ color: 'var(--color-accent-cyan)' }} />
          </div>
          <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--color-slate-text)' }}>Tarik & letakkan file di sini</p>
          <p className="text-[11px]" style={{ color: 'var(--color-slate-muted)' }}>atau klik untuk memilih file</p>
        </div>

        <div className="flex items-center gap-3 rounded-xl p-3 animate-fade-in" style={{ background: 'var(--color-surface-faint)', border: '1px solid rgba(148,163,184,0.12)', animationDelay: '300ms' }}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'rgba(6,182,212,0.12)' }}>
            <FileText size={16} style={{ color: 'var(--color-accent-cyan)' }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold truncate" style={{ color: 'var(--color-slate-text)' }}>{DEMO_UPLOAD.filename}</div>
            <div className="text-[10px]" style={{ color: 'var(--color-slate-muted)' }}>{DEMO_UPLOAD.size} • {DEMO_UPLOAD.tipe}</div>
          </div>
          <span className={`text-[11px] font-bold ${done ? 'animate-bounce-in' : ''}`} style={{ color: done ? 'var(--color-accent-emerald)' : 'var(--color-accent-cyan)' }}>
            {done ? 'Selesai' : `${progress}%`}
          </span>
        </div>

        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(148,163,184,0.1)' }}>
          <div
            className="h-full rounded-full transition-all duration-100"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #0891B2, #22D3EE)',
              boxShadow: '0 0 12px rgba(34,211,238,0.6)',
            }}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {[
            { label: 'Menunggu', color: 'var(--color-accent-amber)', delay: '0ms', on: true },
            { label: 'Diproses', color: 'var(--color-accent-cyan)', delay: '900ms', on: true },
            { label: 'Tersimpan ke KB', color: 'var(--color-accent-emerald)', delay: '1900ms', on: done },
          ].map((chip) => (
            <span key={chip.label} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold animate-fade-in ${chip.on ? '' : 'opacity-0'}`} style={{ background: `color-mix(in srgb, ${chip.color} 12%, transparent)`, color: chip.color, border: `1px solid color-mix(in srgb, ${chip.color} 25%, transparent)`, animationDelay: chip.delay }}>
              <CheckCircle2 size={12} /> {chip.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

const SLIDE_MOCKUPS = {
  dashboard: DashboardMock,
  chatbot: ChatbotMock,
  jurnal: JurnalMock,
  laporan: LaporanMock,
  pajak: PajakMock,
  upload: UploadMock,
}

/* ================= DEMO PAGE ================= */

export default function DemoPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const onboard = searchParams.get('ob') === '1'
  const [index, setIndex] = useState(0)
  const [autoplay, setAutoplay] = useState(true)
  const [paused, setPaused] = useState(false)
  const [done, setDone] = useState(false)

  const slide = SLIDES[index]
  const Mock = SLIDE_MOCKUPS[slide.key]
  const isPaused = paused || !autoplay

  useEffect(() => {
    if (!autoplay || paused || done) return
    const id = setInterval(() => {
      setIndex((i) => {
        if (onboard && i === SLIDES.length - 1) {
          setAutoplay(false)
          setDone(true)
          return i
        }
        return (i + 1) % SLIDES.length
      })
    }, onboard ? 5500 : SLIDE_DURATION)
    return () => clearInterval(id)
  }, [autoplay, paused, done, onboard])

  const goTo = (i) => setIndex((i + SLIDES.length) % SLIDES.length)

  return (
    <div className="app-bg relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Header */}
        <header className="flex items-center gap-4 px-5 lg:px-8 h-18" style={{ background: 'var(--color-glass-bg)', backdropFilter: 'blur(20px) saturate(160%)', borderBottom: '1px solid rgba(148,163,184,0.12)' }}>
          <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-300 hover:bg-[var(--color-hover)]" style={{ color: 'var(--color-slate-body)' }}>
            <ArrowLeft size={16} />
            {user ? 'Dashboard' : 'Beranda'}
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl" style={{ boxShadow: '0 4px 14px rgba(15,23,42,0.12)' }}>
              <img src="/finora_logo.jpeg" alt="Finora" className="h-full w-full object-cover" />
            </div>
            <span className="text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }}>Finora <span className="hidden sm:inline font-medium" style={{ color: 'var(--color-slate-muted)' }}>/ Demo</span></span>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <button
              onClick={() => setAutoplay((a) => !a)}
              className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all duration-300 hover:bg-[var(--color-hover)]"
              style={{ background: 'var(--color-surface-card)', border: '1px solid rgba(148,163,184,0.2)', color: autoplay ? 'var(--color-accent-emerald)' : 'var(--color-slate-body)' }}
              title={autoplay ? 'Matikan autoplay' : 'Nyalakan autoplay'}
            >
              {autoplay ? <Pause size={14} /> : <Play size={14} />}
              <span className="hidden sm:inline">{autoplay ? 'Autoplay' : 'Paused'}</span>
            </button>
            <ThemeToggle compact />
            {user ? (
              <Link to={onboard ? '/dashboard' : '/dashboard'} className="btn-primary !px-5 !py-2 text-sm">{onboard ? 'Lanjut ke Tutorial' : 'Buka Dashboard'}</Link>
            ) : (
              <>
                <Link to="/login" className="hidden sm:inline-flex items-center rounded-full px-5 py-2 text-sm font-semibold transition-all duration-300 hover:bg-[var(--color-hover)]" style={{ color: 'var(--color-slate-text)' }}>Masuk</Link>
                <Link to="/register" className="btn-primary !px-5 !py-2 text-sm">Daftar Gratis</Link>
              </>
            )}
          </div>
        </header>

        {/* Progress bar */}
        <div className="h-1 w-full" style={{ background: 'rgba(148,163,184,0.08)' }}>
          <div
            key={index}
            className={`demo-progress ${isPaused ? 'demo-progress-paused' : ''}`}
            style={{ animationDuration: `${SLIDE_DURATION}ms`, background: `linear-gradient(90deg, ${slide.color}, ${slide.color}88)` }}
          />
        </div>

        {/* Main */}
        <main
          className="flex-1 px-5 lg:px-8 py-8"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2 lg:items-center">
            {/* Description */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`desc-${index}`}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, x: -30 }}
                className="order-2 lg:order-1"
              >
                <div className="flex items-center gap-2 animate-slide-in-left">
                  <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ background: `${slide.color}1f`, color: slide.color, border: `1px solid ${slide.color}40` }}>
                    <Sparkles size={12} /> Fitur {index + 1} / {SLIDES.length}
                  </span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl animate-scale-in" style={{ background: `${slide.color}22`, border: `1px solid ${slide.color}45`, boxShadow: `0 0 20px ${slide.color}40` }}>
                    <slide.icon size={19} style={{ color: slide.color }} />
                  </div>
                </div>
                <h1 className="mt-5 text-3xl lg:text-4xl font-[900] leading-tight animate-slide-in-left delay-100" style={{ letterSpacing: '-0.02em', color: 'var(--color-slate-heading)' }}>
                  {slide.title}
                </h1>
                <p className="mt-4 max-w-md text-base leading-relaxed animate-slide-in-left delay-200" style={{ color: 'var(--color-slate-body)' }}>
                  {slide.desc}
                </p>
                <ul className="mt-6 space-y-3">
                  {slide.bullets.map((b, i) => (
                    <li key={b} className="flex items-center gap-3 animate-slide-in-left" style={{ animationDelay: `${300 + i * 120}ms` }}>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: `${slide.color}1f`, border: `1px solid ${slide.color}45` }}>
                        <CheckCircle2 size={13} style={{ color: slide.color }} />
                      </span>
                      <span className="text-sm font-medium" style={{ color: 'var(--color-slate-text)' }}>{b}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8 animate-slide-in-left delay-500">
                  {!done ? (
                    <span className="inline-flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--color-slate-muted)' }}>
                      <span className="flex gap-1">
                        {[0, 1, 2].map((d) => (
                          <span key={d} className="typing-dot h-1.5 w-1.5 rounded-full" style={{ background: slide.color }} />
                        ))}
                      </span>
                      Demo berjalan otomatis — hover untuk jeda
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--color-accent-blue)' }}>
                      <CheckCircle2 size={14} /> Demo selesai — scroll ke bawah untuk lanjut
                    </span>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Mockup */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`mock-${index}`}
                variants={scaleIn}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="order-1 lg:order-2"
              >
                <div className="relative rounded-3xl p-1.5 animate-scale-in" style={{ background: `linear-gradient(145deg, ${slide.color}33, transparent 60%)`, border: '1px solid rgba(148,163,184,0.15)', boxShadow: '0 24px 60px var(--color-shadow, rgba(0,0,0,0.45))' }}>
                  <div className="relative overflow-hidden rounded-[22px]">
                    <div className="flex items-center gap-1.5 px-4 py-3" style={{ background: 'var(--color-surface-card)', borderBottom: '1px solid rgba(148,163,184,0.12)' }}>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#DC2626' }} />
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#D97706' }} />
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#059669' }} />
                      <span className="ml-3 text-[10px] font-medium" style={{ color: 'var(--color-slate-muted)' }}>app.aiumkm.id — {slide.key}</span>
                    </div>
                    <div className="h-[430px] lg:h-[470px] p-4 overflow-y-auto" style={{ background: 'var(--color-glass-bg)' }}>
                      <Mock />
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Onboarding completion overlay */}
        {onboard && done && (
          <div className="px-5 lg:px-8 pb-6">
            <div className="mx-auto max-w-6xl animate-slide-up">
              <div className="flex items-center gap-5 rounded-3xl px-6 py-6 sm:px-10" style={{ background: 'var(--color-glass-bg)', border: '1px solid rgba(37,99,235,0.25)', backdropFilter: 'blur(16px)', boxShadow: '0 16px 48px rgba(15,23,42,0.12)' }}>
                <div className="hidden sm:flex shrink-0 h-16 w-16 items-center justify-center rounded-2xl overflow-hidden animate-buddy-pop" style={{ boxShadow: '0 4px 20px rgba(15,23,42,0.12)' }}>
                  <img src="/assets/buddy/buddy-happy.png" alt="Buddy" className="h-full w-full object-contain" />
                </div>
                <div className="flex-1">
                  <div className="text-base font-bold" style={{ color: 'var(--color-slate-heading)' }}>Mantap! Itu dia fitur inti Finora.</div>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-slate-muted)' }}>Sekarang kamu sudah tahu gambarannya. Yuk lanjut ke tutorial singkat biar makin jago pakai!</p>
                </div>
                <Link to="/dashboard" className="shrink-0 group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white transition-all duration-300 hover:-translate-y-0.5" style={{ background: 'linear-gradient(135deg, #1D4ED8, #2563EB)', boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}>
                  Mulai Tutorial <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="px-5 lg:px-8 pb-8">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <button
              onClick={() => goTo(index - 1)}
              className="flex h-11 w-11 items-center justify-center rounded-full transition-all duration-300 hover:bg-[var(--color-hover)] hover:-translate-x-1"
              style={{ background: 'var(--color-surface-card)', border: '1px solid rgba(148,163,184,0.2)', color: 'var(--color-slate-text)' }}
              aria-label="Sebelumnya"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="flex items-center gap-2.5">
              {SLIDES.map((s, i) => (
                <button
                  key={s.key}
                  onClick={() => goTo(i)}
                  className="h-2.5 rounded-full transition-all duration-300"
                  style={{
                    width: i === index ? 28 : 10,
                    background: i === index ? s.color : 'rgba(148,163,184,0.3)',
                    boxShadow: i === index ? `0 0 12px ${s.color}80` : 'none',
                  }}
                  aria-label={`Fitur ${i + 1}: ${s.title}`}
                />
              ))}
            </div>

            <button
              onClick={() => goTo(index + 1)}
              className="flex h-11 w-11 items-center justify-center rounded-full transition-all duration-300 hover:bg-[var(--color-hover)] hover:translate-x-1"
              style={{ background: 'var(--color-surface-card)', border: '1px solid rgba(148,163,184,0.2)', color: 'var(--color-slate-text)' }}
              aria-label="Berikutnya"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="px-5 lg:px-8 pb-10">
          <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-4 rounded-3xl px-6 py-6 sm:px-10" style={{ background: 'var(--color-glass-bg)', border: '1px solid rgba(148,163,184,0.15)', backdropFilter: 'blur(16px)' }}>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex h-11 w-11 items-center justify-center rounded-2xl overflow-hidden animate-float-gentle" style={{ boxShadow: '0 4px 20px rgba(15,23,42,0.12)' }}>
                {onboard ? (
                  <img src="/assets/buddy/buddy-happy.png" alt="Buddy" className="h-full w-full object-contain" />
                ) : (
                  <Database size={20} className="text-white" />
                )}
              </div>
              <div>
                <div className="text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }}>{onboard && done ? 'Itu dia fitur inti Finora!' : 'Siap mengelola keuangan UMKM Anda?'}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--color-slate-muted)' }}>{onboard && done ? 'Mantap! Sekarang lanjut ke tutorial singkat ya.' : 'Gabung gratis dan lihat kekuatan AI untuk pembukuan bisnis Anda.'}</div>
              </div>
            </div>
            {user ? (
              <Link to="/dashboard" className="group inline-flex shrink-0 items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold text-white transition-all duration-300 hover:-translate-y-1" style={{ background: 'linear-gradient(135deg, #1D4ED8, #2563EB)', boxShadow: '0 10px 30px rgba(15,23,42,0.12)' }}>
                {onboard ? 'Mulai Tutorial' : 'Buka Dashboard'} <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            ) : (
              <Link to="/register" className="group inline-flex shrink-0 items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold text-white transition-all duration-300 hover:-translate-y-1" style={{ background: 'linear-gradient(135deg, #1D4ED8, #2563EB)', boxShadow: '0 10px 30px rgba(15,23,42,0.12)' }}>
                Mulai Sekarang <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
