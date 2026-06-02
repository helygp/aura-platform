/**
 * components/catalog/ProductCardSkeleton.tsx
 * Skeleton do ProductCard — exibido durante loading.
 */
export default function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card">
      <div className="aspect-square animate-pulse bg-muted" />
      <div className="flex flex-col gap-2 p-3">
        <div className="h-2.5 w-16 animate-pulse rounded bg-muted" />
        <div className="h-3.5 w-full animate-pulse rounded bg-muted" />
        <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-20 animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}
