import { motion } from 'motion/react'
import { memo } from 'react'
import { BellRing, ShieldAlert, AlertTriangle, Info, CheckCircle2 } from 'lucide-react'
import { fadeUp, EASE_GENTLE } from '../utils/motionPresets'

const LEVEL_META = {
  danger: { icon: ShieldAlert, color: '#F87171', bg: 'rgba(220, 38, 38, 0.12)', border: 'rgba(220, 38, 38, 0.28)' },
  warning: { icon: AlertTriangle, color: '#F59E0B', bg: 'rgba(217, 119, 6, 0.12)', border: 'rgba(217, 119, 6, 0.28)' },
  info: { icon: Info, color: 'var(--color-brand-soft)', bg: 'rgba(37, 99, 235, 0.12)', border: 'rgba(37, 99, 235, 0.28)' },
}

function TemuanPenting({ alerts = [] }) {
  return (
    <motion.div variants={fadeUp} whileHover={{ y: -4, transition: EASE_GENTLE }} className="card flex flex-col lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="rounded-xl p-2 text-white"
            style={{ background: 'linear-gradient(135deg, #D97706 0%, #DC2626 100%)', boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}
          >
            <BellRing size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }}>Temuan Penting</h3>
            <p className="text-[11px]" style={{ color: 'var(--color-slate-body)' }}>
              {alerts.length > 0 ? `${alerts.length} hal yang perlu dicermati` : 'Penilaian otomatis kondisi keuangan'}
            </p>
          </div>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 text-center py-6">
          <div
            className="rounded-full p-3"
            style={{ background: 'rgba(5, 150, 105, 0.1)', border: '1px solid rgba(5, 150, 105, 0.2)' }}
          >
            <CheckCircle2 size={22} style={{ color: '#10B981' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-slate-heading)' }}>Tidak ada temuan penting</p>
          <p className="text-xs" style={{ color: 'var(--color-slate-muted)' }}>Keuangan usaha Anda terlihat wajar bulan ini.</p>
        </div>
      ) : (
        <div className="space-y-2.5 flex-1">
          {alerts.map((a, i) => {
            const meta = LEVEL_META[a.level] || LEVEL_META.info
            const Icon = meta.icon
            return (
              <div
                key={i}
                className="flex gap-3 rounded-xl p-3"
                style={{ background: meta.bg, border: `1px solid ${meta.border}` }}
              >
                <div className="rounded-lg p-2 shrink-0" style={{ background: 'rgba(255, 255, 255, 0.06)', border: `1px solid ${meta.border}` }}>
                  <Icon size={15} style={{ color: meta.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }}>{a.judul}</p>
                  <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--color-slate-body)' }}>{a.deskripsi}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}

export default memo(TemuanPenting)