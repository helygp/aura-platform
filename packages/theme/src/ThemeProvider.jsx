import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react'
import { injectTheme, loadFonts } from './inject.js'
import { AURA_DEFAULTS } from './tokens.js'

/**
 * ThemeProvider — Aura Theme
 *
 * Props:
 *   tenantTheme : objeto de tema do tenant (parcial ou null/undefined)
 *     {
 *       primaryColor?: string   (hex)
 *       mood?:         'light' | 'dark' | 'warm' | 'cool'
 *       fontPair?:     'modern' | 'elegant' | 'friendly' | 'bold' | 'minimal' | 'artisan'
 *       radius?:       'sharp' | 'soft' | 'round'
 *     }
 *   storageKey : string  — chave localStorage para preferência dark/light
 *                          (default: 'aura-color-scheme')
 *   children   : ReactNode
 *
 * Contexto expõe:
 *   isDark       : boolean
 *   toggleDark   : () => void
 *   theme        : objeto resolvido (merge defaults + tenant)
 *   setTenantTheme : (obj) => void   — troca de tema em runtime
 *
 * Uso:
 *   <ThemeProvider tenantTheme={tenant.theme_config}>
 *     <App />
 *   </ThemeProvider>
 *
 *   const { isDark, toggleDark } = useTheme()
 */

const ThemeContext = createContext(null)

const STORAGE_KEY_DEFAULT = 'aura-color-scheme'

/* ─── Ler preferência persistida ou system preference ─── */
function resolveInitialDark(storageKey) {
  if (typeof window === 'undefined') return false
  const stored = localStorage.getItem(storageKey)
  if (stored === 'dark')  return true
  if (stored === 'light') return false
  // fallback: preferência do sistema
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

/* ─── Merge tenant com defaults ─── */
function resolveTheme(tenantTheme) {
  return {
    primaryColor: tenantTheme?.primaryColor ?? AURA_DEFAULTS.primaryColor,
    mood:         tenantTheme?.mood         ?? AURA_DEFAULTS.mood,
    fontPair:     tenantTheme?.fontPair     ?? AURA_DEFAULTS.fontPair,
    radius:       tenantTheme?.radius       ?? AURA_DEFAULTS.radius,
  }
}

function ThemeProvider({
  tenantTheme,
  storageKey = STORAGE_KEY_DEFAULT,
  children,
}) {
  const [isDark,       setIsDark]       = useState(() => {
    const dark = resolveInitialDark(storageKey)
    // Injeção síncrona — evita flash no primeiro render
    const theme = resolveTheme(tenantTheme)
    injectTheme(theme, dark)
    loadFonts(theme.fontPair)
    return dark
  })
  const [currentTheme, setCurrentTheme] = useState(() => resolveTheme(tenantTheme))

  /* ─── Injetar toda vez que isDark ou tema mudar ─── */
  useEffect(() => {
    injectTheme(currentTheme, isDark)
    loadFonts(currentTheme.fontPair)
  }, [isDark, currentTheme])

  /* ─── Sync quando tenantTheme prop mudar (ex: carregou do servidor) ─── */
  useEffect(() => {
    setCurrentTheme(resolveTheme(tenantTheme))
  }, [
    tenantTheme?.primaryColor,
    tenantTheme?.mood,
    tenantTheme?.fontPair,
    tenantTheme?.radius,
  ])

  /* ─── Toggle dark/light com persistência ─── */
  const toggleDark = useCallback(() => {
    setIsDark(prev => {
      const next = !prev
      try { localStorage.setItem(storageKey, next ? 'dark' : 'light') } catch {}
      return next
    })
  }, [storageKey])

  /* ─── Setar dark explicitamente ─── */
  const setDark = useCallback((value) => {
    setIsDark(value)
    try { localStorage.setItem(storageKey, value ? 'dark' : 'light') } catch {}
  }, [storageKey])

  /* ─── Trocar tema do tenant em runtime ─── */
  const setTenantTheme = useCallback((partial) => {
    setCurrentTheme(prev => resolveTheme({ ...prev, ...partial }))
  }, [])

  const value = useMemo(() => ({
    isDark,
    toggleDark,
    setDark,
    theme: currentTheme,
    setTenantTheme,
  }), [isDark, toggleDark, setDark, currentTheme, setTenantTheme])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

/* ─── Hook ─── */
function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme deve ser usado dentro de <ThemeProvider>')
  return ctx
}

export { ThemeProvider, useTheme }
