'use client'

/**
 * components/cart/CartView.tsx
 * Página de carrinho completa — orquestra itens + resumo.
 * Recebe minimumOrderAmount do servidor (via page.tsx).
 */

import { useCart } from '@/lib/useCart'
import CartItemRow from './CartItemRow'
import CartSummary from './CartSummary'

interface Props {
  minimumOrderAmount: number   // centavos
}

export default function CartView({ minimumOrderAmount }: Props) {
  const { items, total, count, updateQty, remove, clear, isEmpty } = useCart()

  if (isEmpty) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-4 py-20 text-center sm:px-6">
        <EmptyCartIcon />
        <div>
          <h1 className="text-xl font-bold text-foreground">Seu carrinho está vazio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Explore o catálogo e adicione produtos para fazer seu pedido.
          </p>
        </div>
        <a
          href="/catalogo"
          className="rounded-[var(--radius)] bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Ver catálogo
        </a>
      </div>
    )
  }

  const canCheckout = !isEmpty && (minimumOrderAmount === 0 || total >= minimumOrderAmount)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">

      {/* Cabeçalho */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          Carrinho
          <span className="ml-2 text-base font-normal text-muted-foreground">
            ({count} {count === 1 ? 'item' : 'itens'})
          </span>
        </h1>

        <button
          onClick={clear}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Limpar carrinho
        </button>
      </div>

      {/* Layout: lista + sidebar resumo */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">

        {/* Lista de itens */}
        <div className="flex-1 divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-card px-4">
          {items.map((item) => (
            <CartItemRow
              key={item.skuId}
              item={item}
              onUpdateQty={updateQty}
              onRemove={remove}
            />
          ))}
        </div>

        {/* Resumo — sticky no desktop */}
        <div className="lg:sticky lg:top-20 lg:w-80 lg:shrink-0">
          <CartSummary
            total={total}
            itemCount={count}
            minimumOrderAmount={minimumOrderAmount}
            canCheckout={canCheckout}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Ícone carrinho vazio ─────────────────────────────────────────────────────

function EmptyCartIcon() {
  return (
    <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.75" className="text-border">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <line x1="3" x2="21" y1="6" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  )
}
