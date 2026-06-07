/**
 * components/catalog/ProductCard.tsx
 * Card de produto B2B — ratio 3:4 (moda), badge atacado, MOQ, CTA hover.
 * RSC-safe: sem hooks, sem 'use client'.
 */
import Link from 'next/link'
import type { CatalogProduct } from '@/lib/api'

interface Props {
  product: CatalogProduct
}

export default function ProductCard({ product }: Props) {
  const priceLabel =
    product.minPrice === product.maxPrice
      ? formatPrice(product.minPrice)
      : `A partir de ${formatPrice(product.minPrice)}`

  return (
    <Link
      href={`/catalogo/${product.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card transition-all duration-200 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5"
    >
      {/* ── Imagem ── */}
      <div className="relative overflow-hidden bg-muted" style={{ aspectRatio: '3/4' }}>
        {product.coverImageUrl ? (
          <img
            src={product.coverImageUrl}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted">
            <PlaceholderIcon />
            <span className="text-xs text-muted-foreground">Sem foto</span>
          </div>
        )}

        {/* Overlay no hover — ver produto */}
        <div className="absolute inset-0 flex items-end justify-center p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="w-full rounded-[var(--radius)] bg-foreground/90 py-2 text-center text-xs font-semibold text-background backdrop-blur-sm">
            Ver produto →
          </span>
        </div>

        {/* Badges */}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {!product.inStock && (
            <span className="rounded-full bg-muted/90 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground backdrop-blur-sm">
              Indisponível
            </span>
          )}
        </div>

        {/* Badge atacado */}
        <div className="absolute right-2 top-2">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ background: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
            ATACADO
          </span>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {product.category && (
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {product.category}
          </span>
        )}

        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {product.name}
        </h3>

        {/* Preço + info grade */}
        <div className="mt-auto flex items-end justify-between gap-1 pt-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">por peça</span>
            <span className="text-base font-extrabold leading-none tracking-tight text-primary">
              {priceLabel}
            </span>
          </div>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            Grade
          </span>
        </div>
      </div>
    </Link>
  )
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100)
}

function PlaceholderIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/30">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  )
}
