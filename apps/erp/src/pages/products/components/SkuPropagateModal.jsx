/**
 * pages/products/components/SkuPropagateModal.jsx
 *
 * Painel de revisão da propagação de SKUs.
 * Aparece quando um atributo já em uso recebe valor(es) novo(s):
 * sugere criar os SKUs correspondentes nos produtos que usam aquele atributo.
 *
 * Props:
 *   impact    : { attribute:{id,name}, products:[{productId,code,name,otherKeys,skus:[{attributes,code,priceWholesale,stockMin}]}], totalSkus }
 *   busy      : boolean
 *   onClose   : () => void
 *   onConfirm : (items:[{productId,code,attributes,priceWholesale,stockMin}]) => void
 */

import React, { useMemo, useState } from 'react'
import { X, Check, Sparkles, Package, RefreshCw } from 'lucide-react'

const fmtAttrs = (attrs) =>
  Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join('  ·  ')

export function SkuPropagateModal({ impact, busy = false, onClose, onConfirm }) {
  const [rows, setRows] = useState(() =>
    impact.products.flatMap(p =>
      p.skus.map(s => ({
        key:         `${p.productId}::${s.code}`,
        productId:   p.productId,
        productCode: p.code,
        productName: p.name,
        code:        s.code,
        attributes:  s.attributes,
        price:       s.priceWholesale != null ? String(s.priceWholesale) : '',
        stockMin:    s.stockMin ?? 0,
        selected:    true,
      }))
    )
  )

  const groups = useMemo(() => {
    const m = new Map()
    rows.forEach(r => {
      if (!m.has(r.productId)) m.set(r.productId, { code: r.productCode, name: r.productName, rows: [] })
      m.get(r.productId).rows.push(r)
    })
    return [...m.entries()].map(([productId, g]) => ({ productId, ...g }))
  }, [rows])

  const selectedCount = rows.filter(r => r.selected).length

  const toggleRow   = (key) => setRows(rs => rs.map(r => r.key === key ? { ...r, selected: !r.selected } : r))
  const setPrice    = (key, price) => setRows(rs => rs.map(r => r.key === key ? { ...r, price } : r))
  const toggleGroup = (productId, value) =>
    setRows(rs => rs.map(r => r.productId === productId ? { ...r, selected: value } : r))
  const toggleAll   = (value) => setRows(rs => rs.map(r => ({ ...r, selected: value })))

  const allSelected = rows.length > 0 && rows.every(r => r.selected)

  const confirm = () => {
    const items = rows.filter(r => r.selected).map(r => ({
      productId:      r.productId,
      code:           r.code,
      attributes:     r.attributes,
      priceWholesale: parseFloat(String(r.price).replace(',', '.')) || 0,
      stockMin:       parseInt(r.stockMin) || 0,
    }))
    onConfirm(items)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-[var(--color-bg)] rounded-2xl border border-[var(--color-border)] shadow-2xl">

        {/* Cabeçalho */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-[var(--color-border)] shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
            <Sparkles size={18} className="text-[var(--color-primary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-[var(--color-text)]">Novos SKUs sugeridos</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              O atributo <strong className="text-[var(--color-text)]">{impact.attribute.name}</strong> recebeu valor novo.
              Sugerimos criar <strong className="text-[var(--color-text)]">{impact.totalSkus} SKU{impact.totalSkus !== 1 ? 's' : ''}</strong> em{' '}
              <strong className="text-[var(--color-text)]">{impact.products.length} produto{impact.products.length !== 1 ? 's' : ''}</strong> que já usam esse atributo.
              Preço pré-preenchido herdado de SKU equivalente — ajuste se quiser.
            </p>
          </div>
          <button onClick={onClose} disabled={busy}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors shrink-0 disabled:opacity-40">
            <X size={16} />
          </button>
        </div>

        {/* Selecionar tudo */}
        <div className="px-5 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] shrink-0 flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-medium text-[var(--color-text)] cursor-pointer">
            <input type="checkbox" checked={allSelected} onChange={e => toggleAll(e.target.checked)}
              className="w-4 h-4 rounded accent-[var(--color-primary)]" />
            Selecionar todos
          </label>
          <span className="text-xs text-[var(--color-text-muted)]">{selectedCount} de {rows.length} selecionados</span>
        </div>

        {/* Lista agrupada por produto */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {groups.map(g => {
            const gAll = g.rows.every(r => r.selected)
            return (
              <div key={g.productId} className="rounded-xl border border-[var(--color-border)] overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                  <input type="checkbox" checked={gAll} onChange={e => toggleGroup(g.productId, e.target.checked)}
                    className="w-4 h-4 rounded accent-[var(--color-primary)]" />
                  <Package size={13} className="text-[var(--color-text-muted)] shrink-0" />
                  <span className="text-sm font-semibold text-[var(--color-text)] truncate">{g.name}</span>
                  <span className="font-mono text-[10px] text-[var(--color-text-muted)]">{g.code}</span>
                  <span className="ml-auto text-xs text-[var(--color-text-muted)]">{g.rows.length} SKU{g.rows.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="divide-y divide-[var(--color-border)]">
                  {g.rows.map(r => (
                    <div key={r.key} className={`flex items-center gap-2 px-3 py-2 transition-colors ${r.selected ? '' : 'opacity-50'}`}>
                      <input type="checkbox" checked={r.selected} onChange={() => toggleRow(r.key)}
                        className="w-4 h-4 rounded accent-[var(--color-primary)] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[var(--color-text)] truncate">{fmtAttrs(r.attributes)}</p>
                        <p className="font-mono text-[10px] text-[var(--color-text-muted)]">{r.code}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-[var(--color-text-muted)]">R$</span>
                        <input type="number" min="0" step="0.01" value={r.price}
                          onChange={e => setPrice(r.key, e.target.value)}
                          disabled={!r.selected}
                          className="w-20 h-7 px-2 rounded-md text-xs bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] disabled:opacity-50" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Rodapé */}
        <div className="px-5 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)] flex items-center justify-end gap-3 shrink-0">
          <button onClick={onClose} disabled={busy}
            className="h-9 px-4 rounded-xl text-sm font-medium border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-colors disabled:opacity-40">
            Agora não
          </button>
          <button onClick={confirm} disabled={busy || selectedCount === 0}
            className="h-9 px-4 rounded-xl text-sm font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-1.5">
            {busy ? <><RefreshCw size={14} className="animate-spin" /> Criando…</> : <><Check size={14} /> Criar {selectedCount} SKU{selectedCount !== 1 ? 's' : ''}</>}
          </button>
        </div>
      </div>
    </div>
  )
}
