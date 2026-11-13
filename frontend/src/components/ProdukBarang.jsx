import { useState, useMemo, memo } from 'react'
import { motion } from 'motion/react'
import { Package } from 'lucide-react'
import { formatRupiah } from '../utils/formatters'
import { fadeUp, staggerContainer, itemStagger, EASE_GENTLE } from '../utils/motionPresets'

const PRODUCT_COLORS = ['#059669', '#2563EB', '#D97706', '#DC2626', '#7C3AED', '#0891B2']
const TOP_N = 6

function ProdukBarang({ items }) {
  const [mode, setMode] = useState('terbesar') // 'terbesar' (Rp) | 'terbanyak' (frekuensi)

  const list = useMemo(() => {
    const src = items || []
    const sorted = [...src].sort((a, b) =>
      mode === 'terbesar' ? b.nilai - a.nilai : b.jumlah - a.jumlah
    )
    return sorted.slice(0, TOP_N)
  }, [items, mode])

  const maxValue = useMemo(() => {
    if (list.length === 0) return 1
    return mode === 'terbesar' ? list[0].nilai : list[0].jumlah
  }, [list, mode])

  return (
    <motion.div variants={fadeUp} whileHover={{ y: -4, transition: EASE_GENTLE }} className="card flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl p-2" style={{ background: 'rgba(5, 150, 105, 0.12)' }}>
            <Package size={16} style={{ color: '#10B981' }} />
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }}>Produk / Barang Terlaris</h3>
            <p className="text-[11px]" style={{ color: 'var(--color-slate-body)' }}>Pembelian terbesar atau terbanyak</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'rgba(148, 163, 184, 0.08)', border: '1px solid rgba(148, 163, 184, 0.12)' }}>
          {[
            { key: 'terbesar', label: 'Terbesar' },
            { key: 'terbanyak', label: 'Terbanyak' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setMode(tab.key)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all duration-200"
              style={mode === tab.key
                ? { color: '#0F172A', background: '#10B981' }
                : { color: 'var(--color-slate-body)', background: 'transparent' }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm" style={{ color: 'var(--color-slate-muted)' }}>
          Belum ada data produk
        </div>
      ) : (
        <motion.div variants={staggerContainer(0.08, 0.12)} initial="hidden" animate="visible" className="space-y-3 flex-1">
          {list.map((row, i) => {
            const val = mode === 'terbesar' ? row.nilai : row.jumlah
            const pct = maxValue > 0 ? (val / maxValue) * 100 : 0
            const color = PRODUCT_COLORS[i % PRODUCT_COLORS.length]
            return (
              <motion.div key={row.produk} variants={itemStagger} className="rounded-xl px-3 py-2.5 transition-all duration-200 hover:bg-white/[0.03]"
                style={{ background: 'rgba(148, 163, 184, 0.05)', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="flex items-center gap-2 text-xs font-semibold truncate min-w-0 flex-1" style={{ color: 'var(--color-slate-text)' }}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                    <span className="truncate">{row.produk}</span>
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-extrabold" style={{ color: 'var(--color-slate-heading)' }}>
                      {mode === 'terbesar' ? formatRupiah(row.nilai) : `${row.jumlah} transaksi`}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: `${color}1f`, color }}>
                      {pct.toFixed(0)}%
                    </span>
                  </span>
                </div>
                <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(148, 163, 184, 0.12)' }}>
                  <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.9, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                    style={{ background: `linear-gradient(90deg, ${color}cc, ${color})` }} />
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </motion.div>
  )
}

export default memo(ProdukBarang)