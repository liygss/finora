import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, BookOpen, FileText, BarChart3, Upload, Calculator, FileSpreadsheet, PlayCircle, Database, Send, ShieldCheck, Search, CornerDownLeft, Bot, BookMarked } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const COMMANDS = [
  { key: 'dashboard', label: 'Dashboard', category: 'Menu Utama', to: '/dashboard', icon: LayoutDashboard, keywords: 'ringkasan beranda home overview', adminOnly: false },
  { key: 'chatbot', label: 'Asisten Finora', category: 'Menu Utama', to: '/dashboard', action: 'open-chatbot', icon: Bot, keywords: 'chatbot tanya ai asisten bantuan panel', adminOnly: false },
  { key: 'akun', label: 'Akun (COA)', category: 'Akuntansi', to: '/akun', icon: BookOpen, keywords: 'chart of accounts akun kode coa neraca saldo', adminOnly: false },
  { key: 'jurnal', label: 'Jurnal Umum', category: 'Akuntansi', to: '/jurnal', icon: FileText, keywords: 'transaksi debit kredit jurnal umum', adminOnly: false },
  { key: 'laporan', label: 'Laporan Keuangan', category: 'Akuntansi', to: '/laporan', icon: BarChart3, keywords: 'neraca laba rugi arus kas laporan keuangan', adminOnly: false },
  { key: 'tutup-buku', label: 'Tutup Buku', category: 'Akuntansi', to: '/tutup-buku', icon: BookMarked, keywords: 'tutup buku penutupan periode akhir tahun pembukuan laba ditahan', adminOnly: false },
  { key: 'upload', label: 'Upload File', category: 'Lainnya', to: '/upload', icon: Upload, keywords: 'import excel xlsx xls transaksi', adminOnly: false },
  { key: 'pajak', label: 'Kalkulator Pajak', category: 'Pajak', to: '/pajak', icon: Calculator, keywords: 'pph ppn umkm pajak hitung', adminOnly: false },
  { key: 'spt', label: 'SPT Tahunan (1770 / 1770S)', category: 'Pajak', to: '/spt', icon: FileSpreadsheet, keywords: 'spt pph orang pribadi tahunan pajak surat', adminOnly: false },
  { key: 'demo', label: 'Lihat Demo', category: 'Lainnya', to: '/demo', icon: PlayCircle, keywords: 'contoh demo percobaan contoh data', adminOnly: false },
  { key: 'knowledge', label: 'Knowledge Base', category: 'Admin', to: '/knowledge', icon: Database, keywords: 'basis pengetahuan admin dokumen pajak', adminOnly: true },
  { key: 'notif-admin', label: 'Kirim Notifikasi', category: 'Admin', to: '/notif-admin', icon: Send, keywords: 'pengumuman notifikasi pesan admin kirim', adminOnly: true },
  { key: 'admin', label: 'Dashboard Admin', category: 'Admin', to: '/admin', icon: ShieldCheck, keywords: 'monitoring user pemantauan maintenance paket statistik admin', adminOnly: true },
]

function matchScore(cmd, q) {
  const needle = q.toLowerCase()
  const hay = `${cmd.label} ${cmd.keywords}`.toLowerCase()
  if (cmd.label.toLowerCase().includes(needle)) return 2
  if (hay.includes(needle)) return 1
  return 0
}

export default function CommandPalette({ open, onClose }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'ADMIN'
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const results = COMMANDS
    .filter((c) => c.adminOnly ? isAdmin : true)
    .map((c) => ({ cmd: c, score: matchScore(c, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.cmd)

  const pick = useCallback((cmd) => {
    onClose()
    navigate(cmd.to)
    if (cmd.action === 'open-chatbot') {
      setTimeout(() => window.dispatchEvent(new Event('open-chatbot')), 0)
    }
  }, [navigate, onClose])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setIndex(0)
    const t = setTimeout(() => inputRef.current?.focus(), 30)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => setIndex(0), [query])

  useEffect(() => {
    const el = listRef.current?.children?.[index]
    el?.scrollIntoView({ block: 'nearest' })
  }, [index])

  useEffect(() => {
    const onKey = (e) => {
      if (!open) return
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, results.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter' && results[index]) { e.preventDefault(); pick(results[index]); return }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, index, results, pick, onClose])

  if (!open) return null

  let lastCategory = null

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[12vh] px-4" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(2, 6, 18, 0.6)', backdropFilter: 'blur(6px)' }} />
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-2xl animate-bounce-in"
        style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-soft)', boxShadow: '0 32px 80px var(--color-shadow)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
          <Search size={18} style={{ color: 'var(--color-slate-muted)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari fitur atau menu..."
            className="w-full bg-transparent py-4 text-sm outline-none placeholder:text-[var(--color-slate-muted)]"
            style={{ color: 'var(--color-slate-text)' }}
          />
          <kbd className="rounded-lg px-2 py-0.5 text-[10px] font-medium" style={{ background: 'var(--color-surface-faint)', border: '1px solid var(--color-border-soft)', color: 'var(--color-slate-muted)' }}>ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[40vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--color-slate-muted)' }}>
              Tidak ada hasil untuk "{query}"
            </div>
          )}
          {results.map((cmd, i) => {
            const showCat = cmd.category !== lastCategory
            lastCategory = cmd.category
            return (
              <div key={cmd.key}>
                {showCat && (
                  <p className="px-3 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-slate-muted)' }}>
                    {cmd.category}
                  </p>
                )}
                <button
                  onClick={() => pick(cmd)}
                  onMouseEnter={() => setIndex(i)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 ${i === index ? 'bg-[var(--color-hover)]' : ''}`}
                  style={i === index ? { color: 'var(--color-accent-blue)' } : { color: 'var(--color-slate-text)' }}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--color-accent-blue)' }}>
                    <cmd.icon size={16} />
                  </span>
                  <span className="flex-1 text-sm font-medium">{cmd.label}</span>
                  {i === index && <CornerDownLeft size={14} style={{ color: 'var(--color-slate-muted)' }} />}
                </button>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: '1px solid var(--color-border-subtle)', color: 'var(--color-slate-muted)' }}>
          <span className="text-[11px]">↑↓ untuk navigasi • Enter untuk membuka</span>
          <span className="text-[11px]">{results.length} hasil</span>
        </div>
      </div>
    </div>
  )
}
