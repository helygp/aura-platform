'use client'

/**
 * components/cart/CartSummary.tsx
 * Painel de resumo com CTA auth-aware.
 * - Logado + OK → navega para /pedido/novo
 * - Não logado + OK → redireciona para /conta/login?redirect=/pedido/novo
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatPrice } from '@/lib/cart'
import { useAuth } from '@/lib/useAuth'

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
  const { buyer, loading } = useAuth()
  const router = useRouter()

  const remaining  = minimumOrderAmount - total
  const hasMinimum = minimumOrderAmount > 0
  const belowMin   = hasMinimum && total < minimumOrderAmount
  const progress   = hasMinimum
    ? Math.min(100, Math.round((total / minimumOrderAmount) * 100))
    : 100

  function handleCheckout() {
    if (loading) return
    if (!buyer) {
      router.push('/conta/login?redirect=/pedido/novo')
    } else {
      router.push('/pedido/novo')
    }
  }

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
          {belowMin ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Faltam <strong>{formatPrice(remaining)}</strong> para o pedido mínimo.
            </p>
          ) : (
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
              ✓ Pedido mínimo atingido
            </p>
          )}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                backgroundColor: belowMin
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
        <button
          onClick={handleCheckout}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary py-3 text-sm font-semibold text-primary-foreground shadow transition hover:opacity-90 active:scale-95 disabled:opacity-60"
        >
          {!buyer && !loading ? (
            <>
              <LockIcon />
              Entrar para finalizar
            </>
          ) : (
            <>
              Finalizar pedido
              <ArrowRightIcon />
            </>
          )}
        </button>
      ) : (
        <button
          disabled
          className="w-full cursor-not-allowed rounded-[var(--radius)] bg-muted py-3 text-sm font-semibold text-muted-foreground"
        >
          {belowMin ? 'Pedido mínimo não atingido' : 'Carrinho vazio'}
        </button>
      )}

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

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}
