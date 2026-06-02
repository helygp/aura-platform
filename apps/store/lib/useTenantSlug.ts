'use client'

/**
 * lib/useTenantSlug.ts
 * Hook leve para Client Components que só precisam do slug
 * (ex: para montar URLs de API no cliente).
 *
 * Lê do cookie `tenant-slug` injetado pelo middleware —
 * disponível imediatamente, sem round-trip.
 *
 * Para acessar o tema completo, use useTenant() do TenantProvider.
 */

import { useMemo } from 'react'

export function useTenantSlug(): string {
  return useMemo(() => {
    if (typeof document === 'undefined') return 'demo'
    const match = document.cookie.match(/(?:^|;\s*)tenant-slug=([^;]+)/)
    return match ? decodeURIComponent(match[1]) : 'demo'
  }, [])
}
