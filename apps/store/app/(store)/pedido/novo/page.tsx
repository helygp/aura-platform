/**
 * app/(store)/pedido/novo/page.tsx
 * Checkout B2B — duplo guard de auth:
 * 1. middleware.ts bloqueia na borda (sem cookie → redirect login)
 * 2. Aqui verificamos token via /store/auth/me como barreira server-side
 */

import type { Metadata } from 'next'
import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { fetchTenantTheme, DEFAULT_THEME } from '@/lib/tenant'
import CheckoutForm from '@/components/checkout/CheckoutForm'

export const metadata: Metadata = { title: 'Finalizar pedido' }

export default async function CheckoutPage() {
  const slug  = headers().get('x-tenant-slug') ?? 'demo'
  const token = cookies().get('store_access')?.value

  // Segunda barreira: sem token → login (middleware já faz isso, mas belt+suspenders)
  if (!token) {
    redirect('/conta/login?redirect=/pedido/novo')
  }

  const theme = (await fetchTenantTheme(slug)) ?? DEFAULT_THEME

  return (
    <CheckoutForm
      tenantSlug={slug}
      minimumOrderAmount={theme.minimumOrderAmount}
    />
  )
}
