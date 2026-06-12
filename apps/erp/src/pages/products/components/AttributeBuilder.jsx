/**
 * pages/products/components/AttributeBuilder.jsx
 *
 * Componente para configurar atributos da grade de produto variante.
 * Busca o domínio de atributos da API; fallback para lista hardcoded.
 *
 * Props:
 *   attributes : [{ name, values: string[] }]
 *   onChange   : (newAttributes) => void
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Plus, X, ChevronDown } from 'lucide-react'
import { DEFAULT_ATTRIBUTES, DEFAULT_ATTRIBUTE_VALUES } from '../productsTypes.js'

const MAX_ATTRIBUTES = 3

/* ── Cache de domínio (evita refetch a cada abertura do form) ── */
let _defsCache = null

export async function loadAttrDefs() {
  if (_defsCache) return _defsCache
  try {
    const token = window.__aura_mem_token__ || ''
    const res = await fetch('/api/product-attributes', {
      credentials: 'include',
      headers: token ? { Authorization: 'Bearer ' + token } : {},
    })
    if (!res.ok) throw new Error()
    const data = await res.json()
    _defsCache = data.attributes ?? []
    return _defsCache
  } catch {
    return []
  }
}

/* Invalida cache ao salvar no AttributeDefManager */
export function invalidateDefsCache() { _defsCache = null }

function ValueChip({ value, onRemove }) {
  return (
    <span className="
      inline-flex items-center gap-1 px-2 py-0.5
      rounded-full text-xs font-medium
      bg-[var(--color-surface)] border border-[var(--color-border)]
      text-[var(--color-text)]
    ">
      {value}
      <button
        type="button"
        onClick={() => onRemove(value)}
        className="text-[var(--color-text-muted)] hover:text-red-500 transition-colors"
        aria-label={`Remover ${value}`}
      >
        <X size={11} />
      </button>
    </span>
  )
}

function AttributeRow({ attr, index, usedNames, attrDefs, onChange, onRemove }) {
  const [valueInput,      setValueInput]      = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef(null)

  /* Sugestões: do DB (preferido) ou fallback hardcoded */
  const defEntry    = attrDefs.find(d => d.name === attr.name)
  const dbValues    = defEntry?.values?.map(v => v.label) ?? null
  const suggestions = dbValues ?? DEFAULT_ATTRIBUTE_VALUES[attr.name] ?? []

  const filteredSugg = suggestions.filter(
    s => !attr.values.includes(s) &&
         s.toLowerCase().includes(valueInput.toLowerCase())
  )

  const addValue = useCallback((val) => {
    const v = val.trim()
    if (!v || attr.values.includes(v)) return
    onChange(index, { ...attr, values: [...attr.values, v] })
    setValueInput('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }, [attr, index, onChange])

  const removeValue = useCallback((val) => {
    onChange(index, { ...attr, values: attr.values.filter(v => v !== val) })
  }, [attr, index, onChange])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addValue(valueInput)
    }
  }

  /* Nomes disponíveis: do DB (preferido) ou fallback */
  const dbNames      = attrDefs.length ? attrDefs.map(d => d.name) : DEFAULT_ATTRIBUTES
  const availableNames = dbNames.filter(n => n === attr.name || !usedNames.includes(n))

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        {/* Seletor de nome */}
        <div className="relative flex-1">
          <select
            value={attr.name}
            onChange={e => onChange(index, { ...attr, name: e.target.value, values: [] })}
            className="
              w-full h-9 px-3 pr-8 rounded-lg text-sm
              bg-[var(--color-bg)] border border-[var(--color-border)]
              text-[var(--color-text)]
              focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]
              appearance-none
            "
          >
            <option value="">Selecionar atributo…</option>
            {availableNames.map(n => <option key={n} value={n}>{n}</option>)}
            <option value="__custom__">Outro (personalizado)</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-[var(--color-text-muted)] hover:text-red-500 transition-colors shrink-0"
          aria-label="Remover atributo"
        >
          <X size={16} />
        </button>
      </div>

      {/* Nome personalizado */}
      {attr.name === '__custom__' && (
        <input
          type="text"
          placeholder="Nome do atributo…"
          value={attr.customName ?? ''}
          onChange={e => onChange(index, { ...attr, customName: e.target.value })}
          className="
            w-full h-9 px-3 rounded-lg text-sm
            bg-[var(--color-bg)] border border-[var(--color-border)]
            text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)]
            focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]
          "
        />
      )}

      {/* Chips de valores */}
      {attr.values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attr.values.map(v => (
            <ValueChip key={v} value={v} onRemove={removeValue} />
          ))}
        </div>
      )}

      {/* Input de valor + sugestões */}
      <div className="relative">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            placeholder="Adicionar valor (Enter para confirmar)"
            value={valueInput}
            onChange={e => { setValueInput(e.target.value); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={handleKeyDown}
            className="
              flex-1 h-9 px-3 rounded-lg text-sm
              bg-[var(--color-bg)] border border-[var(--color-border)]
              text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)]
              focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]
            "
          />
          <button
            type="button"
            onClick={() => addValue(valueInput)}
            className="
              h-9 px-3 rounded-lg text-sm font-medium
              bg-[var(--color-primary)] text-white
              hover:bg-[var(--color-primary-hover)]
              transition-colors disabled:opacity-40
            "
            disabled={!valueInput.trim()}
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Dropdown sugestões */}
        {showSuggestions && filteredSugg.length > 0 && (
          <div className="
            absolute top-full left-0 right-0 mt-1 z-10
            bg-[var(--color-bg)] border border-[var(--color-border)]
            rounded-lg shadow-[var(--shadow-md)] overflow-hidden
          ">
            {filteredSugg.map(s => (
              <button
                key={s}
                type="button"
                onMouseDown={() => addValue(s)}
                className="
                  w-full text-left px-3 py-2 text-sm
                  text-[var(--color-text)]
                  hover:bg-[var(--color-surface)]
                  transition-colors
                "
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function AttributeBuilder({ attributes, onChange }) {
  const [attrDefs, setAttrDefs] = useState([])

  useEffect(() => {
    loadAttrDefs().then(setAttrDefs)
  }, [])

  const usedNames = attributes.map(a => a.name).filter(Boolean)

  const addAttribute = () => {
    if (attributes.length >= MAX_ATTRIBUTES) return
    onChange([...attributes, { name: '', values: [] }])
  }

  const updateAttribute = (index, updated) => {
    const next = [...attributes]
    next[index] = updated
    onChange(next)
  }

  const removeAttribute = (index) => {
    onChange(attributes.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      {attributes.map((attr, i) => (
        <AttributeRow
          key={i}
          attr={attr}
          index={i}
          usedNames={usedNames}
          attrDefs={attrDefs}
          onChange={updateAttribute}
          onRemove={removeAttribute}
        />
      ))}

      {attributes.length < MAX_ATTRIBUTES && (
        <button
          type="button"
          onClick={addAttribute}
          className="
            w-full h-10 flex items-center justify-center gap-2
            rounded-xl border-2 border-dashed border-[var(--color-border)]
            text-sm text-[var(--color-text-muted)]
            hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]
            transition-colors duration-150
          "
        >
          <Plus size={15} />
          Adicionar atributo
          <span className="text-xs opacity-60">({attributes.length}/{MAX_ATTRIBUTES})</span>
        </button>
      )}
    </div>
  )
}
