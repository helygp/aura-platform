/**
 * app/(store)/catalogo/[slug]/page.tsx
 * Tarefa 5 — Detalhe do produto B2B.
 *
 * SSR: produto buscado no servidor → HTML completo + metadata + Schema.org.
 * Client: galeria, seletor de atributos, quantidade, carrinho (ProductDetail).
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { catalogApi } from '@/lib/api'
import ProductDetailView from '@/components/product/ProductDetail'

interface Props {
  params: { slug: string }
}

// ─── Metadata (SEO + OG) ──────────────────────────────────────────────────────

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
    openGraph: {
      title,
      description,
      images: image ? [{ url: image, alt: product.name }] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : [],
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProdutoPage({ params }: Props) {
  const tenantSlug = headers().get('x-tenant-slug') ?? 'demo'

  const product = await catalogApi.get(tenantSlug, params.slug).catch(() => null)
  if (!product) notFound()

  // ── Schema.org Product (JSON-LD) ─────────────────────────────────────────
  const host    = headers().get('host') ?? ''
  const canonicalUrl = `https://${host}/produto/${product.slug}`
  const prices  = product.skus.map(s => s.price / 100)
  const minP    = prices.length ? Math.min(...prices) : 0
  const maxP    = prices.length ? Math.max(...prices) : 0
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name:        product.name,
    description: product.description ?? undefined,
    image:       product.images.length > 0
      ? product.images
      : product.coverImageUrl
        ? [product.coverImageUrl]
        : undefined,
    sku:         product.skus[0]?.code,
    url:         canonicalUrl,
    category:    product.category ?? undefined,
    offers: {
      '@type':        'AggregateOffer',
      priceCurrency:  'BRL',
      lowPrice:       minP.toFixed(2),
      highPrice:      maxP.toFixed(2),
      offerCount:     product.skus.length,
      availability:   product.skus.some(s => s.stock > 0)
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  }

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Conteúdo — client component assume interatividade */}
      <ProductDetailView product={product} />
    </>
  )
}
