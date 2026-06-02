/**
 * components/catalog/ProductGrid.tsx
 * Grid responsivo de produtos com estado de vazio.
 * RSC-safe.
 */
import ProductCard from './ProductCard'
import ProductCardSkeleton from './ProductCardSkeleton'
import type { CatalogProduct } from '@/lib/api'

interface Props {
  products: CatalogProduct[]
  loading?: boolean
  skeletonCount?: number
}

export default function ProductGrid({ products, loading, skeletonCount = 24 }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <EmptyIcon />
        <p className="text-base font-medium text-foreground">Nenhum produto encontrado</p>
        <p className="text-sm text-muted-foreground">Tente ajustar os filtros ou a busca.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.slug} product={p} />
      ))}
    </div>
  )
}

function EmptyIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-border">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      <path d="M8 11h6M11 8v6" opacity=".4" />
    </svg>
  )
}
