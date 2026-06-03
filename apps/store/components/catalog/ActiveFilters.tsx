/**
 * components/catalog/ActiveFilters.tsx
 * Chips dos filtros ativos — fácil remoção individual.
 */
'use client'

import type { CatalogFilters } from './catalogTypes'

interface Props {
  filters: CatalogFilters
  onChange: (f: CatalogFilters) => void
}

export default function ActiveFilters({ filters, onChange }: Props) {
  const chips: { label: string; onRemove: () => void }[] = []

  if (filters.category) {
    chips.push({
      label: filters.category,
      onRemove: () => onChange({ ...filters, category: undefined, cursor: undefined }),
    })
  }

  for (const [key, vals] of Object.entries(filters.attributes ?? {})) {
    for (const val of vals ?? []) {
      chips.push({
        label: `${key}: ${val}`,
        onRemove: () => {
          const next = (filters.attributes?.[key] ?? []).filter((v) => v !== val)
          onChange({
            ...filters,
            attributes: { ...filters.attributes, [key]: next.length ? next : undefined },
            cursor: undefined,
          })
        },
      })
    }
  }

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Filtros ativos:</span>
      {chips.map((chip) => (
        <button
          key={chip.label}
          onClick={chip.onRemove}
          className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary transition hover:bg-primary/20"
        >
          {chip.label}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      ))}
    </div>
  )
}
