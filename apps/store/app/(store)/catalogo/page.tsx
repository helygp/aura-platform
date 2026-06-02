/**
 * app/(store)/catalogo/page.tsx
 * Tarefa 4 — Catálogo de produtos B2B.
 *
 * SSR: busca o primeiro lote de produtos + categorias + atributos disponíveis
 * em paralelo no servidor. Entrega HTML completo sem loading state inicial.
 *
 * Client: filtros, busca, ordenação e paginação cursor via CatalogView.
 */

import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { fetchTenantTheme, DEFAULT_THEME } from '@/lib/tenant'
import { catalogApi, fetchCategories } from '@/lib/api'
import CatalogView from '@/components/catalog/CatalogView'
import type { CatalogFilters } from '@/components/catalog/catalogTypes'

export async function generateMetadata(): Promise<Metadata> {
  const slug  = headers().get('x-tenant-slug') ?? 'demo'
  const theme = (await fetchTenantTheme(slug)) ?? DEFAULT_THEME
  const title       = `Catálogo | ${theme.name}`
  const description = `Explore o catálogo completo de ${theme.name}. Produtos com grade, filtros por categoria e preços para lojistas.`
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: theme.name,
      locale: 'pt_BR',
      ...(theme.logoUrl ? { images: [{ url: theme.logoUrl }] } : {}),
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    alternates: {
      canonical: `https://${headers().get('host') ?? ''}/catalogo`,
    },
  }
}

interface SearchParams {
  categoria?: string
  busca?: string
}

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const slug = headers().get('x-tenant-slug') ?? 'demo'

  const defaultFilters: CatalogFilters = {
    category: searchParams.categoria,
    search:   searchParams.busca,
  }

  const [catalogResult, categories] = await Promise.all([
    catalogApi.list(slug, {
      category: defaultFilters.category,
      search:   defaultFilters.search,
      limit:    24,
    }).catch(() => ({ items: [], nextCursor: null, total: 0 })),
    catalogApi.categories(slug).catch(() => []),
  ])

  const attrMap: Record<string, Set<string>> = {}
  for (const product of catalogResult.items) {
    for (const [key, vals] of Object.entries(product.attributes ?? {})) {
      if (!attrMap[key]) attrMap[key] = new Set()
      for (const v of vals) attrMap[key].add(v)
    }
  }
  const availableAttributes = Object.fromEntries(
    Object.entries(attrMap).map(([k, v]) => [k, Array.from(v).sort()])
  )

  return (
    <CatalogView
      tenantSlug={slug}
      initialProducts={catalogResult.items}
      initialNextCursor={catalogResult.nextCursor}
      initialTotal={catalogResult.total}
      categories={categories}
      availableAttributes={availableAttributes}
      defaultFilters={defaultFilters}
    />
  )
}
