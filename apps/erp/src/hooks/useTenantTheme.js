/**
 * hooks/useTenantTheme.js
 *
 * Busca tema e info do tenant na API.
 * Cacheia em sessionStorage por 5 min para evitar flash de tema.
 * Se a API falhar, usa defaults Aura sem quebrar a UI.
 *
 * O cache é invalidado automaticamente quando o slug do tenant muda
 * (evita mostrar nome errado ao trocar entre tenants no mesmo browser).
 */

import { useState, useEffect } from 'react'

const CACHE_KEY    = 'aura-tenant-theme'
const CACHE_TTL    = 5 * 60 * 1000
const CURRENT_HOST = window.location.hostname // ex: fastmalhas.aurabr.app

const DEFAULT_THEME = {
  primaryColor: '#0284C7',
  mood:         'light',
  fontPair:     'modern',
  radius:       'soft',
}

const DEFAULT_INFO = {
  name:    'Aura Platform',
  slug:    '',
  logoUrl: null,
}

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, ts, host } = JSON.parse(raw)
    // Invalida se expirou OU se o hostname mudou (troca de tenant no mesmo browser)
    if (Date.now() - ts > CACHE_TTL) return null
    if (host && host !== CURRENT_HOST) return null
    return data
  } catch { return null }
}

function writeCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      ts:   Date.now(),
      host: CURRENT_HOST,
    }))
  } catch {}
}

export function useTenantTheme() {
  const cached = readCache()

  const [tenantTheme, setTenantTheme] = useState(cached?.theme ?? DEFAULT_THEME)
  const [tenantInfo,  setTenantInfo]  = useState(cached?.info  ?? DEFAULT_INFO)
  const [isLoading,   setIsLoading]   = useState(!cached)
  const [error,       setError]       = useState(null)

  useEffect(() => {
    if (cached) return

    async function fetchTenant() {
      try {
        const res = await fetch('/api/tenant/me', { credentials: 'include' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()

        const theme = {
          primaryColor:     json.theme_config?.primaryColor     ?? DEFAULT_THEME.primaryColor,
          mood:             json.theme_config?.mood             ?? DEFAULT_THEME.mood,
          fontPair:         json.theme_config?.fontPair         ?? DEFAULT_THEME.fontPair,
          radius:           json.theme_config?.radius           ?? DEFAULT_THEME.radius,
          ga4MeasurementId: json.theme_config?.ga4MeasurementId ?? null,
          metaPixelId:      json.theme_config?.metaPixelId      ?? null,
        }
        const info = {
          name:             json.name    ?? DEFAULT_INFO.name,
          slug:             json.slug    ?? DEFAULT_INFO.slug,
          logoUrl:          json.logoUrl ?? null,
          ga4MeasurementId: json.theme_config?.ga4MeasurementId ?? null,
        }

        setTenantTheme(theme)
        setTenantInfo(info)
        writeCache({ theme, info })
      } catch (err) {
        setError(err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTenant()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { tenantTheme, tenantInfo, isLoading, error }
}
