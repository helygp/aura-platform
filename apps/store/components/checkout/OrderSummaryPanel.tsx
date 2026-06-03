'use client'

/**
 * components/checkout/OrderSummaryPanel.tsx
 * Resumo de itens do carrinho no checkout — readonly, sem edição.
 */

import { formatPrice, type CartItem } from '@/lib/cart'

interface Props {
  items: CartItem[]
  total: number
}

export default function OrderSummaryPanel({ items, total }: Props) {
  return (
    <aside className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">Resumo do pedido</h2>

      {/* Lista de itens */}
      <ul className="flex flex-col divide-y divide-border">
        {items.map((item) => {
          const variantLabel = Object.entries(item.attributes)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' · ')

          return (
            <li key={item.skuId} className="flex items-start gap-3 py-3">
              {/* Foto miniatura */}
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[var(--radius)] bg-muted">
                {item.coverImageUrl ? (
                  <img src={item.coverImageUrl} alt={item.productName} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <PlaceholderIcon />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="line-clamp-1 text-sm font-medium text-foreground">{item.productName}</p>
                {variantLabel && <p className="text-xs text-muted-foreground">{variantLabel}</p>}
                <p className="text-xs text-muted-foreground">Qtd: {item.quantity}</p>
              </div>

              {/* Subtotal */}
              <p className="shrink-0 text-sm font-semibold text-foreground">
                {formatPrice(item.price * item.quantity)}
              </p>
            </li>
          )
        })}
      </ul>

      {/* Total */}
      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm font-semibold text-foreground">Total</span>
        <span className="text-lg font-bold text-primary">{formatPrice(total)}</span>
      </div>
    </aside>
  )
}

function PlaceholderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-border">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  )
}
