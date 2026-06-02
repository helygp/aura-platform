/**
 * pages/products/components/ProductCard.jsx
 *
 * Card de produto na listagem. Mostra:
 *   - Foto (ou placeholder com inicial)
 *   - Nome, código, categoria
 *   - Badge tipo (simples/variante)
 *   - Contagem de SKUs e status de estoque geral
 *   - Ações: editar, excluir
 */

import React from 'react'
import { Package, Edit2, Trash2 } from 'lucide-react'
import { Badge } from '@aura/ui'
import { PRODUCT_TYPES, STOCK_STATUS, fmtBRL } from '../productsTypes.js'

/* Calcula status geral de estoque do produto */
function productStockStatus(skus) {
  if (!skus?.length) return STOCK_STATUS.ZERO
  const zeros = skus.filter(s => s.stock === 0).length
  const lows  = skus.filter(s => s.stock > 0 && s.stock <= s.stockMin).length
  if (zeros === skus.length) return STOCK_STATUS.ZERO
  if (zeros + lows > 0)      return STOCK_STATUS.LOW
  return STOCK_STATUS.OK
}

const STOCK_BADGE = {
  [STOCK_STATUS.OK]:   { variant: 'success', label: 'Em estoque' },
  [STOCK_STATUS.LOW]:  { variant: 'warning', label: 'Estoque baixo' },
  [STOCK_STATUS.ZERO]: { variant: 'error',   label: 'Zerado' },
}

export function ProductCard({ product, onEdit, onDelete }) {
  const status  = productStockStatus(product.skus)
  const badge   = STOCK_BADGE[status]
  const minPrice = product.skus?.length
    ? Math.min(...product.skus.map(s => Number(s.priceWholesale) || 0))
    : 0

  return (
    <div className="
      group flex flex-col rounded-xl border border-[var(--color-border)]
      bg-[var(--color-bg)] hover:shadow-[var(--shadow-md)]
      hover:border-[var(--color-border-strong)]
      transition-all duration-200 overflow-hidden
    ">
      {/* Imagem */}
      <div className="relative aspect-square bg-[var(--color-bg-subtle)] flex items-center justify-center overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Package size={32} className="text-[var(--color-text-disabled)]" />
          </div>
        )}
        {/* Badge tipo — topo direito */}
        <div className="absolute top-2 left-2">
          <span className={`
            text-[10px] font-semibold px-2 py-0.5 rounded-full
            ${product.type === PRODUCT_TYPES.VARIANT
              ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
              : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
            }
          `}>
            {product.type === PRODUCT_TYPES.VARIANT ? 'Grade' : 'Simples'}
          </span>
        </div>
        {/* Ações — aparecem no hover */}
        <div className="
          absolute inset-0 bg-black/40 flex items-center justify-center gap-2
          opacity-0 group-hover:opacity-100 transition-opacity duration-150
        ">
          <button
            onClick={() => onEdit(product)}
            className="
              w-9 h-9 rounded-lg bg-white/90 flex items-center justify-center
              text-gray-700 hover:bg-white transition-colors
            "
            aria-label="Editar produto"
          >
            <Edit2 size={15} />
          </button>
          <button
            onClick={() => onDelete(product)}
            className="
              w-9 h-9 rounded-lg bg-white/90 flex items-center justify-center
              text-red-600 hover:bg-white transition-colors
            "
            aria-label="Excluir produto"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <p className="text-xs text-[var(--color-text-muted)] font-mono">{product.code}</p>
        <p className="text-sm font-semibold text-[var(--color-text)] leading-tight line-clamp-2">
          {product.name}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">{product.category}</p>

        <div className="flex items-center justify-between mt-auto pt-2 border-t border-[var(--color-border)]">
          <div>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              {product.skus?.length ?? 0} SKU{product.skus?.length !== 1 ? 's' : ''}
            </p>
            <p className="text-sm font-bold text-[var(--color-text)]">
              {minPrice > 0 ? `a partir de ${fmtBRL(minPrice)}` : '—'}
            </p>
          </div>
          <Badge variant={badge.variant} size="sm">{badge.label}</Badge>
        </div>
      </div>
    </div>
  )
}
