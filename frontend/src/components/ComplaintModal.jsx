import { useState } from 'react'
import { Headphones, X, Send } from 'lucide-react'
import client from '../api/client'
import { extractError } from '../api/extractError'
import toast from 'react-hot-toast'

export default function ComplaintModal({ onClose }) {
  const [form, setForm] = useState({ subject: '', message: '' })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.subject.trim() || !form.message.trim()) {
      return toast.error('Subjek dan pesan wajib diisi')
    }
    setSubmitting(true)
    try {
      await client.post('/feedback', {
        category: 'COMPLAINT',
        subject: form.subject.trim(),
        message: form.message.trim(),
      })
      toast.success('Pesan terkirim! Admin akan segera merespon.')
      setForm({ subject: '', message: '' })
      onClose()
    } catch (err) {
      toast.error(extractError(err, 'Gagal mengirim pesan'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
      style={{ background: 'rgba(2, 6, 18, 0.7)', backdropFilter: 'blur(10px)' }}
    >
      <div
        className="relative w-full max-w-md card overflow-hidden animate-bounce-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-0">
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-xl transition-all duration-300 hover:bg-white/10"
          style={{ color: 'var(--color-slate-body)' }}
          aria-label="Tutup"
        >
          <X size={18} />
        </button>

        <div className="relative p-8">
          <div className="flex items-center gap-3 mb-5">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl"
              style={{ background: 'linear-gradient(135deg, #2563EB, #2563EB)', boxShadow: '0 4px 14px rgba(15,23,42,0.12)' }}
            >
              <Headphones size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--color-slate-heading)' }}>
                Chat ke CS
              </h2>
              <p className="text-xs" style={{ color: 'var(--color-slate-muted)' }}>
                Kirim pesan atau pertanyaan ke admin
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Subjek</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="input-field"
                placeholder="cth: Pertanyaan tentang laporan keuangan"
                maxLength={200}
              />
            </div>

            <div>
              <label className="label">Pesan</label>
              <textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="input-field resize-none"
                rows={4}
                placeholder="Tulis pesan atau pertanyaan Anda di sini..."
              />
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              <Send size={16} /> {submitting ? 'Mengirim...' : 'Kirim Pesan'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
