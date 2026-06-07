/**
 * pages/orders/components/GradePicker.jsx
 *
 * Seletor de produtos com grade para criação de pedidos.
 * Mostra uma matriz Tamanho × Cor (ou atributo1 × atributo2) com
 * inputs de quantidade. O usuário preenche os campos e clica "Adicionar"
 * para incluir todos os itens de uma vez no pedido.
 *
 * Props:
 *   products  : array de produtos com skus
 *   onAdd     : (items[]) => void  — array de {skuId, skuCode, productName, attributes, priceUnit, qty}
 *   addedIds  : Set de sku ids já no pedido
 */

import React, { useState, useMemo } from 'react'
import { Search, Plus, ChevronDown, ChevronUp, ShoppingCart } from 'lucide-react'
import { fmtBRL } from '../ordersTypes.js'

/* ── Constantes de ordenação ── */
const _GP_COLS = ['Cor', 'cor', 'COLOR', 'Color', 'Estampa']   // → colunas (axisB)
const _GP_ROWS = ['Tamanho', 'tamanho', 'Size', 'size', 'Tam', 'tam']  // → linhas (axisA)
const _GP_SZ   = ['PP','P','M','G','GG','XG']

function _gpSzKey(v) {
  const s = String(v).trim()
  if (/^[0-9]+(\.[0-9]+)?$/.test(s)) return 'A' + String(parseFloat(s) + 1e5).padStart(12,'0')
  const i = _GP_SZ.indexOf(s.toUpperCase())
  return 'B' + (i === -1 ? s.toUpperCase() : String(i).padStart(4,'0'))
}
function _gpSortSizes(arr){ return [...arr].sort((a,b)=>{ const ka=_gpSzKey(a),kb=_gpSzKey(b); return ka<kb?-1:ka>kb?1:0 }) }
function _gpSortColors(arr){ return [...arr].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR')) }

/* ── Detecta os dois eixos da grade por nome (Cor → colunas, Tamanho → linhas) ── */
function detectAxes(skus) {
  const attrNames = [...new Set(skus.flatMap(s => Object.keys(s.attributes ?? {})))]
  if (attrNames.length === 0) return { axisA: null, axisB: null }
  if (attrNames.length === 1) return { axisA: attrNames[0], axisB: null }

  // Detecção por nome: Cor → axisB (colunas), Tamanho → axisA (linhas)
  const colName = attrNames.find(n => _GP_COLS.includes(n))
  const rowName = attrNames.find(n => _GP_ROWS.includes(n))
  if (colName && rowName) return { axisA: rowName, axisB: colName }
  if (colName) {
    const other = attrNames.find(n => n !== colName) ?? null
    return { axisA: other ?? colName, axisB: colName }
  }
  if (rowName) {
    const other = attrNames.find(n => n !== rowName) ?? null
    return { axisA: rowName, axisB: other ?? rowName }
  }
  // Fallback: mais valores = linhas
  const counts = {}
  attrNames.forEach(n => { counts[n] = new Set(skus.map(s => s.attributes[n]).filter(Boolean)).size })
  const sorted = [...attrNames].sort((a, b) => counts[b] - counts[a])
  return { axisA: sorted[0], axisB: sorted[1] }
}
function GradeMatrix({ product, onAdd, addedIds }) {
  const skus = product.skus ?? []
  const { axisA, axisB } = useMemo(() => detectAxes(skus), [skus])
  const [qtys, setQtys] = useState({})  // skuId → qty string

  const valuesA = useMemo(() => {
    if (!axisA) return []
    const raw = [...new Set(skus.map(s => s.attributes?.[axisA]).filter(Boolean))]
    return _GP_ROWS.includes(axisA) ? _gpSortSizes(raw) : _gpSortColors(raw)
  }, [skus, axisA])

  const valuesB = useMemo(() => {
    if (!axisB) return ['']
    const raw = [...new Set(skus.map(s => s.attributes?.[axisB]).filter(Boolean))]
    return _GP_COLS.includes(axisB) ? _gpSortColors(raw) : _gpSortSizes(raw)
  }, [skus, axisB])
  const skuMap = useMemo(() => {
    const m = {}
    skus.forEach(s => {
      const a = axisA ? s.attributes?.[axisA] : ''
      const b = axisB ? s.attributes?.[axisB] : ''
      m[`${a}|${b}`] = s
    })
    return m
  }, [skus, axisA, axisB])

  const setQty = (skuId, val) => {
    const n = val.replace(/\D/g,'')
    setQtys(prev => ({ ...prev, [skuId]: n }))
  }

  const totalItems = Object.entries(qtys).filter(([,q]) => parseInt(q) > 0).length

  const handleAdd = () => {
    const items = []
    Object.entries(qtys).forEach(([skuId, qStr]) => {
      const qty = parseInt(qStr)
      if (!qty || qty <= 0) return
      const sku = skus.find(s => s.id === skuId)
      if (!sku) return
      items.push({
        skuId:       sku.id,
        skuCode:     sku.code,
        productName: product.name,
        attributes:  sku.attributes ?? {},
        priceUnit:   sku.priceWholesale ?? 0,
        qty,
      })
    })
    if (items.length) {
      onAdd(items)
      setQtys({})
    }
  }

  /* Produto simples (sem grade) */
  if (!axisA) {
    const sku = skus[0]
    if (!sku) return null
    const added = addedIds.has(sku.id)
    return (
      <div className="flex items-center justify-between p-3 bg-[var(--color-bg-subtle)] rounded-xl">
        <div>
          <p className="text-sm font-medium text-[var(--color-text)]">{product.name}</p>
          <p className="text-xs text-[var(--color-primary)]">{fmtBRL(sku.priceWholesale)}</p>
          <p className="text-xs text-[var(--color-text-muted)]">Estoque: {sku.stock}</p>
        </div>
        <button
          onClick={() => !added && sku.stock > 0 && onAdd([{ skuId:sku.id, skuCode:sku.code, productName:product.name, attributes:{}, priceUnit:sku.priceWholesale??0, qty:1 }])}
          disabled={added || sku.stock <= 0}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-[var(--color-primary)] text-white disabled:opacity-40"
        >
          <Plus size={12}/> {added ? 'Adicionado' : 'Adicionar'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Matriz */}
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-[var(--color-surface)]">
              <th className="px-2 py-2 text-left text-[var(--color-text-muted)] font-medium border-b border-r border-[var(--color-border)] w-16">
                {axisA}
              </th>
              {valuesB.map(b => (
                <th key={b} className="px-2 py-2 text-center text-[var(--color-text-muted)] font-medium border-b border-r border-[var(--color-border)] last:border-r-0 min-w-[64px]">
                  {b || axisA}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {valuesA.map((a, ai) => (
              <tr key={a} className={ai % 2 === 0 ? '' : 'bg-[var(--color-bg-subtle)]'}>
                <td className="px-2 py-1.5 font-semibold text-[var(--color-text)] border-r border-[var(--color-border)] whitespace-nowrap">
                  {a}
                </td>
                {valuesB.map(b => {
                  const sku   = skuMap[`${a}|${b}`]
                  const added = sku && addedIds.has(sku.id)
                  const noStk = !sku || sku.stock <= 0
                  return (
                    <td key={b} className="px-1 py-1 border-r border-[var(--color-border)] last:border-r-0 text-center">
                      {sku ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder={noStk ? '—' : '0'}
                            value={qtys[sku.id] ?? ''}
                            onChange={e => setQty(sku.id, e.target.value)}
                            disabled={noStk || added}
                            className={[
                              'w-12 h-7 text-center text-xs font-semibold rounded-lg border transition-colors',
                              added
                                ? 'bg-green-50 border-green-300 text-green-700 dark:bg-green-950 dark:border-green-700'
                                : noStk
                                  ? 'bg-[var(--color-bg-subtle)] border-[var(--color-border)] text-[var(--color-text-disabled)]'
                                  : 'bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]',
                            ].join(' ')}
                          />
                          <span className={['text-[9px]', noStk ? 'text-red-400' : 'text-[var(--color-text-disabled)]'].join(' ')}>
                            {added ? '✓' : noStk ? 'S/E' : `${sku.stock}`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[var(--color-text-disabled)]">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rodapé com preço e botão */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-[var(--color-text-muted)]">
          {fmtBRL(skus[0]?.priceWholesale ?? 0)} / un
          {totalItems > 0 && (
            <span className="ml-2 font-semibold text-[var(--color-primary)]">
              {totalItems} SKU{totalItems > 1 ? 's' : ''} selecionado{totalItems > 1 ? 's' : ''}
            </span>
          )}
        </p>
        <button
          onClick={handleAdd}
          disabled={totalItems === 0}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-[var(--color-primary)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          <ShoppingCart size={12} />
          Adicionar ao pedido
        </button>
      </div>
    </div>
  )
}

/* ── Componente principal ── */
export function GradePicker({ products, onAdd, addedIds }) {
  const [search,   setSearch]   = useState('')
  const [expanded, setExpanded] = useState(null)  // product id

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q)
    )
  }, [products, search])

  // Auto-expandir quando só 1 resultado
  const effectiveExpanded = filtered.length === 1 ? filtered[0].id : expanded

  return (
    <div className="space-y-2">
      {/* Busca */}
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar produto…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-8 pl-7 pr-3 rounded-lg text-sm bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
        />
      </div>

      {/* Lista de produtos */}
      <div className="max-h-[380px] overflow-y-auto space-y-1.5 pr-0.5">
        {filtered.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)] text-center py-6">Nenhum produto encontrado</p>
        ) : filtered.map(product => {
          const isOpen     = effectiveExpanded === product.id
          const skuCount   = product.skus?.length ?? 0
          const addedCount = product.skus?.filter(s => addedIds.has(s.id)).length ?? 0

          return (
            <div key={product.id} className="rounded-xl border border-[var(--color-border)] overflow-hidden">
              {/* Header do produto */}
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : product.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--color-surface)] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text)] truncate">{product.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {product.category}
                    {skuCount > 0 && <span className="ml-2">{skuCount} SKU{skuCount > 1 ? 's' : ''}</span>}
                    {addedCount > 0 && <span className="ml-2 text-green-600 font-medium">{addedCount} no pedido</span>}
                  </p>
                </div>
                {isOpen
                  ? <ChevronUp size={14} className="text-[var(--color-text-muted)] shrink-0" />
                  : <ChevronDown size={14} className="text-[var(--color-text-muted)] shrink-0" />
                }
              </button>

              {/* Grade expandida */}
              {isOpen && (
                <div className="px-3 pb-3 border-t border-[var(--color-border)]">
                  <div className="pt-2">
                    <GradeMatrix
                      product={product}
                      onAdd={onAdd}
                      addedIds={addedIds}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
