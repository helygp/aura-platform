/**
 * pages/products/ProductDetailPage.jsx
 *
 * Página de detalhe de produto — rota /produtos/:id
 *
 * Mostra:
 *   - Header com nome, código, categoria, badge tipo
 *   - 4 summary cards: SKUs · Unidades em estoque · Valor em estoque · Críticos
 *   - Campo "Aplicar preço para todos" + tabela editável de SKUs
 *   - Botão Salvar (chama PUT /api/products/:id)
 *   - Botão Editar (abre drawer)
 *   - Navegação de volta para /products
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Edit2, RefreshCw, Package,
  DollarSign, AlertTriangle, Layers, Save,
} from 'lucide-react'
import { Badge } from '@aura/ui'
import { ProductForm } from './components/ProductForm.jsx'
import { fmtBRL, PRODUCT_TYPES } from './productsTypes.js'

/* ── auth fetch ── */
function authFetch(url, opts = {}) {
  const token = window.__aura_mem_token__ || ''
  return fetch(url, {
    ...opts,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(opts.headers ?? {}),
    },
  })
}

/* ── Summary card ── */
function Card({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-[var(--color-text)] truncate">{value}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
        {sub && <p className="text-[10px] text-[var(--color-text-disabled)] mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}


/* ── Ordem predefinida para tamanhos comuns ── */

/* ── Ordem canônica: Cor (primário) → Tamanho (secundário) ── */
const _PREF_COLS = ['Cor', 'cor', 'COLOR', 'Color', 'Estampa']
const _PREF_ROWS = ['Tamanho', 'tamanho', 'Size', 'size', 'Tam', 'tam']
const _SZ_LETTERS = ['pp', 'p', 'm', 'g', 'gg', 'xg']

function attrSortValue(val) {
  if (val == null) return 'zzzz'
  const norm = String(val).toLowerCase().trim()
  // Numérico → ordena crescente, prefixo 'A' para vir antes de letras
  if (/^[0-9]+(\.[0-9]+)?$/.test(norm)) {
    return 'A' + String(parseFloat(norm) + 1e5).padStart(12, '0')
  }
  // Letra de tamanho canônica (PP, P, M, G, GG, XG)
  const idx = _SZ_LETTERS.indexOf(norm)
  if (idx !== -1) return 'B' + String(idx).padStart(4, '0')
  // Demais: ordem alfabética
  return 'B' + norm
}

/* ── Linha SKU editável ── */
function SkuRow({ sku, onChange }) {
  const stock = sku.stock ?? 0
  const min   = parseInt(sku.stockMin ?? 0)
  const status = stock === 0 ? 'zero' : stock < min ? 'low' : 'ok'
  const attrKeys = Object.keys(sku.attributes ?? {})

  return (
    <tr className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-subtle)] transition-colors">
      {/* Atributos */}
      {attrKeys.map(k => (
        <td key={k} className="px-3 py-2 text-sm font-medium text-[var(--color-text)] whitespace-nowrap">
          {sku.attributes[k]}
        </td>
      ))}
      {attrKeys.length === 0 && (
        <td className="px-3 py-2 text-xs text-[var(--color-text-muted)]">—</td>
      )}
      {/* Código */}
      <td className="px-3 py-2 font-mono text-[11px] text-[var(--color-text-muted)] whitespace-nowrap">
        {sku.code}
      </td>
      {/* Preço */}
      <td className="px-3 py-2 min-w-[100px]">
        <div className="flex items-center gap-1">
          <span className="text-xs text-[var(--color-text-muted)]">R$</span>
          <input
            type="number" min="0" step="0.01"
            value={sku.priceWholesale ?? ''}
            onChange={e => onChange('priceWholesale', e.target.value)}
            className="w-20 h-7 px-2 rounded-lg text-xs bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          />
        </div>
      </td>
      {/* Est. Mín */}
      <td className="px-3 py-2 min-w-[72px]">
        <input
          type="number" min="0"
          value={sku.stockMin ?? 0}
          onChange={e => onChange('stockMin', e.target.value)}
          className="w-16 h-7 px-2 rounded-lg text-xs bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
        />
      </td>
      {/* Estoque */}
      <td className="px-3 py-2 text-center">
        <span className={[
          'text-sm font-bold tabular-nums px-2.5 py-0.5 rounded-full',
          status === 'zero' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
          : status === 'low'  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
          : 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
        ].join(' ')}>
          {stock}
        </span>
      </td>
      {/* Valor em estoque */}
      <td className="px-3 py-2 text-right text-xs text-[var(--color-text-muted)] whitespace-nowrap">
        {fmtBRL((sku.priceWholesale ?? 0) * stock)}
      </td>
    </tr>
  )
}

/* ── Página principal ── */
export function ProductDetailPage() {
  const { id }     = useParams()
  const navigate   = useNavigate()

  const [product,   setProduct]   = useState(null)
  const [skus,      setSkus]      = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [error,     setError]     = useState('')
  const [editOpen,  setEditOpen]  = useState(false)
  const [bulkPrice, setBulkPrice] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res  = await authFetch(`/api/products/${id}`)
      if (!res.ok) throw new Error(`Produto não encontrado (${res.status})`)
      const data = await res.json()
      setProduct(data)
      setSkus(data.skus ?? [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  /* Stats */
  const stats = useMemo(() => {
    const total    = skus.reduce((a, s) => a + (s.stock ?? 0), 0)
    const value    = skus.reduce((a, s) => a + (s.priceWholesale ?? 0) * (s.stock ?? 0), 0)
    const critical = skus.filter(s => (s.stock ?? 0) <= (s.stockMin ?? 0)).length
    const zero     = skus.filter(s => (s.stock ?? 0) === 0).length
    return { total, value, critical, zero }
  }, [skus])


  /* SKUs ordenados: Cor (primário) → Tamanho (secundário) */
  const sortedSkus = useMemo(() => {
    if (!skus.length) return skus
    const allKeys = [...new Set(skus.flatMap(s => Object.keys(s.attributes ?? {})))]

    // Chaves de cor (primário), tamanho (secundário), demais (terciário)
    const colorKeys = allKeys.filter(k => _PREF_COLS.includes(k))
    const sizeKeys  = allKeys.filter(k => _PREF_ROWS.includes(k))
    const otherKeys = allKeys.filter(k => !_PREF_COLS.includes(k) && !_PREF_ROWS.includes(k))
    const sortKeys  = [...colorKeys, ...sizeKeys, ...otherKeys]

    return [...skus].sort((a, b) => {
      for (const k of sortKeys) {
        const va = attrSortValue(a.attributes?.[k])
        const vb = attrSortValue(b.attributes?.[k])
        if (va < vb) return -1
        if (va > vb) return  1
      }
      return 0
    })
  }, [skus])

  /* Atualizar SKU inline — usa índice do array original */
  const updateSku = useCallback((index, field, value) => {
    setSkus(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }, [])

  /* Aplicar preço em massa */
  const applyBulkPrice = () => {
    const v = parseFloat(bulkPrice)
    if (!v || v <= 0) return
    setSkus(prev => prev.map(s => ({ ...s, priceWholesale: v })))
    setBulkPrice('')
  }

  /* Salvar */
  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await authFetch(`/api/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...product, skus }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Erro ao salvar')
      setSaved(true); setTimeout(() => setSaved(false), 2500)
      await load()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  /* Salvar após edição no drawer */
  const handleDrawerSave = useCallback(async (data) => {
    const res = await authFetch(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error()
    await load()
  }, [id, load])

  const attrKeys = useMemo(() =>
    [...new Set(skus.flatMap(s => Object.keys(s.attributes ?? {})))],
  [skus])

  const isVariant = product?.type === PRODUCT_TYPES.VARIANT

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw size={28} className="animate-spin text-[var(--color-primary)]" />
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
      <AlertTriangle size={28} className="text-red-500" />
      <p className="text-sm text-red-600">{error}</p>
      <button onClick={() => navigate('/products')} className="text-sm text-[var(--color-primary)] hover:underline">
        Voltar para produtos
      </button>
    </div>
  )

  return (
    <div className="space-y-5 max-w-screen-xl">

      {/* ── Header ── */}
      <div className="flex items-start gap-3 flex-wrap">
        <button
          onClick={() => navigate('/products')}
          className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mt-0.5 shrink-0"
        >
          <ArrowLeft size={15} /> Produtos
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-[var(--color-text)] truncate">{product?.name}</h2>
            <span className={[
              'text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0',
              isVariant
                ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
                : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
            ].join(' ')}>
              {isVariant ? 'Grade' : 'Simples'}
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            <span className="font-mono">{product?.code}</span>
            {product?.category && <><span className="mx-2">·</span><span>{product.category}</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold bg-[var(--color-primary)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {saving
              ? <><RefreshCw size={13} className="animate-spin" /> Salvando…</>
              : saved
                ? <><Save size={13} /> Salvo!</>
                : <><Save size={13} /> Salvar</>
            }
          </button>
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-colors"
          >
            <Edit2 size={13} /> Editar info
          </button>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card icon={Layers}       label="SKUs"              value={skus.length}      color="bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400" />
        <Card icon={Package}      label="Unidades em estoque" value={stats.total}    color="bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400" />
        <Card icon={DollarSign}   label="Valor em estoque"  value={fmtBRL(stats.value)} color="bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400" />
        <Card
          icon={AlertTriangle}
          label="SKUs críticos"
          value={stats.critical}
          sub={stats.zero > 0 ? `${stats.zero} zerado${stats.zero > 1 ? 's' : ''}` : undefined}
          color={stats.critical > 0 ? 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400' : 'bg-gray-50 text-gray-400 dark:bg-gray-900 dark:text-gray-600'}
        />
      </div>

      {/* ── Painel de SKUs ── */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] overflow-hidden">

        {/* Barra de ações */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex-wrap">
          <p className="text-sm font-semibold text-[var(--color-text)]">
            {isVariant ? `${skus.length} SKUs da grade` : 'SKU único'}
          </p>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <span className="text-xs text-[var(--color-text-muted)] shrink-0">Aplicar preço para todos:</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-[var(--color-text-muted)]">R$</span>
              <input
                type="number" min="0" step="0.01" placeholder="0,00"
                value={bulkPrice}
                onChange={e => setBulkPrice(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyBulkPrice()}
                className="w-24 h-7 px-2 rounded-lg text-xs bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
              <button
                type="button"
                onClick={applyBulkPrice}
                disabled={!bulkPrice || parseFloat(bulkPrice) <= 0}
                className="h-7 px-3 rounded-lg text-xs font-semibold bg-[var(--color-primary)]/10 text-[var(--color-primary)] disabled:opacity-40 hover:bg-[var(--color-primary)]/20 transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]">
              <tr>
                {attrKeys.map(k => (
                  <th key={k} className="px-3 py-2.5 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">
                    {k}
                  </th>
                ))}
                {attrKeys.length === 0 && (
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Atributos</th>
                )}
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Código</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Preço Atacado</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">Est. Mín</th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Estoque</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">Valor</th>
              </tr>
            </thead>
            <tbody>
              {sortedSkus.map((sku) => {
                const origIdx = skus.indexOf(sku)
                return (
                  <SkuRow
                    key={sku.id ?? origIdx}
                    sku={sku}
                    onChange={(field, value) => updateSku(origIdx, field, value)}
                  />
                )
              })}
            </tbody>
            <tfoot className="border-t-2 border-[var(--color-border)] bg-[var(--color-surface)]">
              <tr>
                <td colSpan={attrKeys.length + 2} />
                <td className="px-3 py-2.5 text-xs font-semibold text-[var(--color-text-muted)] text-right whitespace-nowrap">
                  Total:
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className="text-sm font-bold text-[var(--color-text)]">{stats.total}</span>
                  <span className="text-xs text-[var(--color-text-muted)] ml-1">un</span>
                </td>
                <td className="px-3 py-2.5 text-right text-sm font-bold text-[var(--color-text)] whitespace-nowrap">
                  {fmtBRL(stats.value)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Aviso erro de save ── */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── Drawer de edição rápida ── */}
      <ProductForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        product={product ? { ...product, skus } : null}
        onSave={handleDrawerSave}
      />
    </div>
  )
}
