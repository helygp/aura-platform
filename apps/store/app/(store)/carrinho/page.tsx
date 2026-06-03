/**
 * app/(store)/carrinho/page.tsx
 * Tarefa 6 — Carrinho B2B.
 *
 * SSR: busca apenas o minimumOrderAmount do tenant.
 * Os itens são lidos do localStorage no cliente (CartView).
 * Sem SSR de itens — carrinho é por comprador, não por tenant.
 */

import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { fetchTenantTheme, DEFAULT_THEME } from '@/lib/tenant'
import CartView from '@/components/cart/CartView'

export const metadata: Metadata = { title: 'Carrinho' }

export default async function CarrinhoPage() {
  const slug = headers().get('x-tenant-slug') ?? 'demo'
  const theme = (await fetchTenantTheme(slug)) ?? DEFAULT_THEME

  return <CartView minimumOrderAmount={theme.minimumOrderAmount} />
}
