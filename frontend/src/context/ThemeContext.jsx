import { createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'finora_theme'
const ThemeContext = createContext(null)

export function getInitialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* ignore */
  }
  return 'light'
}

export function applyThemeClass(mode) {
  const el = document.documentElement
  if (mode === 'light') {
    el.classList.add('light')
    el.classList.remove('dark')
  } else {
    el.classList.add('dark')
    el.classList.remove('light')
  }
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => getInitialTheme())

  useEffect(() => {
    applyThemeClass(mode)
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      /* ignore */
    }
  }, [mode])

  const toggle = () => setMode((m) => (m === 'dark' ? 'light' : 'dark'))
  const setModeExplicit = (m) => setMode(m === 'light' ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ mode, toggle, setMode: setModeExplicit }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
