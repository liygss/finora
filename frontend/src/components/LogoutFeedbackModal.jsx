import { useState } from 'react'
import { Star, X, LogOut } from 'lucide-react'
import client from '../api/client'
import toast from 'react-hot-toast'

export default function LogoutFeedbackModal({ onClose, onSkip }) {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (rating === 0) {
      return toast.error('Pilih rating terlebih dahulu')
    }
    setSubmitting(true)
    try {
      await client.post('/feedback/exit', {
        rating,
        comment: comment.trim() || null,
      })
      toast.success('Terima kasih atas feedback-nya!')
    } catch {
      // tetap logout meski feedback gagal
    } finally {
      setSubmitting(false)
      onSkip()
    }
  }

  const handleSkip = () => {
    onSkip()
  }

  const labels = ['', 'Sangat Buruk', 'Buruk', 'Biasa', 'Bagus', 'Sangat Bagus']

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={handleSkip}
      style={{ background: 'rgba(2, 6, 18, 0.7)', backdropFilter: 'blur(10px)' }}
    >
      <div
        className="relative w-full max-w-md card overflow-hidden animate-bounce-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* decorative blobs */}
        <div className="pointer-events-none absolute inset-0">
        </div>

        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 z-10 p-2 rounded-xl transition-all duration-300 hover:bg-white/10"
          style={{ color: 'var(--color-slate-body)' }}
          aria-label="Tutup"
        >
          <X size={18} />
        </button>

        <div className="relative p-8 text-center">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl animate-float-gentle"
            style={{ background: 'linear-gradient(135deg, #D97706, #F59E0B)', boxShadow: '0 8px 32px rgba(15,23,42,0.12)' }}
          >
            <LogOut size={24} className="text-white" />
          </div>

          <h2 className="mt-4 text-lg font-bold" style={{ color: 'var(--color-slate-heading)' }}>
            Sebelum Kamu Keluar...
          </h2>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--color-slate-muted)' }}>
            Bagaimana pengalamanmu menggunakan Finora?
          </p>

          {/* Star Rating */}
          <div className="mt-5 flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                className="transition-all duration-200 hover:scale-110"
              >
                <Star
                  size={36}
                  className="transition-colors duration-200"
                  style={{
                    color: star <= (hovered || rating) ? '#F59E0B' : 'var(--color-slate-muted)',
                    fill: star <= (hovered || rating) ? '#F59E0B' : 'transparent',
                    filter: star <= (hovered || rating) ? 'drop-shadow(0 0 6px rgba(251,191,36,0.5))' : 'none',
                  }}
                />
              </button>
            ))}
          </div>
          {(hovered || rating) > 0 && (
            <p className="mt-2 text-xs font-semibold animate-fade-in" style={{ color: '#F59E0B' }}>
              {labels[hovered || rating]}
            </p>
          )}

          {/* Comment */}
          <div className="mt-4">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="input-field resize-none text-sm"
              rows={3}
              placeholder="Ceritakan pengalamanmu (opsional)..."
              maxLength={500}
            />
          </div>

          {/* Buttons */}
          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSubmit}
              disabled={submitting || rating === 0}
              className="btn-primary flex-1 !py-3 text-sm"
            >
              {submitting ? 'Mengirim...' : 'Kirim Rating'}
            </button>
            <button
              onClick={handleSkip}
              className="btn-ghost flex-1 !py-3 text-sm"
            >
              Lewati
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
