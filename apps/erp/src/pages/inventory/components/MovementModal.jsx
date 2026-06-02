/**
 * pages/inventory/components/MovementModal.jsx
 *
 * Modal de movimentação manual de estoque.
 * Suporta: Entrada, Saída, Ajuste (define o valor absoluto).
 *
 * Props:
 *   sku        : objeto SKU atual
 *   open       : boolean
 *   onClose    : fn
 *   onConfirm  : (skuId, { type, qty, reason }) => Promise
 */

import React, { useState, useEffect } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, RefreshCw } from 'lucide-react'
import { Modal, Button, Input } from '@aura/ui'
import { MOVEMENT_TYPES } from '../inventoryTypes.js'

const TABS = [
  { type: MOVEMENT_TYPES.IN,  icon: ArrowDownToLine,    label: 'Entrada', color: 'text-green-600 bg-green-50 dark:bg-green-950' },
  { type: MOVEMENT_TYPES.OUT, icon: ArrowUpFromLine,    label: 'Saída',   color: 'text-red-600   bg-red-50   dark:bg-red-950'   },
  { type: MOVEMENT_TYPES.ADJ, icon: SlidersHorizontal,  label: 'Ajuste',  color: 'text-amber-600 bg-amber-50 dark:bg-amber-950' },
]

const REASON_OPTIONS = {
  [MOVEMENT_TYPES.IN]:  ['Compra de fornecedor', 'Devolução de cliente', 'Transferência', 'Outro'],
  [MOVEMENT_TYPES.OUT]: ['Venda atacado', 'Perda / avaria', 'Transferência', 'Outro'],
  [MOVEMENT_TYPES.ADJ]: ['Inventário físico', 'Correção de sistema', 'Outro'],
}

export function MovementModal({ sku, open, onClose, onConfirm }) {
  const [type,    setType]    = useState(MOVEMENT_TYPES.IN)
  const [qty,     setQty]     = useState('')
  const [reason,  setReason]  = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (open) {
      setType(MOVEMENT_TYPES.IN)
      setQty('')
      setReason('')
      setError('')
    }
  }, [open, sku?.id])

  /* Calcula estoque resultante para preview */
  const qtyNum = Number(qty) || 0
  const projected =
    type === MOVEMENT_TYPES.IN  ? (sku?.stock ?? 0) + qtyNum
  : type === MOVEMENT_TYPES.OUT ? (sku?.stock ?? 0) - qtyNum
  : qtyNum  // ajuste: define absoluto

  const projectedValid = projected >= 0

  const handleConfirm = async () => {
    if (!qty || qtyNum <= 0)     { setError('Informe uma quantidade válida.'); return }
    if (!reason.trim())          { setError('Informe o motivo.'); return }
    if (type === MOVEMENT_TYPES.OUT && qtyNum > (sku?.stock ?? 0)) {
      setError('Quantidade maior que o estoque atual.')
      return
    }
    setError('')
    setSaving(true)
    try {
      await onConfirm(sku.id, { type, qty: qtyNum, reason: reason.trim() })
      onClose()
    } catch (e) {
      setError(e.message ?? 'Erro ao salvar movimentação.')
    } finally {
      setSaving(false)
    }
  }

  if (!sku) return null

  const attrStr = Object.entries(sku.attributes ?? {})
    .map(([k, v]) => `${k}: ${v}`).join(' · ')

  return (
    <Modal open={open} onOpenChange={v => !v && onClose()}>
      <Modal.Content title="Movimentação de estoque" size="sm">
        <div className="space-y-5 py-1">

          {/* Info do SKU */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3">
            <p className="text-xs font-mono text-[var(--color-text-muted)]">{sku.code}</p>
            <p className="text-sm font-semibold text-[var(--color-text)] mt-0.5">{sku.productName}</p>
            {attrStr && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{attrStr}</p>}
            <div className="flex items-center gap-4 mt-2 pt-2 border-t border-[var(--color-border)]">
              <div>
                <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Atual</p>
                <p className="text-lg font-bold text-[var(--color-text)]">{sku.stock}</p>
              </div>
              <div className="text-[var(--color-text-disabled)]">→</div>
              <div>
                <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Resultado</p>
                <p className={`text-lg font-bold ${
                  !projectedValid ? 'text-[var(--color-error)]'
                  : projected <= sku.stockMin ? 'text-[var(--color-warning)]'
                  : 'text-[var(--color-success)]'
                }`}>
                  {type === MOVEMENT_TYPES.ADJ ? (qty ? projected : '—') : (qty ? projected : '—')}
                </p>
              </div>
            </div>
          </div>

          {/* Tipo de movimentação */}
          <div className="grid grid-cols-3 gap-2">
            {TABS.map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.type}
                  type="button"
                  onClick={() => { setType(tab.type); setQty(''); setError('') }}
                  className={`
                    flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-semibold
                    transition-all duration-150
                    ${type === tab.type
                      ? `border-current ${tab.color}`
                      : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]'
                    }
                  `}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Quantidade */}
          <Input
            label={type === MOVEMENT_TYPES.ADJ ? 'Novo valor de estoque *' : 'Quantidade *'}
            placeholder={type === MOVEMENT_TYPES.ADJ ? 'Valor absoluto' : 'Ex: 10'}
            type="number"
            min="0"
            value={qty}
            onChange={e => { setQty(e.target.value); setError('') }}
          />

          {/* Motivo */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
              Motivo *
            </label>
            <select
              value={reason}
              onChange={e => { setReason(e.target.value); setError('') }}
              className="
                w-full h-10 px-3 rounded-[var(--radius-md)] text-sm mb-2
                bg-[var(--color-bg)] border border-[var(--color-border)]
                text-[var(--color-text)]
                focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]
              "
            >
              <option value="">Selecionar motivo…</option>
              {REASON_OPTIONS[type].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {reason === 'Outro' && (
              <input
                type="text"
                placeholder="Descreva o motivo…"
                onChange={e => setReason(e.target.value)}
                className="
                  w-full h-9 px-3 rounded-[var(--radius-md)] text-sm
                  bg-[var(--color-bg)] border border-[var(--color-border)]
                  text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)]
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]
                "
              />
            )}
          </div>

          {/* Erro */}
          {error && (
            <p className="text-sm text-[var(--color-error)] font-medium">{error}</p>
          )}
        </div>

        <Modal.Footer>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={saving || !projectedValid}>
            {saving
              ? <><RefreshCw size={14} className="animate-spin" /> Salvando…</>
              : 'Confirmar'
            }
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  )
}
