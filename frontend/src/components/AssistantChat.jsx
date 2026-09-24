import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Send, User, X, RotateCcw, FileText, Wallet, TrendingUp, ReceiptText, Landmark, Calculator, HelpCircle, Paperclip, Zap, Shield, CheckCircle2, ArrowDown, FileSpreadsheet } from 'lucide-react'
import { renderMarkdown, TypingIndicator, CopyButton, FileAttachmentChip, DatasetTable, TransactionConfirm, DateSeparator, ActionBar, SummaryCard, MetricHighlight } from '../utils/chatRender'

const SUGGESTIONS = [
  { text: 'Apa itu SAK EMKM?', icon: FileText, tone: 'blue' },
  { text: 'Cara membuat jurnal penjualan?', icon: ReceiptText, tone: 'sky' },
  { text: 'Bagaimana menghitung PPh Final UMKM?', icon: Calculator, tone: 'amber' },
  { text: 'Fitur apa saja yang ada di Finora?', icon: HelpCircle, tone: 'emerald' },
]

const FINANCIAL_SUGGESTIONS = [
  { text: 'Berapa laba bersih bulan ini?', icon: Wallet, tone: 'emerald' },
  { text: 'Tampilkan neraca saldo', icon: Landmark, tone: 'blue' },
  { text: 'Ringkasan keuangan saya', icon: TrendingUp, tone: 'emerald' },
]

const CAPABILITIES = [
  { text: 'Catat jurnal', icon: Zap },
  { text: 'Analisis keuangan', icon: TrendingUp },
  { text: 'Konsultasi pajak', icon: Shield },
]

const TONE_STYLES = {
  blue: { bg: 'rgba(59, 130, 246, 0.12)', color: 'var(--color-brand-soft)', border: 'rgba(59, 130, 246, 0.25)' },
  sky: { bg: 'rgba(34, 211, 238, 0.1)', color: 'var(--color-accent-cyan)', border: 'rgba(34, 211, 238, 0.22)' },
  amber: { bg: 'rgba(251, 191, 36, 0.1)', color: 'var(--color-accent-amber)', border: 'rgba(251, 191, 36, 0.22)' },
  emerald: { bg: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-accent-emerald)', border: 'rgba(16, 185, 129, 0.22)' },
}

const ACCEPT_TYPES = '.csv,.xlsx,.xls,.pdf'

export default function AssistantChat({
  className = '',
  messages,
  input,
  setInput,
  loading,
  onSubmit,
  onReset,
  onClose,
  autoFocus = false,
  hideHeader = false,
  focusSignal = 0,
  uploadAndParse,
  createDataset,
  commitUpload,
  lastUploadId,
  followUpSuggestions = [],
  onFollowUp,
  onConfirmTransaction,
  onRejectTransaction,
  variant = 'panel',
  pendingFile = null,
  onRemovePendingFile,
  onFileSelect,
}) {
  const inputRef = useRef(null)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)
  const scrollRef = useRef(null)
  const isAtBottomRef = useRef(true)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const isFull = variant === 'full'

  useEffect(() => {
    const el = scrollRef.current
    if (el && isAtBottomRef.current) el.scrollTop = el.scrollHeight
  }, [messages, loading])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    isAtBottomRef.current = atBottom
    setShowScrollBtn(!atBottom)
  }, [])

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [])

  useEffect(() => {
    if (autoFocus || focusSignal > 0) setTimeout(() => inputRef.current?.focus(), 120)
  }, [autoFocus, focusSignal])

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0]
    if (file && onFileSelect) {
      onFileSelect(file)
    }
    e.target.value = ''
  }, [onFileSelect])

  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleSubmit = useCallback((e) => {
    e.preventDefault()
    onSubmit?.(e)
  }, [onSubmit])

  const handleConfirmDataset = useCallback((items) => {
    if (createDataset) createDataset(items)
  }, [createDataset])

  const isEmpty = messages.length === 0

  // Group consecutive messages by role for avatar display
  const groupedMessages = useMemo(() => {
    if (!isFull) return messages.map((m, i) => ({ ...m, _index: i, _showAvatar: true }))
    return messages.map((m, i) => {
      const prev = messages[i - 1]
      const showAvatar = !prev || prev.role !== m.role
      return { ...m, _index: i, _showAvatar: showAvatar }
    })
  }, [messages, isFull])

  return (
    <div className={`relative flex flex-col ${className}`}>
      {/* Top brand glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24" style={{ background: 'linear-gradient(180deg, rgba(59,130,246,0.15), transparent)' }} />

      {/* Header — panel mode only */}
      {!hideHeader && (
        <div className="relative flex items-center gap-3 px-4 py-3">
          <div className="relative shrink-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl overflow-hidden" style={{ boxShadow: '0 6px 20px var(--color-brand-glow)' }}>
              <img src="/assets/buddy/buddy-happy.png" alt="Buddy" className="h-full w-full object-contain" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2" style={{ background: '#10B981', borderColor: 'var(--color-surface-2)' }}>
              <span className="absolute h-full w-full rounded-full animate-ping" style={{ background: 'rgba(16,185,129,0.4)' }} />
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold leading-tight" style={{ color: 'var(--color-slate-heading)' }}>Asisten Finora</div>
            <div className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: 'var(--color-accent-emerald)' }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#10B981' }} />
              Online · Siap membantu
            </div>
          </div>
          <div className="ml-auto flex items-center gap-0.5">
            {messages.length > 0 && (
              <motion.button whileTap={{ scale: 0.9 }} onClick={onReset} className="p-2 rounded-xl transition" style={{ color: 'var(--color-slate-muted)' }} title="Mulai percakapan baru">
                <RotateCcw size={16} />
              </motion.button>
            )}
            {onClose && (
              <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="p-2 rounded-xl transition" style={{ color: 'var(--color-slate-body)' }} title="Tutup">
                <X size={18} />
              </motion.button>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} onScroll={onScroll} className="relative flex-1 min-h-0 overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
        <div className="pointer-events-none sticky top-0 z-[6] h-9 shrink-0 chat-fade-top" />
        <div className={`mx-auto w-full px-4 py-4 space-y-4 ${isFull ? 'max-w-3xl' : 'max-w-3xl'}`}>

          {/* ===== EMPTY STATE — Full page hero ===== */}
          {isFull && isEmpty && !loading && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-in">
              {/* Buddy hero with pulse rings */}
              <div className="relative mb-6">
                <div className="relative">
                  {/* Outer pulse ring */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="h-24 w-24 rounded-full animate-pulse-ring" style={{ border: '2px solid rgba(59, 130, 246, 0.2)' }} />
                  </div>
                  {/* Inner pulse ring */}
                  <div className="absolute inset-0 flex items-center justify-center" style={{ animationDelay: '0.5s' }}>
                    <span className="h-20 w-20 rounded-full animate-pulse-ring" style={{ border: '1.5px solid rgba(96, 165, 250, 0.15)', animationDelay: '0.5s' }} />
                  </div>
                  {/* Avatar */}
                  <motion.div
                    initial={{ scale: 0, rotate: -8 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
                    className="relative z-10"
                  >
                    <div className="rounded-2xl p-3 overflow-hidden animate-glow-pulse" style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.25), rgba(59,130,246,0.1))', border: '1px solid rgba(96, 165, 250, 0.3)', boxShadow: '0 12px 40px var(--color-brand-glow)' }}>
                      <img src="/assets/buddy/buddy-happy.png" alt="Buddy" className="h-12 w-12 object-contain" />
                    </div>
                  </motion.div>
                </div>
              </div>

              <motion.h2
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-2xl font-extrabold"
                style={{ color: 'var(--color-slate-heading)', letterSpacing: '-0.02em' }}
              >
                Halo, ada yang bisa saya bantu?
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-sm mt-2 mb-8 max-w-sm"
                style={{ color: 'var(--color-slate-muted)' }}
              >
                Ketik pertanyaan, ceritakan transaksi, atau pilih salah satu topik di bawah
              </motion.p>

              {/* Capability pills */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.65 }}
                className="flex items-center gap-2"
              >
                {CAPABILITIES.map((cap) => (
                  <span key={cap.text} className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: 'var(--color-surface-card)', color: 'var(--color-slate-muted)', border: '1px solid var(--color-border-subtle)' }}>
                    <cap.icon size={10} />
                    {cap.text}
                  </span>
                ))}
              </motion.div>
            </div>
          )}

          {/* ===== EMPTY STATE — Panel mode (original) ===== */}
          {!isFull && isEmpty && !loading && (
            <div className="flex flex-col items-center justify-center min-h-[38vh] text-center animate-fade-in">
              <motion.div
                initial={{ scale: 0, rotate: -8 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.08 }}
                className="mb-5"
              >
                <div className="rounded-2xl p-2.5 overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.2), rgba(59,130,246,0.08))', border: '1px solid rgba(96, 165, 250, 0.28)', boxShadow: '0 8px 26px var(--color-brand-glow)' }}>
                  <img src="/assets/buddy/buddy-happy.png" alt="Buddy" className="h-8 w-8 object-contain" />
                </div>
              </motion.div>
              <h2 className="text-xl font-extrabold" style={{ color: 'var(--color-slate-heading)' }}>Halo, ada yang bisa saya bantu?</h2>
              <p className="text-sm mt-1.5 mb-6" style={{ color: 'var(--color-slate-muted)' }}>Ketik pertanyaan atau upload file transaksi, atau pilih topik di bawah ini</p>
              <div className="w-full max-w-md space-y-2 text-left">
                {[...SUGGESTIONS, ...FINANCIAL_SUGGESTIONS].map((s) => (
                  <SuggestionChip key={s.text} {...s} onClick={() => { setInput(s.text); inputRef.current?.focus() }} />
                ))}
              </div>
            </div>
          )}

          {/* Date separator — full page only */}
          {isFull && !isEmpty && <DateSeparator />}

          {/* Messages */}
          {groupedMessages.map((msg) => (
            <motion.div
              key={msg._index}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' ? (
                <>
                  <div className="shrink-0 self-start">
                    {msg._showAvatar ? (
                      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl overflow-hidden" style={{ boxShadow: '0 4px 14px var(--color-brand-glow)' }}>
                        <img src="/assets/buddy/buddy-happy.png" alt="Buddy" className="h-full w-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-8" />
                    )}
                  </div>

                  <div
                    className={`group max-w-[82%] ${isFull ? 'max-w-[75%]' : ''} rounded-[20px] transition-colors duration-200 hover:bg-white/[0.03]`}
                    style={{
                      background: 'var(--color-surface-card)',
                      border: '1px solid var(--color-border-subtle)',
                      color: 'var(--color-slate-text)',
                      boxShadow: isFull ? '0 4px 24px rgba(0, 0, 0, 0.22)' : '0 6px 18px rgba(0, 0, 0, 0.18)',
                      borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 6, borderBottomRightRadius: 20,
                      padding: isFull ? '12px 16px' : '10px 14px',
                    }}
                  >
                    {msg.files && msg.files.length > 0 && (
                      <div className="mb-1">
                        {msg.files.map((f, fi) => <FileAttachmentChip key={fi} file={f} />)}
                      </div>
                    )}

                    {msg.content && (
                      <div className={`whitespace-pre-wrap leading-relaxed ${isFull ? 'text-[14px]' : 'text-sm'}`}>
                        {renderMarkdown(msg.content)}
                      </div>
                    )}

                    {msg.dataset && (
                      <DatasetTable items={msg.dataset.items} status={msg.dataset.status} onConfirm={handleConfirmDataset} />
                    )}

                    {msg.transaction && (
                      <TransactionConfirm
                        transaction={msg.transaction}
                        onConfirm={onConfirmTransaction}
                        onReject={onRejectTransaction}
                      />
                    )}

                    {msg.has_financial_data && (
                      <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(16, 185, 129, 0.12)', color: 'var(--color-accent-emerald)' }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10B981' }} />
                          Menggunakan data keuangan Anda
                        </span>
                      </div>
                    )}

                    {msg.actions && msg.actions.length > 0 && (
                      <ActionBar actions={msg.actions} onAction={(action) => {
                        if (action.prompt) {
                          setInput(action.prompt)
                          setTimeout(() => inputRef.current?.focus(), 60)
                        }
                      }} />
                    )}

                    <div className="flex items-center gap-2 mt-1.5 justify-between">
                      <span className="text-[10px] opacity-70" style={{ color: 'var(--color-slate-muted)' }}>{msg.time}</span>
                      {msg.content && <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"><CopyButton text={msg.content} /></span>}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className={`group max-w-[82%] ${isFull ? 'max-w-[75%]' : ''} text-white rounded-[20px] transition-all duration-200 hover:brightness-110`}
                    style={{
                      background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)',
                      boxShadow: '0 6px 18px var(--color-brand-glow), inset 0 1px 1px rgba(255,255,255,0.25)',
                      borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 6,
                      padding: isFull ? '12px 16px' : '10px 14px',
                    }}
                  >
                    {msg.files && msg.files.length > 0 && (
                      <div className="mb-1">
                        {msg.files.map((f, fi) => <FileAttachmentChip key={fi} file={f} />)}
                      </div>
                    )}

                    {msg.content && (
                      <div className={`whitespace-pre-wrap leading-relaxed ${isFull ? 'text-[14px]' : 'text-sm'}`}>
                        {msg.content}
                      </div>
                    )}

                    {msg.dataset && (
                      <DatasetTable items={msg.dataset.items} status={msg.dataset.status} onConfirm={handleConfirmDataset} />
                    )}

                    <div className="flex items-center gap-2 mt-1.5 justify-end">
                      <span className="text-[10px] opacity-70" style={{ color: 'rgba(255,255,255,0.65)' }}>{msg.time}</span>
                    </div>
                  </div>

                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white self-start" style={{ background: 'linear-gradient(135deg, #475569 0%, #334155 100%)', border: '1px solid rgba(148, 163, 184, 0.45)', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.35)' }}>
                    <User size={15} />
                  </div>
                </>
              )}
            </motion.div>
          ))}

          {/* Follow-up suggestions */}
          {followUpSuggestions.length > 0 && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap gap-2 pt-1"
            >
              {followUpSuggestions.map((suggestion, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + i * 0.08 }}
                  whileHover={{ scale: 1.03, y: -1, boxShadow: '0 4px 16px rgba(59, 130, 246, 0.25)' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onFollowUp ? onFollowUp(suggestion.text) : setInput(suggestion.text)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-200"
                  style={{
                    background: 'var(--color-surface-card)',
                    border: '1px solid var(--color-border-subtle)',
                    color: 'var(--color-brand-soft)',
                    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.1)',
                  }}
                >
                  <Zap size={11} />
                  {suggestion.text}
                </motion.button>
              ))}
            </motion.div>
          )}

          {/* Commit button — tampil saat ada upload staged */}
          {lastUploadId && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="pt-2"
            >
              <button
                onClick={() => commitUpload && commitUpload(lastUploadId)}
                className="w-full flex items-center justify-center gap-2 text-sm font-semibold px-4 py-3 rounded-xl transition-all duration-200 hover:scale-[1.01]"
                style={{
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  color: '#fff',
                  boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                }}
              >
                <CheckCircle2 size={16} /> Simpan ke Jurnal
              </button>
            </motion.div>
          )}

          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        <div className="pointer-events-none sticky bottom-0 z-[6] h-9 shrink-0 chat-fade-bottom" />

        {/* Scroll-to-bottom FAB */}
        {showScrollBtn && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToBottom}
            className="sticky bottom-4 left-1/2 -translate-x-1/2 z-20 flex h-9 w-9 items-center justify-center rounded-full text-white transition-all duration-200 hover:scale-110"
            style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', color: 'var(--color-brand-soft)' }}
            title="Scroll ke bawah"
          >
            <ArrowDown size={16} />
          </motion.button>
        )}
      </div>

      {/* ===== COMPOSER — Full page variant ===== */}
      {isFull ? (
        <form onSubmit={handleSubmit} className="relative px-4 pb-4 pt-1">
          <div className="mx-auto w-full max-w-3xl">
            {/* Pending file chip */}
            {pendingFile && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="inline-flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                  {pendingFile.name.endsWith('.pdf') ? <FileText size={15} style={{ color: 'var(--color-accent-blue)' }} /> : <FileSpreadsheet size={15} style={{ color: 'var(--color-accent-blue)' }} />}
                  <span className="text-xs font-medium truncate max-w-[180px]" style={{ color: 'var(--color-slate-heading)' }}>{pendingFile.name}</span>
                  <span className="text-[10px] font-medium" style={{ color: 'var(--color-accent-amber)' }}>Siap dikirim</span>
                  <button type="button" onClick={onRemovePendingFile} className="ml-0.5 p-0.5 rounded-md transition hover:bg-white/10" style={{ color: 'var(--color-slate-muted)' }}>
                    <X size={13} />
                  </button>
                </div>
              </div>
            )}
            <div
              className="chat-composer-full flex items-end gap-2 rounded-2xl p-2.5 pl-4"
              style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-soft)', boxShadow: '0 8px 32px var(--color-shadow)' }}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={ACCEPT_TYPES}
                onChange={handleFileSelect}
                disabled={loading}
              />
              {onFileSelect && (
                <button
                  type="button"
                  onClick={handleAttachClick}
                  disabled={loading}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200 hover:scale-105 hover:bg-white/5 disabled:opacity-40"
                  style={{ color: pendingFile ? 'var(--color-brand-soft)' : 'var(--color-slate-muted)' }}
                  title="Upload file (CSV, XLSX, PDF)"
                >
                  <Paperclip size={20} />
                </button>
              )}

              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={pendingFile ? "Ketik pesan untuk file ini..." : "Ketik pertanyaan atau ceritakan transaksi..."}
                disabled={loading}
                className="flex-1 min-w-0 bg-transparent text-[15px] outline-none placeholder:opacity-50 py-2.5"
                style={{ color: 'var(--color-slate-heading)' }}
              />
              <motion.button
                whileTap={{ scale: 0.88 }}
                type="submit"
                disabled={loading || (!input.trim() && !pendingFile)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-35 transition-all duration-200 hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)', boxShadow: '0 4px 14px var(--color-brand-glow)' }}
                aria-label="Kirim"
              >
                <Send size={17} />
              </motion.button>
            </div>
            {onFileSelect && (
              <p className="text-center text-[10px] mt-2" style={{ color: 'var(--color-slate-muted)' }}>
                Upload file transaksi (CSV/XLSX) untuk buat jurnal otomatis, atau file PDF untuk tanyakan isinya
              </p>
            )}
          </div>
        </form>
      ) : (
        /* ===== COMPOSER — Panel variant (original) ===== */
        <form onSubmit={handleSubmit} className="relative px-3 pb-3 pt-1">
          <div className="mx-auto w-full max-w-3xl">
            {/* Pending file chip */}
            {pendingFile && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="inline-flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                  {pendingFile.name.endsWith('.pdf') ? <FileText size={14} style={{ color: 'var(--color-accent-blue)' }} /> : <FileSpreadsheet size={14} style={{ color: 'var(--color-accent-blue)' }} />}
                  <span className="text-xs font-medium truncate max-w-[140px]" style={{ color: 'var(--color-slate-heading)' }}>{pendingFile.name}</span>
                  <span className="text-[10px] font-medium" style={{ color: 'var(--color-accent-amber)' }}>Siap dikirim</span>
                  <button type="button" onClick={onRemovePendingFile} className="ml-0.5 p-0.5 rounded-md transition hover:bg-white/10" style={{ color: 'var(--color-slate-muted)' }}>
                    <X size={12} />
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-end gap-2 rounded-2xl p-2 pl-4 transition focus-within:shadow-[0_0_0_3px_var(--color-brand-glow)]" style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', boxShadow: '0 8px 28px var(--color-shadow)' }}>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={ACCEPT_TYPES}
                onChange={handleFileSelect}
                disabled={loading}
              />
              {onFileSelect && (
                <button
                  type="button"
                  onClick={handleAttachClick}
                  disabled={loading}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200 hover:scale-105 disabled:opacity-40"
                  style={{ color: pendingFile ? 'var(--color-brand-soft)' : 'var(--color-slate-muted)' }}
                  title="Upload file (CSV, XLSX, PDF)"
                >
                  <Paperclip size={18} />
                </button>
              )}

              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={pendingFile ? "Ketik pesan untuk file ini..." : "Ketik pertanyaan atau ceritakan transaksi..."}
                disabled={loading}
                className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:opacity-60 py-2"
                style={{ color: 'var(--color-slate-heading)' }}
              />
              <motion.button
                whileTap={{ scale: 0.88 }}
                type="submit"
                disabled={loading || (!input.trim() && !pendingFile)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-35"
                style={{ background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)', boxShadow: '0 4px 14px var(--color-brand-glow)' }}
                aria-label="Kirim"
              >
                <Send size={15} />
              </motion.button>
            </div>
            {onFileSelect && (
              <p className="text-center text-[10px] mt-1.5" style={{ color: 'var(--color-slate-muted)' }}>
                Upload file transaksi (CSV/XLSX) untuk buat jurnal otomatis, atau file PDF untuk tanyakan isinya
              </p>
            )}
          </div>
        </form>
      )}
    </div>
  )
}

function SuggestionChip({ text, icon: Icon, tone, onClick }) {
  const style = TONE_STYLES[tone] || TONE_STYLES.blue
  return (
    <motion.button
      whileHover={{ y: -2, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition"
      style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)' }}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
        <Icon size={15} />
      </span>
      <span className="text-xs font-medium leading-snug flex-1" style={{ color: 'var(--color-slate-text)' }}>{text}</span>
    </motion.button>
  )
}

