'use client'

/**
 * components/order/OrderStatusView.tsx
 * Página de status completa — polling + cancelamento.
 *
 * Polling: a cada 15s enquanto o pedido não estiver em estado terminal.
 * Cancelamento: modal de confirmação + PATCH /store/orders/:ref/cancel.
 */

import { useState, useEffect, useCallback } from 'react'
import type { OrderStatus } from '@/lib/api'
import { ordersApi } from '@/lib/api'
import { formatPrice } from '@/lib/cart'
import OrderStatusBadge from './OrderStatusBadge'
import OrderTimeline from './OrderTimeline'

const POLL_INTERVAL = 15_000
const TERMINAL = new Set(['entregue', 'cancelado'])

interface Props {
  initialOrder: OrderStatus
  tenantSlug:   string
}

export default function OrderStatusView({ initialOrder, tenantSlug }: Props) {
  const [order,          setOrder]          = useState<OrderStatus>(initialOrder)
  const [cancelling,     setCancelling]     = useState(false)
  const [confirmCancel,  setConfirmCancel]  = useState(false)
  const [cancelError,    setCancelError]    = useState<string | null>(null)

  // ── Polling ────────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    try {
      const updated = await ordersApi.get(tenantSlug, order.ref)
      setOrder(updated)
    } catch {
      // Silencioso — mostra último estado
    }
  }, [tenantSlug, order.ref])

  useEffect(() => {
    if (TERMINAL.has(order.status)) return  // para de pollar
    const timer = setInterval(refresh, POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [order.status, refresh])

  // ── Cancelamento ───────────────────────────────────────────────────────────

  async function handleCancel() {
    setCancelling(true)
    setCancelError(null)
    try {
      await ordersApi.cancel(tenantSlug, order.ref)
      setOrder((prev) => ({ ...prev, status: 'cancelado' }))
      setConfirmCancel(false)
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Erro ao cancelar.')
    } finally {
      setCancelling(false)
    }
  }

  const canCancel = order.status === 'pendente'
  const isCancelled = order.status === 'cancelado'

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">

      {/* ── Confirmação (banner verde logo após criar pedido) ── */}
      {order.status === 'pendente' && (
        <div className="mb-6 flex items-start gap-3 rounded-[var(--radius-lg)] border border-green-200 bg-green-50 px-4 py-4 dark:border-green-900 dark:bg-green-950/30">
          <CheckCircleIcon className="mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
          <div>
            <p className="text-sm font-semibold text-green-800 dark:text-green-300">
              Pedido recebido com sucesso!
            </p>
            <p className="mt-0.5 text-sm text-green-700 dark:text-green-400">
              Guarde o número de referência abaixo para acompanhar seu pedido.
            </p>
          </div>
        </div>
      )}

      {/* ── Cabeçalho ── */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Número do pedido
          </p>
          <h1 className="font-mono text-xl font-bold tracking-wide text-foreground">
            {order.ref}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Criado em {formatDate(order.createdAt)}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="flex flex-col gap-6">

        {/* ── Timeline ── */}
        <section className="rounded-[var(--radius-lg)] border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Acompanhamento</h2>
          <OrderTimeline
            timeline={order.timeline}
            currentStatus={order.status}
            isCancelled={isCancelled}
          />
          {/* Indicador de polling */}
          {!TERMINAL.has(order.status) && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Atualizando automaticamente…
            </p>
          )}
        </section>

        {/* ── Itens do pedido ── */}
        <section className="rounded-[var(--radius-lg)] border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Itens</h2>
          <ul className="flex flex-col divide-y divide-border">
            {order.items.map((item, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">{item.name}</span>
                  {item.variant && (
                    <span className="text-xs text-muted-foreground">{item.variant}</span>
                  )}
                  <span className="text-xs text-muted-foreground">Qtd: {item.quantity}</span>
                </div>
                <span className="shrink-0 font-semibold text-foreground">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm font-semibold text-foreground">Total</span>
            <span className="text-base font-bold text-primary">{formatPrice(order.total)}</span>
          </div>
        </section>

        {/* ── Ações ── */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href="/catalogo"
            className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius)] border border-border bg-card px-4 py-2.5 text-sm font-medium transition hover:bg-muted"
          >
            Continuar comprando
          </a>

          {canCancel && (
            <button
              onClick={() => setConfirmCancel(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius)] border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-100 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
            >
              Cancelar pedido
            </button>
          )}
        </div>
      </div>

      {/* ── Modal de confirmação de cancelamento ── */}
      {confirmCancel && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => !cancelling && setConfirmCancel(false)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] bg-card p-6 shadow-xl">
            <h2 className="text-base font-semibold text-foreground">Cancelar pedido?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Esta ação não pode ser desfeita. O estoque será devolvido automaticamente.
            </p>

            {cancelError && (
              <p className="mt-3 rounded-[var(--radius)] bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
                {cancelError}
              </p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => !cancelling && setConfirmCancel(false)}
                className="flex-1 rounded-[var(--radius)] border border-border py-2.5 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
                disabled={cancelling}
              >
                Voltar
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius)] bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {cancelling ? (
                  <><SpinnerIcon />Cancelando…</>
                ) : (
                  'Confirmar cancelamento'
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

// ─── Ícones ───────────────────────────────────────────────────────────────────

function CheckCircleIcon({ className = '' }: { className?: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
}
function SpinnerIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
}
