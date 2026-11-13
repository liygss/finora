import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'
import AssistantChat from '../AssistantChat'
import { useChatbotShared } from '../../context/ChatbotContext'

export default function SetupStepChat({ onNext, onBack }) {
  const {
    messages, input, setInput, loading,
    send, sendFollowUp, uploadAndParse, createDataset,
    confirmTransaction, rejectTransaction, commitUpload,
    lastUploadId, followUpSuggestions, reset,
    pendingFile, setPendingFile, removePendingFile,
  } = useChatbotShared()

  const onSubmit = (e) => {
    e.preventDefault()
    send()
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40" style={{ background: 'linear-gradient(180deg, rgba(37,99,235,0.16), transparent)' }} />

      {/* Wizard top bar */}
      <div className="relative z-30 mx-auto w-full max-w-5xl px-4 pt-4 pb-2">
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3"
          style={{ background: 'var(--color-glass-bg)', backdropFilter: 'blur(24px) saturate(160%)', border: '1px solid var(--color-border-soft)', boxShadow: '0 12px 34px var(--color-shadow)' }}
        >
          <button
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200 hover:scale-105"
            style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-slate-body)' }}
            title="Kembali ke profil & COA"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold" style={{ color: 'var(--color-slate-heading)' }}>Input via Chat</span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(5, 150, 105, 0.12)', color: 'var(--color-accent-emerald)' }}>
                <span className="h-1 w-1 rounded-full" style={{ background: '#059669' }} />
                Step 2
              </span>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--color-slate-muted)' }}>Ceritakan transaksi atau tanya apa saja — AI bantu langsung</p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {messages.length > 1 && (
              <button
                onClick={reset}
                className="flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 hover:scale-105"
                style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-slate-muted)' }}
                title="Mulai percakapan baru"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              </button>
            )}
            <button
              onClick={onNext}
              className="hidden sm:flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all duration-200 hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #1D4ED8, #2563EB)', boxShadow: '0 4px 14px rgba(15,23,42,0.12)' }}
            >
              Lanjut ke Upload <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Chat area — full Asisten Finora experience */}
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

      {/* Mobile "Lanjut" button */}
      <div className="sm:hidden flex justify-center pb-3">
        <button
          onClick={onNext}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all duration-200"
          style={{ background: 'linear-gradient(135deg, #1D4ED8, #2563EB)', boxShadow: '0 4px 14px rgba(15,23,42,0.12)' }}
        >
          Lanjut ke Upload <ChevronRight size={12} />
        </button>
      </div>
    </div>
  )
}
