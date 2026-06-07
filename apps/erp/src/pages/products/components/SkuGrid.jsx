/**
 * pages/products/components/SkuGrid.jsx
 *
 * Tabela editável de SKUs gerados pela grade de atributos.
 * Exibe para cada combinação: código, atributos, preço atacado, estoque mínimo.
 * Permite editar código e preço diretamente na célula.
 *
 * Props:
 *   skus     : array de SKU objects
 *   onChange : (newSkus) => void
 */

import React, { useCallback } from 'react'

function CellInput({ value, onChange, placeholder, type = 'text', prefix }) {
  return (
    <div className={`flex items-center gap-1 ${prefix ? 'relative' : ''}`}>
      {prefix && (
        <span className="text-xs text-[var(--color-text-muted)] shrink-0">{prefix}</span>
      )}
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        step={type === 'number' ? '0.01' : undefined}
        min={type === 'number' ? '0' : undefined}
        className="
          w-full h-8 px-2 rounded-md text-xs
          bg-[var(--color-bg-subtle)] border border-[var(--color-border)]
          text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)]
          focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]
          focus:bg-[var(--color-bg)]
          transition-colors
        "
      />
    </div>
  )
}

/* ── Sort helpers (Cor primário, Tamanho secundário) ── */
const _SG_COLS = ['Cor','cor','COLOR','Color','Estampa']
const _SG_ROWS = ['Tamanho','tamanho','Size','size','Tam','tam']
const _SG_SZ   = ['PP','P','M','G','GG','XG']
function _sgSzKey(v) {
  const s = String(v).trim()
  if (/^[0-9]+(\.[0-9]+)?$/.test(s)) return 'A' + String(parseFloat(s)+1e5).padStart(12,'0')
  const i = _SG_SZ.indexOf(s.toUpperCase())
  return 'B' + (i === -1 ? s.toUpperCase() : String(i).padStart(4,'0'))
}
function _sgSortKey(sku, colKeys, rowKeys) {
  const c = colKeys.map(k => String(sku.attributes?.[k] ?? '')).join('|')
  const r = rowKeys.map(k => _sgSzKey(sku.attributes?.[k] ?? '')).join('|')
  return c + '~~' + r
}

export function SkuGrid({ skus, onChange }) {
  const updateSku = useCallback((index, field, value) => {
    const next = skus.map((sku, i) =>
      i === index ? { ...sku, [field]: value } : sku
    )
    onChange(next)
  }, [skus, onChange])

  /* Ordena exibição: Cor (primário) → Tamanho (secundário) */
  const _allKeys  = skus.length ? [...new Set(skus.flatMap(s => Object.keys(s.attributes ?? {})))] : []
  const _colKeys  = _allKeys.filter(k => _SG_COLS.includes(k))
  const _rowKeys  = _allKeys.filter(k => _SG_ROWS.includes(k))
  const _otherKeys = _allKeys.filter(k => !_SG_COLS.includes(k) && !_SG_ROWS.includes(k))
  const _ckFull   = [..._colKeys, ..._otherKeys]
  const sortedSkus = [...(skus ?? [])].sort((a,b) => {
    const ka = _ckFull.map(k=>String(a.attributes?.[k]??'')).join('|') + '~~' + _rowKeys.map(k=>_sgSzKey(a.attributes?.[k]??'')).join('|')
    const kb = _ckFull.map(k=>String(b.attributes?.[k]??'')).join('|') + '~~' + _rowKeys.map(k=>_sgSzKey(b.attributes?.[k]??'')).join('|')
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })

  if (!skus?.length) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-6 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">
          Configure os atributos acima para gerar as combinações de SKU.
        </p>
      </div>
    )
  }

  /* Descobre as chaves de atributos dinamicamente */
  const attrKeys = Object.keys(skus[0]?.attributes ?? {})

  return (
    <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
      {/* Header */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]">
            <tr>
              {attrKeys.map(k => (
                <th key={k} className="px-3 py-2.5 text-left font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">
                  {k}
                </th>
              ))}
              <th className="px-3 py-2.5 text-left font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">
                Código SKU
              </th>
              <th className="px-3 py-2.5 text-left font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">
                Preço Atacado
              </th>
              <th className="px-3 py-2.5 text-left font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">
                Estoque Mín.
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {sortedSkus.map((sku, i) => (
              <tr key={sku._tempId ?? sku.id ?? i} className="bg-[var(--color-bg)] hover:bg-[var(--color-bg-subtle)] transition-colors">
                {/* Colunas de atributo — read-only */}
                {attrKeys.map(k => (
                  <td key={k} className="px-3 py-2 font-medium text-[var(--color-text)] whitespace-nowrap">
                    {sku.attributes[k] ?? '—'}
                  </td>
                ))}
                {/* Código editável */}
                <td className="px-3 py-2 min-w-[140px]">
                  <CellInput
                    value={sku.code}
                    onChange={v => updateSku(skus.indexOf(sku), 'code', v)}
                    placeholder="SKU-001"
                  />
                </td>
                {/* Preço editável */}
                <td className="px-3 py-2 min-w-[110px]">
                  <CellInput
                    value={sku.priceWholesale}
                    onChange={v => updateSku(skus.indexOf(sku), 'priceWholesale', v)}
                    placeholder="0,00"
                    type="number"
                    prefix="R$"
                  />
                </td>
                {/* Estoque mínimo */}
                <td className="px-3 py-2 min-w-[90px]">
                  <CellInput
                    value={sku.stockMin}
                    onChange={v => updateSku(skus.indexOf(sku), 'stockMin', v)}
                    placeholder="0"
                    type="number"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 bg-[var(--color-bg-subtle)] border-t border-[var(--color-border)]">
        <p className="text-xs text-[var(--color-text-muted)]">
          {skus.length} combinaç{skus.length === 1 ? 'ão' : 'ões'} gerada{skus.length === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  )
}
