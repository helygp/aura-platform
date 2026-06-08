'use client'

/**
 * components/product/ProductDetail.tsx
 * v2 — integra GradeMatrix para produtos B2B com Cor × Tamanho.
 * Mantém AttributeSelector como fallback para produtos simples.
 */

import * as React from 'react'
import { useState, useMemo, useCallback } from 'react'
import type { ProductDetail, Sku } from '@/lib/api'
import type { TenantTheme } from '@/lib/tenant'
import { useTenant } from '@/components/layout/TenantProvider'
import { addToCart, formatPrice as fmtPrice } from '@/lib/cart'

import ImageGallery       from './ImageGallery'
import AttributeSelector  from './AttributeSelector'
import QuantityInput      from './QuantityInput'
import StockBadge         from './StockBadge'
import GradeMatrix        from './GradeMatrix'

// Mapa de cores padrão Fast Malhas / Aura Store
const DEFAULT_COLOR_HEX: Record<string, string> = {
  'Preto':        '#1a1a1a',
  'Branco':       '#f3f3ee',
  'Bege':         '#d8c7a8',
  'Bordo':        '#6b1f2e',
  'Vermelho':     '#c62828',
  'Rosa Pink':    '#e0218a',
  'Rosa Bebê':    '#f4b8cf',
  'Azul Bic':     '#1f6fd6',
  'Azul Marinho': '#1e2a52',
  'Cinza Mescla': '#b7bcc0',
  'Cinza':        '#9e9e9e',
  'Verde':        '#2e7d32',
  'Amarelo':      '#f9a825',
  'Laranja':      '#e65100',
  'Lilás':        '#7b1fa2',
  'Marrom':       '#5d4037',
  'Caqui':        '#8d7b68',
  'Caramelo':     '#bf8040',
  'Menta':        '#80cbc4',
  'Salmão':       '#ff8a65',
}


// ─── Ordenação de tamanhos por padrão do mercado têxtil ───────────────────────

const SIZE_LETTER_ORDER = ['PP', 'P', 'M', 'G', 'GG', 'XG']

/**
 * Ordena tamanhos conforme padrão do mercado têxtil:
 * - Todos numéricos → crescente (2, 4, 6, 8, 10, 12…)
 * - Por letra       → PP, P, M, G, GG, GGG…
 * - Misto           → numéricos primeiro, letras depois
 */
function sortSizes(raw: string[]): string[] {
  const isNum = (s: string) => /^\d+$/.test(s)
  const nums    = raw.filter(isNum).sort((a, b) => Number(a) - Number(b))
  const letters = raw
    .filter(s => !isNum(s))
    .sort((a, b) => {
      const ia = SIZE_LETTER_ORDER.indexOf(a.toUpperCase())
      const ib = SIZE_LETTER_ORDER.indexOf(b.toUpperCase())
      if (ia === -1 && ib === -1) return a.localeCompare(b)
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
  return [...nums, ...letters]
}

function sortColors(raw: string[]): string[] {
  return [...raw].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

interface Props {
  product: ProductDetail
  theme?:  TenantTheme
}

export default function ProductDetailView({ product, theme }: Props) {
  const { slug: tenantSlug } = useTenant()

  // Detecta se produto tem estrutura Cor × Tamanho (B2B grade)
  const attrs    = product.attributes ?? {}
  const colors   = sortColors((attrs['Cor']     ?? attrs['cor']     ?? []) as string[])
  const sizes    = sortSizes((attrs['Tamanho'] ?? attrs['tamanho'] ?? []) as string[])
  const hasGrade = colors.length > 0 && sizes.length > 0

  // Mapa Cor|Tamanho → estoque, usado pela GradeMatrix para bloquear células
  const skuStocks = React.useMemo(() => {
    const map: Record<string, number> = {}
    product.skus.forEach(s => {
      const cor = s.attributes['Cor']     ?? s.attributes['cor']
      const tam = s.attributes['Tamanho'] ?? s.attributes['tamanho']
      if (cor && tam) map[`${cor}|${tam}`] = s.active ? s.stock : 0
    })
    return map
  }, [product.skus])

  // Grade template: usa distribuição padrão ou deriva dos SKUs
  const gradeTemplate = useMemo(() => {
    if (sizes.length === 0) return {}
    // Conta ocorrências de cada tamanho nos SKUs
    const counts: Record<string, number> = {}
    product.skus.forEach(s => {
      const sz = s.attributes['Tamanho'] ?? s.attributes['tamanho']
      if (sz) counts[sz] = (counts[sz] ?? 0) + 1
    })
    // Se tem contagens reais, normaliza para min=1
    if (Object.keys(counts).length > 0) {
      const min = Math.min(...Object.values(counts))
      return Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Math.round(v / min)]))
    }
    // Fallback: 1 de cada
    return Object.fromEntries(sizes.map(sz => [sz, 1]))
  }, [sizes, product.skus])

  // ── Estado para modo simples (sem grade) ───────────────────────────────────
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding]     = useState(false)
  const [toast, setToast]       = useState<string | null>(null)

  const resolvedSku = useMemo<Sku | null>(() => {
    if (hasGrade) return null
    const dims = Object.keys(attrs)
    if (dims.length === 0) {
      return product.skus.find(s => s.active && s.stock > 0) ?? product.skus[0] ?? null
    }
    if (dims.some(d => !selected[d])) return null
    return product.skus.find(s => s.active && dims.every(d => s.attributes[d] === selected[d])) ?? null
  }, [selected, product.skus, attrs, hasGrade])

  const isSelectionComplete = useMemo(() => {
    if (hasGrade) return true
    const dims = Object.keys(attrs)
    return dims.length === 0 || dims.every(d => selected[d])
  }, [selected, attrs, hasGrade])

  const displayPrice = useMemo(() => {
    if (resolvedSku) return formatPrice(resolvedSku.price)
    return formatPrice(product.minPrice)
  }, [resolvedSku, product])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleAddSimple = useCallback(async () => {
    if (!resolvedSku || adding) return
    setAdding(true)
    try {
      addToCart({
        skuId:         resolvedSku.id,
        skuCode:       resolvedSku.code,
        productSlug:   product.slug,
        productName:   product.name,
        attributes:    resolvedSku.attributes,
        price:         resolvedSku.price,
        coverImageUrl: product.coverImageUrl,
        quantity,
        maxStock:      resolvedSku.stock,
      })
      showToast(`${product.name} adicionado ao carrinho`)
    } catch {
      showToast('Erro ao adicionar. Tente novamente.')
    } finally {
      setAdding(false)
    }
  }, [resolvedSku, adding, quantity, product])

  const handleAddGrade = useCallback((items: Array<{ key: string; color: string; size: string; qty: number }>) => {
    let added = 0
    let skipped = 0
    items.forEach(({ color, size, qty }) => {
      // Encontra SKU correspondente
      const sku = product.skus.find(s =>
        (s.attributes['Cor'] ?? s.attributes['cor']) === color &&
        (s.attributes['Tamanho'] ?? s.attributes['tamanho']) === size
      )
      if (!sku) return
      // Pula SKUs sem estoque — não adiciona ao carrinho
      if (sku.stock <= 0) {
        skipped += qty
        return
      }
      // Respeita o limite real de estoque
      const allowedQty = Math.min(qty, sku.stock)
      addToCart({
        skuId:         sku.id,
        skuCode:       sku.code,
        productSlug:   product.slug,
        productName:   product.name,
        attributes:    sku.attributes,
        price:         sku.price,
        coverImageUrl: product.coverImageUrl,
        quantity:      allowedQty,
        maxStock:      sku.stock,
      })
      added += allowedQty
      if (allowedQty < qty) skipped += (qty - allowedQty)
    })
    if (added > 0) {
      const msg = skipped > 0
        ? `${added} peças adicionadas. ${skipped} sem estoque suficiente.`
        : `${added} peças de ${product.name} adicionadas ao carrinho`
      showToast(msg)
    } else if (skipped > 0) {
      showToast('Nenhuma peça adicionada — estoque insuficiente.')
    }
  }, [product])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const stockMax = resolvedSku?.stock ?? 0

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">

      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <a href="/catalogo" className="hover:text-foreground">Catálogo</a>
        {product.category && (
          <>
            <span>/</span>
            <a href={`/catalogo?categoria=${encodeURIComponent(product.category)}`} className="hover:text-foreground">
              {product.category}
            </a>
          </>
        )}
        <span>/</span>
        <span className="truncate text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">

        {/* Galeria */}
        <ImageGallery
          images={product.images.length > 0 ? product.images : (product.coverImageUrl ? [product.coverImageUrl] : [])}
          productName={product.name}
        />

        {/* Info + ações */}
        <div className="flex flex-col gap-5">

          {/* Cabeçalho */}
          <div>
            {product.category && (
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {product.category}
              </p>
            )}
            <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
              {product.name}
            </h1>
            {theme?.showSkuCode && product.skus[0]?.code && (
              <p className="mt-1 text-xs font-mono text-muted-foreground">
                {product.skus[0].code.split('-')[0]}
              </p>
            )}
          </div>

          {/* Preço */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--ink)', lineHeight: 1 }}>
              {displayPrice}
            </span>
            <span style={{ fontSize: 14, color: 'var(--muted)', paddingBottom: 4 }}>
              por peça · à vista no PIX
            </span>
          </div>

          {/* Descrição */}
          {product.description && (
            <p style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.6, maxWidth: 520 }}>
              {product.description}
            </p>
          )}

          {/* ── MODO GRADE (B2B) ── */}
          {hasGrade ? (
            <GradeMatrix
              productId={product.slug}
              productName={product.name}
              price={product.minPrice}
              colors={colors}
              colorHexMap={DEFAULT_COLOR_HEX}
              sizes={sizes}
              gradeTemplate={gradeTemplate}
              gradeFechada={theme?.gradeFechada ?? true}
              showSkuCode={theme?.showSkuCode ?? false}
              volumeTiers={theme?.volumeTiers ?? []}
              minOrder={theme?.minimumOrderAmount ?? 300}
              theme={theme as TenantTheme}
              skuStocks={skuStocks}
              onAddToCart={handleAddGrade}
            />
          ) : (
            /* ── MODO SIMPLES (fallback) ── */
            <>
              {Object.keys(attrs).length > 0 && (
                <AttributeSelector
                  attributes={attrs}
                  skus={product.skus}
                  selected={selected}
                  onChange={setSelected}
                />
              )}
              {resolvedSku && (
                <StockBadge
                  tenantSlug={tenantSlug}
                  skuId={resolvedSku.id}
                  initialStock={resolvedSku.stock}
                />
              )}
              {resolvedSku && resolvedSku.stock > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">Quantidade</span>
                  <QuantityInput value={quantity} max={stockMax} onChange={setQuantity} />
                </div>
              )}
              {Object.keys(attrs).length > 0 && !isSelectionComplete && (
                <p className="text-sm text-muted-foreground">
                  Selecione {Object.keys(attrs).filter(d => !selected[d]).join(', ')} para continuar.
                </p>
              )}
              <button
                onClick={handleAddSimple}
                disabled={!resolvedSku || resolvedSku.stock <= 0 || adding || !isSelectionComplete}
                className={[
                  'flex w-full items-center justify-center gap-2 rounded-[var(--radius)] py-3.5 text-sm font-semibold transition active:scale-95',
                  resolvedSku && resolvedSku.stock > 0 && isSelectionComplete
                    ? 'bg-primary text-primary-foreground shadow hover:opacity-90'
                    : 'cursor-not-allowed bg-muted text-muted-foreground',
                ].join(' ')}
              >
                {adding ? 'Adicionando…' : resolvedSku && resolvedSku.stock <= 0 ? 'Fora de estoque' : 'Adicionar ao carrinho'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-[var(--radius)] bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

const formatPrice = fmtPrice
