import { useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'
import { ArrowLeft, RotateCcw, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import AssistantChat from '../components/AssistantChat'
import { useChatbotShared } from '../context/ChatbotContext'

export default function ChatbotPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const uploadIdFromUrl = searchParams.get('upload_id')
  const { messages, input, setInput, loading, send, sendFollowUp, uploadAndParse, createDataset, confirmTransaction, rejectTransaction, commitUpload, lastUploadId, setLastUploadId, reset, followUpSuggestions, pendingFile, setPendingFile, removePendingFile } = useChatbotShared()

  // Jika ada upload_id dari URL, set sebagai active upload_id
  useEffect(() => {
    if (uploadIdFromUrl && !lastUploadId) {
      setLastUploadId(uploadIdFromUrl)
      // Kirim sapaan otomatis tentang data yang diupload
      if (messages.length === 0) {
        const welcomeMsg = `📎 File sudah diupload! Dataset kamu siap dianalisis.\n\nKamu bisa bertanya tentang data ini sebelum disimpan ke jurnal.\n\n💡 Coba tanya:\n- "Jelaskan isi data ini"\n- "Berapa total transaksi?"\n- "Akun mana yang paling banyak?"\n\nKetik **"simpan"** jika sudah selesai menganalisis.`
        setMessages(prev => [...prev, { role: 'assistant', content: welcomeMsg, time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }])
      }
    }
  }, [uploadIdFromUrl])

  const onSubmit = (e) => {
    e.preventDefault()
    send()
  }

  return (
    <div className="h-full flex flex-col min-h-0 chat-canvas-bg">
      {/* Top bar — glass pill */}
      <header className="relative z-10 shrink-0 px-4 lg:px-6 pt-3 pb-2">
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-2.5"
          style={{ background: 'var(--color-glass-bg)', backdropFilter: 'blur(16px)', border: '1px solid var(--color-glass-border)', boxShadow: '0 4px 20px var(--color-shadow)' }}
        >
          {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200 hover:scale-105"
            style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-slate-body)' }}
            title="Kembali"
          >
            <ArrowLeft size={17} />
          </button>

          {/* Buddy avatar + status */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden" style={{ boxShadow: '0 4px 16px var(--color-brand-glow)' }}>
                <img src="/assets/buddy/buddy-happy.png" alt="Buddy" className="h-full w-full object-contain" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2" style={{ background: '#10B981', borderColor: 'var(--color-surface-2)' }}>
                <span className="absolute inset-0 rounded-full animate-ping" style={{ background: '#10B981', opacity: 0.5 }} />
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold truncate" style={{ color: 'var(--color-slate-heading)' }}>Asisten Finora</span>
                <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--color-brand-soft)', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
                  <Sparkles size={8} />
                  AI
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-medium" style={{ color: 'var(--color-accent-emerald)' }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#10B981' }} />
                Online · Siap membantu
              </div>
            </div>
          </div>

          {/* Right actions */}
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
          </div>
        </div>
      </header>

      {/* Chat area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <AssistantChat
          className="h-full"
          messages={messages}
          input={input}
          setInput={setInput}
          loading={loading}
          onSubmit={onSubmit}
          onReset={reset}
          autoFocus
          hideHeader
          variant="full"
          uploadAndParse={uploadAndParse}
          createDataset={createDataset}
          commitUpload={commitUpload}
          lastUploadId={lastUploadId}
          followUpSuggestions={followUpSuggestions}
          onFollowUp={sendFollowUp}
          onConfirmTransaction={confirmTransaction}
          onRejectTransaction={rejectTransaction}
          pendingFile={pendingFile}
          onRemovePendingFile={removePendingFile}
          onFileSelect={setPendingFile}
        />
      </div>
    </div>
  )
}
