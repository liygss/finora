import { useState, useEffect, useCallback } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import AskFinoraPanel from './AskFinoraPanel'
import ComplaintModal from './ComplaintModal'
import NotificationsDropdown from './NotificationsDropdown'
import ThemeToggle from './ThemeToggle'
import GuidedTour from './GuidedTour'
import CommandPalette from './CommandPalette'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import ChatPanelContext from '../context/ChatPanelContext'
import { TOUR_STORAGE_PREFIX, BUDDY_STORAGE_PREFIX } from '../data/tourSteps'
import { Menu, Search, Download, CircleHelp, Headphones, ShieldCheck } from 'lucide-react'

export default function Layout() {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [key, setKey] = useState(0)
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [downloadFile, setDownloadFile] = useState('')
  const [tourOpen, setTourOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [complaintOpen, setComplaintOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(() => {
    const saved = localStorage.getItem('ask_finora_collapsed')
    return saved !== null ? saved !== 'true' : true
  })
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    setKey(k => k + 1)
  }, [location.pathname])

  // Buka panel otomatis saat navigasi membawa upload_id (alur upload).
  useEffect(() => {
    if (location.search.includes('upload_id=')) setPanelOpen(true)
  }, [location.search])

  // Auto-open GuidedTour on first dashboard visit after Buddy is dismissed.
  useEffect(() => {
    if (!user?.id) return
    try {
      const buddySeen = localStorage.getItem(BUDDY_STORAGE_PREFIX + user.id)
      if (buddySeen !== 'true') return
    } catch { /* ignore */ }
    try {
      const seen = localStorage.getItem(TOUR_STORAGE_PREFIX + user.id)
      if (seen === 'true') return
    } catch { /* ignore */ }
    const t = setTimeout(() => setTourOpen(true), 400)
    return () => clearTimeout(t)
  }, [user?.id])

  // Buka ComplaintModal dari sidebar "Chat ke CS"
  useEffect(() => {
    const openCS = () => setComplaintOpen(true)
    window.addEventListener('open-cs', openCS)
    return () => window.removeEventListener('open-cs', openCS)
  }, [])

  // Pintasan keyboard ⌘K / Ctrl+K untuk membuka pencarian.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setSearchOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const startTour = () => {
    if (user?.id) {
      try {
        localStorage.removeItem(TOUR_STORAGE_PREFIX + user.id)
      } catch { /* ignore */ }
    }
    setTourOpen(true)
  }

  const togglePanel = useCallback(() => {
    setPanelOpen(p => !p)
  }, [])

  // Listen for open-chatbot events from anywhere (e.g. Quick Actions)
  useEffect(() => {
    const onOpen = () => setPanelOpen(true)
    window.addEventListener('open-chatbot', onOpen)
    return () => window.removeEventListener('open-chatbot', onOpen)
  }, [])

  useEffect(() => {
    const platform = navigator.platform.toLowerCase()
    const isMac = platform.includes('mac')
    const isWin = platform.includes('win')
    const ext = isMac ? '.dmg' : isWin ? '.exe' : '.AppImage'
    const name = isMac ? 'Finora-1.1.0-arm64.dmg'
      : isWin ? 'Finora.Setup.1.1.0.exe'
      : 'Finora-1.1.0.AppImage'

    client.get('/downloads')
      .then(r => {
        const files = Array.isArray(r.data) ? r.data : []
        if (files.some(f => f.endsWith(ext))) {
          setDownloadUrl(`/api/downloads/${encodeURIComponent(name)}`)
          setDownloadFile(name)
        }
      })
      .catch(() => {})
  }, [])

  return (
    <ChatPanelContext.Provider value={{ panelOpen, togglePanel }}>
    <div className="app-bg flex h-screen overflow-hidden min-w-0">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="relative z-40 flex h-18 items-center gap-3 sm:gap-4 px-3 sm:px-4 lg:px-6 overflow-hidden" style={{ background: 'var(--color-header-bg)', backdropFilter: 'blur(20px) saturate(180%)', borderBottom: '1px solid rgba(148, 163, 184, 0.14)' }}>
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2.5 rounded-xl transition-all duration-300 hover:bg-white/5" style={{ color: 'var(--color-slate-body)' }}>
            <Menu size={20} />
          </button>

          {/* Logo - Mobile */}
          <div className="flex lg:hidden items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden" style={{ borderRadius: '0.75rem', boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)' }}>
              <img src="/finora_logo.jpeg" alt="Finora" className="h-full w-full object-cover" />
            </div>
            <span className="text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }}>Finora</span>
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3 min-w-0 flex-wrap justify-end">
            {/* Search */}
            <button data-tour="header-search" onClick={() => setSearchOpen(true)} className="hidden md:flex items-center gap-2.5 rounded-xl px-3 lg:px-4 py-2.5 text-sm transition-all duration-300 cursor-pointer w-44 lg:w-56 hover:shadow-md min-w-0" style={{ background: 'var(--color-surface-card)', border: '1px solid rgba(148, 163, 184, 0.14)', color: 'var(--color-slate-muted)' }}>
              <Search size={14} />
              <span>Cari...</span>
              <kbd className="ml-auto rounded-lg px-2 py-0.5 text-[10px] font-medium" style={{ background: 'var(--color-surface-card)', border: '1px solid rgba(148, 163, 184, 0.18)', color: 'var(--color-slate-muted)' }}>⌘K</kbd>
            </button>

            {/* Download Desktop App */}
            {downloadUrl && (
              <a
                href={downloadUrl}
                download={downloadFile}
                className="hidden sm:flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #059669, #10B981)',
                  color: '#fff',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                }}
                title={`Download ${downloadFile}`}
              >
                <Download size={14} />
                <span className="hidden lg:inline">Download App</span>
              </a>
            )}

            {/* Admin: Kelola Feedback */}
            {user?.role === 'ADMIN' && (
              <button
                onClick={() => navigate('/admin/feedback')}
                title="Kelola Feedback"
                aria-label="Kelola Feedback"
                className="flex h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10 shrink-0 items-center justify-center rounded-full transition-all duration-300 hover:scale-105"
                style={{ background: 'rgba(139, 92, 246, 0.12)', border: '1px solid rgba(139, 92, 246, 0.25)', color: '#C4B5FD' }}
              >
                <ShieldCheck size={16} />
              </button>
            )}

            {/* Chat ke CS — semua user */}
            <button
              onClick={() => setComplaintOpen(true)}
              title="Chat ke CS"
              aria-label="Chat ke CS"
              className="flex h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10 shrink-0 items-center justify-center rounded-full transition-all duration-300 hover:scale-105"
              style={{ background: 'var(--color-surface-faint)', border: '1px solid var(--color-border-soft)', color: 'var(--color-slate-body)' }}
            >
              <Headphones size={16} />
            </button>

            {/* Notification bell */}
            <div className="shrink-0">
              <NotificationsDropdown />
            </div>

            {/* Tutorial / Bantuan */}
            <button
              onClick={startTour}
              title="Tutorial penggunaan"
              aria-label="Buka tutorial"
              className="hidden sm:flex h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10 shrink-0 items-center justify-center rounded-full transition-all duration-300 hover:scale-105"
              style={{ background: 'var(--color-surface-faint)', border: '1px solid var(--color-border-soft)', color: 'var(--color-slate-body)' }}
            >
              <CircleHelp size={16} />
            </button>

            {/* Theme toggle */}
            <div className="shrink-0">
              <ThemeToggle />
            </div>

            {/* Brand badge */}
            <div className="hidden lg:flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold shrink-0" style={{ background: 'rgba(59, 130, 246, 0.14)', color: 'var(--color-accent-blue)', border: '1px solid rgba(96, 165, 250, 0.28)' }}>
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: 'var(--color-brand-soft)' }} />
              Finora
            </div>
          </div>
        </header>

        {/* Main content with page transition */}
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 lg:p-6">
          <div key={key} className="animate-fade-in min-w-0">
            <Outlet />
          </div>
        </main>
      </div>

      <AskFinoraPanel collapsed={!panelOpen} onToggle={togglePanel} />

      {complaintOpen && <ComplaintModal onClose={() => setComplaintOpen(false)} />}
      <GuidedTour open={tourOpen} onClose={() => setTourOpen(false)} />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
    </ChatPanelContext.Provider>
  )
}
