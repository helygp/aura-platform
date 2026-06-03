'use client'

/**
 * app/(store)/conta/pedidos/page.tsx
 * Histórico de pedidos do comprador logado.
 * Redireciona para /conta/login se não autenticado.
 * Permite reordenar um pedido anterior.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'
import { useTenant } from '@/components/layout/TenantProvider'
import { ordersApi, type OrderStatus } from '@/lib/api'
import { formatPrice } from '@/lib/cart'
import { addToCart } from '@/lib/cart'
import OrderStatusBadge from '@/components/order/OrderStatusBadge'

export default function MeusPedidosPage() {
  const router        = useRouter()
  const { buyer, loading: authLoading } = useAuth()
  const { slug }      = useTenant()
  const [orders,   setOrders]   = useState<OrderStatus[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [reordering, setReordering] = useState<string | null>(null)

  // Guard: redireciona se não logado
  useEffect(() => {
    if (!authLoading && !buyer) router.replace('/conta/login')
  }, [authLoading, buyer, router])

  // Busca pedidos
  useEffect(() => {
    if (!buyer) return
    ordersApi.list(slug)
      .then(setOrders)
      .catch(() => setError('Não foi possível carregar seus pedidos.'))
      .finally(() => setLoading(false))
  }, [buyer, slug])

  // ── Reordenar ─────────────────────────────────────────────────────────────
  async function handleReorder(order: OrderStatus) {
    setReordering(order.ref)
    try {
      // Busca detalhes completos (com skuId de cada item)
      const full = await ordersApi.get(slug, order.ref)
      for (const item of full.items) {
        // item.skuId está disponível na resposta detalhada (adicionamos abaixo)
        if ((item as any).skuId) {
          addToCart({
            skuId:        (item as any).skuId,
            skuCode:      (item as any).skuCode ?? '',
            productSlug:  (item as any).productSlug ?? '',
            productName:  item.name,
            attributes:   typeof item.variant === 'string'
              ? parseVariant(item.variant)
              : (item as any).attributes ?? {},
            price:        item.price,
            coverImageUrl: null,
            quantity:     item.quantity,
            maxStock:     999,
          })
        }
      }
      router.push('/carrinho')
    } catch {
      setError('Erro ao reordenar. Tente novamente.')
    } finally {
      setReordering(null)
    }
  }

  // ── Loading / guard states ─────────────────────────────────────────────────
  if (authLoading || (!buyer && !authLoading)) {
    return <div className="flex min-h-[50vh] items-center justify-center"><SpinnerIcon /></div>
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">

      {/* Cabeçalho */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meus pedidos</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Olá, {buyer?.name.split(' ')[0]}</p>
        </div>
        <Link href="/catalogo" className="text-sm font-medium text-primary hover:underline">
          + Novo pedido
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-[var(--radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-16"><SpinnerIcon /></div>
      ) : orders.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <OrderRow
              key={order.ref}
              order={order}
              reordering={reordering === order.ref}
              onReorder={() => handleReorder(order)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── OrderRow ─────────────────────────────────────────────────────────────────

function OrderRow({ order, reordering, onReorder }: {
  order: OrderStatus
  reordering: boolean
  onReorder: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-foreground">{order.ref}</span>
          <OrderStatusBadge status={order.status} size="sm" />
        </div>
        <p className="text-xs text-muted-foreground">
          {formatDate(order.createdAt)} · {order.items.length} {order.items.length === 1 ? 'item' : 'itens'} · {formatPrice(order.total)}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={`/pedido/${order.ref}`}
          className="rounded-[var(--radius)] border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
        >
          Ver pedido
        </Link>
        <button
          onClick={onReorder}
          disabled={reordering}
          className="flex items-center gap-1.5 rounded-[var(--radius)] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {reordering ? <SpinnerIcon size={12} /> : <RefreshIcon />}
          Reordenar
        </button>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.75" className="text-border">
        <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/>
      </svg>
      <div>
        <p className="font-medium text-foreground">Nenhum pedido ainda</p>
        <p className="mt-0.5 text-sm text-muted-foreground">Seus pedidos aparecerão aqui.</p>
      </div>
      <Link href="/catalogo" className="rounded-[var(--radius)] bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
        Ver catálogo
      </Link>
    </div>
  )
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso))
}

function parseVariant(v: string): Record<string, string> {
  const result: Record<string, string> = {}
  v.split(' · ').forEach((part) => {
    const [k, val] = part.split(': ')
    if (k && val) result[k.trim()] = val.trim()
  })
  return result
}

function SpinnerIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
}

function RefreshIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
}
