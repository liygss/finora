import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RotateCcw, MessageCircle, X, Maximize2, Minimize2, Plus, Trash2, History, MessageSquare, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { useChatbotShared } from '../context/ChatbotContext'
import AssistantChat from './AssistantChat'

const MOBILE_QUERY = '(max-width: 767px)'

const WIDTH_KEY = 'ask_finora_width'
const MIN_WIDTH = 300
const DEFAULT_WIDTH = 340

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max)
}

function getMaxWidth() {
  return Math.min(640, Math.max(MIN_WIDTH, window.innerWidth * 0.5))
}

function timeAgo(ts) {
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Baru saja'
  if (minutes < 60) return `${minutes} mnt lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} hari lalu`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} mgg lalu`
  return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

/**
 * Panel "Ask Finora" — bisa di-collapse/expand.
 *
 * - State (collapsed) diangkat ke Layout.jsx, di-share via ChatPanelContext.
 * - Props: collapsed (bool), onToggle (fn).
 * - Bisa di-resize di desktop (seret tepi kiri / panah keyboard / klik-dua kali untuk reset),
 *   width tersimpan di localStorage. Maksimum 50% viewport (cap 640px).
 * - Di mobile (< md) tampil full-screen; di desktop sebagai panel samping.
 */
export default function AskFinoraPanel({ collapsed, onToggle }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [width, setWidth] = useState(() => {
    const saved = parseFloat(localStorage.getItem(WIDTH_KEY))
    return Number.isFinite(saved) ? clamp(saved, MIN_WIDTH, getMaxWidth()) : DEFAULT_WIDTH
  })
  const [dragging, setDragging] = useState(false)
  const [focusSignal, setFocusSignal] = useState(0)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia?.(MOBILE_QUERY).matches ?? false)
  const [maximized, setMaximized] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [activeConvoId, setActiveConvoId] = useState(null)
  const { messages, setMessages, input, setInput, loading, send, sendFollowUp, uploadAndParse, createDataset, confirmTransaction, rejectTransaction, commitUpload, lastUploadId, setLastUploadId, reset, followUpSuggestions, pendingFile, setPendingFile, removePendingFile, conversations, loadConversation, deleteConversation, taxConsult, startTaxConsultation, cancelTaxConsultation } = useChatbotShared()

  // Track viewport for mobile full-screen layout.
  useEffect(() => {
    const mq = window.matchMedia?.(MOBILE_QUERY)
    if (!mq) return
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Jaga lebar panel tetap di dalam batas saat viewport berubah.
  useEffect(() => {
    const onResize = () => setWidth(w => clamp(w, MIN_WIDTH, getMaxWidth()))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Persist collapsed state to localStorage
  useEffect(() => {
    try { localStorage.setItem('ask_finora_collapsed', String(collapsed)) } catch { /* ignore */ }
  }, [collapsed])

  // If an upload_id comes in via URL (e.g. upload flow), bind it to the chat
  // and greet the user about their dataset. Then clear the param.
  const uploadIdFromUrl = searchParams.get('upload_id')
  useEffect(() => {
    if (uploadIdFromUrl && !lastUploadId) {
      setLastUploadId(uploadIdFromUrl)
      if (messages.length === 0) {
        const welcomeMsg = `📎 File sudah diupload! Dataset kamu siap dianalisis.\n\nKamu bisa bertanya tentang data ini sebelum disimpan ke jurnal.\n\n💡 Coba tanya:\n- "Jelaskan isi data ini"\n- "Berapa total transaksi?"\n- "Akun mana yang paling banyak?"\n\nKetik **"simpan"** atau **"masukkan ke jurnal"** jika sudah selesai menganalisis.`
        setMessages(prev => [...prev, { role: 'assistant', content: welcomeMsg, time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }])
      }
      setFocusSignal(n => n + 1)
      const next = new URLSearchParams(searchParams)
      next.delete('upload_id')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadIdFromUrl, lastUploadId])

  // Focus input when panel opens via external event
  useEffect(() => {
    const onFocus = (event) => {
      setFocusSignal(n => n + 1)
      const detail = event.detail || {}
      if (detail.taxConsult) {
        startTaxConsultation()
      } else if (detail.prompt) {
        setInput(detail.prompt)
        if (detail.autoSend) setTimeout(() => send(detail.prompt), 0)
      }
    }
    window.addEventListener('open-chatbot', onFocus)
    return () => window.removeEventListener('open-chatbot', onFocus)
  }, [send, setInput, startTaxConsultation])

  const togglePanel = useCallback(() => {
    setHistoryOpen(false)
    onToggle?.()
  }, [onToggle])

  // Keluar dari mode layar penuh dengan tombol Escape.
  useEffect(() => {
    if (!maximized) return
    const onKey = (e) => {
      if (e.key === 'Escape') setMaximized(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [maximized])

  const handleNewChat = useCallback(() => {
    reset()
    setActiveConvoId(null)
    setHistoryOpen(false)
  }, [reset])

  const historyList = useMemo(
    () => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations]
  )

  const onSubmit = (e) => {
    e.preventDefault()
    send()
  }

  const persistWidth = (next) => {
    try {
      localStorage.setItem(WIDTH_KEY, String(next))
    } catch { /* ignore */ }
  }

  const startResize = (e) => {
    e.preventDefault()
    setDragging(true)
    const startX = e.clientX
    const startWidth = width
    const max = getMaxWidth()
    const prevCursor = document.body.style.cursor
    const prevSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    let pointerX = startX
    let raf = 0
    const applyWidth = () => {
      raf = 0
      setWidth(clamp(startWidth + (startX - pointerX), MIN_WIDTH, max))
    }
    const onMove = (ev) => {
      ev.preventDefault()
      pointerX = ev.clientX
      if (!raf) raf = requestAnimationFrame(applyWidth)
    }
    const onUp = () => {
      if (raf) cancelAnimationFrame(raf)
      setDragging(false)
      document.body.style.cursor = prevCursor
      document.body.style.userSelect = prevSelect
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setWidth(w => {
        const next = clamp(w, MIN_WIDTH, getMaxWidth())
        persistWidth(next)
        return next
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
    window.addEventListener('pointercancel', onUp, { once: true })
  }

  const resetWidth = () => {
    setWidth(DEFAULT_WIDTH)
    persistWidth(DEFAULT_WIDTH)
  }

  const onHandleKeyDown = (e) => {
    const step = e.shiftKey ? 48 : 16
    let next = null
    if (e.key === 'ArrowLeft') next = clamp(width + step, MIN_WIDTH, getMaxWidth())
    else if (e.key === 'ArrowRight') next = clamp(width - step, MIN_WIDTH, getMaxWidth())
    else if (e.key === 'Home') next = MIN_WIDTH
    else if (e.key === 'End') next = getMaxWidth()
    if (next !== null) {
      e.preventDefault()
      setWidth(next)
      persistWidth(next)
    }
  }

  const hasMessages = messages.length > 0

  const renderHistoryNav = (onClose) => (
    <nav className="flex min-h-0 w-full flex-1 flex-col" aria-label="Riwayat chat">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className="text-xs font-bold tracking-wide" style={{ color: 'var(--color-slate-heading)' }}>Riwayat Chat</span>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg transition hover:bg-white/5"
            style={{ color: 'var(--color-slate-muted)' }}
            title="Tutup riwayat"
            aria-label="Tutup riwayat"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <div className="px-3 pb-2">
        <button
          onClick={handleNewChat}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition hover:brightness-110"
          style={{ background: 'rgba(37, 99, 235, 0.12)', border: '1px solid rgba(96, 165, 250, 0.28)', color: 'var(--color-brand-soft)' }}
        >
          <Plus size={13} />
          Percakapan baru
        </button>
      </div>
      {historyList.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <MessageSquare size={18} style={{ color: 'var(--color-slate-muted)' }} />
          <p className="text-[11px]" style={{ color: 'var(--color-slate-muted)' }}>Belum ada riwayat percakapan</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 space-y-1 overflow-y-auto px-2 pb-4">
          {historyList.map((conv) => {
            const isActive = conv.id === activeConvoId
            return (
              <div
                key={conv.id}
                className="group relative flex items-center gap-1 rounded-xl transition hover:bg-white/5"
                style={isActive
                  ? { background: 'rgba(37, 99, 235, 0.1)', border: '1px solid rgba(96, 165, 250, 0.22)' }
                  : { border: '1px solid transparent' }}
              >
                <button
                  onClick={() => { loadConversation(conv.id); setActiveConvoId(conv.id); setHistoryOpen(false) }}
                  className="flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2 text-left"
                  aria-label={`Buka percakapan: ${conv.title}`}
                >
                  <span className="flex items-center gap-2">
                    <span className="truncate flex-1 text-xs font-semibold" style={{ color: isActive ? 'var(--color-brand-soft)' : 'var(--color-slate-heading)' }}>{conv.title}</span>
                    <span className="shrink-0 text-[9px] font-medium" style={{ color: 'var(--color-slate-muted)' }}>{timeAgo(conv.updatedAt)}</span>
                  </span>
                  {conv.preview && <span className="truncate text-[11px]" style={{ color: 'var(--color-slate-muted)' }}>{conv.preview}</span>}
                </button>
                <button
                  onClick={() => { deleteConversation(conv.id); if (conv.id === activeConvoId) setActiveConvoId(null) }}
                  className="mr-1.5 shrink-0 rounded-md p-1.5 transition opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-white/10"
                  style={{ color: 'var(--color-slate-muted)' }}
                  title="Hapus percakapan"
                  aria-label={`Hapus percakapan: ${conv.title}`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </nav>
  )

  const chatProps = {
    messages,
    input,
    setInput,
    loading,
    onSubmit,
    onReset: reset,
    autoFocus: true,
    focusSignal,
    hideHeader: true,
    variant: maximized ? 'full' : 'panel',
    uploadAndParse,
    createDataset,
    commitUpload,
    lastUploadId,
    followUpSuggestions,
    onFollowUp: sendFollowUp,
    onConfirmTransaction: confirmTransaction,
    onRejectTransaction: rejectTransaction,
    taxConsult,
    onStartTaxConsultation: startTaxConsultation,
    onCancelTaxConsultation: cancelTaxConsultation,
    pendingFile,
    onRemovePendingFile: removePendingFile,
    onFileSelect: setPendingFile,
  }

  return (
    <>
      {/* Floating toggle button — visible when collapsed */}
      <AnimatePresence>
        {collapsed && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={togglePanel}
            className="flex fixed bottom-6 right-6 z-50 items-center justify-center h-14 w-14 rounded-full shadow-2xl transition-colors"
            style={{
              background: 'linear-gradient(135deg, #1D4ED8, #2563EB)',
              boxShadow: '0 8px 32px rgba(15,23,42,0.12), 0 0 0 3px rgba(15,23,42,0.12)',
            }}
            title="Buka Asisten Finora"
            aria-label="Buka Asisten Finora"
          >
            <div className="relative">
              <MessageCircle size={22} className="text-white" />
              {hasMessages && (
                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full" style={{ background: '#059669', border: '2px solid #2563EB' }} />
              )}
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Full panel */}
      <AnimatePresence>
        {!collapsed && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: maximized ? '100%' : isMobile ? '100%' : width, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={dragging ? { duration: 0 } : { type: 'spring', stiffness: 350, damping: 30 }}
            className={maximized
              ? 'chat-canvas-bg fixed inset-0 z-[90] w-full flex flex-col overflow-hidden'
              : `${isMobile ? 'fixed inset-0 z-[70] w-full' : 'hidden md:flex relative shrink-0'} flex flex-col overflow-hidden`}
            style={{
              height: '100%',
              background: maximized ? 'none' : 'var(--color-glass-bg)',
              backdropFilter: maximized ? 'none' : 'blur(30px) saturate(180%)',
              borderLeft: maximized ? 'none' : '1px solid var(--color-border-soft)',
              boxShadow: maximized ? 'none' : '-24px 0 60px var(--color-shadow), 0 0 0 1px rgba(37, 99, 235, 0.08)',
            }}
            aria-label="Ask Finora"
          >
            {/* Resize handle — desktop only */}
            {!isMobile && !maximized && (
              <div
                onPointerDown={startResize}
                onDoubleClick={resetWidth}
                onKeyDown={onHandleKeyDown}
                tabIndex={0}
                role="separator"
                aria-orientation="vertical"
                aria-label="Ubah lebar panel chat"
                aria-valuemin={MIN_WIDTH}
                aria-valuemax={getMaxWidth()}
                aria-valuenow={Math.round(width)}
                title="Seret untuk mengubah lebar · klik dua kali untuk reset"
                className={`absolute left-0 inset-y-0 z-10 flex w-3 cursor-col-resize items-center justify-center select-none focus:outline-none transition-opacity duration-200 ${dragging ? 'opacity-100' : 'opacity-50 hover:opacity-100 focus-visible:opacity-100'}`}
                style={{ touchAction: 'none' }}
              >
                <span
                  className={`rounded-full transition-all duration-200 ${dragging ? 'h-16' : 'h-10'} w-1`}
                  style={{
                    background: dragging ? 'var(--color-brand-soft)' : 'var(--color-slate-muted)',
                    boxShadow: dragging ? '0 0 10px var(--color-brand-glow)' : 'none',
                  }}
                />
              </div>
            )}

            {/* Header — maximize: glass pill ala halaman chat */}
            {maximized ? (
              <header className="relative z-10 shrink-0 px-4 lg:px-6 pt-3 pb-2">
                <div
                  className="flex items-center gap-3 rounded-2xl px-4 py-2.5"
                  style={{ background: 'var(--color-glass-bg)', backdropFilter: 'blur(16px)', border: '1px solid var(--color-glass-border)', boxShadow: '0 4px 20px var(--color-shadow)' }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden" style={{ boxShadow: '0 4px 16px var(--color-brand-glow)' }}>
                        <img src="/assets/buddy/buddy-happy.png" alt="Buddy" className="h-full w-full object-contain" />
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2" style={{ background: '#059669', borderColor: 'var(--color-surface-2)' }}>
                        <span className="absolute inset-0 rounded-full animate-ping" style={{ background: '#059669', opacity: 0.5 }} />
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold truncate" style={{ color: 'var(--color-slate-heading)' }}>Asisten Finora</span>
                        <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(37, 99, 235, 0.15)', color: 'var(--color-brand-soft)', border: '1px solid rgba(37, 99, 235, 0.25)' }}>
                          <Sparkles size={8} />
                          AI
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-medium" style={{ color: 'var(--color-accent-emerald)' }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#059669' }} />
                        Online · Siap membantu
                      </div>
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-1">
                    {messages.length > 0 && (
                      <motion.button
                        whileTap={{ scale: 0.92 }}
                        onClick={reset}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all duration-200 hover:bg-white/5"
                        style={{ color: 'var(--color-slate-muted)', border: '1px solid var(--color-border-subtle)' }}
                        title="Mulai percakapan baru"
                      >
                        <RotateCcw size={13} />
                        Baru
                      </motion.button>
                    )}
                    <button
                      onClick={() => setMaximized(m => !m)}
                      className="p-1.5 rounded-lg transition hover:bg-white/5"
                      style={{ color: 'var(--color-slate-muted)' }}
                      title="Kecilkan panel"
                      aria-label="Kecilkan panel"
                    >
                      <Minimize2 size={16} />
                    </button>
                    <button
                      onClick={togglePanel}
                      className="p-1.5 rounded-lg transition hover:bg-white/5"
                      style={{ color: 'var(--color-slate-muted)' }}
                      title="Tutup panel"
                      aria-label="Tutup panel"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </header>
            ) : (
              /* Header — panel normal */
              <header className="relative flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <div className="relative shrink-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl overflow-hidden" style={{ boxShadow: '0 6px 20px var(--color-brand-glow)' }}>
                    <img src="/assets/buddy/buddy-happy.png" alt="Buddy" className="h-full w-full object-contain" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2" style={{ background: '#059669', borderColor: 'var(--color-surface-2)' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold leading-tight" style={{ color: 'var(--color-slate-heading)' }}>Asisten Finora</div>
                  <div className="flex items-center gap-1.5 text-[10px] font-medium" style={{ color: 'var(--color-accent-emerald)' }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#059669' }} />
                    Online
                  </div>
                </div>
                {messages.length > 0 && (
                  <button
                    onClick={reset}
                    className="p-1.5 rounded-lg transition hover:bg-white/5"
                    style={{ color: 'var(--color-slate-muted)' }}
                    title="Mulai percakapan baru"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
                {isMobile && (
                  <button
                    onClick={() => setHistoryOpen(o => !o)}
                    className="p-1.5 rounded-lg transition hover:bg-white/5"
                    style={{ color: 'var(--color-slate-muted)' }}
                    title="Riwayat chat"
                    aria-label="Riwayat chat"
                  >
                    <History size={16} />
                  </button>
                )}
                {!isMobile && (
                  <button
                    onClick={() => setMaximized(m => !m)}
                    className="p-1.5 rounded-lg transition hover:bg-white/5"
                    style={{ color: 'var(--color-slate-muted)' }}
                    title={maximized ? 'Kecilkan panel' : 'Maksimalkan layar penuh'}
                    aria-label={maximized ? 'Kecilkan panel' : 'Maksimalkan layar penuh'}
                  >
                    {maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  </button>
                )}
                <button
                  onClick={togglePanel}
                  className="p-1.5 rounded-lg transition hover:bg-white/5"
                  style={{ color: 'var(--color-slate-muted)' }}
                  title="Tutup panel"
                  aria-label="Tutup panel"
                >
                  <X size={16} />
                </button>
              </header>
            )}

            {/* Chat */}
            {maximized ? (
              <div className="relative flex flex-1 min-h-0 overflow-hidden px-4 lg:px-6 pb-2">
                {/* Riwayat chat — sidebar desktop saat fullscreen */}
                <aside className="hidden md:flex w-60 shrink-0 flex-col overflow-hidden rounded-2xl border-r" style={{ borderColor: 'var(--color-border-subtle)', background: 'var(--color-glass-bg)', backdropFilter: 'blur(16px)' }}>
                  {renderHistoryNav()}
                </aside>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  <AssistantChat className="flex-1 min-h-0" {...chatProps} />
                </div>
              </div>
            ) : (
              <div className="relative min-h-0 flex-1 overflow-hidden">
                <AssistantChat className="h-full" {...chatProps} />

                {/* Riwayat chat — drawer mobile */}
                {isMobile && historyOpen && (
                  <div className="absolute inset-0 z-20 flex">
                    <div className="absolute inset-0" style={{ background: 'rgba(15, 23, 42, 0.55)' }} onClick={() => setHistoryOpen(false)} />
                    <motion.div
                      initial={{ x: '-100%' }}
                      animate={{ x: 0 }}
                      exit={{ x: '-100%' }}
                      transition={{ type: 'spring', stiffness: 350, damping: 32 }}
                      className="relative flex h-full w-[82%] max-w-xs flex-col overflow-hidden"
                      style={{ background: 'var(--color-surface-card)', borderRight: '1px solid var(--color-border-soft)' }}
                    >
                      {renderHistoryNav(() => setHistoryOpen(false))}
                    </motion.div>
                  </div>
                )}
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
