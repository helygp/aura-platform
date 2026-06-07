/**
 * pages/orders/components/OrderForm.jsx
 *
 * Novo conceito (T5.1): dois painéis lado a lado.
 *   Esquerda: catálogo de produtos com busca — cards expansíveis por produto
 *             mostrando SKUs inline com estoque + stepper de quantidade.
 *   Direita:  carrinho + cliente + canal + obs + submit.
 *
 * Props:
 *   open     : boolean
 *   onClose  : fn
 *   onSave   : (payload) => Promise
 *   customers: array
 *   products : array  — cada produto tem .skus[]
 *   skus     : array  — fallback plano
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../../auth/AuthContext.jsx'
import { Search, Trash2, RefreshCw, ChevronDown, ChevronUp, ShoppingCart, Package, X } from 'lucide-react'
import { Modal, Button } from '@aura/ui'
import { ORDER_CHANNEL, fmtBRL, calcOrderTotals } from '../ordersTypes.js'

/* ─── Stock badge ─── */
function StockBadge({ stock, stockMin = 0 }) {
  if (stock <= 0)
    return <span className="text-[10px] font-semibold text-red-600 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded-full">Sem estoque</span>
  if (stockMin > 0 && stock <= stockMin)
    return <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full">{stock} ⚠</span>
  return <span className="text-[10px] font-semibold text-green-600 bg-green-50 dark:bg-green-950/30 px-1.5 py-0.5 rounded-full">{stock} un</span>
}

/* ─── Linha de SKU no catálogo ─── */
function SkuRow({ sku, qty, onQtyChange }) {
  const attrStr = Object.entries(sku.attributes ?? {})
    .map(([k, v]) => `${v}`)
    .join(' / ')
  const noStock = (sku.stock ?? 0) <= 0

  return (
    <div className={`flex items-center gap-2 py-2 px-3 rounded-lg transition-colors ${qty > 0 ? 'bg-blue-50 dark:bg-blue-950/20' : 'hover:bg-[var(--color-bg-subtle)]'} ${noStock ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {attrStr && <span className="text-xs font-medium text-[var(--color-text)]">{attrStr}</span>}
          <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{sku.code}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <StockBadge stock={sku.stock ?? 0} stockMin={sku.stockMin} />
          <span className="text-[10px] text-[var(--color-text-muted)]">{fmtBRL(sku.priceWholesale ?? sku.price_wholesale ?? 0)}/un</span>
        </div>
      </div>
      {/* Qty stepper */}
      <div className="flex items-center gap-1 shrink-0">
        <button type="button" disabled={noStock || qty <= 0}
          onClick={() => onQtyChange(Math.max(0, qty - 1))}
          className="w-6 h-6 rounded border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] disabled:opacity-30 text-sm font-bold transition-colors">
          −
        </button>
        <input type="number" min="0" max={sku.stock ?? 999} value={qty}
          disabled={noStock}
          onChange={e => onQtyChange(Math.max(0, Math.min(sku.stock ?? 999, Number(e.target.value) || 0)))}
          className="w-10 h-6 text-center text-xs font-semibold rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] disabled:opacity-30"
        />
        <button type="button" disabled={noStock || qty >= (sku.stock ?? 999)}
          onClick={() => onQtyChange(Math.min(sku.stock ?? 999, qty + 1))}
          className="w-6 h-6 rounded border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] disabled:opacity-30 text-sm font-bold transition-colors">
          +
        </button>
      </div>
    </div>
  )
}

/* ─── Card de produto no catálogo ─── */
function ProductCard({ product, quantities, onQtyChange }) {
  const [open, setOpen] = useState(false)
  const skus = product.skus ?? []
  const totalStock = skus.reduce((a, s) => a + (s.stock ?? 0), 0)
  const qtyInCart  = skus.reduce((a, s) => a + (quantities[s.id] ?? 0), 0)

  return (
    <div className={`rounded-xl border transition-colors ${qtyInCart > 0 ? 'border-blue-300 dark:border-blue-700' : 'border-[var(--color-border)]'} bg-[var(--color-bg)]`}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-surface)] flex items-center justify-center shrink-0">
          <Package size={14} className="text-[var(--color-text-muted)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--color-text)] truncate">{product.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {product.category && <span className="text-[10px] text-[var(--color-text-muted)]">{product.category}</span>}
            <span className="text-[10px] text-[var(--color-text-muted)]">{skus.length} SKU{skus.length !== 1 ? 's' : ''}</span>
            <StockBadge stock={totalStock} />
          </div>
        </div>
        {qtyInCart > 0 && (
          <span className="shrink-0 text-xs font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">
            {qtyInCart} no pedido
          </span>
        )}
        {open ? <ChevronUp size={14} className="shrink-0 text-[var(--color-text-muted)]" />
               : <ChevronDown size={14} className="shrink-0 text-[var(--color-text-muted)]" />}
      </button>

      {open && skus.length > 0 && (
        <div className="px-1 pb-2 border-t border-[var(--color-border)] space-y-0.5 pt-1.5">
          {skus.map(sku => (
            <SkuRow key={sku.id} sku={sku}
              qty={quantities[sku.id] ?? 0}
              onQtyChange={qty => onQtyChange(sku, qty, product)} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Item no carrinho ─── */
function CartItem({ item, onRemove, onQtyChange }) {
  const attrStr = Object.values(item.attributes ?? {}).join(' / ')
  return (
    <div className="flex items-center gap-2 py-2 border-b border-[var(--color-border)] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[var(--color-text)] truncate">{item.productName}</p>
        {attrStr && <p className="text-[10px] text-[var(--color-text-muted)]">{attrStr}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button type="button" onClick={() => onQtyChange(Math.max(1, item.qty - 1))}
          className="w-5 h-5 rounded border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] text-xs font-bold">−</button>
        <span className="w-6 text-center text-xs font-semibold text-[var(--color-text)]">{item.qty}</span>
        <button type="button" onClick={() => onQtyChange(item.qty + 1)}
          className="w-5 h-5 rounded border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] text-xs font-bold">+</button>
      </div>
      <span className="text-xs font-semibold text-[var(--color-text)] min-w-[52px] text-right">
        {fmtBRL(item.priceUnit * item.qty)}
      </span>
      <button type="button" onClick={onRemove}
        className="w-5 h-5 flex items-center justify-center rounded text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
        <X size={11} />
      </button>
    </div>
  )
}

/* ─── Form principal ─── */
const EMPTY_FORM = { customerId: '', customerName: '', customerWhatsapp: '', channel: ORDER_CHANNEL.MANUAL, notes: '' }

export function OrderForm({ open, onClose, onSave, customers = [], skus = [], products = [] }) {
  const { user } = useAuth()
  const [form,    setForm]    = useState(EMPTY_FORM)
  const [items,   setItems]   = useState([])         // carrinho: [{skuId, skuCode, productName, attributes, qty, priceUnit}]
  const [qtys,    setQtys]    = useState({})          // skuId → qty no catálogo
  const [search,  setSearch]  = useState('')
  const [saving,  setSaving]  = useState(false)
  const [errors,  setErrors]  = useState({})

  useEffect(() => {
    if (open) {
      const linkedIds = user?.customerIds ?? []
      let preselect = EMPTY_FORM
      if (linkedIds.length === 1) {
        const cust = customers.find(c => c.id === linkedIds[0])
        if (cust) preselect = { ...EMPTY_FORM, customerId: cust.id, customerName: cust.name, customerWhatsapp: cust.whatsapp ?? '' }
      }
      setForm(preselect)
      setItems([]); setQtys({}); setErrors({}); setSearch('')
    }
  }, [open, user, customers])

  // Normaliza produtos — garante que products[] tem a estrutura certa
  const catalog = useMemo(() => {
    if (products.length) return products
    // fallback: reconstrói a partir de skus planos
    const map = {}
    skus.forEach(s => {
      const key = s.productName
      if (!map[key]) map[key] = { id: s.id, name: s.productName, code: s.code, category: s.category ?? '', skus: [] }
      map[key].skus.push({ id: s.id, code: s.code, attributes: s.attributes ?? {}, priceWholesale: s.priceWholesale ?? 0, stock: s.stock ?? 0, stockMin: s.stockMin ?? 0 })
    })
    return Object.values(map)
  }, [products, skus])

  const filteredCatalog = useMemo(() => {
    if (!search.trim()) return catalog
    const q = search.toLowerCase()
    return catalog.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p.skus?.some(s => s.code.toLowerCase().includes(q))
    )
  }, [catalog, search])

  const handleCustomerChange = (e) => {
    const cust = customers.find(c => c.id === e.target.value)
    setForm(prev => ({ ...prev, customerId: cust?.id ?? '', customerName: cust?.name ?? '', customerWhatsapp: cust?.whatsapp ?? '' }))
  }

  // Atualiza qty no catálogo e sincroniza com o carrinho
  const handleQtyChange = useCallback((sku, newQty, product) => {
    setQtys(prev => ({ ...prev, [sku.id]: newQty }))
    setItems(prev => {
      const exists = prev.find(it => it.skuId === sku.id)
      if (newQty <= 0) return prev.filter(it => it.skuId !== sku.id)
      if (exists) return prev.map(it => it.skuId === sku.id ? { ...it, qty: newQty } : it)
      return [...prev, {
        id:          `tmp-${sku.id}`,
        skuId:       sku.id,
        skuCode:     sku.code,
        productName: product.name,
        attributes:  sku.attributes ?? {},
        qty:         newQty,
        priceUnit:   sku.priceWholesale ?? sku.price_wholesale ?? 0,
      }]
    })
    setErrors(p => ({ ...p, items: undefined }))
  }, [])

  const removeFromCart = (skuId) => {
    setItems(prev => prev.filter(it => it.skuId !== skuId))
    setQtys(prev => ({ ...prev, [skuId]: 0 }))
  }

  const updateCartQty = (skuId, qty) => {
    setItems(prev => prev.map(it => it.skuId === skuId ? { ...it, qty } : it))
    setQtys(prev => ({ ...prev, [skuId]: qty }))
  }

  const { subtotal } = calcOrderTotals(items)

  const handleSubmit = async () => {
    const errs = {}
    if (!form.customerId) errs.customer = 'Selecione um cliente.'
    if (!items.length)    errs.items    = 'Adicione pelo menos 1 item.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      await onSave({ ...form, items })
      onClose()
    } catch (e) {
      setErrors(prev => ({ ...prev, submit: e.message || 'Erro ao criar pedido.' }))
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onOpenChange={v => !v && onClose()}>
      <Modal.Content title="Novo pedido" size="xl">
        <div className="flex flex-col gap-4 py-1">

          {/* ── Linha superior: cliente + canal ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Cliente *</label>
              <select value={form.customerId} onChange={handleCustomerChange}
                className={`w-full h-9 px-3 rounded-lg text-sm bg-[var(--color-bg)] border text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${errors.customer ? 'border-red-500' : 'border-[var(--color-border)]'}`}>
                <option value="">Selecionar…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.customer && <p className="text-[10px] text-red-500 mt-0.5">{errors.customer}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Canal</label>
              <div className="flex gap-1">
                {Object.values(ORDER_CHANNEL).map(ch => {
                  const labels = { manual: '✏️ Manual', whatsapp: '💬 WhatsApp', loja: '🛒 Loja' }
                  return (
                    <button key={ch} type="button" onClick={() => setForm(p => ({ ...p, channel: ch }))}
                      className={`flex-1 h-9 rounded-lg text-xs font-medium border transition-colors ${form.channel === ch ? 'border-[var(--color-primary)] bg-blue-50 dark:bg-blue-950/30 text-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]'}`}>
                      {labels[ch]}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Dois painéis ── */}
          <div className="grid grid-cols-[1fr_300px] gap-4 min-h-[400px] max-h-[480px]">

            {/* Painel esquerdo: catálogo */}
            <div className="flex flex-col gap-2 min-h-0">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide shrink-0">Produtos</label>
                <div className="relative flex-1">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto ou SKU…"
                    className="w-full h-7 pl-7 pr-3 rounded-lg text-xs bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {filteredCatalog.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <Package size={24} className="text-[var(--color-text-muted)] mb-2 opacity-40" />
                    <p className="text-xs text-[var(--color-text-muted)]">{search ? 'Nenhum produto encontrado.' : 'Nenhum produto disponível.'}</p>
                  </div>
                ) : filteredCatalog.map(product => (
                  <ProductCard key={product.id} product={product}
                    quantities={qtys} onQtyChange={handleQtyChange} />
                ))}
              </div>
            </div>

            {/* Painel direito: carrinho */}
            <div className="flex flex-col border-l border-[var(--color-border)] pl-4 min-h-0">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart size={13} className="text-[var(--color-text-muted)]" />
                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Carrinho</label>
                {items.length > 0 && (
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded-full ml-auto">
                    {items.length} item{items.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {errors.items && <p className="text-[10px] text-red-500 mb-1">{errors.items}</p>}

              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 text-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-border)]">
                  <ShoppingCart size={20} className="text-[var(--color-text-muted)] opacity-30" />
                  <p className="text-[11px] text-[var(--color-text-muted)]">Ajuste as quantidades ao lado para adicionar itens</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  {items.map(item => (
                    <CartItem key={item.skuId} item={item}
                      onRemove={() => removeFromCart(item.skuId)}
                      onQtyChange={qty => updateCartQty(item.skuId, qty)} />
                  ))}
                </div>
              )}

              {/* Total + obs */}
              <div className="pt-3 border-t border-[var(--color-border)] mt-2 space-y-2">
                <div className="flex justify-between text-sm font-bold text-[var(--color-text)]">
                  <span>Total</span><span>{fmtBRL(subtotal)}</span>
                </div>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Observações…" rows={2}
                  className="w-full px-2 py-1.5 rounded-lg text-xs resize-none bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" />
              </div>
            </div>
          </div>

        </div>

        <Modal.Footer>
          {errors.submit && <p className="text-xs text-red-500 w-full mb-1 text-center">{errors.submit}</p>}
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving
              ? <><RefreshCw size={14} className="animate-spin" /> Criando…</>
              : `Criar pedido${items.length ? ' · ' + fmtBRL(subtotal) : ''}`}
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  )
}
