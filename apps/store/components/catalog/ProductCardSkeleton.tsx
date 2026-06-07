'use client'

/**
 * components/catalog/ProductCardSkeleton.tsx
 * Skeleton de loading no mesmo ratio do ProductCard (3:4).
 */

export default function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
      {/* Imagem 3:4 */}
      <div className="skeleton" style={{ aspectRatio: '3/4' }} />
      {/* Info */}
      <div className="flex flex-col gap-2 p-3">
        <div className="skeleton h-2.5 w-1/3 rounded-full" />
        <div className="skeleton h-3.5 w-4/5 rounded" />
        <div className="skeleton h-3 w-3/5 rounded" />
        <div className="mt-1 skeleton h-5 w-2/4 rounded" />
      </div>
    </div>
  )
}
