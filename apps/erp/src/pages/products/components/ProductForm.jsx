/**
 * pages/products/components/ProductForm.jsx
 *
 * Drawer lateral de cadastro e edição de produto.
 * Mobile: tela cheia. Desktop: 600px fixo à direita.
 *
 * Modo NOVO:
 *   Aba única — dados básicos + tipo + atributos (se grade) + SKUs gerados
 *
 * Modo EDIÇÃO:
 *   Aba "Informações" — nome, código, categoria, foto
 *   Aba "SKUs (N)"    — tabela compacta editável (preço + estoque mín por SKU)
 *
 * Props:
 *   open       : boolean
 *   onClose    : () => void
 *   product    : objeto a editar (null = novo)
 *   onSave     : (data) => Promise<void>
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Upload, X, RefreshCw, Info, ChevronDown } from 'lucide-react'
import { Button, Input, Badge } from '@aura/ui'
import { AttributeBuilder } from './AttributeBuilder.jsx'
import { SkuGrid }           from './SkuGrid.jsx'
import {
  PRODUCT_TYPES, DEFAULT_CATEGORIES,
  generateSkus, validateSimpleProduct, validateVariantProduct,
} from '../productsTypes.js'

/* ── Foto upload ── */
function ImageUpload({ imageUrl, onImageChange }) {
  const inputRef = useRef(null)
  const handleFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => onImageChange(reader.result)
    reader.readAsDataURL(file)
  }
  return (
    <div>
      <p className="text-sm font-medium text-[var(--color-text)] mb-1.5">Foto do produto</p>
      <div
        onClick={() => inputRef.current?.click()}
        className="relative w-full aspect-video max-w-[200px] rounded-xl overflow-hidden border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-subtle)] cursor-pointer hover:border-[var(--color-primary)] hover:bg-[var(--color-surface)] transition-colors flex items-center justify-center"
      >
        {imageUrl ? (
          <>
            <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
            <button type="button" onClick={e => { e.stopPropagation(); onImageChange(null) }}
              className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80">
              <X size={12} />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-[var(--color-text-muted)]">
            <Upload size={20} />
            <span className="text-xs">Clique para enviar</span>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  )
}

/* ── Constantes de ordenação de SKUs ── */
const _FORM_COLS = ['Cor','cor','COLOR','Color','Estampa']
const _FORM_ROWS = ['Tamanho','tamanho','Size','size','Tam','tam']
const _FORM_SZ   = ['PP','P','M','G','GG','XG']

function _formSzKey(v) {
  const s = String(v ?? '').trim()
  const n = Number(s)
  if (!isNaN(n) && s !== '') return 'A' + String(n + 1e5).padStart(12, '0')
  const idx = _FORM_SZ.indexOf(s.toUpperCase())
  return 'B' + (idx === -1 ? s : String(idx).padStart(4, '0'))
}

function sortSkusForDisplay(skus, attrKeys) {
  const colKeys  = attrKeys.filter(k => _FORM_COLS.includes(k))
  const szeKeys  = attrKeys.filter(k => _FORM_ROWS.includes(k))
  const othKeys  = attrKeys.filter(k => !_FORM_COLS.includes(k) && !_FORM_ROWS.includes(k))
  const sortKeys = [...colKeys, ...szeKeys, ...othKeys]
  return [...skus].sort((a, b) => {
    for (const k of sortKeys) {
      const isSz = _FORM_ROWS.includes(k)
      const va   = isSz ? _formSzKey(a.attributes?.[k]) : String(a.attributes?.[k] ?? '')
      const vb   = isSz ? _formSzKey(b.attributes?.[k]) : String(b.attributes?.[k] ?? '')
      const c    = va.localeCompare(vb, 'pt-BR')
      if (c !== 0) return c
    }
    return 0
  })
}

/* ── Tabela compacta de SKUs para EDIÇÃO ── */
function SkuEditTable({ skus, onChange }) {
  const [bulkPrice, setBulkPrice] = React.useState('')
  const [bulkStock, setBulkStock] = React.useState('')
  const [bulkOpen,  setBulkOpen]  = React.useState(false)
  const [confirm,   setConfirm]   = React.useState(null) // { label, onConfirm }

  const updateSku = (index, field, value) => {
    onChange(skus.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  const requestBulkPrice = () => {
    const v = parseFloat(bulkPrice)
    if (!v || v <= 0) return
    const formatted = v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    setConfirm({
      label: `preço de R$ ${formatted}`,
      onConfirm: () => {
        onChange(skus.map(s => ({ ...s, priceWholesale: v })))
        setBulkPrice('')
        setBulkOpen(false)
      },
    })
  }

  const requestBulkStock = () => {
    const v = parseInt(bulkStock)
    if (isNaN(v) || v < 0) return
    setConfirm({
      label: `estoque mínimo de ${v}`,
      onConfirm: () => {
        onChange(skus.map(s => ({ ...s, stockMin: v })))
        setBulkStock('')
        setBulkOpen(false)
      },
    })
  }

  if (!skus?.length) return (
    <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
      Este produto não possui SKUs cadastrados.
    </p>
  )

  // T6.2 — Cor sempre antes de Tamanho, depois demais atributos em ordem alfabética
  const ATTR_ORDER = ['cor', 'color', 'tamanho', 'size', 'tam']
  const attrKeys = [...new Set(skus.flatMap(s => Object.keys(s.attributes ?? {})))].sort((a, b) => {
    const ai = ATTR_ORDER.findIndex(k => a.toLowerCase().startsWith(k))
    const bi = ATTR_ORDER.findIndex(k => b.toLowerCase().startsWith(k))
    const av = ai === -1 ? 99 : ai
    const bv = bi === -1 ? 99 : bi
    if (av !== bv) return av - bv
    return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
  })

  // Ordena as linhas: Cor (primário) → Tamanho (secundário)
  const sortedSkus = sortSkusForDisplay(skus, attrKeys)

  return (
    <>
      {/* ── Modal de confirmação ── */}
      {confirm && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          onClick={() => setConfirm(null)}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative bg-[var(--color-bg)] rounded-2xl border border-[var(--color-border)] shadow-2xl p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-[var(--color-text)] mb-2">Tem certeza?</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-5 leading-relaxed">
              O{' '}<strong className="text-[var(--color-text)]">{confirm.label}</strong>{' '}
              será aplicado a todos os{' '}
              <strong className="text-[var(--color-text)]">{skus.length} SKUs</strong>,
              sobrepondo os valores existentes. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="h-9 px-4 rounded-xl text-sm font-medium border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => { confirm.onConfirm(); setConfirm(null) }}
                className="h-9 px-4 rounded-xl text-sm font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ações em massa (colapsável) ── */}
      <div className="mb-2">
        <button
          type="button"
          onClick={() => setBulkOpen(o => !o)}
          className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] px-1 py-1 rounded-lg transition-colors group"
        >
          <ChevronDown
            size={13}
            className={`transition-transform duration-200 ${bulkOpen ? 'rotate-180' : ''}`}
          />
          <span className="group-hover:underline underline-offset-2">Ações em massa</span>
          <span className="text-[var(--color-text-disabled)]">· {skus.length} SKUs</span>
        </button>

        {bulkOpen && (
          <div className="mt-1.5 p-3 bg-[var(--color-bg-subtle)] rounded-xl border border-[var(--color-border)] space-y-2.5">
            {/* Preço em massa */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[var(--color-text-muted)] w-40 shrink-0">
                Preço atacado (todos):
              </span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-[var(--color-text-muted)]">R$</span>
                <input
                  type="number" min="0" step="0.01" placeholder="0,00"
                  value={bulkPrice}
                  onChange={e => setBulkPrice(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && requestBulkPrice()}
                  className="w-24 h-7 px-2 rounded-lg text-xs bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                />
                <button
                  type="button"
                  onClick={requestBulkPrice}
                  disabled={!bulkPrice || parseFloat(bulkPrice) <= 0}
                  className="h-7 px-3 rounded-lg text-xs font-semibold bg-[var(--color-primary)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  Aplicar
                </button>
              </div>
            </div>

            {/* Estoque mínimo em massa */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[var(--color-text-muted)] w-40 shrink-0">
                Estoque mínimo (todos):
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number" min="0" placeholder="0"
                  value={bulkStock}
                  onChange={e => setBulkStock(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && requestBulkStock()}
                  className="w-24 h-7 px-2 rounded-lg text-xs bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                />
                <button
                  type="button"
                  onClick={requestBulkStock}
                  disabled={bulkStock === '' || parseInt(bulkStock) < 0}
                  className="h-7 px-3 rounded-lg text-xs font-semibold bg-[var(--color-primary)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Tabela de SKUs ── */}
      <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[var(--color-surface)] border-b border-[var(--color-border)]">
              <tr>
                {attrKeys.map(k => (
                  <th key={k} className="px-3 py-2.5 text-left font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">
                    {k}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-left font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">Código</th>
                <th className="px-3 py-2.5 text-left font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">Preço R$</th>
                <th className="px-3 py-2.5 text-left font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">Est. Mín</th>
                <th className="px-3 py-2.5 text-center font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">Estoque</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {sortedSkus.map((sku) => {
                const origIdx = skus.indexOf(sku)
                return (
                <tr key={sku.id ?? sku._tempId ?? origIdx} className="hover:bg-[var(--color-bg-subtle)] transition-colors">
                  {attrKeys.map(k => (
                    <td key={k} className="px-3 py-2 font-medium text-[var(--color-text)] whitespace-nowrap">
                      {sku.attributes?.[k] ?? '—'}
                    </td>
                  ))}
                  <td className="px-3 py-2 font-mono text-[10px] text-[var(--color-text-muted)] whitespace-nowrap">
                    {sku.code}
                  </td>
                  <td className="px-3 py-2 min-w-[90px]">
                    <input
                      type="number" min="0" step="0.01"
                      value={sku.priceWholesale ?? ''}
                      onChange={e => updateSku(origIdx, 'priceWholesale', e.target.value)}
                      className="w-full h-7 px-2 rounded-md text-xs bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                    />
                  </td>
                  <td className="px-3 py-2 min-w-[72px]">
                    <input
                      type="number" min="0"
                      value={sku.stockMin ?? 0}
                      onChange={e => updateSku(origIdx, 'stockMin', e.target.value)}
                      className="w-full h-7 px-2 rounded-md text-xs bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={[
                      'text-xs font-semibold px-2 py-0.5 rounded-full',
                      sku.stock <= 0
                        ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                        : sku.stock < (sku.stockMin ?? 0)
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                    ].join(' ')}>
                      {sku.stock ?? 0}
                    </span>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 bg-[var(--color-surface)] border-t border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-text-muted)]">
            {skus.length} SKU{skus.length !== 1 ? 's' : ''} · Edite preço e estoque mínimo inline · Estoque real via movimentações
          </p>
        </div>
      </div>
    </>
  )
}

/* ── Categorias do DB (com fallback) ── */
let _catCache = null
async function loadCategories() {
  if (_catCache) return _catCache
  try {
    const token = window.__aura_mem_token__ || ''
    const res = await fetch('/api/product-categories', {
      credentials: 'include',
      headers: token ? { Authorization: 'Bearer ' + token } : {},
    })
    if (!res.ok) throw new Error()
    const data = await res.json()
    _catCache = (data.categories ?? []).map(c => c.name)
    return _catCache
  } catch {
    return DEFAULT_CATEGORIES
  }
}

/* ── Form state inicial ── */
function initialForm(product) {
  if (!product) return {
    name: '', code: '', category: '', type: PRODUCT_TYPES.SIMPLE,
    imageUrl: null, priceWholesale: '', stockMin: '0',
    attributes: [], skus: [],
  }
  return {
    ...product,
    priceWholesale: product.skus?.[0]?.priceWholesale ?? '',
    stockMin:       product.skus?.[0]?.stockMin ?? '0',
  }
}

/* ── Aba indicator ── */
function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 p-1 bg-[var(--color-surface)] rounded-xl w-fit shrink-0">
      {tabs.map(tab => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={[
            'flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-medium transition-all',
            active === tab.key
              ? 'bg-[var(--color-bg)] text-[var(--color-text)] shadow-sm'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
          ].join(' ')}
        >
          {tab.label}
          {tab.badge != null && (
            <span className="text-xs bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-1.5 py-0.5 rounded-full font-semibold">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/* ── Componente principal ── */
export function ProductForm({ open, onClose, product, onSave }) {
  const isEdit    = Boolean(product?.id)
  const isVariant = isEdit
    ? product?.type === PRODUCT_TYPES.VARIANT
    : undefined  // controlado pelo form no modo novo

  const [form,       setForm]       = useState(() => initialForm(product))
  const [errors,     setErrors]     = useState({})
  const [saving,     setSaving]     = useState(false)
  const [skus,       setSkus]       = useState(product?.skus ?? [])
  const [activeTab,  setActiveTab]  = useState('info')
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES)

  /* Carrega categorias do DB */
  useEffect(() => { loadCategories().then(setCategories) }, [])

  /* Reseta ao abrir/trocar produto */
  useEffect(() => {
    if (open) {
      setForm(initialForm(product))
      setSkus(product?.skus ?? [])
      setErrors({})
      setActiveTab('info')
    }
  }, [open, product])

  const set = (field) => (e) =>
    setForm(prev => ({ ...prev, [field]: e.target?.value ?? e }))

  /* Regenera SKUs ao mudar atributos (só modo novo) */
  const handleAttributeChange = useCallback((attrs) => {
    setForm(prev => ({ ...prev, attributes: attrs }))
    if (form.code) setSkus(generateSkus(form.code, attrs))
  }, [form.code])

  useEffect(() => {
    if (!isEdit && form.type === PRODUCT_TYPES.VARIANT && form.attributes?.length) {
      setSkus(generateSkus(form.code || 'PROD', form.attributes))
    }
  }, [form.code]) // eslint-disable-line

  const handleSubmit = async () => {
    const validate = form.type === PRODUCT_TYPES.VARIANT ? validateVariantProduct : validateSimpleProduct
    const errs = validate(form)
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    try {
      const payload = {
        ...form,
        skus: form.type === PRODUCT_TYPES.VARIANT
          ? skus
          : [{
              code:           form.code,
              attributes:     {},
              priceWholesale: Number(form.priceWholesale) || 0,
              stockMin:       Number(form.stockMin) || 0,
              stock:          product?.skus?.[0]?.stock ?? 0,
            }],
      }
      await onSave(payload)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const formIsVariant = form.type === PRODUCT_TYPES.VARIANT

  /* Tabs para modo edição de variante */
  const editTabs = [
    { key: 'info', label: 'Informações' },
    { key: 'skus', label: 'SKUs', badge: skus.length },
  ]

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-50 w-full md:w-[600px] flex flex-col bg-[var(--color-bg)] border-l border-[var(--color-border)] shadow-2xl"
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--color-border)] shrink-0">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-[var(--color-text)] truncate">
                  {isEdit ? product.name : 'Novo produto'}
                </h2>
                {isEdit && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5 flex items-center gap-2">
                    <span className="font-mono">{product.code}</span>
                    <span>·</span>
                    <span>{product.category}</span>
                    {product.type === PRODUCT_TYPES.VARIANT && (
                      <><span>·</span><span>{skus.length} SKUs</span></>
                    )}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* ── Tabs (só edição de variante) ── */}
            {isEdit && isVariant && (
              <div className="px-5 pt-3 pb-0 shrink-0">
                <TabBar tabs={editTabs} active={activeTab} onChange={setActiveTab} />
              </div>
            )}

            {/* ── Body com scroll ── */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5">

              {/* ════════ ABA INFORMAÇÕES / MODO NOVO ════════ */}
              {(activeTab === 'info') && (
                <>
                  {/* Tipo — só modo novo */}
                  {!isEdit && (
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text)] mb-2">Tipo de produto</p>
                      <div className="flex gap-3">
                        {[
                          { value: PRODUCT_TYPES.SIMPLE,  label: 'Simples',    desc: '1 SKU' },
                          { value: PRODUCT_TYPES.VARIANT, label: 'Com grade',  desc: 'N SKUs por combinação' },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => { setForm(prev => ({ ...prev, type: opt.value, attributes: [], skus: [] })); setSkus([]) }}
                            className={[
                              'flex-1 rounded-xl border-2 p-3 text-left transition-all',
                              form.type === opt.value
                                ? 'border-[var(--color-primary)] bg-blue-50 dark:bg-blue-950'
                                : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
                            ].join(' ')}
                          >
                            <p className={`text-sm font-semibold ${form.type === opt.value ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
                              {opt.label}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{opt.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dados básicos */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Nome do produto *"
                      placeholder="Ex: Camiseta Básica"
                      value={form.name}
                      onChange={set('name')}
                      error={errors.name}
                      wrapperClassName="sm:col-span-2"
                    />
                    <Input
                      label="Código / Referência *"
                      placeholder="Ex: C001"
                      value={form.code}
                      onChange={set('code')}
                      error={errors.code}
                      disabled={isEdit}
                    />
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Categoria *</label>
                      <select
                        value={form.category}
                        onChange={set('category')}
                        className={[
                          'w-full h-10 px-3 rounded-[var(--radius-md)] text-sm bg-[var(--color-bg)] border text-[var(--color-text)]',
                          'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]',
                          errors.category ? 'border-[var(--color-error)]' : 'border-[var(--color-border)]',
                        ].join(' ')}
                      >
                        <option value="">Selecionar categoria…</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {errors.category && <p className="text-xs text-[var(--color-error)] mt-1">{errors.category}</p>}
                    </div>
                  </div>

                  {/* Foto */}
                  <ImageUpload
                    imageUrl={form.imageUrl}
                    onImageChange={url => setForm(prev => ({ ...prev, imageUrl: url }))}
                  />

                  {/* Preço / estoque — produto simples */}
                  {!formIsVariant && (
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Preço atacado (R$)"
                        placeholder="0,00"
                        type="number" min="0" step="0.01"
                        value={form.priceWholesale}
                        onChange={set('priceWholesale')}
                        error={errors.priceWholesale}
                      />
                      <Input
                        label="Estoque mínimo"
                        placeholder="0"
                        type="number" min="0"
                        value={form.stockMin}
                        onChange={set('stockMin')}
                      />
                    </div>
                  )}

                  {/* Atributos da grade (modo novo) */}
                  {formIsVariant && !isEdit && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-[var(--color-text)]">Atributos da grade</p>
                        {skus.length > 0 && <Badge variant="default" size="sm">{skus.length} SKUs</Badge>}
                      </div>
                      <AttributeBuilder attributes={form.attributes} onChange={handleAttributeChange} />
                      {skus.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-[var(--color-text)]">SKUs gerados</p>
                          <SkuGrid skus={skus} onChange={setSkus} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Info: em edição de variante, ir para aba SKUs */}
                  {isEdit && isVariant && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('skus')}
                      className="w-full flex items-center justify-between p-4 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface)] transition-colors text-left"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[var(--color-text)]">SKUs da grade</p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          {skus.length} combinaç{skus.length === 1 ? 'ão' : 'ões'} · Edite preço e estoque mínimo
                        </p>
                      </div>
                      <ChevronDown size={16} className="text-[var(--color-text-muted)] -rotate-90 shrink-0" />
                    </button>
                  )}
                </>
              )}

              {/* ════════ ABA SKUs (só edição de variante) ════════ */}
              {activeTab === 'skus' && isEdit && isVariant && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[var(--color-text)]">
                      {skus.length} SKU{skus.length !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">Preço e estoque mín. editáveis</p>
                  </div>
                  <SkuEditTable skus={skus} onChange={setSkus} />
                </div>
              )}
            </div>

            {/* ── Footer fixo ── */}
            <div className="px-5 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)] flex justify-end gap-3 shrink-0">
              <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving
                  ? <><RefreshCw size={14} className="animate-spin" /> Salvando…</>
                  : isEdit ? 'Salvar alterações' : 'Criar produto'
                }
              </Button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
