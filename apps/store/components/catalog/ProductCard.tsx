/**
 * components/catalog/ProductCard.tsx
 * Card de produto — usado na Home (destaques) e no Catálogo.
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
      className="group flex flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      {/* Imagem */}
      <div className="relative aspect-square overflow-hidden bg-muted">
        {product.coverImageUrl ? (
          <img
            src={product.coverImageUrl}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <PlaceholderIcon />
          </div>
        )}
        {/* Badge disponibilidade */}
        {!product.inStock && (
          <span className="absolute left-2 top-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            Indisponível
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        {product.category && (
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {product.category}
          </span>
        )}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {product.name}
        </h3>
        <p className="mt-auto pt-2 text-sm font-bold text-primary">{priceLabel}</p>
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
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      className="text-border"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  )
}
