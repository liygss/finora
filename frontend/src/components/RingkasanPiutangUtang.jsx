import { motion } from 'motion/react'
import { memo } from 'react'
import { Link } from 'react-router-dom'
import { HandCoins, ArrowRight } from 'lucide-react'
import { formatRupiah } from '../utils/formatters'
import { fadeUp, EASE_GENTLE } from '../utils/motionPresets'

function Row({ label, value, color }) {
  return (
    <div className="rounded-xl px-3.5 py-2.5" style={{ background: 'rgba(148, 163, 184, 0.06)', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
      <p className="text-[11px] font-semibold" style={{ color: 'var(--color-slate-body)' }}>{label}</p>
      <p className="mt-0.5 text-sm font-extrabold truncate min-w-0" style={{ color: color || 'var(--color-slate-heading)' }}>{value}</p>
    </div>
  )
}

function RingkasanPiutangUtang({ data = null }) {
  const hasData = Boolean(data)
  const selisih = hasData ? data.selisih : 0
  const selisihPositif = selisih >= 0

  return (
    <motion.div variants={fadeUp} whileHover={{ y: -4, transition: EASE_GENTLE }} className="card flex flex-col">
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className="rounded-xl p-2 text-white"
          style={{ background: 'linear-gradient(135deg, #2563EB 0%, #0D9488 100%)', boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}
        >
          <HandCoins size={16} />
        </div>
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }}>Ringkasan Piutang & Utang</h3>
          <p className="text-[11px]" style={{ color: 'var(--color-slate-body)' }}>Tagihan yang belum Anda terima & lunasi</p>
        </div>
      </div>

      {hasData ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
            <Row label="Piutang Usaha" value={formatRupiah(data.piutang_usaha)} color="var(--color-brand-soft)" />
            <Row label="Utang Usaha" value={formatRupiah(data.utang_usaha)} color="#F59E0B" />
            <Row label="Utang Pajak" value={formatRupiah(data.utang_pajak)} color="#F87171" />
            <Row label="Utang Bank" value={formatRupiah(data.utang_bank)} color="#94A3B8" />
          </div>

          <div
            className="mt-3 rounded-xl p-3"
            style={{ background: selisihPositif ? 'rgba(5, 150, 105, 0.08)' : 'rgba(220, 38, 38, 0.08)', border: `1px solid ${selisihPositif ? 'rgba(5, 150, 105, 0.2)' : 'rgba(220, 38, 38, 0.2)'}` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: selisihPositif ? '#10B981' : '#F87171' }}>
                {selisihPositif ? 'Piutang lebih besar dari utang' : 'Utang lebih besar dari piutang'}
              </span>
              <span className="text-sm font-extrabold" style={{ color: selisihPositif ? '#10B981' : '#F87171' }}>
                {selisihPositif ? '' : '-'}{formatRupiah(Math.abs(selisih))}
              </span>
            </div>
          </div>

          <Link
            to="/laporan?t=posisi-keuangan"
            className="mt-3 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200 hover:brightness-125"
            style={{ background: 'rgba(37, 99, 235, 0.1)', border: '1px solid rgba(37, 99, 235, 0.25)', color: 'var(--color-brand-soft)' }}
          >
            Lihat Laporan
            <ArrowRight size={13} />
          </Link>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center text-xs" style={{ color: 'var(--color-slate-muted)' }}>
          Belum ada data piutang & utang
        </div>
      )}
    </motion.div>
  )
}

export default memo(RingkasanPiutangUtang)