/**
 * routes/store/tenant.js
 * GET /store/tenant/theme
 *
 * Endpoint PÚBLICO — sem autenticação.
 * Retorna o tema do tenant para a loja B2B (Next.js SSR).
 *
 * Identificação do tenant:
 *   1. Header X-Tenant-Slug  (enviado pelo middleware da loja)
 *   2. Header X-Tenant-ID    (alternativo)
 *   3. Subdomínio do Origin  (fallback)
 *
 * Rate limiting: 60 req/min por IP (aplicado no index.js).
 */

import { Router } from 'express'
import { prismaMaster as prisma } from '../../lib/prisma-master.js'
import { query } from '../../lib/tenantDb.js'

export const storeTenantRouter = Router()

/* ── Helpers de cor ── */

/** Converte primaryColor + mood em paleta de CSS vars */
function buildColorPalette(primaryColor, mood) {
  const primary = primaryColor ?? '#18181b'

  // Paleta base — em produção pode ser gerada dinamicamente via chroma.js
  const isDark = mood === 'dark'
  return {
    primary,
    primaryForeground: '#ffffff',
    secondary: isDark ? '#27272a' : '#f4f4f5',
    accent: isDark ? '#3f3f46' : '#e4e4e7',
    background: isDark ? '#09090b' : '#ffffff',
    foreground: isDark ? '#fafafa' : '#09090b',
    muted: isDark ? '#27272a' : '#f4f4f5',
    mutedForeground: isDark ? '#a1a1aa' : '#71717a',
    border: isDark ? '#27272a' : '#e4e4e7',
    card: isDark ? '#18181b' : '#ffffff',
    cardForeground: isDark ? '#fafafa' : '#09090b',
  }
}

/** Mapeia fontPair do ERP para font-family da loja */
function resolveFontSans(fontPair) {
  const map = {
    'inter-inter':    'Inter',
    'plus-jakarta':   'Plus Jakarta Sans',
    'dm-sans':        'DM Sans',
    'geist':          'Geist',
    'nunito':         'Nunito',
    'roboto':         'Roboto',
  }
  return map[fontPair] ?? 'Inter'
}

/* ── GET /store/tenant/theme ── */
storeTenantRouter.get('/theme', async (req, res) => {
  try {
    // Resolve o slug da requisição
    const slug =
      req.headers['x-tenant-slug'] ??
      req.headers['x-tenant-id'] ??
      extractSlugFromOrigin(req.headers['origin'] ?? '')

    if (!slug) {
      return res.status(400).json({ error: 'Tenant não identificado.' })
    }

    // Busca o tenant no banco master
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: {
        slug: true,
        name: true,
        status: true,
        themeConfig: true,
      },
    })

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant não encontrado.' })
    }

    if (tenant.status !== 'ACTIVE' && tenant.status !== 'TRIAL') {
      return res.status(403).json({ error: 'Loja inativa.' })
    }

    // Busca configurações extras do banco do tenant (logoUrl, banners, etc.)
    let tenantSettings = {}
    try {
      const { rows } = await query(
        "SELECT value FROM settings WHERE key = 'theme'",
        [],
        slug,
      )
      if (rows[0]?.value) tenantSettings = rows[0].value
    } catch {
      // Banco do tenant pode não ter a tabela ainda — não é fatal
    }

    // Monta configurações do tema
    const tc = tenant.themeConfig ?? {}
    const colors = buildColorPalette(tc.primaryColor, tc.mood)
    const fontSans = resolveFontSans(tc.fontPair)
    const radius = tc.radius ?? '0.5rem'

    const theme = {
      slug: tenant.slug,
      name: tenant.name,
      logoUrl: tenantSettings.logoUrl ?? null,
      faviconUrl: tenantSettings.faviconUrl ?? null,
      colors,
      radius,
      fontSans,
      // Conteúdo da home (configurável no painel ERP)
      heroTitle:     tenantSettings.heroTitle ?? null,
      heroSubtitle:  tenantSettings.heroSubtitle ?? null,
      heroCta:       tenantSettings.heroCta ?? null,
      heroBannerUrl: tenantSettings.heroBannerUrl ?? null,
      minimumOrderAmount: tenantSettings.minimumOrderAmount ?? 0,
      // Analytics (IDs configurados pelo admin no ERP)
      ga4MeasurementId: tc.ga4MeasurementId ?? null,
      metaPixelId:      tc.metaPixelId      ?? null,
    }

    // Cache de 60s no CDN/proxy — o Next.js também faz revalidate:60
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30')
    res.json(theme)
  } catch (err) {
    console.error('[store/tenant/theme]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

function extractSlugFromOrigin(origin) {
  if (!origin) return null
  try {
    const url = new URL(origin)
    const match = url.hostname.match(/^loja\.([^.]+)\.aurabr\.app$/)
    return match ? match[1] : null
  } catch {
    return null
  }
}
