/**
 * app/(store)/page.tsx
 * Tarefa 3 — Home da loja B2B.
 *
 * Estrutura:
 *   HeroSection         — banner + título + CTA (configurável pelo dono)
 *   CategoriesSection   — links rápidos por categoria
 *   FeaturedProducts    — grade de destaques (configuráveis no ERP)
 *
 * Todo conteúdo da identidade visual vem do tenant — nenhuma referência à Aura.
 * Dados de produto buscados em paralelo com o tema (Promise.all).
 */

import type { Metadata } from 'next'
import { Suspense } from 'react'
import { headers } from 'next/headers'
import { fetchTenantTheme, DEFAULT_THEME } from '@/lib/tenant'
import { catalogApi } from '@/lib/api'

import HeroSection from '@/components/home/HeroSection'
import CategoriesSection from '@/components/home/CategoriesSection'
import FeaturedProducts from '@/components/home/FeaturedProducts'
import ProductCardSkeleton from '@/components/catalog/ProductCardSkeleton'

// ─── Componente assíncrono para destaques (Suspense boundary separado) ─────────

async function FeaturedProductsLoader({ tenantSlug }: { tenantSlug: string }) {
  const products = await catalogApi.featured(tenantSlug).catch(() => [])
  return <FeaturedProducts products={products} />
}

async function CategoriesLoader({ tenantSlug }: { tenantSlug: string }) {
  const categories = await catalogApi.categories(tenantSlug).catch(() => [])
  return <CategoriesSection categories={categories} />
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const slug  = headers().get('x-tenant-slug') ?? 'demo'
  const host  = headers().get('host') ?? ''
  const theme = (await fetchTenantTheme(slug)) ?? DEFAULT_THEME
  const title       = theme.heroTitle ?? theme.name
  const description = theme.heroSubtitle ?? `Loja B2B de ${theme.name}. Compre no atacado com facilidade.`
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type:     'website',
      siteName: theme.name,
      locale:   'pt_BR',
      url:      `https://${host}/`,
      ...(theme.heroBannerUrl || theme.logoUrl
        ? { images: [{ url: theme.heroBannerUrl ?? theme.logoUrl ?? '' }] }
        : {}),
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description,
      ...(theme.heroBannerUrl ? { images: [theme.heroBannerUrl] } : {}),
    },
    alternates: {
      canonical: `https://${host}/`,
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const slug = headers().get('x-tenant-slug') ?? 'demo'
  const theme = (await fetchTenantTheme(slug)) ?? DEFAULT_THEME

  return (
    <>
      {/* Hero — tema carregado junto, sem loading */}
      <HeroSection theme={theme} />

      {/* Categorias — Suspense com fallback invisível (lista de pills) */}
      <Suspense fallback={<CategoriesFallback />}>
        <CategoriesLoader tenantSlug={slug} />
      </Suspense>

      {/* Destaques — Suspense com skeleton grid */}
      <Suspense fallback={<FeaturedSkeleton />}>
        <FeaturedProductsLoader tenantSlug={slug} />
      </Suspense>
    </>
  )
}

// ─── Fallbacks ────────────────────────────────────────────────────────────────

function CategoriesFallback() {
  return (
    <div className="bg-muted/40 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-5 h-7 w-32 animate-pulse rounded bg-muted" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 w-24 animate-pulse rounded-full bg-muted" />
          ))}
        </div>
      </div>
    </div>
  )
}

function FeaturedSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-6 h-7 w-32 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
