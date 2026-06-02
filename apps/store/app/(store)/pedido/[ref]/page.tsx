/**
 * app/(store)/pedido/[ref]/page.tsx
 * Tarefa 8 — Confirmação e status do pedido B2B.
 *
 * SSR: busca o estado inicial do pedido pelo ref opaco.
 * Client: polling a cada 15s + cancelamento (OrderStatusView).
 *
 * [ref] = token opaco gerado pelo servidor — ex: ord_4a9c1b2e3f8d7e6a
 * Nunca expõe IDs internos.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { ordersApi } from '@/lib/api'
import OrderStatusView from '@/components/order/OrderStatusView'

interface Props {
  params: { ref: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `Pedido ${params.ref}`,
    // Evita indexação de páginas de pedido
    robots: { index: false, follow: false },
  }
}

export default async function PedidoStatusPage({ params }: Props) {
  // Valida formato antes de qualquer I/O
  if (!/^ord_[0-9a-f]{16}$/.test(params.ref)) notFound()

  const tenantSlug = headers().get('x-tenant-slug') ?? 'demo'

  const order = await ordersApi.get(tenantSlug, params.ref).catch(() => null)
  if (!order) notFound()

  return (
    <OrderStatusView
      initialOrder={order}
      tenantSlug={tenantSlug}
    />
  )
}
