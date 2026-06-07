/**
 * pages/inventory/inventoryTypes.js
 *
 * Constantes e helpers de domínio para o módulo de estoque.
 */

export const MOVEMENT_TYPES = {
  IN:     'entrada',
  OUT:    'saida',
  ADJ:    'ajuste',
}

export const MOVEMENT_LABELS = {
  [MOVEMENT_TYPES.IN]:  { label: 'Entrada',  color: 'text-[var(--color-success)]', bg: 'bg-[var(--color-success-bg)]' },
  [MOVEMENT_TYPES.OUT]: { label: 'Saída',    color: 'text-[var(--color-error)]',   bg: 'bg-[var(--color-error-bg)]'   },
  [MOVEMENT_TYPES.ADJ]: { label: 'Ajuste',   color: 'text-[var(--color-warning)]', bg: 'bg-[var(--color-warning-bg)]' },
}

export const STOCK_FILTER = {
  ALL:   'all',
  LOW:   'baixo',
  ZERO:  'zerado',
  OK:    'ok',
}

/**
 * Calcula o status de estoque de um SKU.
 * ok     → stock > stockMin
 * baixo  → 0 < stock <= stockMin
 * zerado → stock === 0
 */
export function stockStatus(sku) {
  if (sku.stock <= 0)              return 'zerado'
  if (sku.stock <= sku.stockMin)   return 'baixo'
  return 'ok'
}

export const STATUS_META = {
  ok:     { label: 'Em estoque',   variant: 'success', dot: 'bg-green-500'  },
  baixo:  { label: 'Estoque baixo', variant: 'warning', dot: 'bg-amber-500' },
  zerado: { label: 'Zerado',        variant: 'error',   dot: 'bg-red-500'   },
}

export const fmtDate = (iso) => {
  try {
    const d = new Date(iso)
    if (!iso || isNaN(d.getTime())) return "-"
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(d)
  } catch { return "-" }
}
