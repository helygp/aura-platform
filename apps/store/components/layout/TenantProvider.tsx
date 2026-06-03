'use client'

/**
 * components/layout/TenantProvider.tsx
 * Tarefa 2 — Contexto do tenant para Client Components.
 *
 * O layout RSC busca o tema no servidor e passa como prop.
 * Este componente distribui para qualquer filho via useTenant().
 *
 * Uso:
 *   const { theme } = useTenant()
 *   console.log(theme.name, theme.colors.primary)
 */

import { createContext, useContext, type ReactNode } from 'react'
import type { TenantTheme } from '@/lib/tenant'

// ─── Contexto ─────────────────────────────────────────────────────────────────

interface TenantContextValue {
  theme: TenantTheme
  /** Slug do tenant — atalho para theme.slug */
  slug: string
}

const TenantContext = createContext<TenantContextValue | null>(null)

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext)
  if (!ctx) {
    throw new Error(
      '[useTenant] Deve ser usado dentro de <TenantProvider>. ' +
        'Verifique se o componente está na árvore abaixo de app/layout.tsx.',
    )
  }
  return ctx
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface Props {
  theme: TenantTheme
  children: ReactNode
}

export default function TenantProvider({ theme, children }: Props) {
  return (
    <TenantContext.Provider value={{ theme, slug: theme.slug }}>
      {children}
    </TenantContext.Provider>
  )
}
