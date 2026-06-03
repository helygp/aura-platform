/**
 * lib/tenant.ts
 * Resolve o slug do tenant a partir do hostname.
 * Usado no middleware e no layout raiz (SSR).
 */

export interface TenantTheme {
  slug: string
  name: string
  logoUrl: string | null
  faviconUrl: string | null
  colors: {
    primary: string
    primaryForeground: string
    secondary: string
    accent: string
    background: string
    foreground: string
    muted: string
    mutedForeground: string
    border: string
    card: string
    cardForeground: string
  }
  radius: string
  fontSans: string
  heroTitle: string | null
  heroSubtitle: string | null
  heroCta: string | null
  heroBannerUrl: string | null
  minimumOrderAmount: number
  ga4MeasurementId: string | null
  metaPixelId: string | null
}

export interface TenantInfo {
  slug: string
  theme: TenantTheme
}

/**
 * Extrai o slug do tenant do hostname.
 * loja.acme.aurabr.app  → "acme"
 * loja.acme.localhost   → "acme"  (dev local)
 * localhost             → "demo"  (fallback dev)
 */
export function extractTenantSlug(hostname: string): string {
  // Remove porta se existir
  const host = hostname.split(':')[0]

  // loja.[slug].aurabr.app
  const prodMatch = host.match(/^loja\.([^.]+)\.aurabr\.app$/)
  if (prodMatch) return prodMatch[1]

  // loja.[slug].localhost (dev)
  const devMatch = host.match(/^loja\.([^.]+)\.localhost$/)
  if (devMatch) return devMatch[1]

  // Fallback para desenvolvimento
  return process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? 'demo'
}

/**
 * Busca os dados do tenant na API do ERP.
 * Chamado no middleware (edge) e no layout (RSC).
 */
export async function fetchTenantTheme(slug: string): Promise<TenantTheme | null> {
  const apiUrl = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL
  if (!apiUrl) {
    console.error('[tenant] API_INTERNAL_URL não configurada')
    return null
  }

  try {
    const res = await fetch(`${apiUrl}/store/tenant/theme`, {
      headers: { 'X-Tenant-Slug': slug },
      // Cache de 60s no lado do servidor — revalidação automática
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

/**
 * Gera o bloco de CSS vars para injetar no <head>.
 * Aplicado antes do HTML chegar no cliente — sem flash de estilo.
 */
export function buildThemeCssVars(theme: TenantTheme): string {
  const c = theme.colors
  return `
    --color-primary: ${c.primary};
    --color-primary-foreground: ${c.primaryForeground};
    --color-secondary: ${c.secondary};
    --color-accent: ${c.accent};
    --color-background: ${c.background};
    --color-foreground: ${c.foreground};
    --color-muted: ${c.muted};
    --color-muted-foreground: ${c.mutedForeground};
    --color-border: ${c.border};
    --color-card: ${c.card};
    --color-card-foreground: ${c.cardForeground};
    --radius: ${theme.radius};
    --radius-sm: calc(${theme.radius} * 0.5);
    --radius-lg: calc(${theme.radius} * 1.5);
    --radius-full: 9999px;
    --font-sans: '${theme.fontSans}', system-ui, sans-serif;
  `.trim()
}

/** Tema padrão usado como fallback quando a API não responde */
export const DEFAULT_THEME: TenantTheme = {
  slug: 'demo',
  name: 'Loja Demo',
  logoUrl: null,
  faviconUrl: null,
  colors: {
    primary: '#18181b',
    primaryForeground: '#fafafa',
    secondary: '#f4f4f5',
    accent: '#f4f4f5',
    background: '#ffffff',
    foreground: '#09090b',
    muted: '#f4f4f5',
    mutedForeground: '#71717a',
    border: '#e4e4e7',
    card: '#ffffff',
    cardForeground: '#09090b',
  },
  radius: '0.5rem',
  fontSans: 'Inter',
  heroTitle: null,
  heroSubtitle: null,
  heroCta: null,
  heroBannerUrl: null,
  minimumOrderAmount: 0,
  ga4MeasurementId:  null,
  metaPixelId:       null,
}
