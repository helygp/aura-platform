/**
 * app/(store)/pedido/novo/page.tsx
 * Tarefa 7 — Checkout B2B.
 *
 * SSR mínimo: só busca minimumOrderAmount e slug.
 * Os itens vêm do localStorage via CheckoutForm (Client Component).
 */

import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { fetchTenantTheme, DEFAULT_THEME } from '@/lib/tenant'
import CheckoutForm from '@/components/checkout/CheckoutForm'

export const metadata: Metadata = { title: 'Finalizar pedido' }

export default async function CheckoutPage() {
  const slug  = headers().get('x-tenant-slug') ?? 'demo'
  const theme = (await fetchTenantTheme(slug)) ?? DEFAULT_THEME

  return (
    <CheckoutForm
      tenantSlug={slug}
      minimumOrderAmount={theme.minimumOrderAmount}
    />
  )
}
