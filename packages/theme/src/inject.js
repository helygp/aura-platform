/**
 * inject.js — Aura Theme
 *
 * buildCssVars(config, isDark) → objeto { '--var': 'valor', ... }
 * injectTheme(config, isDark)  → aplica vars no :root do documento
 * loadFonts(fontPair)          → injeta <link> do Google Fonts se necessário
 */

import {
  AURA_DEFAULTS,
  RADIUS_TOKENS,
  FONT_PAIRS,
  MOOD_PALETTES,
  FEEDBACK_TOKENS,
} from './tokens.js'

/* ─── Derivar primary hover (escurece ~10%) ─── */
function darkenHex(hex, amount = 20) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (n >> 16) - amount)
  const g = Math.max(0, ((n >> 8) & 0xff) - amount)
  const b = Math.max(0, (n & 0xff) - amount)
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`
}

function lightenHex(hex, amount = 20) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, (n >> 16) + amount)
  const g = Math.min(255, ((n >> 8) & 0xff) + amount)
  const b = Math.min(255, (n & 0xff) + amount)
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`
}

/* ─── Contraste automático para primary-fg ─── */
function contrastFg(hex) {
  const n   = parseInt(hex.replace('#', ''), 16)
  const r   = n >> 16
  const g   = (n >> 8) & 0xff
  const b   = n & 0xff
  // luminância relativa simplificada
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.5 ? '#0F172A' : '#FFFFFF'
}

/* ─── Montar objeto de vars ─── */
export function buildCssVars(config, isDark) {
  const {
    primaryColor = AURA_DEFAULTS.primaryColor,
    mood         = AURA_DEFAULTS.mood,
    fontPair     = AURA_DEFAULTS.fontPair,
    radius       = AURA_DEFAULTS.radius,
  } = config ?? {}

  const moodKey    = MOOD_PALETTES[mood]    ? mood    : AURA_DEFAULTS.mood
  const fontKey    = FONT_PAIRS[fontPair]   ? fontPair : AURA_DEFAULTS.fontPair
  const radiusKey  = RADIUS_TOKENS[radius]  ? radius  : AURA_DEFAULTS.radius
  const scheme     = isDark ? 'dark' : 'light'

  const palette = MOOD_PALETTES[moodKey][scheme]
  const radii   = RADIUS_TOKENS[radiusKey]
  const fonts   = FONT_PAIRS[fontKey]

  const primary      = primaryColor
  const primaryHover = isDark ? lightenHex(primary, 30) : darkenHex(primary, 20)
  const primaryFg    = contrastFg(primary)

  // Feedback varia ligeiramente em dark
  const fb = isDark ? {
    success:   FEEDBACK_TOKENS.darkSuccess,
    successBg: FEEDBACK_TOKENS.darkSuccessBg,
    successFg: FEEDBACK_TOKENS.darkSuccessFg,
    warning:   FEEDBACK_TOKENS.darkWarning,
    warningBg: FEEDBACK_TOKENS.darkWarningBg,
    warningFg: FEEDBACK_TOKENS.darkWarningFg,
    error:     FEEDBACK_TOKENS.darkError,
    errorBg:   FEEDBACK_TOKENS.darkErrorBg,
    errorFg:   FEEDBACK_TOKENS.darkErrorFg,
  } : {
    success:   FEEDBACK_TOKENS.success,
    successBg: FEEDBACK_TOKENS.successBg,
    successFg: FEEDBACK_TOKENS.successFg,
    warning:   FEEDBACK_TOKENS.warning,
    warningBg: FEEDBACK_TOKENS.warningBg,
    warningFg: FEEDBACK_TOKENS.warningFg,
    error:     FEEDBACK_TOKENS.error,
    errorBg:   FEEDBACK_TOKENS.errorBg,
    errorFg:   FEEDBACK_TOKENS.errorFg,
  }

  return {
    // Brand
    '--color-primary':        primary,
    '--color-primary-hover':  primaryHover,
    '--color-primary-fg':     primaryFg,

    // Neutros (palette do mood × scheme)
    '--color-bg':             palette.bg,
    '--color-bg-subtle':      palette.bgSubtle,
    '--color-surface':        palette.surface,
    '--color-border':         palette.border,
    '--color-border-strong':  palette.borderStrong,

    // Texto
    '--color-text':           palette.text,
    '--color-text-muted':     palette.textMuted,
    '--color-text-disabled':  palette.textDisabled,
    '--color-text-secondary': palette.textMuted,
    '--color-surface-hover':  palette.borderStrong,

    // Feedback
    '--color-success':        fb.success,
    '--color-success-bg':     fb.successBg,
    '--color-success-fg':     fb.successFg,
    '--color-warning':        fb.warning,
    '--color-warning-bg':     fb.warningBg,
    '--color-warning-fg':     fb.warningFg,
    '--color-error':          fb.error,
    '--color-error-bg':       fb.errorBg,
    '--color-error-fg':       fb.errorFg,

    // Radius
    '--radius-sm':    radii.sm,
    '--radius-md':    radii.md,
    '--radius-lg':    radii.lg,
    '--radius-full':  radii.full,

    // Sombra
    '--shadow-sm': '0 1px 2px 0 rgb(0 0 0 / .05)',
    '--shadow-md': isDark
      ? '0 4px 6px -1px rgb(0 0 0 / .4), 0 2px 4px -2px rgb(0 0 0 / .4)'
      : '0 4px 6px -1px rgb(0 0 0 / .10), 0 2px 4px -2px rgb(0 0 0 / .10)',

    // Tipografia
    '--font-heading': `'${fonts.heading}', sans-serif`,
    '--font-body':    `'${fonts.body}', sans-serif`,
    '--font-heading-weight': fonts.headingWeight,
  }
}

/* ─── Aplicar no :root do DOM ─── */
export function injectTheme(config, isDark) {
  if (typeof document === 'undefined') return // SSR guard
  const vars = buildCssVars(config, isDark)
  const root = document.documentElement

  Object.entries(vars).forEach(([prop, value]) => {
    root.style.setProperty(prop, value)
  })

  // Marca o scheme para o Tailwind dark: e outros seletores
  if (isDark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

/* ─── Carregar Google Fonts dinamicamente ─── */
const loadedFonts = new Set()

export function loadFonts(fontPair) {
  if (typeof document === 'undefined') return
  const fonts = FONT_PAIRS[fontPair] ?? FONT_PAIRS[AURA_DEFAULTS.fontPair]
  const families = [...new Set([fonts.heading, fonts.body])]
    .filter(f => !loadedFonts.has(f))

  if (families.length === 0) return

  const query = families
    .map(f => `family=${encodeURIComponent(f)}:wght@400;500;600;700;800`)
    .join('&')

  const link = document.createElement('link')
  link.rel  = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?${query}&display=swap`
  document.head.appendChild(link)

  families.forEach(f => loadedFonts.add(f))
}
