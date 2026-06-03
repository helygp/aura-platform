'use client'

/**
 * components/cart/CartSummary.tsx
 * Painel lateral de resumo: total, pedido mínimo, botão finalizar.
 */

import Link from 'next/link'
import { formatPrice } from '@/lib/cart'

interface Props {
  total:              number   // centavos
  itemCount:          number
  minimumOrderAmount: number   // centavos — 0 = sem mínimo
  canCheckout:        boolean
}

export default function CartSummary({
  total,
  itemCount,
  minimumOrderAmount,
  canCheckout,
}: Props) {
  const remaining = minimumOrderAmount - total
  const hasMinimum = minimumOrderAmount > 0
  const belowMinimum = hasMinimum && total < minimumOrderAmount
  const progress = hasMinimum
    ? Math.min(100, Math.round((total / minimumOrderAmount) * 100))
    : 100

  return (
    <aside className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-border bg-card p-5">
      <h2 className="text-base font-semibold text-foreground">Resumo do pedido</h2>

      {/* Linhas */}
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>{itemCount} {itemCount === 1 ? 'item' : 'itens'}</span>
          <span>{formatPrice(total)}</span>
        </div>
        <div className="my-1 border-t border-border" />
        <div className="flex justify-between font-semibold text-foreground">
          <span>Total</span>
          <span className="text-lg">{formatPrice(total)}</span>
        </div>
      </div>

      {/* Pedido mínimo */}
      {hasMinimum && (
        <div className="flex flex-col gap-1.5">
          {belowMinimum ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Faltam <strong>{formatPrice(remaining)}</strong> para atingir o pedido mínimo.
            </p>
          ) : (
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
              ✓ Pedido mínimo atingido
            </p>
          )}
          {/* Barra de progresso */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                backgroundColor: belowMinimum
                  ? 'var(--color-accent)'
                  : 'var(--color-primary)',
              }}
            />
          </div>
          <p className="text-right text-[10px] text-muted-foreground">
            Mínimo: {formatPrice(minimumOrderAmount)}
          </p>
        </div>
      )}

      {/* CTA */}
      {canCheckout ? (
        <Link
          href="/pedido/novo"
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary py-3 text-sm font-semibold text-primary-foreground shadow transition hover:opacity-90 active:scale-95"
        >
          Finalizar pedido
          <ArrowRightIcon />
        </Link>
      ) : (
        <button
          disabled
          className="w-full cursor-not-allowed rounded-[var(--radius)] bg-muted py-3 text-sm font-semibold text-muted-foreground"
        >
          {belowMinimum ? 'Pedido mínimo não atingido' : 'Carrinho vazio'}
        </button>
      )}

      {/* Link continuar comprando */}
      <Link
        href="/catalogo"
        className="text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        Continuar comprando
      </Link>
    </aside>
  )
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}
