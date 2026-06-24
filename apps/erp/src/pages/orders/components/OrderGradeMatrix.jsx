/**
 * pages/orders/components/OrderGradeMatrix.jsx
 *
 * Matriz Cor × Tamanho para seleção de SKUs no novo pedido.
 * Ativado via viewMode === 'matrix' no OrderForm.
 *
 * Diferenças em relação à loja (GradeMatrix.tsx):
 *   - Sem tiers de desconto
 *   - Sem grade fechada / preencher proporção
 *   - Sync imediato por célula (igual ao comportamento do ProductCard)
 *   - Design tokens do ERP (Tailwind vars)
 *
 * Props:
 *   product     : { name, skus: [{id, code, attributes, priceWholesale, stock}] }
 *   quantities  : { skuId: qty }   ← vindo do OrderForm
 *   onQtyChange : (sku, qty, product) => void
 *
 * Retorna null se o produto não tiver grid Cor × Tamanho detectável.
 * Nesse caso o ProductCard faz fallback para a lista flat.
 */

import { useMemo } from 'react'

/* ─── Constantes de detecção de eixos ─── */
const _SZ_CANONICAL = ['PP','P','M','G','GG','XG']
const _SZ_ROWS      = ['Tamanho','tamanho','Size','size','Tam','tam']
const _GP_COLS      = ['Cor','cor','COLOR','Color','Estampa']

function _szKey(v) {
  const s = String(v ?? '').trim()
  if (/^[0-9]+(\.[0-9]+)?$/.test(s)) return 'A' + String(parseFloat(s) + 1e5).padStart(12,'0')
  const i = _SZ_CANONICAL.indexOf(s.toUpperCase())
  return 'B' + (i === -1 ? s.toUpperCase() : String(i).padStart(4,'0'))
}

/* Utilitário exportado — ProductCard usa para decidir se renderiza matriz ou lista */
export function hasProductGrid(product) {
  const skus  = product.skus ?? []
  const names = [...new Set(skus.flatMap(s => Object.keys(s.attributes ?? {})))]
  return names.some(n => _GP_COLS.includes(n)) && names.some(n => _SZ_ROWS.includes(n))
}

/* ─── Componente principal ─── */
export function OrderGradeMatrix({ product, quantities, onQtyChange }) {
  const skus = product.skus ?? []

  /* Detecta chaves de cor e tamanho */
  const { colorKey, sizeKey } = useMemo(() => {
    const names = [...new Set(skus.flatMap(s => Object.keys(s.attributes ?? {})))]
    return {
      colorKey: names.find(n => _GP_COLS.includes(n)) ?? null,
      sizeKey:  names.find(n => _SZ_ROWS.includes(n)) ?? null,
    }
  }, [skus])

  /* Cores (linhas) — ordem alfabética pt-BR */
  const colors = useMemo(() => {
    if (!colorKey) return []
    const raw = [...new Set(skus.map(s => s.attributes?.[colorKey]).filter(Boolean))]
    return raw.sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))
  }, [skus, colorKey])

  /* Tamanhos (colunas) — ordem canônica */
  const sizes = useMemo(() => {
    if (!sizeKey) return []
    const raw = [...new Set(skus.map(s => s.attributes?.[sizeKey]).filter(Boolean))]
    return raw.sort((a, b) => { const ka = _szKey(a), kb = _szKey(b); return ka < kb ? -1 : ka > kb ? 1 : 0 })
  }, [skus, sizeKey])

  /* Mapa "Cor|Tamanho" → sku */
  const skuMap = useMemo(() => {
    const m = {}
    skus.forEach(s => {
      const c = colorKey ? (s.attributes?.[colorKey] ?? '') : ''
      const z = sizeKey  ? (s.attributes?.[sizeKey]  ?? '') : ''
      if (c && z) m[`${c}|${z}`] = s
    })
    return m
  }, [skus, colorKey, sizeKey])

  /* Guard: produto sem grade detectável → lista flat no ProductCard */
  if (!colorKey || !sizeKey || colors.length === 0 || sizes.length === 0) return null

  /* Totalizadores */
  const qty   = (sku) => sku ? (quantities[sku.id] ?? 0) : 0
  const rowQty = (color) => sizes.reduce((s, sz) => s + qty(skuMap[`${color}|${sz}`]), 0)
  const colQty = (sz)    => colors.reduce((s, c)  => s + qty(skuMap[`${c}|${sz}`]),    0)
  const grand  = colors.reduce((s, c) => s + rowQty(c), 0)

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
      <table className="w-full text-xs border-collapse">

        {/* ── Cabeçalho ── */}
        <thead>
          <tr className="bg-[var(--color-surface)]">
            <th className="px-3 py-2 text-left font-semibold text-[var(--color-text-muted)] border-b border-r border-[var(--color-border)] whitespace-nowrap min-w-[96px]">
              Cor
            </th>
            {sizes.map(sz => (
              <th key={sz} className="px-1 py-2 text-center font-semibold text-[var(--color-text-muted)] border-b border-r border-[var(--color-border)] last:border-r-0 min-w-[48px]">
                {sz}
              </th>
            ))}
            <th className="px-2 py-2 text-right font-semibold text-[var(--color-text-muted)] border-b border-[var(--color-border)] min-w-[40px]">
              Un
            </th>
          </tr>
        </thead>

        {/* ── Linhas de cor ── */}
        <tbody>
          {colors.map((color, ci) => {
            const total = rowQty(color)
            return (
              <tr key={color} className={ci % 2 === 0 ? '' : 'bg-[var(--color-bg-subtle)]'}>

                {/* Nome da cor */}
                <td className="px-3 py-1 font-medium text-[var(--color-text)] border-r border-b border-[var(--color-border)] whitespace-nowrap">
                  {color}
                </td>

                {/* Células de quantidade */}
                {sizes.map(sz => {
                  const sku     = skuMap[`${color}|${sz}`]
                  const q       = qty(sku)
                  const noStock = !sku || (sku.stock ?? 0) <= 0
                  return (
                    <td key={sz} className="px-1 py-1 border-r border-b border-[var(--color-border)] last:border-r-0 text-center">
                      {sku ? (
                        <input
                          type="text"
                          inputMode="numeric"
                          disabled={noStock}
                          value={q > 0 ? q : ''}
                          placeholder={noStock ? '—' : '0'}
                          title={noStock ? 'Sem estoque' : `Disponível: ${sku.stock}`}
                          onChange={e => {
                            const n = parseInt(e.target.value.replace(/\D/g, '')) || 0
                            onQtyChange(sku, Math.min(n, sku.stock ?? 999), product)
                          }}
                          className={[
                            'w-10 h-7 text-center text-xs font-semibold rounded-lg border transition-colors',
                            'focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]',
                            noStock
                              ? 'bg-[var(--color-bg-subtle)] border-[var(--color-border)] text-[var(--color-text-disabled)] cursor-not-allowed'
                              : q > 0
                                ? 'bg-blue-50 dark:bg-blue-950/20 border-[var(--color-primary)] text-[var(--color-primary)]'
                                : 'bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)]',
                          ].join(' ')}
                        />
                      ) : (
                        <span className="text-[var(--color-text-disabled)]">—</span>
                      )}
                    </td>
                  )
                })}

                {/* Total da cor */}
                <td className="px-2 py-1 text-right border-b border-[var(--color-border)]">
                  <span className={total > 0 ? 'font-bold text-[var(--color-text)]' : 'text-[var(--color-text-disabled)]'}>
                    {total > 0 ? total : '—'}
                  </span>
                </td>
              </tr>
            )
          })}

          {/* ── Linha de totais por tamanho ── */}
          <tr className="bg-[var(--color-surface)]" style={{ borderTop: '2px solid var(--color-border)' }}>
            <td className="px-3 py-1.5 font-semibold text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] border-r border-[var(--color-border)]">
              Total
            </td>
            {sizes.map(sz => {
              const t = colQty(sz)
              return (
                <td key={sz} className="px-1 py-1.5 text-center border-r border-[var(--color-border)] last:border-r-0">
                  <span className={t > 0 ? 'font-bold text-[var(--color-text)]' : 'text-[var(--color-text-disabled)]'}>
                    {t > 0 ? t : '—'}
                  </span>
                </td>
              )
            })}
            <td className="px-2 py-1.5 text-right">
              <span className={grand > 0 ? 'font-bold text-[var(--color-primary)]' : 'text-[var(--color-text-disabled)]'}>
                {grand > 0 ? grand : '—'}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
