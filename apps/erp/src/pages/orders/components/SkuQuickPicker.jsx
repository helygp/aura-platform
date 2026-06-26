/**
 * pages/orders/components/SkuQuickPicker.jsx
 *
 * Modal compacto para selecionar um SKU e quantidade ao adicionar item em
 * pedido EXISTENTE (edição até "separando"). Permite cancelar sem efeito
 * antes de confirmar — comportamento de "remover" só vale aqui.
 */

import React, { useState, useMemo } from 'react'
import { Search, Plus, X } from 'lucide-react'
import { fmtBRL } from '../ordersTypes.js'

export function SkuQuickPicker({ open, skus = [], onConfirm, onClose }) {
  const [q,        setQ]        = useState('')
  const [selected, setSelected] = useState(null)
  const [qty,      setQty]      = useState(1)
  const [busy,     setBusy]     = useState(false)
  const [err,      setErr]      = useState(null)

  // Reset state when modal opens
  React.useEffect(() => {
    if (open) { setQ(''); setSelected(null); setQty(1); setErr(null) }
  }, [open])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    const list = (skus ?? []).filter(s => Number(s.stock) > 0)
    if (!term) return list.slice(0, 20)
    return list.filter(s =>
      (s.code ?? '').toLowerCase().includes(term) ||
      (s.productName ?? '').toLowerCase().includes(term) ||
      Object.values(s.attributes ?? {}).join(' ').toLowerCase().includes(term)
    ).slice(0, 20)
  }, [skus, q])

  const handleConfirm = async () => {
    if (!selected) return
    if (qty < 1 || qty > selected.stock) {
      setErr(`Quantidade deve ser entre 1 e ${selected.stock}.`)
      return
    }
    setBusy(true); setErr(null)
    try {
      await onConfirm(selected.id, qty)
      onClose()
    } catch (e) {
      setErr(e.message || 'Não foi possível adicionar.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && onClose()}>
      <div className="bg-[var(--color-bg)] rounded-xl shadow-xl p-5 w-full max-w-md max-h-[85vh] flex flex-col space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plus size={16} className="text-[var(--color-primary)]" />
            <p className="text-sm font-semibold text-[var(--color-text)]">Adicionar item ao pedido</p>
          </div>
          <button onClick={onClose} disabled={busy} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--color-surface)] disabled:opacity-40">
            <X size={14} />
          </button>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar por código ou produto…"
            className="w-full text-sm pl-8 pr-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          />
        </div>

        <div className="flex-1 overflow-y-auto border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
          {filtered.length === 0 && (
            <p className="text-xs text-[var(--color-text-muted)] text-center py-6">
              {q ? 'Nenhum SKU encontrado.' : 'Digite pra buscar SKUs disponíveis.'}
            </p>
          )}
          {filtered.map(s => {
            const isSel = selected?.id === s.id
            const attrs = Object.values(s.attributes ?? {}).join(' / ')
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelected(s)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors ${isSel ? 'bg-[var(--color-primary)]/10' : 'hover:bg-[var(--color-surface)]'}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--color-text)] truncate">{s.productName}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)] truncate">
                    {attrs && <span>{attrs} · </span>}<span className="font-mono">{s.code}</span> · estoque {s.stock}
                  </p>
                </div>
                <span className="text-xs font-semibold text-[var(--color-text)] tabular-nums shrink-0">{fmtBRL(s.priceWholesale)}</span>
              </button>
            )
          })}
        </div>

        {selected && (
          <div className="flex items-center gap-3 bg-[var(--color-bg-subtle)] border border-[var(--color-border)] rounded-lg p-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[var(--color-text)] truncate">{selected.productName}</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">máx {selected.stock}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button disabled={busy} onClick={() => setQty(q => Math.max(1, q - 1))}
                className="w-7 h-7 rounded border border-[var(--color-border)] text-xs hover:bg-[var(--color-surface)] disabled:opacity-40">−</button>
              <input type="number" min={1} max={selected.stock} value={qty}
                onChange={e => setQty(Math.max(1, Math.min(selected.stock, parseInt(e.target.value) || 1)))}
                className="w-12 text-center text-xs px-1 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)]" />
              <button disabled={busy} onClick={() => setQty(q => Math.min(selected.stock, q + 1))}
                className="w-7 h-7 rounded border border-[var(--color-border)] text-xs hover:bg-[var(--color-surface)] disabled:opacity-40">+</button>
            </div>
            <span className="text-xs font-bold text-[var(--color-text)] tabular-nums shrink-0">
              {fmtBRL(selected.priceWholesale * qty)}
            </span>
          </div>
        )}

        {err && <p className="text-xs text-red-500">{err}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} disabled={busy} className="flex-1 text-sm py-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface)] disabled:opacity-40">Cancelar</button>
          <button onClick={handleConfirm} disabled={busy || !selected}
            className="flex-1 text-sm py-2 rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-40">
            {busy ? 'Adicionando…' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  )
}
