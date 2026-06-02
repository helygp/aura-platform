/**
 * components/home/FeaturedProducts.tsx
 * Grade de produtos em destaque — configuráveis pelo dono no ERP.
 * Busca os produtos marcados como destaque via API.
 * RSC com Suspense boundary na page.tsx.
 */
import Link from 'next/link'
import ProductCard from '@/components/catalog/ProductCard'
import type { CatalogProduct } from '@/lib/api'

interface Props {
  products: CatalogProduct[]
}

export default function FeaturedProducts({ products }: Props) {
  if (products.length === 0) return null

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      {/* Cabeçalho da seção */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">Destaques</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Produtos selecionados para você
          </p>
        </div>
        <Link
          href="/catalogo"
          className="flex items-center gap-1 text-sm font-medium text-primary transition hover:opacity-70"
        >
          Ver todos
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {products.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
    </section>
  )
}
