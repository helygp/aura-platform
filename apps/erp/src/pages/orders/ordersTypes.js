/**
 * pages/orders/ordersTypes.js
 *
 * Constantes, helpers e formatadores do módulo de pedidos.
 */

/* ─── Status do pedido ─── */
export const ORDER_STATUS = {
  PENDING:    'pendente',
  CONFIRMED:  'confirmado',
  PICKING:    'separando',
  SHIPPED:    'enviado',
  DELIVERED:  'entregue',
  CANCELLED:  'cancelado',
}

/* Fluxo de transições permitidas por status */
export const STATUS_TRANSITIONS = {
  [ORDER_STATUS.PENDING]:   [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PICKING,   ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PICKING]:   [ORDER_STATUS.SHIPPED,   ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPED]:   [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELLED]: [],
}

export const STATUS_META = {
  [ORDER_STATUS.PENDING]:   { label: 'Pendente',   color: 'text-amber-600',   bg: 'bg-amber-50  dark:bg-amber-950',  border: 'border-amber-300 dark:border-amber-700',  dot: 'bg-amber-500'  },
  [ORDER_STATUS.CONFIRMED]: { label: 'Confirmado', color: 'text-blue-600',    bg: 'bg-blue-50   dark:bg-blue-950',   border: 'border-blue-300  dark:border-blue-700',   dot: 'bg-blue-500'   },
  [ORDER_STATUS.PICKING]:   { label: 'Separando',  color: 'text-violet-600',  bg: 'bg-violet-50 dark:bg-violet-950', border: 'border-violet-300 dark:border-violet-700', dot: 'bg-violet-500' },
  [ORDER_STATUS.SHIPPED]:   { label: 'Enviado',    color: 'text-cyan-600',    bg: 'bg-cyan-50   dark:bg-cyan-950',   border: 'border-cyan-300  dark:border-cyan-700',   dot: 'bg-cyan-500'   },
  [ORDER_STATUS.DELIVERED]: { label: 'Entregue',   color: 'text-green-600',   bg: 'bg-green-50  dark:bg-green-950',  border: 'border-green-300 dark:border-green-700',  dot: 'bg-green-500'  },
  [ORDER_STATUS.CANCELLED]: { label: 'Cancelado',  color: 'text-red-500',     bg: 'bg-red-50    dark:bg-red-950',    border: 'border-red-300   dark:border-red-700',    dot: 'bg-red-500'    },
}

/* ─── Canal de origem ─── */
export const ORDER_CHANNEL = {
  WHATSAPP: 'whatsapp',
  MANUAL:   'manual',
  STORE:    'loja',
}

export const CHANNEL_META = {
  [ORDER_CHANNEL.WHATSAPP]: { label: 'WhatsApp', icon: '💬' },
  [ORDER_CHANNEL.MANUAL]:   { label: 'Manual',   icon: '✏️'  },
  [ORDER_CHANNEL.STORE]:    { label: 'Loja',     icon: '🛒' },
}

/* ─── Formatadores ─── */
export const fmtBRL = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)

export const fmtDate = (iso) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))

export const fmtDateShort = (iso) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(iso))

/* ─── Calcula totais de um pedido ─── */
export function calcOrderTotals(items) {
  const subtotal = items.reduce((s, i) => s + (Number(i.priceUnit) * Number(i.qty)), 0)
  return { subtotal, total: subtotal }
}

/* ─── Gera número de pedido legível ─── */
export function orderNumber(id) {
  return `#${String(id).slice(-6).toUpperCase()}`
}
