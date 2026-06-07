/**
 * lib/tenant.ts
 * v2 — suporta identidade visual expandida do Aura Store Template.
 * Compatível com o design system do protótipo Fast Malhas.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface VolumeTier {
  min: number   // peças mínimas no carrinho
  off: number   // desconto fracional (0.05 = 5%)
}

export interface HeroStat {
  value: string
  label: string
}

export interface ValueProp {
  icon:  string
  title: string
  desc:  string
}

export interface TenantTheme {
  slug:      string
  name:      string
  logoUrl:   string | null
  faviconUrl: string | null

  // Paleta Tailwind (retrocompat)
  colors: {
    primary:          string
    primaryForeground: string
    secondary:        string
    accent:           string
    background:       string
    foreground:       string
    muted:            string
    mutedForeground:  string
    border:           string
    card:             string
    cardForeground:   string
  }

  // Identidade expandida
  brandColor:    string
  bgTone:        'warm' | 'pure' | 'gray'
  themeVariant:  'verde' | 'mono'
  radius:        string
  fontSans:      string

  // Conteúdo da home
  heroTitle:     string | null
  heroSubtitle:  string | null
  heroCta:       string | null
  heroBannerUrl: string | null
  heroLayout:    'split' | 'banner'
  heroStats:     HeroStat[]
  valueProps:    ValueProp[]

  // B2B
  minimumOrderAmount: number
  volumeTiers:        VolumeTier[]
  gradeFechada:       boolean
  showSkuCode:        boolean

  // Analytics
  ga4MeasurementId: string | null
  metaPixelId:      string | null
}

// ─── Slug ─────────────────────────────────────────────────────────────────────

export function extractTenantSlug(hostname: string): string {
  const host = hostname.split(':')[0]
  const prodMatch = host.match(/^loja\.([^.]+)\.aurabr\.app$/)
  if (prodMatch) return prodMatch[1]
  const devMatch = host.match(/^loja\.([^.]+)\.localhost$/)
  if (devMatch) return devMatch[1]
  return process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? 'demo'
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchTenantTheme(slug: string): Promise<TenantTheme | null> {
  const apiUrl = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL
  if (!apiUrl) {
    console.error('[tenant] API_INTERNAL_URL não configurada')
    return null
  }
  try {
    const res = await fetch(`${apiUrl}/store/tenant/theme`, {
      headers: { 'X-Tenant-Slug': slug },
      next: { revalidate: 60 },
    })
    if (!res.ok) {
      console.error(`[tenant] Falha ao buscar tema para "${slug}": ${res.status}`)
      return null
    }
    return res.json() as Promise<TenantTheme>
  } catch (err) {
    console.error('[tenant] Erro na requisição de tema:', err)
    return null
  }
}

// ─── buildThemeCssVars ────────────────────────────────────────────────────────
//
// Gera o bloco CSS injetado no <head> antes da primeira pintura (zero FOUC).
// Produz TANTO as vars Tailwind (--color-*) QUANTO as vars do design system
// do protótipo (--brand, --bg, --surface, --ink, etc.) — coexistem sem conflito.

export function buildThemeCssVars(theme: TenantTheme): string {
  // Guard defensivo — nunca crasha mesmo com campos ausentes da API
  const brand  = theme?.brandColor  ?? '#1f7a47'
  const bgTone = theme?.bgTone      ?? 'warm'
  const radius = theme?.radius      ?? '0.875rem'
  const font   = theme?.fontSans    ?? 'Hanken Grotesk'
  const c = theme?.colors ?? {}

  const brandSoft    = hexLighten(brand, 0.93)
  const brandSoftInk = hexDarken(brand, 0.35)
  const brandInk     = isLightColor(brand) ? '#16201a' : '#ffffff'

  const bgMap: Record<string, string> = {
    warm: '#f6f7f4',
    pure: '#ffffff',
    gray: '#f5f5f5',
  }
  const bg       = bgMap[bgTone] ?? '#f6f7f4'
  const surface2 = bgTone === 'warm' ? '#fbfcfa' : '#fafafa'

  const r = radius
  const rPx = remToPx(r)
  const rSm = `${(rPx * 0.71).toFixed(1)}px`
  const rLg = `${(rPx * 1.57).toFixed(1)}px`

  return [
    `--font: '${font}', ui-sans-serif, system-ui, -apple-system, sans-serif`,
    `--brand: ${brand}`,
    `--brand-700: ${hexDarken(brand, 0.12)}`,
    `--brand-ink: ${brandInk}`,
    `--brand-soft: ${brandSoft}`,
    `--brand-soft-ink: ${brandSoftInk}`,
    `--bg: ${bg}`,
    `--surface: #ffffff`,
    `--surface-2: ${surface2}`,
    `--ink: #111816`,
    `--ink-2: #3a4a42`,
    `--muted: #5e706a`,
    `--line: #d8ddd7`,
    `--line-2: #e4e9e2`,
    `--radius: ${r}`,
    `--radius-sm: ${rSm}`,
    `--radius-lg: ${rLg}`,
    `--shadow-sm: 0 1px 2px rgba(20,32,26,.04), 0 1px 3px rgba(20,32,26,.05)`,
    `--shadow: 0 4px 16px -4px rgba(20,32,26,.10), 0 2px 6px -2px rgba(20,32,26,.06)`,
    `--shadow-lg: 0 24px 60px -18px rgba(20,32,26,.22)`,
    `--control-h: 46px`,
    `--pad-card: 22px`,
    `--pad-sect: 56px`,
    `--gap-grid: 22px`,
    `--color-primary: ${c.primary}`,
    `--color-primary-foreground: ${c.primaryForeground}`,
    `--color-secondary: ${c.secondary}`,
    `--color-accent: ${c.accent}`,
    `--color-background: ${bg}`,
    `--color-foreground: #111816`,
    `--color-muted: ${c.muted}`,
    `--color-muted-foreground: #5e706a`,
    `--color-border: ${c.border}`,
    `--color-card: ${c.card}`,
    `--color-card-foreground: ${c.cardForeground}`,
    `--font-sans: '${font}', system-ui, sans-serif`,
  ].join(';')
}

// ─── Helpers de cor ───────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const n = hex.replace('#', '')
  const full = n.length === 3 ? n.split('').map(c => c + c).join('') : n
  const num = parseInt(full, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
    .join('')
}

function hexLighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount)
}

function hexDarken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount))
}

function isLightColor(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex)
  return (r * 299 + g * 587 + b * 114) / 1000 > 128
}

function remToPx(rem: string): number {
  const match = rem.match(/([\d.]+)rem/)
  return match ? parseFloat(match[1]) * 16 : 8
}

// ─── Default ──────────────────────────────────────────────────────────────────

export const DEFAULT_THEME: TenantTheme = {
  slug:      'demo',
  name:      'Loja Demo',
  logoUrl:   null,
  faviconUrl: null,
  colors: {
    primary:           '#1f7a47',
    primaryForeground: '#ffffff',
    secondary:         '#f4f4f5',
    accent:            '#f4f4f5',
    background:        '#f6f7f4',
    foreground:        '#16201a',
    muted:             '#f4f4f5',
    mutedForeground:   '#8a948e',
    border:            '#e7eae4',
    card:              '#ffffff',
    cardForeground:    '#16201a',
  },
  brandColor:    '#1f7a47',
  bgTone:        'warm',
  themeVariant:  'verde',
  radius:        '0.875rem',
  fontSans:      'Hanken Grotesk',
  heroTitle:     null,
  heroSubtitle:  null,
  heroCta:       'Ver catálogo',
  heroBannerUrl: null,
  heroLayout:    'split',
  heroStats:     [],
  valueProps:    [],
  minimumOrderAmount: 300,
  volumeTiers: [
    { min: 0,   off: 0    },
    { min: 50,  off: 0.05 },
    { min: 120, off: 0.10 },
    { min: 300, off: 0.15 },
  ],
  gradeFechada:  true,
  showSkuCode:   true,
  ga4MeasurementId: null,
  metaPixelId:      null,
}
