'use client'

/**
 * components/product/ProductDetail.tsx
 * Orquestra: galeria + seletor de atributos + quantidade + CTA.
 * Client Component — estado de seleção, quantidade, toast de carrinho.
 */

import { useState, useMemo, useCallback } from 'react'
import type { ProductDetail, Sku } from '@/lib/api'
import { useTenant } from '@/components/layout/TenantProvider'

import ImageGallery from './ImageGallery'
import AttributeSelector from './AttributeSelector'
import QuantityInput from './QuantityInput'
import StockBadge from './StockBadge'
import { addToCart, formatPrice as fmtPrice, type CartItem } from '@/lib/cart'

interface Props {
  product: ProductDetail
}

export default function ProductDetailView({ product }: Props) {
  const { slug: tenantSlug } = useTenant()
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [quantity, setQuantity]   = useState(1)
  const [adding, setAdding]       = useState(false)
  const [toast, setToast]         = useState<string | null>(null)

  // ─── SKU resolvido ────────────────────────────────────────────────────────

  const resolvedSku = useMemo<Sku | null>(() => {
    const dims = Object.keys(product.attributes)
    if (dims.length === 0) {
      // Produto simples — pega o primeiro SKU ativo
      return product.skus.find((s) => s.active && s.stock > 0) ?? product.skus[0] ?? null
    }
    // Todos os atributos precisam estar selecionados
    if (dims.some((d) => !selected[d])) return null
    return (
      product.skus.find(
        (s) =>
          s.active &&
          dims.every((d) => s.attributes[d] === selected[d])
      ) ?? null
    )
  }, [selected, product.skus, product.attributes])

  const isSelectionComplete = useMemo(() => {
    const dims = Object.keys(product.attributes)
    return dims.length === 0 || dims.every((d) => selected[d])
  }, [selected, product.attributes])

  // ─── Preço exibido ────────────────────────────────────────────────────────

  const displayPrice = useMemo(() => {
    if (resolvedSku) return formatPrice(resolvedSku.price)
    const { minPrice, maxPrice } = product
    if (minPrice === maxPrice) return formatPrice(minPrice)
    return `${formatPrice(minPrice)} – ${formatPrice(maxPrice)}`
  }, [resolvedSku, product])

  // ─── Adicionar ao carrinho ────────────────────────────────────────────────

  const handleAddToCart = useCallback(async () => {
    if (!resolvedSku || adding) return
    setAdding(true)

    try {
      addToCart({
          skuId:        resolvedSku.id,
          skuCode:      resolvedSku.code,
          productSlug:  product.slug,
          productName:  product.name,
          attributes:   resolvedSku.attributes,
          price:        resolvedSku.price,
          coverImageUrl: product.coverImageUrl,
          quantity,
          maxStock:     resolvedSku.stock,
        })

      showToast(`${product.name} adicionado ao carrinho`)
    } catch {
      showToast('Erro ao adicionar. Tente novamente.')
    } finally {
      setAdding(false)
    }
  }, [resolvedSku, adding, quantity, product])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const hasDimensions = Object.keys(product.attributes).length > 0
  const stockMax = resolvedSku?.stock ?? 0

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
          </div>

          {/* Preço */}
          <p className="text-2xl font-bold text-primary">{displayPrice}</p>

          {/* Seletor de atributos */}
          {hasDimensions && (
            <AttributeSelector
              attributes={product.attributes}
              skus={product.skus}
              selected={selected}
              onChange={setSelected}
            />
          )}

          {/* Disponibilidade em tempo real */}
          {resolvedSku && (
            <StockBadge
              tenantSlug={tenantSlug}
              skuId={resolvedSku.id}
              initialStock={resolvedSku.stock}
            />
          )}

          {/* Quantidade */}
          {resolvedSku && resolvedSku.stock > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">Quantidade</span>
              <QuantityInput
                value={quantity}
                max={stockMax}
                onChange={setQuantity}
              />
            </div>
          )}

          {/* Aviso seleção incompleta */}
          {hasDimensions && !isSelectionComplete && (
            <p className="text-sm text-muted-foreground">
              Selecione {Object.keys(product.attributes)
                .filter((d) => !selected[d])
                .join(', ')} para continuar.
            </p>
          )}

          {/* CTA — adicionar ao carrinho */}
          <button
            onClick={handleAddToCart}
            disabled={!resolvedSku || resolvedSku.stock <= 0 || adding || !isSelectionComplete}
            className={[
              'flex w-full items-center justify-center gap-2 rounded-[var(--radius)] py-3.5 text-sm font-semibold transition active:scale-95',
              resolvedSku && resolvedSku.stock > 0 && isSelectionComplete
                ? 'bg-primary text-primary-foreground shadow hover:opacity-90'
                : 'cursor-not-allowed bg-muted text-muted-foreground',
            ].join(' ')}
          >
            {adding ? (
              <>
                <SpinnerIcon />
                Adicionando…
              </>
            ) : resolvedSku && resolvedSku.stock <= 0 ? (
              'Fora de estoque'
            ) : (
              <>
                <CartIcon />
                Adicionar ao carrinho
              </>
            )}
          </button>

          {/* Descrição */}
          {product.description && (
            <div className="border-t border-border pt-5">
              <h2 className="mb-2 text-sm font-semibold text-foreground">Descrição</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {product.description}
              </p>
            </div>
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


// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatPrice = fmtPrice

function CartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <line x1="3" x2="21" y1="6" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}
