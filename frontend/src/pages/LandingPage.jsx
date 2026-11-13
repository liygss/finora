import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  Bot, BookOpen, BarChart3, Upload, Shield, Star, HelpCircle, ChevronDown,
  ArrowRight, Zap, TrendingUp, MessageSquare, CheckCircle, Quote, Menu, X, PlayCircle,
  Apple, Download, MonitorDown, Laptop, Calculator, FileText, LayoutDashboard,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from '../components/ThemeToggle'

const NAV_LINKS = [
  { label: 'Fitur', href: '#fitur' },
  { label: 'Cara Kerja', href: '#cara-kerja' },
  { label: 'Testimoni', href: '#testimoni' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Download', href: '#download' },
]

const HERO_STAGGER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
}
const HERO_ITEM = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}
const HERO_SLIDER = {
  hidden: { opacity: 0, y: 40, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.3 } },
}

// Installer disajikan langsung oleh backend (folder downloads/) untuk file yang
// sudah ada lokal, DAN dari GitHub Releases untuk platform yang belum dibangun
// lokal (Windows/Linux — PyInstaller tidak bisa cross-compile, jadi dibangun
// lewat GitHub Actions lalu di-publish ke Releases). URL dibuat relatif supaya
// jalan di web dev ('/api' di-proxy Vite) maupun desktop (server statis
// mem-proxy '/api/*' ke backend).
const API_BASE = import.meta.env.VITE_API_URL || '/api'
const DOWNLOAD_BASE = `${API_BASE}/downloads`

// Repo tempat CI mem-publish installer (electron/release.yml). Landing page
// menanyakan releases/latest untuk mengetahui asset apa saja yang tersedia,
// lalu mengaktifkan tombol platform yang sesuai secara otomatis.
const GITHUB_REPO = 'liygss/UMKM-ai'
const GITHUB_RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`

const PLATFORMS = [
  { icon: Apple,       os: 'macOS',   note: 'Apple Silicon & Intel',    file: 'Finora-1.1.0-arm64.dmg',  ext: '.dmg'      },
  { icon: MonitorDown, os: 'Windows', note: 'Windows 10 / 11 (x64)',    file: 'Finora.Setup.1.1.0.exe',   ext: '.exe'      },
  { icon: Laptop,      os: 'Linux',   note: 'AppImage (x64)',            file: 'Finora-1.1.0.AppImage',   ext: '.AppImage' },
]

const STATS = [
  { icon: TrendingUp, value: 120, suffix: '+', label: 'UMKM Bergabung' },
  { icon: MessageSquare, value: 500, suffix: '+', label: 'Pertanyaan AI' },
  { icon: Zap, value: 99.9, suffix: '%', label: 'Akurasi Sistem', decimals: 1 },
  { icon: Shield, value: 4.8, suffix: '/5', label: 'Rating Pengguna', decimals: 1 },
]

const STEPS = [
  {
    icon: Bot,
    title: 'Daftar Gratis',
    desc: 'Buat akun Anda dan mulai perjalanan pembukuan digital dalam hitungan menit.',
    num: '01',
  },
  {
    icon: BookOpen,
    title: 'Catat Transaksi',
    desc: 'Input atau upload transaksi bisnis Anda, sistem mencatatnya otomatis ke jurnal.',
    num: '02',
  },
  {
    icon: BarChart3,
    title: 'Pantau Laporan',
    desc: 'Lihat laporan keuangan real-time dan dapatkan insight cerdas dari AI.',
    num: '03',
  },
]

const TESTIMONIALS = [
  {
    text: 'Saya bisa fokus ke bisnis tanpa pusing soal pembukuan. Laporan laba rugi muncul otomatis setiap bulan!',
    name: 'Nino Ahmadiy',
    role: 'Pemilik Kedai Kopi',
    avatar: 'NA',
    color: '#2563EB',
  },
  {
    text: 'AI chatbot-nya sangat membantu. Saya bertanya soal PPh Final UMKM dan langsung dijawab dengan penjelasan yang mudah dipahami.',
    name: 'Haidar Adlan',
    role: 'Owner Restoran',
    avatar: 'HD',
    color: '#059669',
  },
  {
    text: 'Dari yang tadinya catatan manual, sekarang semua rapi otomatis. Fitur upload CSV menghemat banyak waktu tim saya.',
    name: 'Dani Shofi',
    role: 'Founder Startup F&B',
    avatar: 'DS',
    color: '#D97706',
  },
]

const FAQS = [
  {
    q: 'Apakah Finora cocok untuk usaha kecil?',
    a: 'Tentu! Platform kami dirancang khusus untuk UMKM. Anda bisa langsung memakai laporan yang sesuai standar SAK EMKM tanpa harus paham akuntansi.',
  },
  {
    q: 'Bagaimana AI membantu pembukuan saya?',
    a: 'AI kami bisa menjawab pertanyaan seputar akuntansi dan pajak, membantu mengklasifikasikan transaksi, serta memberikan insight dari laporan keuangan Anda.',
  },
  {
    q: 'Apakah data keuangan saya aman?',
    a: 'Keamanan adalah prioritas utama kami. Seluruh data dienkripsi dan disimpan dengan standar keamanan terbaik. Data Anda tidak akan pernah dibagikan ke pihak ketiga.',
  },
  {
    q: 'Format file apa saja yang bisa diupload?',
    a: 'Anda bisa mengupload file CSV untuk data transaksi dan file PDF untuk dokumen pendukung seperti peraturan pajak.',
  },
]

export default function LandingPage() {
  const { user } = useAuth()
  const [mobileMenu, setMobileMenu] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)

  const [scrolled, setScrolled] = useState(false)
  const [navVisible, setNavVisible] = useState(false)

  const heroRef = useRef(null)
  const [heroVisible, setHeroVisible] = useState(false)
  const statsRef = useRef(null)
  const [statsVisible, setStatsVisible] = useState(false)
  const featuresRef = useRef(null)
  const [featuresVisible, setFeaturesVisible] = useState(false)
  const stepsRef = useRef(null)
  const [stepsVisible, setStepsVisible] = useState(false)
  const testimonialsRef = useRef(null)
  const [testimonialsVisible, setTestimonialsVisible] = useState(false)
  const faqRef = useRef(null)
  const [faqVisible, setFaqVisible] = useState(false)
  const ctaRef = useRef(null)
  const [ctaVisible, setCtaVisible] = useState(false)
  const downloadRef = useRef(null)
  const [downloadVisible, setDownloadVisible] = useState(false)
  const [availableDownloads, setAvailableDownloads] = useState([])
  const [releaseAssets, setReleaseAssets] = useState({})

  useEffect(() => {
    // 1) File installer yang disajikan backend dari folder downloads/ (lokal).
    fetch(`${DOWNLOAD_BASE}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((files) => setAvailableDownloads(Array.isArray(files) ? files : []))
      .catch(() => setAvailableDownloads([]))

    // 2) Asset dari GitHub Releases terbaru (Windows/Linux dibangun lewat CI).
    fetch(GITHUB_RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.assets)) return setReleaseAssets({})
        const map = {}
        for (const a of data.assets) {
          if (a && a.name && a.browser_download_url) map[a.name] = a.browser_download_url
        }
        setReleaseAssets(map)
      })
      .catch(() => setReleaseAssets({}))
  }, [])

  const isAvailable = (ext) => availableDownloads.some((f) => f.toLowerCase().endsWith(ext.toLowerCase()))

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40)
      checkVisibility()
    }

    const checkVisibility = () => {
      const vh = window.innerHeight
      const isVisible = (el) => {
        if (!el) return false
        const rect = el.getBoundingClientRect()
        return rect.top < vh * 0.88
      }
      setStatsVisible((p) => p || isVisible(statsRef.current))
      setFeaturesVisible((p) => p || isVisible(featuresRef.current))
      setStepsVisible((p) => p || isVisible(stepsRef.current))
      setTestimonialsVisible((p) => p || isVisible(testimonialsRef.current))
      setFaqVisible((p) => p || isVisible(faqRef.current))
      setCtaVisible((p) => p || isVisible(ctaRef.current))
      setDownloadVisible((p) => p || isVisible(downloadRef.current))
    }

    const heroTimer = setTimeout(() => setHeroVisible(true), 150)
    const navTimer = setTimeout(() => setNavVisible(true), 100)

    checkVisibility()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      clearTimeout(heroTimer)
      clearTimeout(navTimer)
    }
  }, [])

  const scrollTo = (href) => {
    if (href.startsWith('#')) {
      const el = document.querySelector(href)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
        return
      }
    }
    window.location.hash = href
  }

  function AnimatedCounter({ target, suffix = '', decimals = 0 }) {
    const [value, setValue] = useState(0)
    useEffect(() => {
      let start
      const duration = 2000
      const step = (ts) => {
        if (!start) start = ts
        const progress = Math.min((ts - start) / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        setValue(target * eased)
        if (progress < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }, [target])
    return <>{value.toFixed(decimals)}{suffix}</>
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: 'var(--color-surface-0)', color: 'var(--color-slate-heading)' }}>

      {/* ============ BACKGROUND ============ */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 h-full w-full" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(148,163,184,0.06) 1px, transparent 0)', backgroundSize: '36px 36px' }} />
      </div>

      {/* ============ NAVBAR ============ */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'py-3' : 'py-5'}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div
            className={`flex items-center justify-between rounded-2xl px-5 transition-all duration-500 ${navVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'} ${scrolled ? 'py-3' : 'py-4'}`}
            style={scrolled
              ? { background: 'var(--color-glass-bg)', border: '1px solid rgba(148,163,184,0.15)', backdropFilter: 'blur(20px)', boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }
              : { background: 'transparent', border: '1px solid transparent' }}
          >
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3">
              <div
                className="relative flex h-11 w-11 items-center justify-center overflow-hidden"
                style={{ borderRadius: '1rem', boxShadow: '0 2px 8px rgba(16,24,40,0.12)' }}
              >
                <img src="/finora_logo.jpeg" alt="Finora" className="h-full w-full object-cover relative z-10" />
              </div>
              <div className="leading-tight">
                <div className="text-lg font-[900] tracking-tight" style={{ color: 'var(--color-slate-heading)' }}>
                  Finora
                </div>
                <div className="text-[10px] font-medium tracking-widest uppercase" style={{ color: 'var(--color-slate-muted)' }}>
                  Smart Accounting
                </div>
              </div>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-1 rounded-full px-1.5 py-1.5" style={{ background: 'var(--color-surface-card)', border: '1px solid rgba(148,163,184,0.1)', backdropFilter: 'blur(12px)' }}>
              {NAV_LINKS.map((link) => (
                <button
                  key={link.href}
                  onClick={() => scrollTo(link.href)}
                  className="px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 hover:bg-white/10"
                  style={{ color: 'var(--color-slate-text)' }}
                  onMouseEnter={(e) => e.target.style.color = 'var(--color-slate-heading)'}
                  onMouseLeave={(e) => e.target.style.color = 'var(--color-slate-text)'}
                >
                  {link.label}
                </button>
              ))}
            </nav>

            {/* Theme toggle */}
            <div className="hidden lg:flex">
              <ThemeToggle compact />
            </div>

            {/* Auth buttons */}
            <div className="hidden lg:flex items-center gap-3">
              {user ? (
                <>
                  <Link
                    to="/dashboard"
                    className="px-6 py-2.5 text-sm font-bold rounded-full text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)', boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}
                  >
                    Buka Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-5 py-2.5 text-sm font-semibold rounded-full transition-all duration-300 hover:bg-white/10"
                    style={{ color: 'var(--color-slate-text)' }}
                  >
                    Masuk
                  </Link>
                  <Link
                    to="/register"
                    className="px-6 py-2.5 text-sm font-bold rounded-full text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)', boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}
                  >
                    Daftar Gratis
                  </Link>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              className="lg:hidden flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ background: 'var(--color-surface-card)', border: '1px solid rgba(148,163,184,0.15)' }}
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              {mobileMenu ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          {/* Mobile menu */}
          {mobileMenu && (
            <div
              className="lg:hidden mt-2 rounded-2xl p-4"
              style={{ background: 'var(--color-glass-bg)', border: '1px solid rgba(148,163,184,0.15)', backdropFilter: 'blur(20px)', boxShadow: '0 16px 48px rgba(0,0,0,0.4)' }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold" style={{ color: 'var(--color-slate-body)' }}>Menu</span>
                <ThemeToggle compact />
              </div>
              <nav className="flex flex-col gap-1">
                {NAV_LINKS.map((link) => (
                  <button
                    key={link.href}
                    onClick={() => { setMobileMenu(false); scrollTo(link.href) }}
                    className="px-4 py-3 text-sm font-semibold rounded-xl text-left hover:bg-white/10 transition-colors"
                    style={{ color: 'var(--color-slate-text)' }}
                  >
                    {link.label}
                  </button>
                ))}
              </nav>
              <div className="flex flex-col gap-2 mt-3 pt-3" style={{ borderTop: '1px solid rgba(148,163,184,0.15)' }}>
                {user ? (
                  <Link
                    to="/dashboard"
                    className="text-center px-5 py-3 text-sm font-bold rounded-xl text-white"
                    style={{ background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)' }}
                  >
                    Buka Dashboard
                  </Link>
                ) : (
                  <>
                    <Link to="/login" className="text-center px-5 py-3 text-sm font-bold rounded-xl" style={{ color: 'var(--color-slate-text)', background: 'var(--color-surface-card)' }}>
                      Masuk
                    </Link>
                    <Link
                      to="/register"
                      className="text-center px-5 py-3 text-sm font-bold rounded-xl text-white"
                      style={{ background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)' }}
                    >
                      Daftar Gratis
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section ref={heroRef} className="relative overflow-hidden px-6 pt-36 pb-20 lg:px-12 lg:pt-32 lg:pb-16">
        {/* Atmosphere */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-[-14%] h-[560px] w-[860px] -translate-x-1/2 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.12), transparent 70%)' }} />
          <div className="absolute bottom-0 left-0 right-0 h-40" style={{ background: 'linear-gradient(180deg, transparent, var(--color-surface-0))' }} />
        </div>

        <div className="relative mx-auto max-w-[88rem] grid grid-cols-1 lg:grid-cols-[0.88fr_1.12fr] gap-12 lg:gap-14 items-center">
          {/* Left column - copy */}
          <motion.div
            className="text-center lg:text-left"
            variants={HERO_STAGGER}
            initial="hidden"
            animate={heroVisible ? 'show' : 'hidden'}
          >
            {/* Trust badge */}
            <motion.div variants={HERO_ITEM} className="mb-6">
              <div
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
                style={{ background: 'rgba(37,99,235,0.08)', color: 'var(--color-accent-blue)', border: '1px solid rgba(37,99,235,0.18)', boxShadow: '0 2px 8px rgba(16,24,40,0.05)' }}
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: 'var(--color-accent-emerald)' }} />
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: 'var(--color-accent-emerald)' }} />
                </span>
                Solusi Terpercaya untuk Pembukuan & Pajak UMKM
              </div>
            </motion.div>

            <motion.h1
              variants={HERO_ITEM}
              className="text-4xl sm:text-5xl md:text-6xl xl:text-7xl font-[900] leading-[1.05] tracking-tight mb-8"
              style={{ color: 'var(--color-slate-heading)', letterSpacing: '-0.03em' }}
            >
              Kelola Keuangan UMKM dengan <span className="gradient-text">Kecerdasan</span> Finora
            </motion.h1>

            <motion.p
              variants={HERO_ITEM}
              className="text-lg lg:text-xl max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed"
              style={{ color: 'var(--color-slate-body)' }}
            >
              Asisten pembukuan, pajak, dan laporan keuangan berbasis AI dalam satu platform.
              Biarkan Finora bekerja, Anda fokus mengembangkan bisnis.
            </motion.p>

            {/* Hero buttons */}
            <motion.div
              variants={HERO_ITEM}
              className="flex flex-col sm:flex-row sm:flex-nowrap justify-center lg:justify-start items-center gap-2.5 lg:gap-3"
            >
              {user ? (
                <Link
                  to="/dashboard"
                  className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 lg:px-6 py-3 text-sm font-bold text-white transition-all duration-300 hover:-translate-y-1 w-full sm:w-auto"
                  style={{ background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)', boxShadow: '0 2px 8px rgba(16,24,40,0.14)' }}
                >
                  Buka Dashboard
                  <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1.5" />
                </Link>
              ) : (
                <Link
                  to="/register"
                  className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 lg:px-6 py-3 text-sm font-bold text-white transition-all duration-300 hover:-translate-y-1 w-full sm:w-auto"
                  style={{ background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)', boxShadow: '0 2px 8px rgba(16,24,40,0.14)' }}
                >
                  Mulai Sekarang
                  <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1.5" />
                </Link>
              )}
              <Link
                to="/demo"
                className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 lg:px-6 py-3 text-sm font-bold transition-all duration-300 hover:-translate-y-1 w-full sm:w-auto"
                style={{ background: 'var(--color-surface-card)', color: 'var(--color-slate-text)', border: '1px solid var(--color-border-soft)' }}
              >
                <PlayCircle size={18} className="transition-transform duration-300 group-hover:scale-110" />
                Lihat Demo
              </Link>
            </motion.div>

            {/* Micro-line + social proof */}
            <motion.div
              variants={HERO_ITEM}
              className="mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-sm"
              style={{ color: 'var(--color-slate-muted)' }}
            >
              <span className="inline-flex items-center gap-2">
                <CheckCircle size={15} style={{ color: 'var(--color-accent-emerald)' }} /> Gratis selamanya
              </span>
              <span className="hidden h-4 w-px sm:block" style={{ background: 'var(--color-border-soft)' }} />
              <span className="inline-flex items-center gap-2">
                <CheckCircle size={15} style={{ color: 'var(--color-accent-emerald)' }} /> Tanpa kartu kredit
              </span>
              <span className="hidden h-4 w-px sm:block" style={{ background: 'var(--color-border-soft)' }} />
              <span className="inline-flex items-center gap-2 font-semibold" style={{ color: 'var(--color-slate-text)' }}>
                <span className="inline-flex" style={{ color: '#D97706' }}>
                  {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={14} className="fill-current" />)}
                </span>
                4,9/5 · 120+ UMKM
              </span>
            </motion.div>
          </motion.div>

          {/* Right column - product mockup */}
          <motion.div
            className="relative w-full"
            variants={HERO_SLIDER}
            initial="hidden"
            animate={heroVisible ? 'show' : 'hidden'}
          >
            <div className="pointer-events-none absolute -inset-6 rounded-[2.5rem] blur-3xl" style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.16), transparent 70%)' }} />

            <div className="landing-hero-mock relative overflow-hidden rounded-[1.75rem] text-left" style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', backdropFilter: 'blur(20px)', boxShadow: '0 32px 90px -40px rgba(15,23,42,0.45)' }}>
              {/* Window bar */}
              <div className="landing-hero-mock__bar flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-surface-faint)' }}>
                <div className="h-3 w-3 rounded-full" style={{ background: '#FCA5A5' }} />
                <div className="h-3 w-3 rounded-full" style={{ background: '#FCD34D' }} />
                <div className="h-3 w-3 rounded-full" style={{ background: '#6EE7B7' }} />
                <div className="landing-hero-mock__url ml-4 h-6 flex-1 max-w-xs rounded-lg" style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)' }} />
              </div>

              {/* Mock dashboard body */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-5 md:p-6">
                {/* Stat tiles */}
                <div className="md:col-span-3 grid grid-cols-2 gap-4">
                  <div className="landing-hero-mock__tile landing-hero-mock__tile--highlight rounded-2xl p-4" style={{ background: 'var(--color-surface-faint)', border: '1px solid rgba(37,99,235,0.2)' }}>
                    <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-accent-blue)' }}>Pendapatan</div>
                    <div className="text-2xl font-[900]" style={{ color: 'var(--color-slate-heading)' }}>Rp 48,2 jt</div>
                    <div className="inline-flex items-center gap-1 mt-1 text-xs font-bold rounded-full px-2 py-0.5" style={{ color: 'var(--color-accent-emerald)', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <TrendingUp size={12} /> +18,4%
                    </div>
                  </div>
                  <div className="landing-hero-mock__tile rounded-2xl p-4" style={{ background: 'var(--color-surface-faint)', border: '1px solid var(--color-border-subtle)' }}>
                    <div className="landing-hero-mock__label text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-slate-body)' }}>Laba Bersih</div>
                    <div className="text-2xl font-[900]" style={{ color: 'var(--color-slate-heading)' }}>Rp 9,6 jt</div>
                    <div className="inline-flex items-center gap-1 mt-1 text-xs font-bold rounded-full px-2 py-0.5" style={{ color: 'var(--color-accent-blue)', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)' }}>SAK EMKM</div>
                  </div>
                  <div className="landing-hero-mock__tile rounded-2xl p-4" style={{ background: 'var(--color-surface-faint)', border: '1px solid var(--color-border-subtle)' }}>
                    <div className="landing-hero-mock__label text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-slate-body)' }}>Transaksi</div>
                    <div className="text-2xl font-[900]" style={{ color: 'var(--color-slate-heading)' }}>1.284</div>
                    <div className="inline-flex items-center gap-1 mt-1 text-xs font-bold rounded-full px-2 py-0.5" style={{ color: 'var(--color-accent-amber)', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.22)' }}><Zap size={12} /> Otomatis</div>
                  </div>
                  <div className="landing-hero-mock__tile rounded-2xl p-4" style={{ background: 'var(--color-surface-faint)', border: '1px solid var(--color-border-subtle)' }}>
                    <div className="landing-hero-mock__label text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-slate-body)' }}>Pajak</div>
                    <div className="text-2xl font-[900]" style={{ color: 'var(--color-slate-heading)' }}>PPh 0,5%</div>
                    <div className="inline-flex items-center gap-1 mt-1 text-xs font-bold rounded-full px-2 py-0.5" style={{ color: 'var(--color-accent-emerald)', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}><Shield size={12} /> Sesuai aturan</div>
                  </div>
                  {/* Chart placeholder */}
                  <div className="landing-hero-mock__tile col-span-2 rounded-2xl p-4 flex items-end gap-2 h-36" style={{ background: 'var(--color-surface-faint)', border: '1px solid var(--color-border-subtle)' }}>
                    {[45, 62, 38, 74, 52, 88, 66, 95].map((h, i) => (
                      <div key={i} className="landing-hero-mock__bar-item flex-1 rounded-t-lg" style={{ height: `${h}%`, background: 'linear-gradient(180deg, #93C5FD 0%, #3B82F6 60%, rgba(37,99,235,0.35) 100%)', opacity: 0.85 + (i * 0.02), boxShadow: '0 0 10px -4px rgba(59,130,246,0.5)' }} />
                    ))}
                  </div>
                </div>

                {/* AI chatbot preview */}
                <div className="landing-hero-mock__chat md:col-span-2 flex flex-col rounded-2xl overflow-hidden" style={{ background: 'var(--color-glass-bg)', border: '1px solid rgba(37,99,235,0.22)', boxShadow: '0 20px 50px -24px rgba(37,99,235,0.35)' }}>
                  {/* Chat header */}
                  <div className="landing-hero-mock__chat-header flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-surface-faint)' }}>
                    <div className="relative">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #2563EB, #60A5FA)' }}>
                        <Bot size={16} className="text-white" />
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2" style={{ background: '#059669', borderColor: 'var(--color-surface-2)' }} />
                    </div>
                    <div>
                      <div className="text-sm font-bold leading-tight" style={{ color: 'var(--color-slate-heading)' }}>Asisten Finora</div>
                      <div className="text-[10px] flex items-center gap-1" style={{ color: 'var(--color-accent-emerald)' }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#059669' }} /> Online
                      </div>
                    </div>
                  </div>

                  {/* Chat body */}
                  <div className="landing-hero-mock__chat-body flex-1 flex flex-col gap-3 px-4 py-4">
                    {/* User question (right, gradient) */}
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-xs text-white" style={{ background: 'linear-gradient(135deg, #1D4ED8, #2563EB)' }}>
                        Estimasi pajak bulan ini?
                      </div>
                    </div>
                    {/* Assistant answer (left, with avatar) */}
                    <div className="flex items-start gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg mt-0.5" style={{ background: 'linear-gradient(135deg, #2563EB, #60A5FA)' }}>
                        <Bot size={13} className="text-white" />
                      </div>
                      <div className="landing-hero-mock__chat-bubble max-w-[85%] rounded-2xl rounded-bl-md px-3.5 py-2 text-xs leading-relaxed" style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-slate-text)', boxShadow: '0 4px 14px rgba(15,23,42,0.12)' }}>
                        PPh Final <b>0,5%</b> dari omzet <b>Rp 48 jt</b> ≈ <b style={{ color: 'var(--color-accent-blue)' }}>Rp 241.000</b>.
                        <div className="landing-hero-mock__badge mt-1.5 text-[10px] px-1.5 py-0.5 inline-flex rounded-md" style={{ background: 'rgba(37,99,235,0.12)', color: 'var(--color-accent-blue)' }}>
                          ✓ Sesuai aturan UMKM
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Chat input */}
                  <div className="landing-hero-mock__chat-input mx-3 mb-3 flex items-center gap-2 rounded-xl p-1.5 pl-3" style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)' }}>
                    <span className="flex-1 text-[11px] truncate" style={{ color: 'var(--color-slate-muted)' }}>Tanya apa saja...</span>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)' }}>
                      <MessageSquare size={13} className="text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Hero stats + avatars - full width */}
          <motion.div
            className="lg:col-span-2 flex flex-col items-center gap-8 mt-16 lg:mt-20"
            variants={HERO_ITEM}
            initial="hidden"
            animate={heroVisible ? 'show' : 'hidden'}
          >
            <div className="flex items-center gap-3">
              <div className="flex -space-x-3">
                {['#2563EB', '#059669', '#D97706', '#7C3AED'].map((c, i) => (
                  <div key={i} className="h-10 w-10 rounded-full ring-2 ring-[var(--color-surface-0)] flex items-center justify-center text-xs font-bold text-white" style={{ background: `linear-gradient(135deg, ${c}, ${c}bb)` }}>
                    {['N', 'H', 'D', 'S'][i]}
                  </div>
                ))}
              </div>
              <div className="text-sm font-medium leading-tight" style={{ color: 'var(--color-slate-body)' }}>
                Dipercaya <span className="font-bold" style={{ color: 'var(--color-slate-heading)' }}>120+ UMKM</span> di Indonesia
              </div>
            </div>

            <div
              className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 rounded-2xl px-6 py-4"
              style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', boxShadow: '0 10px 34px -20px rgba(15,23,42,0.28)' }}
            >
              {STATS.map((stat, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="hidden h-9 w-px md:block" style={{ background: 'var(--color-border-subtle)' }} />}
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.15)' }}>
                      <stat.icon size={16} style={{ color: 'var(--color-brand-soft)' }} />
                    </div>
                    <div className="text-left">
                      <div className="text-xl font-[900] leading-none" style={{ color: 'var(--color-slate-heading)' }}>
                        <AnimatedCounter target={stat.value} suffix={stat.suffix} decimals={stat.decimals || 0} />
                      </div>
                      <div className="text-xs font-medium mt-1" style={{ color: 'var(--color-slate-muted)' }}>{stat.label}</div>
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============ TECH MARQUEE ============ */}
      <section className="relative px-6 py-10 lg:px-12" style={{ borderTop: '1px solid rgba(148,163,184,0.08)', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-xs font-semibold tracking-widest uppercase mb-6" style={{ color: '#475569' }}>
            Standar & Teknologi yang Digunakan
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {['SAK EMKM', 'PPh Final 0,5%', 'PNBP', 'RAG AI', 'LLM', 'CSV & PDF'].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm font-bold tracking-wide" style={{ color: 'var(--color-slate-muted)' }}>
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: '#2563EB' }} />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ STATS ============ */}
      <section ref={statsRef} className="relative px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((stat, i) => (
              <div
                key={i}
                className={`group text-center rounded-3xl p-6 transition-all duration-700 hover:-translate-y-1 ${statsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{
                  animationDelay: `${i * 100}ms`,
                  background: 'var(--color-surface-card)',
                  border: '1px solid rgba(148,163,184,0.12)',
                  backdropFilter: 'blur(12px)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 12px 40px rgba(37,99,235,0.15)'; e.currentTarget.style.borderColor = 'rgba(37,99,235,0.25)' }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'rgba(148,163,184,0.12)' }}
              >
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(37,99,235,0.12)' }}>
                  <stat.icon size={22} style={{ color: 'var(--color-brand-soft)' }} />
                </div>
                <div className="text-3xl lg:text-4xl font-[900] gradient-text">
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </div>
                <div className="mt-1.5 text-sm font-medium" style={{ color: 'var(--color-slate-body)' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FEATURES - BENTO GRID ============ */}
      <section id="fitur" ref={featuresRef} className="relative px-6 py-24 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <div
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold mb-5 transition-all duration-700 ${featuresVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ background: 'rgba(37,99,235,0.1)', color: 'var(--color-accent-blue)', border: '1px solid rgba(37,99,235,0.2)' }}
            >
              <Zap size={14} />
              Fitur Unggulan
            </div>
            <h2
              className={`text-3xl lg:text-5xl font-[900] tracking-tight transition-all duration-700 delay-100 ${featuresVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
              style={{ color: 'var(--color-slate-heading)', letterSpacing: '-0.02em' }}
            >
              Semua yang Anda Butuhkan
            </h2>
            <p
              className={`mt-5 text-lg max-w-xl mx-auto transition-all duration-700 delay-200 ${featuresVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
              style={{ color: 'var(--color-slate-body)' }}
            >
              Platform lengkap untuk mengelola keuangan UMKM dengan bantuan kecerdasan buatan
            </p>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Large card - AI Chatbot */}
            <div
              className={`group relative md:col-span-2 md:row-span-2 rounded-3xl p-8 transition-all duration-700 hover:-translate-y-1 ${featuresVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ background: 'var(--color-surface-card)', border: '1px solid rgba(148,163,184,0.12)', backdropFilter: 'blur(16px)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 24px 60px rgba(37,99,235,0.15)'; e.currentTarget.style.borderColor = 'rgba(37,99,235,0.25)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'rgba(148,163,184,0.12)' }}
            >
              <div className="absolute top-0 right-0 h-64 w-64 rounded-bl-[120px] opacity-[0.06] group-hover:opacity-[0.12] transition-opacity duration-500" style={{ background: 'linear-gradient(135deg, #2563EB, transparent)' }} />
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl mb-6 transition-transform duration-500 group-hover:scale-110" style={{ background: 'linear-gradient(135deg, #2563EB, #60A5FA)', boxShadow: '0 8px 32px rgba(15,23,42,0.12)' }}>
                <Bot size={28} className="text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-slate-heading)' }}>AI Chatbot Akuntansi</h3>
              <p className="text-base leading-relaxed mb-6" style={{ color: 'var(--color-slate-body)' }}>
                Tanya jawab seputar SAK EMKM, pajak, dan pembukuan dengan AI yang memahami konteks bisnis Anda.
              </p>
              {/* Mini chat preview */}
              <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface-faint)', border: '1px solid rgba(148,163,184,0.15)' }}>
                <div className="flex gap-3 mb-3">
                  <div className="h-7 w-7 rounded-lg flex-shrink-0" style={{ background: 'linear-gradient(135deg, #2563EB, #60A5FA)' }} />
                  <div className="rounded-xl rounded-tl-none px-3.5 py-2 text-xs" style={{ background: 'rgba(37,99,235,0.15)', color: 'var(--color-slate-text)', border: '1px solid rgba(37,99,235,0.15)' }}>
                    Bagaimana cara menghitung PPh Final UMKM?
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <div className="rounded-xl rounded-tr-none px-3.5 py-2 text-xs" style={{ background: 'linear-gradient(135deg, #1D4ED8, #2563EB)', color: 'white' }}>
                    PPh Final UMKM dikenakan tarif 0,5% dari omzet...
                  </div>
                  <div className="h-7 w-7 rounded-lg flex-shrink-0" style={{ background: 'linear-gradient(135deg, #059669, #10B981)' }} />
                </div>
              </div>
            </div>

            {/* Pembukuan Otomatis */}
            <div
              className={`group rounded-3xl p-6 transition-all duration-700 hover:-translate-y-1 ${featuresVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ animationDelay: '100ms', background: 'var(--color-surface-card)', border: '1px solid rgba(148,163,184,0.12)', backdropFilter: 'blur(16px)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 16px 48px rgba(5,150,105,0.12)'; e.currentTarget.style.borderColor = 'rgba(5,150,105,0.25)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'rgba(148,163,184,0.12)' }}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl mb-4 transition-transform duration-500 group-hover:scale-110" style={{ background: 'linear-gradient(135deg, #059669, #10B981)', boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}>
                <BookOpen size={24} className="text-white" />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-slate-heading)' }}>Pembukuan Otomatis</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-slate-body)' }}>Catat transaksi, buat jurnal, dan kelola chart of accounts sesuai standar akuntansi Indonesia.</p>
            </div>

            {/* Laporan Keuangan */}
            <div
              className={`group rounded-3xl p-6 transition-all duration-700 hover:-translate-y-1 ${featuresVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ animationDelay: '200ms', background: 'var(--color-surface-card)', border: '1px solid rgba(148,163,184,0.12)', backdropFilter: 'blur(16px)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 16px 48px rgba(217,119,6,0.12)'; e.currentTarget.style.borderColor = 'rgba(217,119,6,0.25)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'rgba(148,163,184,0.12)' }}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl mb-4 transition-transform duration-500 group-hover:scale-110" style={{ background: 'linear-gradient(135deg, #D97706, #F59E0B)', boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}>
                <BarChart3 size={24} className="text-white" />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-slate-heading)' }}>Laporan Keuangan</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-slate-body)' }}>Neraca saldo, laba rugi, posisi keuangan, dan CALK tergenerate otomatis secara real-time.</p>
            </div>

            {/* Kalkulator Pajak */}
            <div
              className={`group rounded-3xl p-6 transition-all duration-700 hover:-translate-y-1 ${featuresVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ animationDelay: '300ms', background: 'var(--color-surface-card)', border: '1px solid rgba(148,163,184,0.12)', backdropFilter: 'blur(16px)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 16px 48px rgba(220,38,38,0.12)'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.25)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'rgba(148,163,184,0.12)' }}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl mb-4 transition-transform duration-500 group-hover:scale-110" style={{ background: 'linear-gradient(135deg, #DC2626, #F87171)', boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}>
                <Calculator size={24} className="text-white" />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-slate-heading)' }}>Kalkulator Pajak</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-slate-body)' }}>Hitung PPh Final 0,5% dan PPN 11% secara instan, lengkap dengan rincian perhitungan.</p>
            </div>

            {/* Upload & Knowledge Base */}
            <div
              className={`group rounded-3xl p-6 transition-all duration-700 hover:-translate-y-1 ${featuresVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ animationDelay: '400ms', background: 'var(--color-surface-card)', border: '1px solid rgba(148,163,184,0.12)', backdropFilter: 'blur(16px)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 16px 48px rgba(6,182,212,0.12)'; e.currentTarget.style.borderColor = 'rgba(6,182,212,0.25)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'rgba(148,163,184,0.12)' }}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl mb-4 transition-transform duration-500 group-hover:scale-110" style={{ background: 'linear-gradient(135deg, #0891B2, #22D3EE)', boxShadow: '0 8px 24px rgba(6,182,212,0.3)' }}>
                <Upload size={24} className="text-white" />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-slate-heading)' }}>Upload & Knowledge Base</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-slate-body)' }}>Upload CSV transaksi atau PDF aturan pajak, otomatis diproses dan masuk knowledge base AI.</p>
            </div>

            {/* SPT Tahunan */}
            <div
              className={`group rounded-3xl p-6 transition-all duration-700 hover:-translate-y-1 ${featuresVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ animationDelay: '500ms', background: 'var(--color-surface-card)', border: '1px solid rgba(148,163,184,0.12)', backdropFilter: 'blur(16px)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 16px 48px rgba(124,58,237,0.12)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.25)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'rgba(148,163,184,0.12)' }}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl mb-4 transition-transform duration-500 group-hover:scale-110" style={{ background: 'linear-gradient(135deg, #7C3AED, #8B5CF6)', boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}>
                <FileText size={24} className="text-white" />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-slate-heading)' }}>SPT Tahunan</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-slate-body)' }}>Susun SPT 1770/1771 otomatis dari data pembukuan, siap untuk proses pelaporan.</p>
            </div>

            {/* Dashboard Real-time */}
            <div
              className={`group md:col-span-3 rounded-3xl p-6 transition-all duration-700 hover:-translate-y-1 ${featuresVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ animationDelay: '600ms', background: 'var(--color-surface-card)', border: '1px solid rgba(148,163,184,0.12)', backdropFilter: 'blur(16px)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 16px 48px rgba(37,99,235,0.12)'; e.currentTarget.style.borderColor = 'rgba(37,99,235,0.25)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'rgba(148,163,184,0.12)' }}
            >
              <div className="flex items-start gap-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-transform duration-500 group-hover:scale-110" style={{ background: 'linear-gradient(135deg, #2563EB, #60A5FA)', boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}>
                  <LayoutDashboard size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-slate-heading)' }}>Dashboard Keuangan Real-time</h3>
                  <p className="text-sm leading-relaxed max-w-3xl" style={{ color: 'var(--color-slate-body)' }}>Pantau ringkasan kas, pendapatan, laba bersih, dan tren finansial dalam satu tampilan. Data selalu ter-update dari jurnal dan transaksi Anda, plus chatbot AI siap menjawab kapan pun dibutuhkan.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="cara-kerja" ref={stepsRef} className="relative px-6 py-24 lg:px-12">
        {/* Subtle bg */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(37,99,235,0.04) 50%, transparent 100%)' }} />

        <div className="relative mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <div
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold mb-5 transition-all duration-700 ${stepsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ background: 'rgba(5,150,105,0.1)', color: 'var(--color-accent-emerald)', border: '1px solid rgba(5,150,105,0.2)' }}
            >
              <Shield size={14} />
              Mudah Digunakan
            </div>
            <h2
              className={`text-3xl lg:text-5xl font-[900] tracking-tight transition-all duration-700 delay-100 ${stepsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
              style={{ color: 'var(--color-slate-heading)', letterSpacing: '-0.02em' }}
            >
              Cara <span className="gradient-text">Kerja</span>
            </h2>
            <p className={`mt-5 text-lg transition-all duration-700 delay-200 ${stepsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} style={{ color: 'var(--color-slate-body)' }}>
              Tiga langkah mudah untuk memulai
            </p>
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Connection line */}
            <div className="hidden md:block absolute top-10 left-[20%] right-[20%] h-[2px]" style={{ background: 'linear-gradient(90deg, rgba(37,99,235,0.2), rgba(37,99,235,0.4), rgba(37,99,235,0.2))' }} />

            {STEPS.map((s, i) => (
              <div
                key={i}
                className={`relative text-center transition-all duration-700 ${stepsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                style={{ animationDelay: `${i * 200}ms` }}
              >
                <div className="relative inline-block mb-6">
                  <div
                    className="flex h-20 w-20 items-center justify-center rounded-[22px] text-white transition-transform duration-500 hover:scale-110"
                    style={{
                      background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)',
                      boxShadow: '0 12px 32px rgba(15,23,42,0.12)',
                    }}
                  >
                    <s.icon size={28} />
                  </div>
                  <div
                    className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full text-xs font-[900] text-white"
                    style={{ background: 'linear-gradient(135deg, #059669, #10B981)', boxShadow: '0 4px 12px rgba(15,23,42,0.12)' }}
                  >
                    {s.num}
                  </div>
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-slate-heading)' }}>{s.title}</h3>
                <p className="max-w-xs mx-auto text-sm leading-relaxed" style={{ color: 'var(--color-slate-body)' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ TESTIMONIALS ============ */}
      <section id="testimoni" ref={testimonialsRef} className="relative px-6 py-24 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <div
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold mb-5 transition-all duration-700 ${testimonialsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ background: 'rgba(217,119,6,0.1)', color: 'var(--color-accent-amber)', border: '1px solid rgba(217,119,6,0.2)' }}
            >
              <Star size={14} />
              Testimoni
            </div>
            <h2
              className={`text-3xl lg:text-5xl font-[900] tracking-tight transition-all duration-700 delay-100 ${testimonialsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
              style={{ color: 'var(--color-slate-heading)', letterSpacing: '-0.02em' }}
            >
              Dipercaya oleh <span className="gradient-text">UMKM</span>
            </h2>
            <p className={`mt-5 text-lg transition-all duration-700 delay-200 ${testimonialsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} style={{ color: 'var(--color-slate-body)' }}>
              Apa kata pengguna kami
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={i}
                className={`group rounded-3xl p-7 transition-all duration-700 hover:-translate-y-2 ${testimonialsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{
                  animationDelay: `${i * 150}ms`,
                  background: 'var(--color-surface-card)',
                  border: '1px solid rgba(148,163,184,0.12)',
                  backdropFilter: 'blur(16px)',
                  marginTop: i === 1 ? '2rem' : 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 20px 60px rgba(0,0,0,0.5)'; e.currentTarget.style.borderColor = `${t.color}40` }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'rgba(148,163,184,0.12)' }}
              >
                {/* Stars */}
                <div className="flex gap-1 mb-5">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} size={16} className="fill-current" style={{ color: '#F59E0B' }} />
                  ))}
                </div>

                {/* Quote */}
                <Quote size={28} style={{ color: `${t.color}33` }} className="mb-4" />
                <p className="text-sm leading-relaxed mb-7" style={{ color: 'var(--color-slate-text)' }}>{t.text}</p>

                {/* Author */}
                <div className="flex items-center gap-3.5 pt-5" style={{ borderTop: '1px solid rgba(148,163,184,0.12)' }}>
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-bold text-white ring-2 ring-offset-2 transition-all duration-300"
                    style={{
                      background: `linear-gradient(135deg, ${t.color}, ${t.color}CC)`,
                      ringColor: `${t.color}40`,
                      boxShadow: `0 4px 16px ${t.color}40`,
                    }}
                  >
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }}>{t.name}</p>
                    <p className="text-xs font-medium" style={{ color: 'var(--color-slate-muted)' }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" ref={faqRef} className="relative px-6 py-24 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-16">
            <div
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold mb-5 transition-all duration-700 ${faqVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ background: 'rgba(37,99,235,0.1)', color: 'var(--color-accent-blue)', border: '1px solid rgba(37,99,235,0.2)' }}
            >
              <HelpCircle size={14} />
              FAQ
            </div>
            <h2
              className={`text-3xl lg:text-5xl font-[900] tracking-tight transition-all duration-700 delay-100 ${faqVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
              style={{ color: 'var(--color-slate-heading)', letterSpacing: '-0.02em' }}
            >
              Pertanyaan <span className="gradient-text">Umum</span>
            </h2>
            <p className={`mt-5 text-lg transition-all duration-700 delay-200 ${faqVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} style={{ color: 'var(--color-slate-body)' }}>
              Jawaban atas pertanyaan yang sering ditanyakan
            </p>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className={`rounded-2xl transition-all duration-700 ${faqVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <button
                  className="w-full flex items-center justify-between gap-4 rounded-2xl px-6 py-5 text-left transition-all duration-300"
                  style={{
                    background: openFaq === i ? 'var(--color-surface-card)' : 'var(--color-surface-faint)',
                    border: openFaq === i ? '1px solid rgba(37,99,235,0.3)' : '1px solid rgba(148,163,184,0.12)',
                    backdropFilter: 'blur(12px)',
                    boxShadow: openFaq === i ? '0 8px 32px rgba(37,99,235,0.1)' : 'none',
                  }}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="text-sm font-bold" style={{ color: 'var(--color-slate-heading)' }}>{faq.q}</span>
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-transform duration-300"
                    style={{
                      background: openFaq === i ? 'rgba(37,99,235,0.15)' : 'var(--color-surface-card)',
                      transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  >
                    <ChevronDown size={16} style={{ color: openFaq === i ? 'var(--color-accent-blue)' : 'var(--color-slate-muted)' }} />
                  </div>
                </button>
                <div
                  className="overflow-hidden transition-all duration-400"
                  style={{ maxHeight: openFaq === i ? '200px' : '0', opacity: openFaq === i ? 1 : 0 }}
                >
                  <div className="px-6 pb-5 pt-2">
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-slate-body)' }}>{faq.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ DOWNLOAD ============ */}
      <section id="download" ref={downloadRef} className="relative px-6 py-24 lg:px-12">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(5,150,105,0.04) 50%, transparent 100%)' }} />

        <div className="relative mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <div
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold mb-5 transition-all duration-700 ${downloadVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ background: 'rgba(5,150,105,0.1)', color: 'var(--color-accent-emerald)', border: '1px solid rgba(5,150,105,0.2)' }}
            >
              <Download size={14} />
              Aplikasi Desktop
            </div>
            <h2
              className={`text-3xl lg:text-5xl font-[900] tracking-tight transition-all duration-700 delay-100 ${downloadVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
              style={{ color: 'var(--color-slate-heading)', letterSpacing: '-0.02em' }}
            >
              Unduh Aplikasi <span className="gradient-text">Desktop</span>
            </h2>
            <p className={`mt-5 text-lg transition-all duration-700 delay-200 ${downloadVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} style={{ color: 'var(--color-slate-body)' }}>
              Jalankan langsung di perangkat Anda — lebih cepat dan data tersimpan lokal
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLATFORMS.map((p, i) => {
              const hasLocal = isAvailable(p.ext)
              const releaseUrl = releaseAssets[p.file]
              const downloadUrl = hasLocal
                ? `${DOWNLOAD_BASE}/${encodeURIComponent(p.file)}`
                : releaseUrl
              const canDownload = hasLocal || Boolean(releaseUrl)
              const cardStyle = {
                animationDelay: `${i * 150}ms`,
                background: 'var(--color-surface-card)',
                border: '1px solid rgba(148,163,184,0.12)',
                backdropFilter: 'blur(16px)',
              }
              return canDownload ? (
                <a
                  key={p.os}
                  href={downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`group flex flex-col items-center rounded-3xl p-8 text-center transition-all duration-700 hover:-translate-y-2 ${downloadVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                  style={cardStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 20px 60px rgba(5,150,105,0.12)'; e.currentTarget.style.borderColor = 'rgba(5,150,105,0.3)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'rgba(148,163,184,0.12)' }}
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl mb-5 transition-transform duration-500 group-hover:scale-110" style={{ background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)', boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}>
                    <p.icon size={28} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-1.5" style={{ color: 'var(--color-slate-heading)' }}>{p.os}</h3>
                  <p className="text-sm mb-6" style={{ color: 'var(--color-slate-body)' }}>{p.note}</p>
                  <div
                    className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white transition-all duration-300 group-hover:-translate-y-0.5"
                    style={{ background: 'linear-gradient(135deg, #059669 0%, #059669 100%)', boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}
                  >
                    <Download size={15} />
                    Unduh {p.os}
                  </div>
                </a>
              ) : (
                <div
                  key={p.os}
                  className={`flex flex-col items-center rounded-3xl p-8 text-center transition-all duration-700 hover:-translate-y-2 ${downloadVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                  style={cardStyle}
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl mb-5 transition-transform duration-500 group-hover:scale-110" style={{ background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)', boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}>
                    <p.icon size={28} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-1.5" style={{ color: 'var(--color-slate-heading)' }}>{p.os}</h3>
                  <p className="text-sm mb-6" style={{ color: 'var(--color-slate-body)' }}>{p.note}</p>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white transition-all duration-300 group-hover:-translate-y-0.5"
                    style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)', boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}
                  >
                    <PlayCircle size={15} />
                    Gunakan di Browser
                  </Link>
                </div>
              )
            })}
          </div>

          <p className={`mt-10 text-center text-sm transition-all duration-700 delay-300 ${downloadVisible ? 'opacity-100' : 'opacity-0'}`} style={{ color: 'var(--color-slate-muted)' }}>
            Versi terbaru langsung terunduh dari server kami — gratis, tanpa kartu kredit.
          </p>
        </div>
      </section>

      {/* ============ CTA BANNER ============ */}
      <section ref={ctaRef} className="relative px-6 py-16 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <div
            className={`relative overflow-hidden rounded-[2rem] px-8 py-16 text-center transition-all duration-1000 lg:px-16 lg:py-20 ${ctaVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
            style={{ background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 45%, #2563EB 75%, #60A5FA 100%)', boxShadow: '0 32px 80px rgba(15,23,42,0.12)' }}
          >
            {/* Decorative */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute top-0 left-0 h-full w-full" style={{ background: 'radial-gradient(ellipse at 30% 20%, var(--color-surface-card), transparent 60%)' }} />
            </div>

            <div className="relative">
              <h2 className="text-3xl lg:text-5xl font-[900] text-white mb-5 tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                Siap Mulai?
              </h2>
              <p className="text-lg mb-10 max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.7 }}>
                Bergabung dengan ribuan UMKM yang sudah merasakan kemudahan pembukuan digital.
              </p>
              <Link
                to="/register"
                className="group inline-flex items-center gap-2.5 rounded-full px-10 py-4 text-base font-bold transition-all duration-400 hover:-translate-y-1.5"
                style={{ background: '#F4F8FD', color: '#1D4ED8', boxShadow: '0 12px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(125,180,255,0.3)' }}
              >
                Daftar Gratis Sekarang
                <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>

              {/* Trust under CTA */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                {['Tanpa kartu kredit', 'Setup 2 menit', 'Bisa langsung pakai'].map((text, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
                    <CheckCircle size={13} />
                    {text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="relative px-6 pt-20 pb-8 lg:px-12" style={{ borderTop: '1px solid rgba(148,163,184,0.1)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-4 mb-14">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="flex h-10 w-10 items-center justify-center overflow-hidden"
                  style={{ borderRadius: '0.75rem', boxShadow: '0 4px 16px rgba(15,23,42,0.12)' }}
                >
                  <img src="/finora_logo.jpeg" alt="Finora" className="h-full w-full object-cover" />
                </div>
                <span className="text-lg font-extrabold" style={{ color: 'var(--color-slate-heading)' }}>Finora</span>
              </div>
              <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--color-slate-body)' }}>
                Platform pembukuan cerdas untuk UMKM Indonesia. Kelola keuangan dengan bantuan AI.
              </p>
              <div className="flex gap-3">
                {['twitter', 'linkedin', 'github'].map((social) => (
                  <div
                    key={social}
                    className="flex h-9 w-9 items-center justify-center rounded-xl cursor-pointer transition-all duration-300 hover:-translate-y-0.5"
                    style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.15)' }}
                  >
                    <div className="h-4 w-4 rounded" style={{ background: 'rgba(96,165,250,0.4)' }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Links */}
            {[
              { title: 'Product', links: ['Fitur', 'Cara Kerja', 'Harga', 'FAQ'] },
              { title: 'Company', links: ['Tentang Kami', 'Blog', 'Karir', 'Kontak'] },
              { title: 'Support', links: ['Bantuan', 'Privasi', 'Syarat', 'Status'] },
            ].map((col, i) => (
              <div key={i}>
                <h4 className="text-sm font-bold mb-5" style={{ color: 'var(--color-slate-heading)' }}>{col.title}</h4>
                <ul className="space-y-3">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-sm transition-colors duration-200 hover:translate-x-0.5 inline-block"
                        style={{ color: 'var(--color-slate-body)' }}
                        onMouseEnter={(e) => e.target.style.color = 'var(--color-accent-blue)'}
                        onMouseLeave={(e) => e.target.style.color = 'var(--color-slate-body)'}
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom */}
          <div className="flex flex-col items-center justify-between gap-4 pt-8 sm:flex-row" style={{ borderTop: '1px solid rgba(148,163,184,0.1)' }}>
            <p className="text-xs" style={{ color: 'var(--color-slate-muted)' }}>
              &copy; {new Date().getFullYear()} Finora. Hak cipta dilindungi.
            </p>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--color-accent-emerald)' }}>Semua sistem berjalan normal</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
