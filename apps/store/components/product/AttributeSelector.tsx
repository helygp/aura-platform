'use client'

/**
 * components/product/AttributeSelector.tsx
 * Seletor de grade visual de atributos — botões, não dropdowns.
 *
 * Exibe cada dimensão (tamanho, cor) como grade de botões.
 * Detecta automaticamente quais combinações têm estoque disponível
 * e desabilita os botões sem estoque.
 *
 * Props:
 *   attributes  — { tamanho: ['P','M','G'], cor: ['Preto','Branco'] }
 *   skus        — lista de SKUs com atributos + estoque
 *   selected    — { tamanho: 'M', cor: 'Preto' } (estado controlado)
 *   onChange    — callback com novo estado
 */

import type { Sku } from '@/lib/api'

interface Props {
  attributes: Record<string, string[]>
  skus: Sku[]
  selected: Record<string, string>
  onChange: (s: Record<string, string>) => void
}

export default function AttributeSelector({ attributes, skus, selected, onChange }: Props) {
  const dimensions = Object.entries(attributes)
  if (dimensions.length === 0) return null

  /** Verifica se uma escolha parcial tem ao menos 1 SKU com estoque */
  function hasStock(dim: string, val: string): boolean {
    const candidate = { ...selected, [dim]: val }
    return skus.some((sku) => {
      if (!sku.active || sku.stock <= 0) return false
      // Todos os atributos da candidatura que estão definidos devem bater
      return Object.entries(candidate).every(
        ([k, v]) => sku.attributes[k] === v
      )
    })
  }

  /** Verifica se a combinação atual completa tem estoque */
  function isFullySelected(dim: string, val: string): boolean {
    const candidate = { ...selected, [dim]: val }
    const keys = Object.keys(attributes)
    if (keys.some((k) => !candidate[k])) return false // seleção incompleta
    return skus.some(
      (sku) =>
        sku.active &&
        sku.stock > 0 &&
        keys.every((k) => sku.attributes[k] === candidate[k])
    )
  }

  function select(dim: string, val: string) {
    // Se clicar no já selecionado, deseleciona
    if (selected[dim] === val) {
      const next = { ...selected }
      delete next[dim]
      onChange(next)
    } else {
      onChange({ ...selected, [dim]: val })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {dimensions.map(([dim, values]) => (
        <div key={dim}>
          <div className="mb-2 flex items-baseline gap-2">
            <span className="text-sm font-semibold capitalize text-foreground">{dim}</span>
            {selected[dim] && (
              <span className="text-sm text-muted-foreground">{selected[dim]}</span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {values.map((val) => {
              const isSelected = selected[dim] === val
              const inStock    = hasStock(dim, val)
              const isComplete = Object.keys(attributes).length === Object.keys({ ...selected, [dim]: val }).length
              const noStock    = isComplete ? !isFullySelected(dim, val) : !inStock

              return (
                <button
                  key={val}
                  onClick={() => !noStock && select(dim, val)}
                  disabled={noStock}
                  className={[
                    'relative min-w-[2.5rem] rounded-[var(--radius)] border px-3 py-2 text-sm font-medium transition',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : noStock
                        ? 'cursor-not-allowed border-border text-muted-foreground opacity-40'
                        : 'border-border text-foreground hover:border-primary hover:text-primary',
                  ].join(' ')}
                  aria-pressed={isSelected}
                  aria-label={noStock ? `${val} — indisponível` : val}
                >
                  {val}
                  {/* Risco diagonal para sem estoque */}
                  {noStock && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
                    >
                      <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        className="h-full w-full"
                      >
                        <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" className="opacity-30" />
                      </svg>
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
