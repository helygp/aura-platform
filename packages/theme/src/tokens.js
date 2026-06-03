/**
 * tokens.js — Aura Theme
 *
 * Mapeia os 4 parâmetros de tema (primaryColor, mood, fontPair, radius)
 * para CSS variables concretas injetadas no :root.
 *
 * Qualquer valor ausente cai no fallback AURA_DEFAULTS.
 */

/* ─── Defaults da marca Aura ─── */
export const AURA_DEFAULTS = {
  primaryColor: '#0284C7',
  mood:         'light',
  fontPair:     'modern',
  radius:       'soft',
}

/* ─── Radius ─── */
export const RADIUS_TOKENS = {
  sharp: { sm: '2px',    md: '4px',    lg: '6px',    full: '9999px' },
  soft:  { sm: '4px',    md: '8px',    lg: '12px',   full: '9999px' },
  round: { sm: '8px',    md: '14px',   lg: '20px',   full: '9999px' },
}

/* ─── Font pairs ─── */
// Cada par define heading + body como Google Fonts (carregadas no injetor)
export const FONT_PAIRS = {
  modern:   { heading: 'Inter',            body: 'Inter',          headingWeight: '600' },
  elegant:  { heading: 'Playfair Display', body: 'Lato',           headingWeight: '700' },
  friendly: { heading: 'Nunito',           body: 'Nunito',         headingWeight: '700' },
  bold:     { heading: 'Sora',             body: 'Sora',           headingWeight: '800' },
  minimal:  { heading: 'DM Sans',          body: 'DM Sans',        headingWeight: '500' },
  artisan:  { heading: 'Fraunces',         body: 'Source Serif 4', headingWeight: '700' },
}

/* ─── Mood palettes ─── */
// Cada mood tem uma variante light e dark
// primaryColor é injetado separadamente via hex → derivações
export const MOOD_PALETTES = {
  light: {
    light: {
      bg:           '#FFFFFF',
      bgSubtle:     '#F8FAFC',
      surface:      '#F1F5F9',
      border:       '#E2E8F0',
      borderStrong: '#CBD5E1',
      text:         '#0F172A',
      textMuted:    '#64748B',
      textDisabled: '#94A3B8',
    },
    dark: {
      bg:           '#0F172A',
      bgSubtle:     '#1E293B',
      surface:      '#1E293B',
      border:       '#334155',
      borderStrong: '#475569',
      text:         '#F1F5F9',
      textMuted:    '#94A3B8',
      textDisabled: '#475569',
    },
  },

  dark: {
    // mood dark: superfícies mais escuras, quase preto
    light: {
      bg:           '#FAFAFA',
      bgSubtle:     '#F4F4F5',
      surface:      '#E4E4E7',
      border:       '#D4D4D8',
      borderStrong: '#A1A1AA',
      text:         '#09090B',
      textMuted:    '#52525B',
      textDisabled: '#A1A1AA',
    },
    dark: {
      bg:           '#09090B',
      bgSubtle:     '#18181B',
      surface:      '#27272A',
      border:       '#3F3F46',
      borderStrong: '#52525B',
      text:         '#FAFAFA',
      textMuted:    '#A1A1AA',
      textDisabled: '#3F3F46',
    },
  },

  warm: {
    light: {
      bg:           '#FFFBF5',
      bgSubtle:     '#FEF3E2',
      surface:      '#FDE8C8',
      border:       '#F5D0A9',
      borderStrong: '#E8B47D',
      text:         '#1C0A00',
      textMuted:    '#7C4A1E',
      textDisabled: '#C4956A',
    },
    dark: {
      bg:           '#1C0A00',
      bgSubtle:     '#2D1200',
      surface:      '#3D1A00',
      border:       '#5C2E00',
      borderStrong: '#7A4000',
      text:         '#FFF8F0',
      textMuted:    '#C4956A',
      textDisabled: '#5C2E00',
    },
  },

  cool: {
    light: {
      bg:           '#F0F9FF',
      bgSubtle:     '#E0F2FE',
      surface:      '#BAE6FD',
      border:       '#7DD3FC',
      borderStrong: '#38BDF8',
      text:         '#082F49',
      textMuted:    '#0369A1',
      textDisabled: '#7DD3FC',
    },
    dark: {
      bg:           '#082F49',
      bgSubtle:     '#0C4A6E',
      surface:      '#075985',
      border:       '#0369A1',
      borderStrong: '#0284C7',
      text:         '#F0F9FF',
      textMuted:    '#7DD3FC',
      textDisabled: '#0369A1',
    },
  },
}

/* ─── Feedback (fixos, não variam por tenant) ─── */
export const FEEDBACK_TOKENS = {
  success:    '#16A34A',
  successBg:  '#DCFCE7',
  successFg:  '#14532D',
  warning:    '#CA8A04',
  warningBg:  '#FEF9C3',
  warningFg:  '#713F12',
  error:      '#DC2626',
  errorBg:    '#FEE2E2',
  errorFg:    '#7F1D1D',
  // dark overrides
  darkSuccess:   '#4ADE80',
  darkSuccessBg: '#14532D',
  darkSuccessFg: '#DCFCE7',
  darkWarning:   '#FDE047',
  darkWarningBg: '#713F12',
  darkWarningFg: '#FEF9C3',
  darkError:     '#F87171',
  darkErrorBg:   '#7F1D1D',
  darkErrorFg:   '#FEE2E2',
}
