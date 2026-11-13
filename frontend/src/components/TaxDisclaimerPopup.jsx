import { motion } from 'motion/react'
import { X, ShieldCheck } from 'lucide-react'

export default function TaxDisclaimerPopup({
  isOpen,
  onClose,
  title,
  accentColor,
  children,
}) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
      style={{ background: 'rgba(2, 6, 18, 0.7)', backdropFilter: 'blur(10px)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-lg card overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full blur-3xl"
          style={{ background: `${accentColor}20` }}
        />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-xl transition-all duration-300 hover:bg-white/10"
          style={{ color: 'var(--color-slate-body)' }}
          aria-label="Tutup"
        >
          <X size={18} />
        </button>

        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl"
              style={{
                background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
                boxShadow: `0 4px 14px ${accentColor}40`,
              }}
            >
              <ShieldCheck size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--color-slate-heading)' }}>
                {title}
              </h2>
              <p className="text-xs" style={{ color: 'var(--color-slate-muted)' }}>
                Informasi dan peringatan penting
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm leading-relaxed" style={{ color: 'var(--color-slate-body)' }}>
            {children}
          </div>

          <div className="mt-5 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90"
              style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)` }}
            >
              Tutup
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}