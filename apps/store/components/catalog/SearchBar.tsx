/**
 * components/catalog/SearchBar.tsx
 * Barra de busca por nome/código.
 * Client Component — debounce 400ms para não disparar a cada tecla.
 */
'use client'

import { useRef, useEffect, useState } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}

export default function SearchBar({ value, onChange, placeholder = 'Buscar produtos...' }: Props) {
  const [local, setLocal] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync externo → local (ex: reset de filtros)
  useEffect(() => { setLocal(value) }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setLocal(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange(v), 400)
  }

  function handleClear() {
    setLocal('')
    onChange('')
  }

  return (
    <div className="relative w-full">
      {/* Ícone lupa */}
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        <SearchIcon />
      </span>

      <input
        type="search"
        value={local}
        onChange={handleChange}
        placeholder={placeholder}
        className="h-10 w-full rounded-[var(--radius)] border border-border bg-card pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      />

      {/* Botão limpar */}
      {local && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
          aria-label="Limpar busca"
        >
          <CloseIcon />
        </button>
      )}
    </div>
  )
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  )
}
function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}
