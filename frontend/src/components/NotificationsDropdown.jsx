import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import client from '../api/client'
import { Bell, CheckCheck, MessageSquare, BarChart3, Info, Inbox } from 'lucide-react'

const ICON_BY_TYPE = {
  ADMIN: MessageSquare,
  MONTHLY: BarChart3,
  SYSTEM: Info,
}
const COLOR_BY_TYPE = {
  ADMIN: { bg: 'rgba(37,99,235,0.14)', fg: 'var(--color-accent-blue)', ring: 'rgba(96,165,250,0.28)' },
  MONTHLY: { bg: 'rgba(5,150,105,0.12)', fg: '#6EE7B7', ring: 'rgba(5,150,105,0.25)' },
  SYSTEM: { bg: 'rgba(148,163,184,0.12)', fg: 'var(--color-slate-text)', ring: 'rgba(148,163,184,0.25)' },
}

const POLL_INTERVAL_MS = 60_000

function timeAgo(dtStr) {
  if (!dtStr) return ''
  const now = new Date()
  const dt = new Date(dtStr)
  const sec = Math.max(0, Math.floor((now - dt) / 1000))
  if (sec < 60) return 'baru saja'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} menit lalu`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} jam lalu`
  const day = Math.floor(hr / 24)
  if (day === 1) return 'kemarin'
  if (day < 7) return `${day} hari lalu`
  if (day < 30) return `${Math.floor(day / 7)} minggu lalu`
  return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function NotificationsDropdown() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const rootRef = useRef(null)
  const timerRef = useRef(null)

  const fetchNotifications = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data } = await client.get('/notifications')
      setItems(data.items || [])
      setUnread(data.unread_count ?? 0)
    } catch {
      // diam — jangan ganggu user kalau gagal
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    fetchNotifications()
    timerRef.current = setInterval(fetchNotifications, POLL_INTERVAL_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchNotifications, user])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const markRead = async (id) => {
    try { await client.post(`/notifications/${id}/read`) } catch { /* noop */ }
  }
  const markAllRead = async () => {
    try {
      await client.post('/notifications/read-all')
      setItems((xs) => xs.map((x) => ({ ...x, is_read: true })))
      setUnread(0)
    } catch { /* noop */ }
  }

  const onClickItem = async (n) => {
    if (!n.is_read) await markRead(n.id)
    setOpen(false)
    // Refresh list supaya badge & unread state sinkron
    fetchNotifications()
    if (n.link) navigate(n.link)
  }

  if (!user) return null

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2.5 rounded-xl transition-all duration-300 hover:bg-white/5"
        style={{ color: 'var(--color-slate-body)' }}
        aria-label="Notifikasi"
        title="Notifikasi"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
            style={{ background: '#DC2626', boxShadow: '0 0 0 2px var(--color-surface-0)' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl overflow-hidden flex flex-col"
          style={{
            background: 'var(--color-surface-deep)',
            border: '1px solid var(--color-border-soft)',
            boxShadow: '0 20px 40px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(15,23,42,0.12)',
            maxHeight: '70vh',
            zIndex: 10000,
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid rgba(148,163,184,0.12)' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }}>Notifikasi</span>
              {unread > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: 'rgba(220,38,38,0.15)', color: '#FCA5A5' }}
                >
                  {unread} baru
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition-all hover:bg-white/5"
                style={{ color: 'var(--color-accent-blue)' }}
              >
                <CheckCheck size={13} /> Tandai semua dibaca
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1" style={{ scrollbarGutter: 'stable' }}>
            {loading && items.length === 0 && (
              <div className="p-6 text-center text-xs" style={{ color: 'var(--color-slate-muted)' }}>Memuat...</div>
            )}
            {!loading && items.length === 0 && (
              <div className="p-8 text-center">
                <div
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl mb-3"
                  style={{ background: 'rgba(148,163,184,0.08)' }}
                >
                  <Inbox size={22} style={{ color: 'var(--color-slate-muted)' }} />
                </div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-slate-text)' }}>Belum ada notifikasi</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-slate-muted)' }}>
                  Admin akan mengirim info penting di sini, dan Ringkasan Bulanan akan muncul otomatis.
                </p>
              </div>
            )}
            {items.map((n) => {
              const Icon = ICON_BY_TYPE[n.type] || Info
              const palette = COLOR_BY_TYPE[n.type] || COLOR_BY_TYPE.SYSTEM
              return (
                <button
                  key={n.id}
                  onClick={() => onClickItem(n)}
                  className="w-full text-left px-4 py-3 flex gap-3 transition-all hover:bg-white/[0.03]"
                  style={{
                    borderBottom: '1px solid rgba(148,163,184,0.08)',
                    background: n.is_read ? 'transparent' : 'rgba(37,99,235,0.04)',
                  }}
                >
                  <div
                    className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{
                      background: palette.bg,
                      border: `1px solid ${palette.ring}`,
                      color: palette.fg,
                    }}
                  >
                    <Icon size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {!n.is_read && (
                        <span
                          className="shrink-0 h-2 w-2 rounded-full"
                          style={{ background: '#2563EB', boxShadow: '0 0 6px rgba(15,23,42,0.12)' }}
                        />
                      )}
                      <span
                        className={`text-sm truncate ${n.is_read ? '' : 'font-semibold'}`}
                        style={{ color: n.is_read ? 'var(--color-slate-text)' : 'var(--color-slate-heading)' }}
                      >
                        {n.title}
                      </span>
                    </div>
                    <p
                      className="text-xs mt-0.5 line-clamp-2"
                      style={{ color: n.is_read ? 'var(--color-slate-body)' : 'var(--color-slate-text)' }}
                    >
                      {n.message}
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--color-slate-muted)' }}>
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
