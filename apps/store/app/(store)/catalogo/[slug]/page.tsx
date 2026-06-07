/**
 * app/(store)/catalogo/[slug]/page.tsx
 * v2 — passa tenant theme para ProductDetailView (GradeMatrix + tiers).
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { catalogApi } from '@/lib/api'
import { fetchTenantTheme, DEFAULT_THEME } from '@/lib/tenant'
import ProductDetailView from '@/components/product/ProductDetail'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tenantSlug = headers().get('x-tenant-slug') ?? 'demo'
  const product = await catalogApi.get(tenantSlug, params.slug).catch(() => null)
  if (!product) return { title: 'Produto não encontrado' }

  const title       = product.seoTitle ?? product.name
  const description = product.seoDescription ?? product.description ?? undefined
  const image       = product.coverImageUrl ?? undefined

  return {
    title,
    description,
    openGraph: { title, description, images: image ? [{ url: image, alt: product.name }] : [], type: 'website' },
    twitter:   { card: 'summary_large_image', title, description, images: image ? [image] : [] },
  }
}

export default async function ProdutoPage({ params }: Props) {
  const tenantSlug = headers().get('x-tenant-slug') ?? 'demo'

  const [product, theme] = await Promise.all([
    catalogApi.get(tenantSlug, params.slug).catch(() => null),
    fetchTenantTheme(tenantSlug).catch(() => DEFAULT_THEME),
  ])

  if (!product) notFound()

  const host = headers().get('host') ?? ''
  const prices = product.skus.map(s => s.price / 100)
  const minP   = prices.length ? Math.min(...prices) : 0
  const maxP   = prices.length ? Math.max(...prices) : 0
  const jsonLd = {
    '@context':  'https://schema.org',
    '@type':     'Product',
    name:        product.name,
    description: product.description ?? undefined,
    image:       product.images.length > 0 ? product.images : product.coverImageUrl ? [product.coverImageUrl] : undefined,
    sku:         product.skus[0]?.code,
    url:         `https://${host}/catalogo/${product.slug}`,
    category:    product.category ?? undefined,
    offers: {
      '@type':       'AggregateOffer',
      priceCurrency: 'BRL',
      lowPrice:      minP.toFixed(2),
      highPrice:     maxP.toFixed(2),
      offerCount:    product.skus.length,
      availability:  product.skus.some(s => s.stock > 0)
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProductDetailView product={product} theme={theme ?? DEFAULT_THEME} />
    </>
  )
}
