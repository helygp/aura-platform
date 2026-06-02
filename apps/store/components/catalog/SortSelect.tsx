/**
 * components/catalog/SortSelect.tsx
 * Seletor de ordenação.
 */
'use client'

import type { SortOption } from './catalogTypes'

interface Props {
  value: SortOption
  onChange: (v: SortOption) => void
}

const OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'relevance',  label: 'Relevância' },
  { value: 'price_asc',  label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
  { value: 'name_asc',   label: 'A–Z' },
]

export default function SortSelect({ value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SortOption)}
      className="h-9 rounded-[var(--radius)] border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
