/**
 * components/catalog/CatalogView.tsx
 * Orquestra filtros + busca + grid + paginação.
 * Client Component — todo estado de filtro aqui, fetch via SWR manual.
 *
 * Recebe as categorias e atributos disponíveis como props (buscados no servidor
 * pela page.tsx para evitar waterfall e ter SSR no primeiro render).
 */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { CatalogProduct } from '@/lib/api'
import type { CatalogFilters, SortOption } from './catalogTypes'

import SearchBar from './SearchBar'
import FilterSidebar from './FilterSidebar'
import ActiveFilters from './ActiveFilters'
import SortSelect from './SortSelect'
import ProductGrid from './ProductGrid'

interface Props {
  tenantSlug: string
  initialProducts: CatalogProduct[]
  initialNextCursor: string | null
  initialTotal: number
  categories: string[]
  // Atributos disponíveis no catálogo inteiro (para popular o sidebar)
  availableAttributes: Record<string, string[]>
  // Filtros da URL (categoria pré-selecionada vinda da home)
  defaultFilters?: CatalogFilters
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

export default function CatalogView({
  tenantSlug,
  initialProducts,
  initialNextCursor,
  initialTotal,
  categories,
  availableAttributes,
  defaultFilters = {},
}: Props) {
  const [filters, setFilters] = useState<CatalogFilters>(defaultFilters)
  const [sort, setSort] = useState<SortOption>('relevance')
  const [products, setProducts] = useState<CatalogProduct[]>(initialProducts)
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor)
  const [total, setTotal] = useState(initialTotal)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Evita fetch duplo na montagem (SSR já trouxe dados iniciais)
  const isFirstRender = useRef(true)

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchProducts = useCallback(
    async (f: CatalogFilters, s: SortOption, append = false) => {
      append ? setLoadingMore(true) : setLoading(true)

      try {
        const qs = new URLSearchParams()
        if (f.search)   qs.set('search', f.search)
        if (f.category) qs.set('category', f.category)
        if (f.cursor)   qs.set('cursor', f.cursor)
        if (s !== 'relevance') qs.set('sort', s)
        qs.set('limit', '24')

        // Filtros de atributo: passa como JSON no query param
        const attrEntries = Object.entries(f.attributes ?? {}).filter(([, v]) => v?.length)
        if (attrEntries.length) {
          qs.set('attributes', JSON.stringify(Object.fromEntries(attrEntries)))
        }

        const res = await fetch(`${API_URL}/store/catalog?${qs}`, {
          headers: { 'X-Tenant-Slug': tenantSlug },
        })
        if (!res.ok) throw new Error('Erro na busca')

        const data: { items: CatalogProduct[]; nextCursor: string | null; total: number } =
          await res.json()

        setProducts((prev) => (append ? [...prev, ...data.items] : data.items))
        setNextCursor(data.nextCursor)
        setTotal(data.total)
      } catch {
        // Silencioso — produtos anteriores permanecem visíveis
      } finally {
        append ? setLoadingMore(false) : setLoading(false)
      }
    },
    [tenantSlug],
  )

  // Dispara fetch ao mudar filtros/sort (não na montagem — já tem dados do SSR)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    fetchProducts({ ...filters, cursor: undefined }, sort)
  }, [filters, sort]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFiltersChange(f: CatalogFilters) {
    setFilters(f)
  }

  function handleLoadMore() {
    if (!nextCursor || loadingMore) return
    fetchProducts({ ...filters, cursor: nextCursor }, sort, true)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const hasActiveFilters = Boolean(
    filters.category || Object.values(filters.attributes ?? {}).some((v) => v?.length),
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {/* Busca */}
          <div className="flex-1">
            <SearchBar
              value={filters.search ?? ''}
              onChange={(v) => handleFiltersChange({ ...filters, search: v, cursor: undefined })}
            />
          </div>

          {/* Botão filtros (mobile) */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="relative flex h-10 items-center gap-1.5 rounded-[var(--radius)] border border-border bg-card px-3 text-sm font-medium transition hover:bg-muted md:hidden"
          >
            <FilterIcon />
            Filtros
            {hasActiveFilters && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {countActiveFilters(filters)}
              </span>
            )}
          </button>

          {/* Ordenação */}
          <SortSelect value={sort} onChange={(v) => { setSort(v); }} />
        </div>

        {/* Chips de filtros ativos */}
        <ActiveFilters filters={filters} onChange={handleFiltersChange} />

        {/* Contagem */}
        {!loading && (
          <p className="text-xs text-muted-foreground">
            {total === 0 ? 'Nenhum produto' : `${products.length} de ${total} produto${total !== 1 ? 's' : ''}`}
          </p>
        )}
      </div>

      {/* ── Layout principal ─────────────────────────────────────────── */}
      <div className="flex gap-8">

        {/* Sidebar desktop */}
        <div className="hidden md:block">
          <FilterSidebar
            categories={categories}
            attributes={availableAttributes}
            selected={filters}
            onChange={handleFiltersChange}
          />
        </div>

        {/* Grid */}
        <div className="min-w-0 flex-1">
          <ProductGrid products={products} loading={loading} />

          {/* Paginação — botão "carregar mais" */}
          {nextCursor && !loading && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 rounded-[var(--radius)] border border-border bg-card px-6 py-2.5 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <SpinnerIcon />
                    Carregando...
                  </>
                ) : (
                  'Carregar mais'
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Drawer de filtros (mobile) ───────────────────────────────── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Painel */}
          <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-card p-5 shadow-xl">
            <FilterSidebar
              categories={categories}
              attributes={availableAttributes}
              selected={filters}
              onChange={(f) => { handleFiltersChange(f); }}
              onClose={() => setDrawerOpen(false)}
            />
            <button
              onClick={() => setDrawerOpen(false)}
              className="mt-6 w-full rounded-[var(--radius)] bg-primary py-3 text-sm font-semibold text-primary-foreground"
            >
              Ver produtos
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countActiveFilters(f: CatalogFilters): number {
  let n = f.category ? 1 : 0
  for (const vals of Object.values(f.attributes ?? {})) {
    n += vals?.length ?? 0
  }
  return n
}

function FilterIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}
