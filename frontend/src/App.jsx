import { lazy, Suspense, useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { ChatbotProvider } from './context/ChatbotContext'
import Layout from './components/Layout'
import BuddyOnboarding from './components/BuddyOnboarding'

import { BUDDY_STORAGE_PREFIX, TOUR_STORAGE_PREFIX } from './data/tourSteps'
import LoadingScreen from './components/LoadingScreen'

// Halaman dimuat sesuai kebutuhan (React.lazy) supaya bundle awal tidak
// memuat semua halaman sekaligus. Sebelumnya 18 halaman di-import statis
// sehingga index.js mencapai 1,58 MB dan baru tampil setelah semua terunduh.

const LandingPage = lazy(() => import('./pages/LandingPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const SetupPage = lazy(() => import('./pages/SetupPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const AccountingPage = lazy(() => import('./pages/AccountingPage'))
const JurnalPage = lazy(() => import('./pages/JurnalPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const TutupBukuPage = lazy(() => import('./pages/TutupBukuPage'))
const UploadPage = lazy(() => import('./pages/UploadPage'))
const TaxPage = lazy(() => import('./pages/TaxPage'))
const SptPage = lazy(() => import('./pages/SptPage'))
const KnowledgePage = lazy(() => import('./pages/KnowledgePage'))
const NotifAdminPage = lazy(() => import('./pages/NotifAdminPage'))
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'))
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'))
const AdminFeedbackPage = lazy(() => import('./pages/AdminFeedbackPage'))
const DemoPage = lazy(() => import('./pages/DemoPage'))

function ProtectedRoute({ children, requireAdmin }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (!user.setup_completed) return <Navigate to="/setup" replace />
  if (requireAdmin && user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />
  return children
}

function SetupRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (user.setup_completed) return <Navigate to="/dashboard" replace />
  return children
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
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
      <Suspense fallback={<LoadingScreen label="Memuat halaman…" />}>
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
      </Suspense>
      <BuddyOnboardingGate />
    </ChatbotProvider>
  )
}
