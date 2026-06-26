/**
 * pages/orders/components/OrderForm.jsx
 *
 * Ticket #49:  autosave de rascunho em banco (server-first + localStorage fallback).
 * fix #81:     sort canônico Cor → Tamanho nos SKUs do catálogo.
 * feat:        viewMode lista | grade (toggle em Configurações → Pedidos).
 * Ticket #115: 4 melhorias na tela de Novo Pedido —
 *              1. agrupamento por cor no modo lista (expansível);
 *              2. combobox de cliente com busca por nome / razão social / CNPJ;
 *              3. clientes filtrados por status ativo + acesso do usuário;
 *              4. filtro de produtos também busca em código e variações (cor/tamanho).
 *
 * Props:
 *   open     : boolean
 *   onClose  : fn
 *   onSave   : (payload) => Promise
 *   customers: array
 *   products : array  — cada produto tem .skus[]
 *   skus     : array  — fallback plano
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuth } from '../../../auth/AuthContext.jsx'
import { useOrderDraft } from '../useOrderDraft.js'
import { Search, Trash2, RefreshCw, ChevronDown, ChevronUp, ShoppingCart, Package, X, Save, Cloud, CloudOff, AlertTriangle, LayoutList, LayoutGrid } from 'lucide-react'
import { Modal, Button } from '@aura/ui'
import { ORDER_CHANNEL, fmtBRL, calcOrderTotals } from '../ordersTypes.js'
import { OrderGradeMatrix, hasProductGrid } from './OrderGradeMatrix.jsx'

/* ─── Utilitários de ordenação canônica (fix #81) ─── */
/* Ordem: Cor (alfabética) → Tamanho canônico dentro de cada cor */
const _SZ_CANONICAL = ['PP','P','M','G','GG','XG']
const _SZ_ROWS      = ['Tamanho','tamanho','Size','size','Tam','tam']

function _szKey(v) {
  const s = String(v ?? '').trim()
  if (/^[0-9]+(\.[0-9]+)?$/.test(s)) return 'A' + String(parseFloat(s) + 1e5).padStart(12,'0')
  const i = _SZ_CANONICAL.indexOf(s.toUpperCase())
  return 'B' + (i === -1 ? s.toUpperCase() : String(i).padStart(4,'0'))
}

function sortSkus(skus) {
  return [...skus].sort((a, b) => {
    const aAttr = a.attributes ?? {}
    const bAttr = b.attributes ?? {}
    // Primário: Cor (alfabética)
    const cA = Object.entries(aAttr).find(([k]) => !_SZ_ROWS.includes(k))?.[1] ?? ''
    const cB = Object.entries(bAttr).find(([k]) => !_SZ_ROWS.includes(k))?.[1] ?? ''
    const colorCmp = String(cA).localeCompare(String(cB), 'pt-BR')
    if (colorCmp !== 0) return colorCmp
    // Secundário: Tamanho canônico
    const szA = Object.keys(aAttr).find(k => _SZ_ROWS.includes(k))
    const szB = Object.keys(bAttr).find(k => _SZ_ROWS.includes(k))
    const ka  = szA ? _szKey(aAttr[szA]) : ''
    const kb  = szB ? _szKey(bAttr[szB]) : ''
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })
}

function sortedAttrStr(attributes) {
  return Object.entries(attributes ?? {})
    .sort(([a], [b]) => (_SZ_ROWS.includes(a) ? 1 : 0) - (_SZ_ROWS.includes(b) ? 1 : 0))
    .map(([, v]) => `${v}`)
    .join(' / ')
}

/* ─── Lê/salva preferência de viewMode no localStorage ─── */
function readViewMode() {
  try { return localStorage.getItem('aura_order_view') ?? 'list' } catch { return 'list' }
}
function saveViewMode(mode) {
  try { localStorage.setItem('aura_order_view', mode) } catch {}
}

/* ─── Stock badge ─── */
function StockBadge({ stock, stockMin = 0 }) {
  if (stock <= 0)
    return <span className="text-[10px] font-semibold text-red-600 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded-full">Sem estoque</span>
  if (stockMin > 0 && stock <= stockMin)
    return <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full">{stock} ⚠</span>
  return <span className="text-[10px] font-semibold text-green-600 bg-green-50 dark:bg-green-950/30 px-1.5 py-0.5 rounded-full">{stock} un</span>
}

/* ─── Linha de SKU no catálogo (modo lista) ─── */
function SkuRow({ sku, qty, onQtyChange }) {
  const attrStr = sortedAttrStr(sku.attributes)
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

/* ─── Detecta se o produto tem algum atributo não-tamanho (ex: Cor, Estampa) ─── */
function hasColorAttribute(product) {
  return (product.skus ?? []).some(s => {
    const attrs = s.attributes ?? {}
    return Object.keys(attrs).some(k => !_SZ_ROWS.includes(k))
  })
}

/* ─── Agrupa SKUs por cor (atributo não-tamanho) — ticket #115 ─── */
function groupSkusByColor(skus) {
  const groups = new Map()
  for (const sku of skus) {
    const attrs = sku.attributes ?? {}
    const colorEntry = Object.entries(attrs).find(([k]) => !_SZ_ROWS.includes(k))
    const colorKey = colorEntry ? String(colorEntry[1]) : '—'
    if (!groups.has(colorKey)) groups.set(colorKey, [])
    groups.get(colorKey).push(sku)
  }
  // Ordena grupos por nome da cor, depois ordena tamanhos canônicos dentro
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([color, list]) => ({
      color,
      skus: [...list].sort((a, b) => {
        const szA = Object.keys(a.attributes ?? {}).find(k => _SZ_ROWS.includes(k))
        const szB = Object.keys(b.attributes ?? {}).find(k => _SZ_ROWS.includes(k))
        const ka  = szA ? _szKey(a.attributes[szA]) : ''
        const kb  = szB ? _szKey(b.attributes[szB]) : ''
        return ka < kb ? -1 : ka > kb ? 1 : 0
      }),
    }))
}

/* ─── Grupo de cor expansível (modo lista) — ticket #115 ─── */
function ColorGroup({ color, skus, product, quantities, onQtyChange }) {
  const qtyInColor = skus.reduce((a, s) => a + (quantities[s.id] ?? 0), 0)
  const totalStock = skus.reduce((a, s) => a + (s.stock ?? 0), 0)
  // Default: recolhido. Se já tem item da cor no pedido, começa expandido.
  const [open, setOpen] = useState(qtyInColor > 0)

  // Auto-expande quando um SKU dessa cor recebe o primeiro item
  const prevQtyRef = useRef(qtyInColor)
  useEffect(() => {
    if (prevQtyRef.current === 0 && qtyInColor > 0) setOpen(true)
    prevQtyRef.current = qtyInColor
  }, [qtyInColor])

  return (
    <div className={`rounded-md border ${qtyInColor > 0 ? 'border-blue-200 dark:border-blue-800' : 'border-[var(--color-border)]'} bg-[var(--color-bg-subtle)]/30`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left"
      >
        <span className="text-xs font-semibold text-[var(--color-text)]">{color}</span>
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {skus.length} tam.
        </span>
        <StockBadge stock={totalStock} />
        {qtyInColor > 0 && (
          <span className="text-[10px] font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded-full">
            {qtyInColor} no pedido
          </span>
        )}
        <span className="flex-1" />
        {open
          ? <ChevronUp size={12} className="text-[var(--color-text-muted)] shrink-0" />
          : <ChevronDown size={12} className="text-[var(--color-text-muted)] shrink-0" />}
      </button>
      {open && (
        <div className="px-1 pb-1 space-y-0.5">
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

/* ─── Card de produto no catálogo ─── */
function ProductCard({ product, quantities, onQtyChange, viewMode }) {
  const [open, setOpen] = useState(false)
  const skus       = product.skus ?? []
  const totalStock = skus.reduce((a, s) => a + (s.stock ?? 0), 0)
  const qtyInCart  = skus.reduce((a, s) => a + (quantities[s.id] ?? 0), 0)

  /* Em modo grade: usa matriz se o produto tiver Cor×Tamanho; senão, lista flat */
  const useMatrix = viewMode === 'matrix' && hasProductGrid(product)
  /* Em modo lista: agrupa por cor se o produto tiver atributo não-tamanho (ticket #115) */
  const useColorGroups = viewMode === 'list' && hasColorAttribute(product)

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
        <div className={`border-t border-[var(--color-border)] ${useMatrix ? 'p-2' : 'px-1 pb-2 space-y-1 pt-1.5'}`}>
          {useMatrix ? (
            <OrderGradeMatrix
              product={product}
              quantities={quantities}
              onQtyChange={onQtyChange}
            />
          ) : useColorGroups ? (
            groupSkusByColor(skus).map(g => (
              <ColorGroup key={g.color} color={g.color} skus={g.skus}
                product={product} quantities={quantities} onQtyChange={onQtyChange} />
            ))
          ) : (
            sortSkus(skus).map(sku => (
              <SkuRow key={sku.id} sku={sku}
                qty={quantities[sku.id] ?? 0}
                onQtyChange={qty => onQtyChange(sku, qty, product)} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Item no carrinho ─── */
function CartItem({ item, onRemove, onQtyChange }) {
  const attrStr = sortedAttrStr(item.attributes)
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

/* ─── Indicador de status do rascunho ─── */
function DraftStatus({ status, lastSavedAt }) {
  if (status === 'saving')
    return <span className="inline-flex items-center gap-1 text-[10px] text-blue-500"><RefreshCw size={10} className="animate-spin" /> Salvando…</span>
  if (status === 'saved' && lastSavedAt)
    return <span className="inline-flex items-center gap-1 text-[10px] text-green-600"><Cloud size={10} /> Salvo {lastSavedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
  if (status === 'offline')
    return <span className="inline-flex items-center gap-1 text-[10px] text-amber-500"><CloudOff size={10} /> Salvo localmente</span>
  return null
}

/* ─── Banner de retomar rascunho ─── */
function DraftBanner({ draft, onResume, onDiscard }) {
  const when = draft?.updatedAt ? new Date(draft.updatedAt) : null
  const timeStr = when
    ? when.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : ''
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30">
      <AlertTriangle size={16} className="text-amber-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-text)]">Pedido em andamento encontrado</p>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          {draft.items?.length ?? 0} item{(draft.items?.length ?? 0) !== 1 ? 's' : ''}
          {draft.customerName ? ` · ${draft.customerName}` : ''}
          {timeStr ? ` · ${timeStr}` : ''}
        </p>
      </div>
      <button type="button" onClick={onDiscard}
        className="h-7 px-3 rounded-lg text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-red-300 hover:text-red-500 transition-colors">
        Descartar
      </button>
      <Button size="sm" onClick={onResume}>Retomar</Button>
    </div>
  )
}

/* ─── Combobox de cliente com busca por nome / razão social / CNPJ — ticket #115 ─── */
function fmtDoc(doc, personType) {
  if (!doc) return ''
  const d = String(doc).replace(/\D/g, '')
  if (personType === 'pj' || d.length === 14) {
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5')
  }
  if (d.length === 11) {
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2}).*/, '$1.$2.$3-$4')
  }
  return doc
}

function CustomerCombobox({ customers, value, onChange, error, disabled = false }) {
  const [open, setOpen]           = useState(false)
  const [query, setQuery]         = useState('')
  const [highlight, setHighlight] = useState(0)
  const wrapperRef = useRef(null)
  const inputRef   = useRef(null)
  const listRef    = useRef(null)

  const selected = useMemo(
    () => customers.find(c => c.id === value) ?? null,
    [customers, value]
  )

  /* Fecha ao clicar fora */
  useEffect(() => {
    function onClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return customers
    const qDigits = q.replace(/\D/g, '')
    return customers.filter(c => {
      const name = (c.name ?? '').toLowerCase()
      if (name.includes(q)) return true
      if (qDigits) {
        const docDigits = String(c.document ?? '').replace(/\D/g, '')
        if (docDigits.includes(qDigits)) return true
      }
      return false
    })
  }, [customers, query])

  useEffect(() => { setHighlight(0) }, [query])

  /* Mantém highlight visível */
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.querySelector(`[data-idx="${highlight}"]`)
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [highlight, open])

  function selectItem(c) {
    onChange(c)
    setQuery('')
    setOpen(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      setHighlight(h => Math.min(filtered.length - 1, h + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(0, h - 1))
    } else if (e.key === 'Enter') {
      if (open && filtered[highlight]) {
        e.preventDefault()
        selectItem(filtered[highlight])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
      inputRef.current?.blur()
    }
  }

  function clear(e) {
    e.stopPropagation()
    onChange(null)
    setQuery('')
    inputRef.current?.focus()
  }

  const displayValue = open ? query : (selected?.name ?? '')
  const placeholder = customers.length === 0
    ? 'Nenhum cliente disponível'
    : 'Buscar por nome, razão social ou CNPJ…'

  return (
    <div ref={wrapperRef} className="relative">
      <div className={`flex items-center w-full h-9 rounded-lg bg-[var(--color-bg)] border focus-within:ring-2 focus-within:ring-[var(--color-primary)] ${error ? 'border-red-500' : 'border-[var(--color-border)]'} ${disabled ? 'opacity-50' : ''}`}>
        <Search size={12} className="ml-3 text-[var(--color-text-muted)] shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          placeholder={placeholder}
          disabled={disabled || customers.length === 0}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onKeyDown={handleKeyDown}
          className="flex-1 h-full px-2 bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)] focus:outline-none disabled:cursor-not-allowed"
        />
        {selected && !open && !disabled && (
          <button type="button" onClick={clear} aria-label="Limpar cliente"
            className="mr-1 w-5 h-5 flex items-center justify-center rounded text-[var(--color-text-muted)] hover:text-red-500">
            <X size={12} />
          </button>
        )}
        <button type="button" onClick={() => { if (!disabled) { setOpen(o => !o); inputRef.current?.focus() } }} aria-label="Abrir lista"
          className="mr-2 w-5 h-5 flex items-center justify-center text-[var(--color-text-muted)]">
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {open && customers.length > 0 && (
        <div ref={listRef}
          className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[var(--color-text-muted)]">Nenhum cliente encontrado.</div>
          ) : filtered.map((c, idx) => (
            <button
              type="button"
              key={c.id}
              data-idx={idx}
              onMouseEnter={() => setHighlight(idx)}
              onClick={() => selectItem(c)}
              className={`w-full text-left px-3 py-2 transition-colors ${
                idx === highlight ? 'bg-[var(--color-bg-subtle)]' : 'hover:bg-[var(--color-bg-subtle)]'
              } ${c.id === value ? 'border-l-2 border-[var(--color-primary)]' : ''}`}
            >
              <p className="text-sm text-[var(--color-text)] truncate">{c.name}</p>
              {c.document && (
                <p className="text-[10px] font-mono text-[var(--color-text-muted)]">{fmtDoc(c.document, c.personType)}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Form principal ─── */
const EMPTY_FORM = { customerId: '', customerName: '', customerWhatsapp: '', channel: ORDER_CHANNEL.MANUAL, notes: '' }

export function OrderForm({ open, onClose, onSave, customers = [], skus = [], products = [] }) {
  const { user } = useAuth()
  const { draft: serverDraft, status: draftStatus, lastSavedAt, load: loadDraft, save: saveDraft, discard: discardDraft, clearLocal } = useOrderDraft()

  const [form,         setForm]        = useState(EMPTY_FORM)
  const [items,        setItems]       = useState([])
  const [qtys,         setQtys]        = useState({})
  const [search,       setSearch]      = useState('')
  const [saving,       setSaving]      = useState(false)
  const [errors,       setErrors]      = useState({})
  const [showBanner,   setShowBanner]  = useState(false)
  const [pendingDraft, setPendingDraft] = useState(null)

  /* Preferência de viewMode persistida em localStorage */
  const [viewMode, setViewMode] = useState(readViewMode)

  const toggleViewMode = useCallback(() => {
    setViewMode(prev => {
      const next = prev === 'list' ? 'matrix' : 'list'
      saveViewMode(next)
      return next
    })
  }, [])

  const hasContent = items.length > 0 || form.customerId

  /* ── Clientes acessíveis: ativos + filtro de acesso do usuário (ticket #115) ──
   * Regra:
   *   - admin: vê todos os clientes ativos
   *   - não-admin com customerIds configurado: vê só os vinculados (e ativos)
   *   - não-admin sem customerIds: sem restrição (vê todos os ativos)
   * Isso preserva compat com usuários legados sem vínculo configurado.
   */
  const accessibleCustomers = useMemo(() => {
    const isAdmin   = (user?.roles ?? []).includes('admin')
    const linkedIds = user?.customerIds ?? []
    return (customers ?? []).filter(c => {
      if (c.status !== 'ativo') return false
      if (isAdmin) return true
      if (linkedIds.length === 0) return true
      return linkedIds.includes(c.id)
    })
  }, [customers, user])

  /* ── Ao abrir o modal: carrega draft do servidor ── */
  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function init() {
      setForm(EMPTY_FORM)
      setItems([])
      setQtys({})
      setErrors({})
      setSearch('')
      setShowBanner(false)
      setPendingDraft(null)

      // Se o usuário só tem 1 cliente acessível, pré-seleciona automaticamente.
      if (accessibleCustomers.length === 1) {
        const cust = accessibleCustomers[0]
        setForm({ ...EMPTY_FORM, customerId: cust.id, customerName: cust.name, customerWhatsapp: cust.whatsapp ?? '' })
      }

      const draft = await loadDraft()
      if (cancelled) return
      if (draft && (draft.items?.length > 0 || draft.customerId)) {
        setPendingDraft(draft)
        setShowBanner(true)
      }
    }
    init()
    return () => { cancelled = true }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleResume = useCallback(() => {
    if (!pendingDraft) return
    const d = pendingDraft
    setForm({
      customerId:       d.customerId ?? '',
      customerName:     d.customerName ?? '',
      customerWhatsapp: d.customerWhatsapp ?? '',
      channel:          d.channel ?? ORDER_CHANNEL.MANUAL,
      notes:            d.notes ?? '',
    })
    setItems(d.items ?? [])
    const q = {}
    for (const item of (d.items ?? [])) { q[item.skuId] = item.qty }
    setQtys(q)
    setShowBanner(false)
    setPendingDraft(null)
  }, [pendingDraft])

  const handleDiscardDraft = useCallback(() => {
    setShowBanner(false)
    setPendingDraft(null)
    discardDraft()
  }, [discardDraft])

  const catalog = useMemo(() => {
    if (products.length) return products
    const map = {}
    skus.forEach(s => {
      const key = s.productName
      if (!map[key]) map[key] = { id: s.id, name: s.productName, code: s.code, category: s.category ?? '', skus: [] }
      map[key].skus.push({ id: s.id, code: s.code, attributes: s.attributes ?? {}, priceWholesale: s.priceWholesale ?? 0, stock: s.stock ?? 0, stockMin: s.stockMin ?? 0 })
    })
    return Object.values(map)
  }, [products, skus])

  /* ── Filtro de catálogo — agora também busca em código e variações (ticket #115) ── */
  const filteredCatalog = useMemo(() => {
    if (!search.trim()) return catalog
    const q = search.toLowerCase()
    return catalog.filter(p =>
      (p.name ?? '').toLowerCase().includes(q) ||
      (p.category ?? '').toLowerCase().includes(q) ||
      (p.skus ?? []).some(s =>
        (s.code ?? '').toLowerCase().includes(q) ||
        Object.values(s.attributes ?? {}).some(v => String(v).toLowerCase().includes(q))
      )
    )
  }, [catalog, search])

  const handleCustomerChange = useCallback((cust) => {
    setForm(prev => ({
      ...prev,
      customerId:       cust?.id ?? '',
      customerName:     cust?.name ?? '',
      customerWhatsapp: cust?.whatsapp ?? '',
    }))
    if (cust) setErrors(prev => ({ ...prev, customer: undefined }))
  }, [])

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

  const prevPayloadRef = useRef('')
  useEffect(() => {
    if (!open || showBanner) return
    if (!hasContent) return
    const payload    = { ...form, items }
    const serialized = JSON.stringify(payload)
    if (serialized === prevPayloadRef.current) return
    prevPayloadRef.current = serialized
    saveDraft(payload)
  }, [form, items, open, showBanner, hasContent, saveDraft])

  const { subtotal } = calcOrderTotals(items)

  const handleSubmit = async () => {
    const errs = {}
    if (!form.customerId) errs.customer = 'Selecione um cliente.'
    if (!items.length)    errs.items    = 'Adicione pelo menos 1 item.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      await onSave({ ...form, items })
      clearLocal()
      onClose()
    } catch (e) {
      setErrors(prev => ({ ...prev, submit: e.message || 'Erro ao criar pedido.' }))
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onOpenChange={v => !v && onClose()}>
      <Modal.Content title="Novo pedido" size="xl">
        <div className="flex flex-col gap-4 py-1">

          {showBanner && pendingDraft && (
            <DraftBanner draft={pendingDraft} onResume={handleResume} onDiscard={handleDiscardDraft} />
          )}

          {/* Cliente + Canal */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Cliente *</label>
              <CustomerCombobox
                customers={accessibleCustomers}
                value={form.customerId}
                onChange={handleCustomerChange}
                error={errors.customer}
              />
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

          {/* Dois painéis */}
          <div className="grid grid-cols-[1fr_300px] gap-4 min-h-[400px] max-h-[480px]">

            {/* Painel esquerdo: catálogo */}
            <div className="flex flex-col gap-2 min-h-0">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide shrink-0">Produtos</label>
                <div className="relative flex-1">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, código ou variação…"
                    className="w-full h-7 pl-7 pr-3 rounded-lg text-xs bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" />
                </div>
                {/* Toggle lista / grade */}
                <button
                  type="button"
                  onClick={toggleViewMode}
                  title={viewMode === 'list' ? 'Mudar para grade' : 'Mudar para lista'}
                  className={`shrink-0 h-7 w-7 flex items-center justify-center rounded-lg border transition-colors ${
                    viewMode === 'matrix'
                      ? 'border-[var(--color-primary)] bg-blue-50 dark:bg-blue-950/30 text-[var(--color-primary)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]'
                  }`}
                >
                  {viewMode === 'matrix' ? <LayoutGrid size={13} /> : <LayoutList size={13} />}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {filteredCatalog.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <Package size={24} className="text-[var(--color-text-muted)] mb-2 opacity-40" />
                    <p className="text-xs text-[var(--color-text-muted)]">{search ? 'Nenhum produto encontrado.' : 'Nenhum produto disponível.'}</p>
                  </div>
                ) : filteredCatalog.map(product => (
                  <ProductCard key={product.id} product={product}
                    quantities={qtys} onQtyChange={handleQtyChange}
                    viewMode={viewMode} />
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
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    {viewMode === 'matrix' ? 'Preencha a grade ao lado' : 'Ajuste as quantidades ao lado para adicionar itens'}
                  </p>
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
          <div className="flex items-center gap-3 w-full">
            <DraftStatus status={draftStatus} lastSavedAt={lastSavedAt} />
            {hasContent && !showBanner && (
              <button type="button" onClick={handleDiscardDraft}
                className="text-[10px] text-[var(--color-text-muted)] hover:text-red-500 transition-colors underline underline-offset-2">
                Descartar rascunho
              </button>
            )}
            <div className="flex-1" />
            {errors.submit && <p className="text-xs text-red-500 text-right">{errors.submit}</p>}
            <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving
                ? <><RefreshCw size={14} className="animate-spin" /> Criando…</>
                : `Criar pedido${items.length ? ' · ' + fmtBRL(subtotal) : ''}`}
            </Button>
          </div>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  )
}
