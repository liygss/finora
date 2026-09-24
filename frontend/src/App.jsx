import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { ChatbotProvider } from './context/ChatbotContext'
import Layout from './components/Layout'
import BuddyOnboarding from './components/BuddyOnboarding'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import SetupPage from './pages/SetupPage'
import DashboardPage from './pages/DashboardPage'
import AccountingPage from './pages/AccountingPage'
import JurnalPage from './pages/JurnalPage'
import ReportsPage from './pages/ReportsPage'
import TutupBukuPage from './pages/TutupBukuPage'
import UploadPage from './pages/UploadPage'
import TaxPage from './pages/TaxPage'
import SptPage from './pages/SptPage'
import KnowledgePage from './pages/KnowledgePage'
import NotifAdminPage from './pages/NotifAdminPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import FeedbackPage from './pages/FeedbackPage'
import AdminFeedbackPage from './pages/AdminFeedbackPage'
import DemoPage from './pages/DemoPage'
import { BUDDY_STORAGE_PREFIX, TOUR_STORAGE_PREFIX } from './data/tourSteps'

function ProtectedRoute({ children, requireAdmin }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (!user.setup_completed) return <Navigate to="/setup" replace />
  if (requireAdmin && user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />
  return children
}

function SetupRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.setup_completed) return <Navigate to="/dashboard" replace />
  return children
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) {
    if (!user.setup_completed) return <Navigate to="/setup" replace />
    return <Navigate to="/dashboard" replace />
  }
  return children
}

function BuddyOnboardingGate() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!user?.id) { setOpen(false); return }
    try {
      if (localStorage.getItem(BUDDY_STORAGE_PREFIX + user.id) === 'true') { setOpen(false); return }
    } catch { /* ignore */ }
    const t = setTimeout(() => setOpen(true), 300)
    return () => clearTimeout(t)
  }, [user?.id])

  const markSeen = () => {
    try { localStorage.setItem(BUDDY_STORAGE_PREFIX + user.id, 'true') } catch {}
    setOpen(false)
  }

  const handleStartDemo = () => {
    markSeen()
    navigate('/demo?ob=1')
  }

  const handleContinue = () => markSeen()

  const handleSkip = () => {
    try {
      localStorage.setItem(BUDDY_STORAGE_PREFIX + user.id, 'true')
      localStorage.setItem(TOUR_STORAGE_PREFIX + user.id, 'true')
    } catch {}
    setOpen(false)
  }

  return (
    <BuddyOnboarding
      open={open}
      onStartDemo={handleStartDemo}
      onContinue={handleContinue}
      onSkip={handleSkip}
    />
  )
}

export default function App() {
  return (
    <ChatbotProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
        <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
        <Route path="/reset-password" element={<GuestRoute><ResetPasswordPage /></GuestRoute>} />
        <Route path="/setup" element={<SetupRoute><SetupPage /></SetupRoute>} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/akun" element={<AccountingPage />} />
          <Route path="/jurnal" element={<JurnalPage />} />
          <Route path="/laporan" element={<ReportsPage />} />
          <Route path="/tutup-buku" element={<TutupBukuPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/pajak" element={<TaxPage />} />
          <Route path="/spt" element={<SptPage />} />
          <Route path="/chatbot" element={<Navigate to="/dashboard" replace />} />
          <Route path="/knowledge" element={<KnowledgePage />} />
          <Route path="/notif-admin" element={<NotifAdminPage />} />
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/feedback" element={<ProtectedRoute requireAdmin><FeedbackPage /></ProtectedRoute>} />
          <Route path="/admin/feedback" element={<AdminFeedbackPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BuddyOnboardingGate />
    </ChatbotProvider>
  )
}
