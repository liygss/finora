import { useState, useMemo } from 'react'
import { motion } from 'motion/react'
import { Copy, Check, FileSpreadsheet, FileText, Loader2, CheckCircle2, XCircle, Clock, BarChart3, Table2, Download, Landmark, ReceiptText, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, Legend } from 'recharts'

function renderInline(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/\\\*/g, '')
    .replace(/\*/g, '')
    .replace(/`(.*?)`/g, '<code class="rounded-md px-1.5 py-0.5 text-[0.85em] font-mono" style="background: rgba(37, 99, 235, 0.15); color: var(--color-accent-blue)">$1</code>')
}

function renderListItem(text) {
  const match = text.match(/^([^:]{1,48}):\s*(.+)$/)
  if (!match) return renderInline(text)
  return `<span class="font-semibold" style="color: var(--color-slate-heading)">${renderInline(match[1])}:</span> ${renderInline(match[2])}`
}

export function renderMarkdown(text) {
  if (!text) return null
  let lines = text.split('\n')
  let result = []
  let inCodeBlock = false
  let codeLines = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        result.push(
          <pre key={`code-${i}`} className="my-2 rounded-xl p-3 text-xs overflow-x-auto" style={{ background: '#070E1C', color: '#D7E3F4', border: '1px solid var(--color-border-subtle)' }}>
            <code>{codeLines.join('\n')}</code>
          </pre>
        )
        codeLines = []
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeLines.push(line)
      continue
    }

    if (line.trim() === '') {
      result.push(<div key={`space-${i}`} className="h-2" />)
      continue
    }

    if (line.trim().startsWith('|')) {
      const tableLines = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim())
        i++
      }
      i--
      const table = parseTable(tableLines)
      if (table) {
        const prevLine = i > 0 ? lines[i - 1]?.trim() : ''
        const chartMatch = prevLine?.match(/^<<(?:CHART|GRAFIK):(bar|line)>>$/i)
        if (chartMatch) {
          result.push(<RichChart key={`chart-${i}`} data={table} chartType={chartMatch[1].toLowerCase()} />)
        } else {
          result.push(<Table key={`tbl-${i}`} data={table} />)
        }
      }
      continue
    }

    const unordered = line.match(/^[-•*]\s+(.*)$/)
    const ordered = line.match(/^(\d+)\.\s+(.*)$/)
    if (unordered || ordered) {
      const isOrdered = Boolean(ordered)
      const items = []
      let j = i
      while (j < lines.length) {
        const match = isOrdered
          ? lines[j].match(/^(\d+)\.\s+(.*)$/)
          : lines[j].match(/^[-•*]\s+(.*)$/)
        if (!match) break
        items.push(isOrdered ? match[2] : match[1])
        j++
      }
      i = j - 1
      const ListTag = isOrdered ? 'ol' : 'ul'
      result.push(
        <ListTag
          key={`list-${i}`}
          className={isOrdered ? 'my-1.5 space-y-1 pl-5 text-sm leading-7' : 'my-1.5 space-y-1 pl-3 text-sm leading-7'}
          style={{ color: 'var(--color-slate-text)', listStyleType: isOrdered ? 'decimal' : 'none' }}
        >
          {items.map((item, idx) => (
            <li key={idx} className="break-words" dangerouslySetInnerHTML={{ __html: renderListItem(item) }} />
          ))}
        </ListTag>
      )
      continue
    }

    if (line.startsWith('> ')) {
      result.push(
        <blockquote key={`q-${i}`} className="my-2 rounded-r-lg border-l-2 py-1.5 pl-3 pr-2 text-sm leading-7" style={{ borderColor: 'var(--color-accent-blue)', background: 'rgba(37, 99, 235, 0.08)', color: 'var(--color-slate-body)' }} dangerouslySetInnerHTML={{ __html: renderInline(line.slice(2)) }} />
      )
    } else if (line.startsWith('#### ')) {
      result.push(<h4 key={`h4-${i}`} className="mb-1 mt-2.5 text-[13px] font-bold" style={{ color: 'var(--color-slate-heading)' }} dangerouslySetInnerHTML={{ __html: renderInline(line.slice(5)) }} />)
    } else if (line.startsWith('### ')) {
      result.push(<h3 key={`h3-${i}`} className="mb-1 mt-3 text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }} dangerouslySetInnerHTML={{ __html: renderInline(line.slice(4)) }} />)
    } else if (line.startsWith('# ')) {
      result.push(<h1 key={`h-${i}`} className="mb-1.5 mt-3 text-lg font-bold" style={{ color: 'var(--color-slate-heading)' }} dangerouslySetInnerHTML={{ __html: renderInline(line.slice(2)) }} />)
    } else if (line.startsWith('## ')) {
      result.push(<h2 key={`h2-${i}`} className="mb-1.5 mt-3 text-[15px] font-bold" style={{ color: 'var(--color-slate-heading)' }} dangerouslySetInnerHTML={{ __html: renderInline(line.slice(3)) }} />)
    } else {
      result.push(<p key={`p-${i}`} className="my-1 break-words text-sm leading-7" style={{ color: 'var(--color-slate-text)' }} dangerouslySetInnerHTML={{ __html: renderInline(line) }} />)
    }
  }

  return result
}

function splitTableRow(row) {
  let cells = []
  let current = ''
  let inCode = false
  for (const ch of row) {
    if (ch === '`') inCode = !inCode
    if (ch === '|' && !inCode) {
      cells.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current.trim())
  return cells
}

function parseTable(lines) {
  if (lines.length < 1) return null
  const header = splitTableRow(lines[0].replace(/^\|/, '').replace(/\|$/, ''))
  let bodyIndex = 1
  if (lines.length > 1 && /^[\s|:-]+$/.test(lines[1].replace(/\|/g, ''))) {
    bodyIndex = 2
  }
  const rows = []
  for (let i = bodyIndex; i < lines.length; i++) {
    const cells = splitTableRow(lines[i].replace(/^\|/, '').replace(/\|$/, ''))
    rows.push(cells)
  }
  return { header, rows }
}

function Table({ data }) {
  const { header, rows } = data
  return (
    <div className="my-2 overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(148, 163, 184, 0.2)' }}>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr style={{ background: 'rgba(37, 99, 235, 0.12)' }}>
            {header.map((h, idx) => (
              <th key={idx} className="px-3 py-1.5 text-left font-bold whitespace-nowrap" style={{ color: 'var(--color-slate-heading)', borderBottom: '1px solid rgba(148, 163, 184, 0.25)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={rIdx} style={rIdx % 2 ? { background: 'rgba(148, 163, 184, 0.05)' } : undefined}>
              {row.map((cell, cIdx) => {
                const isNumeric = /^(Rp\s|[\d.,]+$)/.test(cell.trim())
                return (
                  <td key={cIdx} className={`px-3 py-1.5 align-top ${isNumeric ? 'text-right tabular-nums' : ''}`} style={{ color: 'var(--color-slate-text)', borderBottom: '1px solid rgba(148, 163, 184, 0.12)' }} dangerouslySetInnerHTML={{ __html: renderInline(cell) }} />
                )
              })}
              </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3"
      aria-live="polite"
      aria-label="Buddy sedang mengetik"
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl overflow-hidden"
        style={{
          boxShadow: '0 4px 12px rgba(15,23,42,0.12)',
        }}
      >
        <img
          src="/assets/buddy/buddy-happy.png"
          alt="Buddy sedang mengetik"
          className="h-full w-full object-contain animate-buddy-talk"
        />
      </div>
      <div className="rounded-2xl rounded-bl-md px-4 py-3" style={{ background: 'var(--color-surface-card)', border: '1px solid rgba(148, 163, 184, 0.14)', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)' }}>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="typing-dot h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-brand-soft)' }} />
            <span className="typing-dot h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-brand-soft)' }} />
            <span className="typing-dot h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-brand-soft)' }} />
          </div>
          <span className="text-[11px] font-medium" style={{ color: 'var(--color-slate-muted)' }}>
            Buddy sedang mengetik…
          </span>
        </div>
      </div>
    </motion.div>
  )
}

export function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button onClick={handleCopy} className="p-1 rounded-lg transition hover:bg-white/10" style={{ color: 'var(--color-slate-muted)' }} title="Salin pesan">
      {copied ? <Check size={12} style={{ color: '#059669' }} /> : <Copy size={12} />}
    </button>
  )
}

// ---------------------------------------------------------------------------
// File attachment chip
// ---------------------------------------------------------------------------
const FILE_STATUS = {
  uploading: { icon: Loader2, color: '#D97706', label: 'Mengupload...', spin: true },
  processing: { icon: Clock, color: '#D97706', label: 'Diproses' },
  POSTED: { icon: CheckCircle2, color: '#059669', label: 'Jurnal dibuat' },
  INGESTED: { icon: CheckCircle2, color: '#059669', label: 'Pengetahuan tersimpan' },
  FAILED: { icon: XCircle, color: '#DC2626', label: 'Gagal' },
}

const FILE_ICONS = {
  csv: FileSpreadsheet, xlsx: FileSpreadsheet, xls: FileSpreadsheet,
  pdf: FileText,
}

export function FileAttachmentChip({ file }) {
  const ext = (file.filename || '').split('.').pop()?.toLowerCase() || ''
  const Icon = FILE_ICONS[ext] || FileText
  const status = FILE_STATUS[file.status] || FILE_STATUS.processing
  const StatusIcon = status.icon

  return (
    <div className="inline-flex items-center gap-2 rounded-xl px-3 py-2 mt-1" style={{ background: 'rgba(37, 99, 235, 0.08)', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
      <Icon size={16} style={{ color: 'var(--color-accent-blue)' }} />
      <span className="text-xs font-medium truncate max-w-[160px]" style={{ color: 'var(--color-slate-heading)' }}>{file.filename}</span>
      <StatusIcon
        size={13}
        className={status.spin ? 'animate-spin' : ''}
        style={{ color: status.color }}
      />
      <span className="text-[10px] font-medium" style={{ color: status.color }}>{status.label}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dataset table (kumpulan transaksi)
// ---------------------------------------------------------------------------
function formatRp(n) {
  return new Intl.NumberFormat('id-ID').format(n || 0)
}

export function DatasetTable({ items, status, onConfirm }) {
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try { await onConfirm?.(items) } finally { setSaving(false) }
  }

  return (
    <div className="mt-2 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(5, 150, 105, 0.25)', background: 'rgba(5, 150, 105, 0.04)' }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid rgba(5, 150, 105, 0.15)', background: 'rgba(5, 150, 105, 0.08)' }}>
        <span className="text-xs font-bold" style={{ color: 'var(--color-accent-emerald)' }}>
          📊 {items.length} transaksi ditemukan
        </span>
      </div>
      <div className="max-h-[240px] overflow-y-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr style={{ background: 'rgba(5, 150, 105, 0.06)' }}>
              <th className="px-2.5 py-1.5 text-left font-bold" style={{ color: 'var(--color-slate-heading)' }}>#</th>
              <th className="px-2.5 py-1.5 text-left font-bold" style={{ color: 'var(--color-slate-heading)' }}>Deskripsi</th>
              <th className="px-2.5 py-1.5 text-left font-bold" style={{ color: 'var(--color-slate-heading)' }}>Tanggal</th>
              <th className="px-2.5 py-1.5 text-right font-bold" style={{ color: 'var(--color-slate-heading)' }}>Debit</th>
              <th className="px-2.5 py-1.5 text-right font-bold" style={{ color: 'var(--color-slate-heading)' }}>Kredit</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const totalDebit = item.detail.reduce((s, d) => s + (d.debit || 0), 0)
              const totalKredit = item.detail.reduce((s, d) => s + (d.kredit || 0), 0)
              return (
                <tr key={idx} style={{ borderTop: '1px solid rgba(5, 150, 105, 0.1)' }}>
                  <td className="px-2.5 py-1.5 font-medium" style={{ color: 'var(--color-accent-emerald)' }}>{idx + 1}</td>
                  <td className="px-2.5 py-1.5 font-medium" style={{ color: 'var(--color-slate-heading)' }}>{item.deskripsi}</td>
                  <td className="px-2.5 py-1.5" style={{ color: 'var(--color-slate-body)' }}>{item.tanggal}</td>
                  <td className="px-2.5 py-1.5 text-right font-medium" style={{ color: 'var(--color-accent-emerald)' }}>Rp {formatRp(totalDebit)}</td>
                  <td className="px-2.5 py-1.5 text-right font-medium" style={{ color: '#DC2626' }}>Rp {formatRp(totalKredit)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {status === 'ready' && (
        <div className="px-3 py-2.5" style={{ borderTop: '1px solid rgba(5, 150, 105, 0.15)' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 w-full rounded-xl px-4 py-2.5 text-xs font-bold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #059669, #059669)', boxShadow: '0 4px 14px rgba(15,23,42,0.12)' }}
          >
            {saving ? 'Menyimpan...' : <><Check size={14} /> Simpan Semua Jurnal ({items.length})</>}
          </button>
        </div>
      )}
      {status === 'saved' && (
        <div className="px-3 py-2 text-center">
          <span className="text-[11px] font-medium" style={{ color: 'var(--color-accent-emerald)' }}>
            <CheckCircle2 size={12} className="inline mr-1" /> Semua jurnal tersimpan
          </span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Transaction confirm (single journal from chat)
// ---------------------------------------------------------------------------
export function TransactionConfirm({ transaction, onConfirm, onReject }) {
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try { await onConfirm?.(transaction) } finally { setSaving(false) }
  }

  if (!transaction) return null

  const { deskripsi, tanggal, detail, status } = transaction
  const totalDebit = detail.reduce((s, d) => s + (d.debit || 0), 0)
  const totalKredit = detail.reduce((s, d) => s + (d.kredit || 0), 0)

  if (status === 'saved') {
    return (
      <div className="mt-2 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(5, 150, 105, 0.25)', background: 'rgba(5, 150, 105, 0.06)' }}>
        <div className="px-3 py-2.5 text-center">
          <span className="text-xs font-bold" style={{ color: 'var(--color-accent-emerald)' }}>
            <CheckCircle2 size={13} className="inline mr-1" /> Jurnal tersimpan
          </span>
          <p className="text-[11px] mt-1" style={{ color: 'var(--color-slate-muted)' }}>{deskripsi}</p>
        </div>
      </div>
    )
  }

  if (status === 'rejected') {
    return (
      <div className="mt-2 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(220, 38, 38, 0.25)', background: 'rgba(220, 38, 38, 0.06)' }}>
        <div className="px-3 py-2.5 text-center">
          <span className="text-xs font-bold" style={{ color: '#DC2626' }}>
            <XCircle size={13} className="inline mr-1" /> Dibatalkan
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(37, 99, 235, 0.25)', background: 'rgba(37, 99, 235, 0.04)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid rgba(37, 99, 235, 0.15)', background: 'rgba(37, 99, 235, 0.1)' }}>
        <FileSpreadsheet size={14} style={{ color: 'var(--color-brand-soft)' }} />
        <span className="text-xs font-bold" style={{ color: 'var(--color-brand-soft)' }}>
          Jurnal Baru
        </span>
        <span className="ml-auto text-[10px] font-medium" style={{ color: 'var(--color-slate-muted)' }}>
          {tanggal}
        </span>
      </div>

      {/* Deskripsi */}
      <div className="px-3 py-2" style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.12)' }}>
        <div className="text-xs font-semibold" style={{ color: 'var(--color-slate-heading)' }}>{deskripsi}</div>
      </div>

      {/* Detail jurnal */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr style={{ background: 'rgba(37, 99, 235, 0.06)' }}>
              <th className="px-2.5 py-1.5 text-left font-bold" style={{ color: 'var(--color-slate-heading)' }}>Akun</th>
              <th className="px-2.5 py-1.5 text-right font-bold" style={{ color: 'var(--color-slate-heading)' }}>Debit</th>
              <th className="px-2.5 py-1.5 text-right font-bold" style={{ color: 'var(--color-slate-heading)' }}>Kredit</th>
            </tr>
          </thead>
          <tbody>
            {detail.map((d, idx) => (
              <tr key={idx} style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
                <td className="px-2.5 py-1.5">
                  <div className="font-medium" style={{ color: 'var(--color-slate-heading)' }}>{d.nama_akun}</div>
                  {d.keterangan && <div className="text-[10px]" style={{ color: 'var(--color-slate-muted)' }}>{d.keterangan}</div>}
                </td>
                <td className="px-2.5 py-1.5 text-right tabular-nums font-medium" style={{ color: d.debit > 0 ? 'var(--color-accent-emerald)' : 'var(--color-slate-muted)' }}>
                  {d.debit > 0 ? `Rp ${formatRp(d.debit)}` : '-'}
                </td>
                <td className="px-2.5 py-1.5 text-right tabular-nums font-medium" style={{ color: d.kredit > 0 ? '#DC2626' : 'var(--color-slate-muted)' }}>
                  {d.kredit > 0 ? `Rp ${formatRp(d.kredit)}` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid rgba(37, 99, 235, 0.2)', background: 'rgba(37, 99, 235, 0.06)' }}>
              <td className="px-2.5 py-1.5 font-bold" style={{ color: 'var(--color-slate-heading)' }}>Total</td>
              <td className="px-2.5 py-1.5 text-right tabular-nums font-bold" style={{ color: 'var(--color-accent-emerald)' }}>Rp {formatRp(totalDebit)}</td>
              <td className="px-2.5 py-1.5 text-right tabular-nums font-bold" style={{ color: '#DC2626' }}>Rp {formatRp(totalKredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Balance indicator */}
      <div className="px-3 py-1.5" style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
        <span className="text-[10px] font-medium" style={{ color: totalDebit === totalKredit ? 'var(--color-accent-emerald)' : '#DC2626' }}>
          {totalDebit === totalKredit ? '✓ Seimbang' : '✗ Tidak seimbang'}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 px-3 py-2.5" style={{ borderTop: '1px solid rgba(37, 99, 235, 0.15)' }}>
        <button
          onClick={handleSave}
          disabled={saving || totalDebit !== totalKredit}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg, #1D4ED8, #2563EB)', boxShadow: '0 4px 14px var(--color-brand-glow)' }}
        >
          {saving ? (
            <><Loader2 size={13} className="animate-spin" /> Menyimpan...</>
          ) : (
            <><Check size={13} /> Simpan Jurnal</>
          )}
        </button>
        <button
          onClick={() => onReject?.(transaction)}
          disabled={saving}
          className="flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          style={{ color: 'var(--color-slate-muted)', border: '1px solid var(--color-border-subtle)', background: 'var(--color-surface-card)' }}
        >
          <XCircle size={13} /> Batal
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Date separator (pill "Hari ini")
// ---------------------------------------------------------------------------
export function DateSeparator({ label = 'Hari ini' }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 h-px" style={{ background: 'var(--color-border-subtle)' }} />
      <span className="shrink-0 text-[10px] font-semibold px-3 py-1 rounded-full" style={{ background: 'var(--color-surface-card)', color: 'var(--color-slate-muted)', border: '1px solid var(--color-border-subtle)' }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: 'var(--color-border-subtle)' }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Summary card — key financial metrics in a compact grid
// ---------------------------------------------------------------------------
export function SummaryCard({ title, metrics = [] }) {
  if (!metrics.length) return null
  return (
    <div className="my-2 rounded-xl overflow-hidden" style={{ background: 'rgba(37, 99, 235, 0.06)', border: '1px solid rgba(37, 99, 235, 0.18)' }}>
      {title && (
        <div className="px-3 py-2 font-bold text-xs" style={{ background: 'rgba(37, 99, 235, 0.12)', color: 'var(--color-brand-soft)', borderBottom: '1px solid rgba(37, 99, 235, 0.15)' }}>
          {title}
        </div>
      )}
      <div className="grid grid-cols-2 gap-px" style={{ background: 'rgba(148, 163, 184, 0.1)' }}>
        {metrics.map((m, i) => (
          <div key={i} className="px-3 py-2" style={{ background: 'var(--color-surface-card)' }}>
            <div className="text-[10px] font-medium" style={{ color: 'var(--color-slate-muted)' }}>{m.label}</div>
            <div className="text-sm font-bold mt-0.5" style={{ color: m.color || 'var(--color-slate-heading)' }}>{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// RichChart — interactive chart from table data (bar/line)
// ---------------------------------------------------------------------------
const CHART_COLORS = ['#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED', '#EC4899', '#0891B2', '#84CC16']

function parseNumeric(str) {
  if (!str) return 0
  const cleaned = str.replace(/[Rp\s.,]/g, '').replace(/,/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

function RichChart({ data, chartType = 'bar' }) {
  const { header, rows } = data
  const [view, setView] = useState(chartType)

  const chartData = useMemo(() => {
    if (!header || !rows || rows.length === 0) return []

    const labelCol = 0
    const numericCols = []
    for (let c = 1; c < header.length; c++) {
      const hasNumeric = rows.some(r => /^(Rp\s|[\d.,]+$)/.test((r[c] || '').trim()))
      if (hasNumeric) numericCols.push(c)
    }
    if (numericCols.length === 0) return []

    return rows.map(row => {
      const item = { name: (row[labelCol] || '').replace(/\*\*/g, '') }
      numericCols.forEach(c => {
        item[header[c]] = parseNumeric(row[c])
      })
      return item
    })
  }, [header, rows])

  const numericKeys = useMemo(() => {
    if (!header || !rows || rows.length === 0) return []
    const keys = []
    for (let c = 1; c < header.length; c++) {
      const hasNumeric = rows.some(r => /^(Rp\s|[\d.,]+$)/.test((r[c] || '').trim()))
      if (hasNumeric) keys.push(header[c])
    }
    return keys
  }, [header, rows])

  if (chartData.length === 0) {
    return <Table data={data} />
  }

  return (
    <div className="my-2 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(148, 163, 184, 0.2)' }}>
      {/* Toggle bar */}
      <div className="flex items-center gap-1 px-2 py-1.5" style={{ background: 'rgba(37, 99, 235, 0.08)', borderBottom: '1px solid rgba(148, 163, 184, 0.15)' }}>
        <button
          onClick={() => setView('chart')}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all"
          style={{
            background: view === 'chart' ? 'rgba(37, 99, 235, 0.2)' : 'transparent',
            color: view === 'chart' ? 'var(--color-brand-soft)' : 'var(--color-slate-muted)',
          }}
        >
          <BarChart3 size={11} /> Grafik
        </button>
        <button
          onClick={() => setView('table')}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all"
          style={{
            background: view === 'table' ? 'rgba(37, 99, 235, 0.2)' : 'transparent',
            color: view === 'table' ? 'var(--color-brand-soft)' : 'var(--color-slate-muted)',
          }}
        >
          <Table2 size={11} /> Tabel
        </button>
      </div>

      {view === 'chart' ? (
        <div className="px-2 py-3" style={{ background: 'var(--color-surface-card)' }}>
          <ResponsiveContainer width="100%" height={Math.max(200, Math.min(320, chartData.length * 36 + 40))}>
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: 'var(--color-slate-muted)' }}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={chartData.length > 6 ? -35 : 0}
                textAnchor={chartData.length > 6 ? 'end' : 'middle'}
                height={chartData.length > 6 ? 60 : 30}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--color-slate-muted)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(0)}jt` : v >= 1000 ? `${(v / 1000).toFixed(0)}rb` : v}
              />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid var(--color-border-subtle)', background: 'var(--color-surface-card)' }}
                formatter={(value) => [`Rp ${new Intl.NumberFormat('id-ID').format(value)}`, '']}
              />
              {numericKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
              {numericKeys.map((key, idx) => (
                <Bar key={key} dataKey={key} fill={CHART_COLORS[idx % CHART_COLORS.length]} radius={[4, 4, 0, 0]} barSize={Math.max(16, Math.min(40, 300 / chartData.length))} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <Table data={data} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ActionBar — quick-action buttons after financial answers
// ---------------------------------------------------------------------------
const ACTION_STYLES = {
  primary: { bg: 'linear-gradient(135deg, #1D4ED8, #2563EB)', color: '#fff', shadow: '0 4px 14px var(--color-brand-glow)' },
  success: { bg: 'linear-gradient(135deg, #059669, #059669)', color: '#fff', shadow: '0 4px 14px rgba(5, 150, 105, 0.3)' },
  amber: { bg: 'rgba(217, 119, 6, 0.12)', color: 'var(--color-accent-amber)', shadow: 'none', border: '1px solid rgba(217, 119, 6, 0.25)' },
  blue: { bg: 'rgba(37, 99, 235, 0.12)', color: 'var(--color-brand-soft)', shadow: 'none', border: '1px solid rgba(37, 99, 235, 0.25)' },
  outline: { bg: 'var(--color-surface-card)', color: 'var(--color-brand-soft)', shadow: 'none', border: '1px solid var(--color-border-subtle)' },
}

const ACTION_ICONS = {
  neraca: Landmark,
  jurnal: ReceiptText,
  trend: TrendingUp,
  download: Download,
}

export function ActionBar({ actions = [], onAction }) {
  if (!actions.length) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {actions.map((action, i) => {
        const style = ACTION_STYLES[action.style] || ACTION_STYLES.outline
        const Icon = ACTION_ICONS[action.icon] || ReceiptText
        return (
          <motion.button
            key={i}
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onAction?.(action)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-200"
            style={{
              background: style.bg,
              color: style.color,
              border: style.border,
              boxShadow: style.shadow,
            }}
          >
            <Icon size={12} />
            {action.label}
          </motion.button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MetricHighlight — single big-number callout
// ---------------------------------------------------------------------------
export function MetricHighlight({ label, value, color = 'var(--color-accent-emerald)', icon: Icon }) {
  return (
    <div className="my-2 flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(37, 99, 235, 0.06)', border: '1px solid rgba(37, 99, 235, 0.18)' }}>
      {Icon && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(37, 99, 235, 0.12)', color: 'var(--color-brand-soft)' }}>
          <Icon size={18} />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-[10px] font-medium" style={{ color: 'var(--color-slate-muted)' }}>{label}</div>
        <div className="text-lg font-extrabold tabular-nums" style={{ color }}>{value}</div>
      </div>
    </div>
  )
}