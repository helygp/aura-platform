/**
 * components/catalog/FilterSidebar.tsx
 * Painel de filtros — categoria + atributos dinâmicos (tamanho, cor, etc.).
 * Client Component: estado local dos filtros aplicados.
 *
 * Uso:
 *   <FilterSidebar
 *     categories={['Camisetas', 'Calças']}
 *     attributes={{ tamanho: ['P','M','G'], cor: ['Preto','Branco'] }}
 *     selected={filters}
 *     onChange={setFilters}
 *   />
 */
'use client'

import { type CatalogFilters } from './catalogTypes'

interface Props {
  categories: string[]
  attributes: Record<string, string[]>
  selected: CatalogFilters
  onChange: (f: CatalogFilters) => void
  /** Modo drawer (mobile) — exibe botão fechar */
  onClose?: () => void
}

export default function FilterSidebar({
  categories,
  attributes,
  selected,
  onChange,
  onClose,
}: Props) {
  function toggleCategory(cat: string) {
    onChange({ ...selected, category: selected.category === cat ? undefined : cat, cursor: undefined })
  }

  function toggleAttribute(key: string, val: string) {
    const current = selected.attributes?.[key] ?? []
    const next = current.includes(val)
      ? current.filter((v) => v !== val)
      : [...current, val]
    onChange({
      ...selected,
      attributes: { ...selected.attributes, [key]: next.length ? next : undefined },
      cursor: undefined,
    })
  }

  function clearAll() {
    onChange({ search: selected.search })
  }

  const hasFilters = Boolean(selected.category || Object.values(selected.attributes ?? {}).some((v) => v?.length))

  return (
    <aside className="flex w-full flex-col gap-6 md:w-56 md:shrink-0">
      {/* Cabeçalho do painel */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Filtros</span>
        <div className="flex items-center gap-2">
          {hasFilters && (
            <button
              onClick={clearAll}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Limpar
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted md:hidden"
              aria-label="Fechar filtros"
            >
              <CloseIcon />
            </button>
          )}
        </div>
      </div>

      {/* Categorias */}
      {categories.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Categoria
          </p>
          <ul className="flex flex-col gap-0.5">
            {categories.map((cat) => (
              <li key={cat}>
                <button
                  onClick={() => toggleCategory(cat)}
                  className={[
                    'w-full rounded-md px-2.5 py-1.5 text-left text-sm transition',
                    selected.category === cat
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-foreground hover:bg-muted',
                  ].join(' ')}
                >
                  {cat}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Atributos dinâmicos */}
      {Object.entries(attributes).map(([key, values]) => (
        <div key={key}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {key}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {values.map((val) => {
              const active = selected.attributes?.[key]?.includes(val)
              return (
                <button
                  key={val}
                  onClick={() => toggleAttribute(key, val)}
                  className={[
                    'rounded-md border px-2.5 py-1 text-xs font-medium transition',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-foreground hover:border-primary hover:text-primary',
                  ].join(' ')}
                >
                  {val}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </aside>
  )
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}
