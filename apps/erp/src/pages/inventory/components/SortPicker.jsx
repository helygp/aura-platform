/**
 * pages/inventory/components/SortPicker.jsx
 *
 * Dropdown "Ordenar por" com presets para a tela de estoque.
 */

import React, { useState, useRef, useEffect } from 'react'
import { ArrowUpDown, Check, ChevronDown } from 'lucide-react'
import { SORT_PRESETS } from '../sortPresets.js'

export function SortPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const current = SORT_PRESETS.find(p => p.key === value) ?? SORT_PRESETS[0]

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="
          flex items-center gap-2 h-9 px-3 rounded-lg
          text-xs font-medium
          text-[var(--color-text)]
          bg-[var(--color-bg)]
          border border-[var(--color-border)]
          hover:border-[var(--color-border-strong)]
          transition-colors
        "
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <ArrowUpDown size={13} className="text-[var(--color-text-muted)]" />
        <span className="text-[var(--color-text-muted)]">Ordenar:</span>
        <span className="truncate max-w-[200px]">{current.label}</span>
        <ChevronDown size={12} className={`text-[var(--color-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="
            absolute right-0 top-full mt-1 z-30
            w-64 rounded-xl
            bg-[var(--color-bg)]
            border border-[var(--color-border)]
            shadow-[var(--shadow-md)]
            overflow-hidden py-1
          "
          role="listbox"
        >
          {SORT_PRESETS.map(p => {
            const active = p.key === value
            return (
              <button
                key={p.key}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => { onChange(p.key); setOpen(false) }}
                className={`
                  w-full flex items-center justify-between gap-2 px-3 py-2 text-xs
                  text-left transition-colors
                  hover:bg-[var(--color-surface)]
                  ${active ? 'text-[var(--color-primary)] font-medium' : 'text-[var(--color-text)]'}
                `}
              >
                <span>{p.label}</span>
                {active && <Check size={13} className="shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
