/**
 * routes/store/tenant.js  v2
 * GET /store/tenant/theme — endpoint público
 */

import { Router } from 'express'
import { prismaMaster as prisma } from '../../lib/prisma-master.js'
import { query } from '../../lib/tenantDb.js'

export const storeTenantRouter = Router()

function buildColorPalette(primaryColor, mood, bgTone) {
  const primary = primaryColor ?? '#18181b'
  const isDark  = mood === 'dark'
  const bgMap   = { warm: isDark ? '#0f1510' : '#f6f7f4', pure: isDark ? '#09090b' : '#ffffff', gray: isDark ? '#111113' : '#f5f5f5' }
  const bg      = bgMap[bgTone] ?? (isDark ? '#09090b' : '#ffffff')
  return {
    primary, primaryForeground: '#ffffff',
    secondary: isDark ? '#27272a' : '#f4f4f5',
    accent:    isDark ? '#3f3f46' : '#e4e4e7',
    background: bg,
    foreground: isDark ? '#fafafa' : '#09090b',
    muted:      isDark ? '#27272a' : '#f4f4f5',
    mutedForeground: isDark ? '#a1a1aa' : '#71717a',
    border:     isDark ? '#27272a' : '#e4e4e7',
    card:       isDark ? '#18181b' : '#ffffff',
    cardForeground: isDark ? '#fafafa' : '#09090b',
  }
}

function resolveFontSans(fontPair) {
  const map = {
    'inter-inter': 'Inter', 'plus-jakarta': 'Plus Jakarta Sans',
    'dm-sans': 'DM Sans', 'geist': 'Geist', 'nunito': 'Nunito',
    'roboto': 'Roboto', 'hanken-grotesk': 'Hanken Grotesk',
    'poppins': 'Poppins', 'outfit': 'Outfit', 'urbanist': 'Urbanist',
  }
  return map[fontPair] ?? 'Inter'
}

function resolveRadius(radiusStyle, rawRadius) {
  if (rawRadius && !radiusStyle) return rawRadius
  const map = { rounded: '0.875rem', medium: '0.625rem', sharp: '0.375rem' }
  return map[radiusStyle] ?? rawRadius ?? '0.5rem'
}

storeTenantRouter.get('/theme', async (req, res) => {
  try {
    const slug =
      req.headers['x-tenant-slug'] ??
      req.headers['x-tenant-id'] ??
      extractSlugFromOrigin(req.headers['origin'] ?? '')

    if (!slug) return res.status(400).json({ error: 'Tenant não identificado.' })

    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { slug: true, name: true, status: true, themeConfig: true },
    })

    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado.' })
    if (tenant.status !== 'ACTIVE' && tenant.status !== 'TRIAL')
      return res.status(403).json({ error: 'Loja inativa.' })

    let ts = {}
    try {
      const { rows } = await query("SELECT value FROM settings WHERE key = 'theme'", [], slug)
      if (rows[0]?.value) ts = rows[0].value
    } catch { /* não fatal */ }

    const tc     = tenant.themeConfig ?? {}
    const colors = buildColorPalette(tc.primaryColor, tc.mood, tc.bgTone)
    const fontSans = resolveFontSans(tc.fontPair)
    const radius   = resolveRadius(tc.radiusStyle, tc.radius)

    const theme = {
      slug: tenant.slug, name: tenant.name,
      logoUrl:    ts.logoUrl    ?? null,
      faviconUrl: ts.faviconUrl ?? null,
      colors,
      radius,
      fontSans,
      brandColor:   tc.primaryColor    ?? '#18181b',
      bgTone:       tc.bgTone          ?? 'pure',
      themeVariant: tc.themeVariant    ?? 'verde',
      heroTitle:     ts.heroTitle     ?? null,
      heroSubtitle:  ts.heroSubtitle  ?? null,
      heroCta:       ts.heroCta       ?? null,
      heroBannerUrl: ts.heroBannerUrl ?? null,
      heroLayout:    ts.heroLayout    ?? 'banner',
      heroStats:     ts.heroStats     ?? [],
      valueProps:    ts.valueProps    ?? [],
      minimumOrderAmount: ts.minimumOrderAmount ?? tc.minOrder ?? 0,
      volumeTiers:  tc.volumeTiers    ?? [],
      gradeFechada: tc.gradeFechada   ?? false,
      showSkuCode:  tc.showSkuCode    ?? false,
      ga4MeasurementId: tc.ga4MeasurementId ?? null,
      metaPixelId:      tc.metaPixelId      ?? null,
    }

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
    const url   = new URL(origin)
    const match = url.hostname.match(/^loja\.([^.]+)\.aurabr\.app$/)
    return match ? match[1] : null
  } catch { return null }
}
