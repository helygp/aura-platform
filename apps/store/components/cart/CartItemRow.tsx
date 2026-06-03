'use client'

/**
 * components/cart/CartItemRow.tsx
 * Linha de item do carrinho — foto, nome, variante, preço, quantidade, remover.
 */

import Link from 'next/link'
import QuantityInput from '@/components/product/QuantityInput'
import { formatPrice, type CartItem } from '@/lib/cart'

interface Props {
  item: CartItem
  onUpdateQty: (skuId: string, qty: number) => void
  onRemove:    (skuId: string) => void
}

export default function CartItemRow({ item, onUpdateQty, onRemove }: Props) {
  const variantLabel = Object.entries(item.attributes)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ')

  const subtotal = formatPrice(item.price * item.quantity)

  return (
    <div className="flex gap-3 py-4 sm:gap-4">

      {/* Foto */}
      <Link href={`/catalogo/${item.productSlug}`} className="shrink-0">
        <div className="h-20 w-20 overflow-hidden rounded-[var(--radius)] bg-muted sm:h-24 sm:w-24">
          {item.coverImageUrl ? (
            <img
              src={item.coverImageUrl}
              alt={item.productName}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <PlaceholderIcon />
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">

        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/catalogo/${item.productSlug}`}
            className="line-clamp-2 text-sm font-semibold leading-snug text-foreground hover:underline"
          >
            {item.productName}
          </Link>

          {/* Remover */}
          <button
            onClick={() => onRemove(item.skuId)}
            className="shrink-0 rounded p-1 text-muted-foreground transition hover:text-foreground"
            aria-label="Remover item"
          >
            <TrashIcon />
          </button>
        </div>

        {/* Variante */}
        {variantLabel && (
          <p className="text-xs text-muted-foreground">{variantLabel}</p>
        )}

        {/* Código SKU */}
        <p className="text-xs text-muted-foreground">Ref: {item.skuCode}</p>

        {/* Preço unitário */}
        <p className="text-xs text-muted-foreground">
          {formatPrice(item.price)} / un.
        </p>

        {/* Quantidade + subtotal */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <QuantityInput
            value={item.quantity}
            max={999}
            onChange={(qty) => onUpdateQty(item.skuId, qty)}
          />
          <p className="text-sm font-bold text-foreground">{subtotal}</p>
        </div>
      </div>
    </div>
  )
}

function PlaceholderIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-border">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  )
}
