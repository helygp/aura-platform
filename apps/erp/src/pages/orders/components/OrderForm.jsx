/**
 * pages/orders/components/OrderForm.jsx
 *
 * Modal de criação manual de pedido.
 *
 * Fluxo:
 *   1. Selecionar cliente (dropdown + busca)
 *   2. Adicionar itens: selecionar SKU → qty → adiciona linha
 *   3. Obs opcionais
 *   4. Resumo + confirmar
 *
 * Props:
 *   open         : boolean
 *   onClose      : fn
 *   onSave       : (payload) => Promise
 *   customers    : array
 *   skus         : array
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, RefreshCw, Search } from 'lucide-react'
import { Modal, Button, Input } from '@aura/ui'
import { ORDER_CHANNEL, fmtBRL, calcOrderTotals } from '../ordersTypes.js'

/* ─── Linha de item no formulário ─── */
function ItemRow({ item, onQtyChange, onRemove }) {
  const attrStr = Object.values(item.attributes ?? {}).join(' / ')
  return (
    <div className="flex items-center gap-2 py-2 border-b border-[var(--color-border)] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-text)] truncate">{item.productName}</p>
        <div className="flex items-center gap-2">
          {attrStr && <span className="text-xs text-[var(--color-text-muted)]">{attrStr}</span>}
          <span className="text-[10px] font-mono text-[var(--color-text-disabled)]">{item.skuCode}</span>
        </div>
        <p className="text-xs text-[var(--color-primary)] mt-0.5">{fmtBRL(item.priceUnit)} / un</p>
      </div>
      {/* Qty stepper */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onQtyChange(Math.max(1, item.qty - 1))}
          className="w-7 h-7 rounded-lg border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors text-sm font-bold"
        >−</button>
        <input
          type="number"
          min="1"
          value={item.qty}
          onChange={e => onQtyChange(Math.max(1, Number(e.target.value) || 1))}
          className="w-12 h-7 text-center text-sm font-semibold rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
        />
        <button
          type="button"
          onClick={() => onQtyChange(item.qty + 1)}
          className="w-7 h-7 rounded-lg border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors text-sm font-bold"
        >+</button>
      </div>
      {/* Subtotal */}
      <div className="text-right min-w-[72px] shrink-0">
        <p className="text-sm font-bold text-[var(--color-text)]">{fmtBRL(item.priceUnit * item.qty)}</p>
      </div>
      {/* Remover */}
      <button
        type="button"
        onClick={onRemove}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors shrink-0"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

/* ─── SKU picker ─── */
function SkuPicker({ skus, onAdd, addedIds }) {
  const [search, setSearch] = useState('')
  const filtered = skus.filter(s =>
    s.code.toLowerCase().includes(search.toLowerCase()) ||
    s.productName.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar produto/SKU…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-8 pl-7 pr-3 rounded-lg text-sm bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
        />
      </div>
      <div className="max-h-[180px] overflow-y-auto rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
        {filtered.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)] p-3 text-center">Nenhum SKU encontrado</p>
        ) : filtered.map(sku => {
          const added = addedIds.has(sku.id)
          const attrStr = Object.values(sku.attributes ?? {}).join(' / ')
          return (
            <button
              key={sku.id}
              type="button"
              onClick={() => !added && onAdd(sku)}
              disabled={added}
              className={`
                w-full flex items-center justify-between gap-3 px-3 py-2
                text-left text-sm transition-colors
                ${added
                  ? 'opacity-40 cursor-not-allowed bg-[var(--color-bg-subtle)]'
                  : 'hover:bg-[var(--color-surface)] cursor-pointer'
                }
              `}
            >
              <div className="min-w-0">
                <p className="font-medium text-[var(--color-text)] truncate">{sku.productName}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{sku.code}{attrStr ? ' · ' + attrStr : ''}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-semibold text-[var(--color-text)]">{fmtBRL(sku.priceWholesale)}</p>
                {added ? (
                  <span className="text-[10px] text-green-600">Adicionado</span>
                ) : (
                  <span className="text-[10px] text-[var(--color-primary)]"><Plus size={10} className="inline" /> Adicionar</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const EMPTY_FORM = { customerId: '', customerName: '', customerWhatsapp: '', channel: ORDER_CHANNEL.MANUAL, notes: '' }

export function OrderForm({ open, onClose, onSave, customers = [], skus = [] }) {
  const [form,   setForm]   = useState(EMPTY_FORM)
  const [items,  setItems]  = useState([])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [showPicker, setShowPicker] = useState(false)

  useEffect(() => {
    if (open) { setForm(EMPTY_FORM); setItems([]); setErrors({}); setShowPicker(false) }
  }, [open])

  const addedIds = new Set(items.map(i => i.skuId))

  const handleCustomerChange = (e) => {
    const cust = customers.find(c => c.id === e.target.value)
    setForm(prev => ({
      ...prev,
      customerId:        cust?.id ?? '',
      customerName:      cust?.name ?? '',
      customerWhatsapp:  cust?.whatsapp ?? '',
    }))
  }

  const addItem = useCallback((sku) => {
    setItems(prev => [...prev, {
      id:          `tmp-${Date.now()}`,
      skuId:       sku.id,
      skuCode:     sku.code,
      productName: sku.productName,
      attributes:  sku.attributes,
      qty:         1,
      priceUnit:   sku.priceWholesale,
    }])
  }, [])

  const updateQty = (idx, qty) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, qty } : it))

  const removeItem = (idx) =>
    setItems(prev => prev.filter((_, i) => i !== idx))

  const { subtotal } = calcOrderTotals(items)

  const validate = () => {
    const errs = {}
    if (!form.customerId) errs.customer = 'Selecione um cliente.'
    if (!items.length)    errs.items = 'Adicione pelo menos 1 item.'
    return errs
  }

  const handleSubmit = async () => {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      await onSave({ ...form, items })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onOpenChange={v => !v && onClose()}>
      <Modal.Content title="Novo pedido" description="Crie um pedido manual para um cliente" size="lg">
        <div className="space-y-5 py-1">

          {/* ── Cliente ── */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
              Cliente *
            </label>
            <select
              value={form.customerId}
              onChange={handleCustomerChange}
              className={`
                w-full h-10 px-3 rounded-[var(--radius-md)] text-sm
                bg-[var(--color-bg)] border text-[var(--color-text)]
                focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]
                ${errors.customer ? 'border-[var(--color-error)]' : 'border-[var(--color-border)]'}
              `}
            >
              <option value="">Selecionar cliente…</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.customer && <p className="text-xs text-[var(--color-error)] mt-1">{errors.customer}</p>}
          </div>

          {/* ── Canal ── */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Canal de origem</label>
            <div className="flex gap-2">
              {Object.values(ORDER_CHANNEL).map(ch => {
                const meta = { manual: 'Manual ✏️', whatsapp: 'WhatsApp 💬', loja: 'Loja 🛒' }
                return (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, channel: ch }))}
                    className={`
                      flex-1 h-9 rounded-lg text-xs font-medium border transition-colors
                      ${form.channel === ch
                        ? 'border-[var(--color-primary)] bg-blue-50 text-[var(--color-primary)] dark:bg-blue-950'
                        : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]'
                      }
                    `}
                  >
                    {meta[ch]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Itens ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[var(--color-text)]">Itens *</label>
              <button
                type="button"
                onClick={() => setShowPicker(p => !p)}
                className="flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
              >
                <Plus size={12} /> Adicionar item
              </button>
            </div>
            {errors.items && <p className="text-xs text-[var(--color-error)] mb-2">{errors.items}</p>}

            {showPicker && (
              <div className="mb-3">
                <SkuPicker skus={skus} onAdd={(sku) => { addItem(sku); setErrors(p => ({ ...p, items: undefined })) }} addedIds={addedIds} />
              </div>
            )}

            {items.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-[var(--color-border)] p-6 text-center">
                <p className="text-sm text-[var(--color-text-muted)]">Nenhum item adicionado.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--color-border)] px-3">
                {items.map((item, idx) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onQtyChange={qty => updateQty(idx, qty)}
                    onRemove={() => removeItem(idx)}
                  />
                ))}
                <div className="flex justify-between items-center py-2.5 text-sm font-bold text-[var(--color-text)]">
                  <span>Total</span>
                  <span>{fmtBRL(subtotal)}</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Observações ── */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Observações</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Ex: Entregar na portaria, urgente…"
              rows={2}
              className="
                w-full px-3 py-2 rounded-[var(--radius-md)] text-sm resize-none
                bg-[var(--color-bg)] border border-[var(--color-border)]
                text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)]
                focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]
              "
            />
          </div>

        </div>

        <Modal.Footer>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving
              ? <><RefreshCw size={14} className="animate-spin" /> Criando…</>
              : `Criar pedido${items.length ? ' · ' + fmtBRL(subtotal) : ''}`
            }
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  )
}
