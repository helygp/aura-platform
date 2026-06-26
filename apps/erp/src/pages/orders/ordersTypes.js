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

/* Fluxo de transições permitidas por status (UI) */
export const STATUS_TRANSITIONS = {
  [ORDER_STATUS.PENDING]:   [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PICKING,   ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PICKING]:   [ORDER_STATUS.SHIPPED,   ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPED]:   [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [], // devolução é uma ação separada (botão próprio)
  [ORDER_STATUS.CANCELLED]: [],
}

/* Status do pedido + eventos extra que aparecem em order_history (timeline) */
export const STATUS_META = {
  [ORDER_STATUS.PENDING]:   { label: 'Pendente',   color: 'text-amber-600',   bg: 'bg-amber-50  dark:bg-amber-950',  border: 'border-amber-300 dark:border-amber-700',  dot: 'bg-amber-500'  },
  [ORDER_STATUS.CONFIRMED]: { label: 'Confirmado', color: 'text-blue-600',    bg: 'bg-blue-50   dark:bg-blue-950',   border: 'border-blue-300  dark:border-blue-700',   dot: 'bg-blue-500'   },
  [ORDER_STATUS.PICKING]:   { label: 'Separando',  color: 'text-violet-600',  bg: 'bg-violet-50 dark:bg-violet-950', border: 'border-violet-300 dark:border-violet-700', dot: 'bg-violet-500' },
  [ORDER_STATUS.SHIPPED]:   { label: 'Enviado',    color: 'text-cyan-600',    bg: 'bg-cyan-50   dark:bg-cyan-950',   border: 'border-cyan-300  dark:border-cyan-700',   dot: 'bg-cyan-500'   },
  [ORDER_STATUS.DELIVERED]: { label: 'Entregue',   color: 'text-green-600',   bg: 'bg-green-50  dark:bg-green-950',  border: 'border-green-300 dark:border-green-700',  dot: 'bg-green-500'  },
  [ORDER_STATUS.CANCELLED]: { label: 'Cancelado',  color: 'text-red-500',     bg: 'bg-red-50    dark:bg-red-950',    border: 'border-red-300   dark:border-red-700',    dot: 'bg-red-500'    },
  // Eventos só de timeline (#83/#117):
  item_adicionado:          { label: 'Item adicionado', color: 'text-blue-500',  bg: '', border: '', dot: 'bg-blue-400' },
  item_editado:             { label: 'Item editado',    color: 'text-slate-500', bg: '', border: '', dot: 'bg-slate-400' },
  item_removido:            { label: 'Item removido',   color: 'text-orange-500',bg: '', border: '', dot: 'bg-orange-400' },
  item_cancelado:           { label: 'Item cancelado',  color: 'text-red-400',   bg: '', border: '', dot: 'bg-red-300' },
  item_devolvido:           { label: 'Item devolvido',  color: 'text-amber-500', bg: '', border: '', dot: 'bg-amber-400' },
  devolucao_parcial:        { label: 'Devolução parcial', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950', border: 'border-amber-300 dark:border-amber-700', dot: 'bg-amber-500' },
  devolucao_total:          { label: 'Devolução total',   color: 'text-red-500',   bg: 'bg-red-50    dark:bg-red-950',  border: 'border-red-300   dark:border-red-700',  dot: 'bg-red-500'   },
}

/* ─── Método de pagamento ─── */
export const PAYMENT_METHOD = {
  PIX:        'pix',
  BOLETO:     'boleto',
  CREDITO:    'credito',
  A_COMBINAR: 'a_combinar',
}

export const PAYMENT_METHOD_META = {
  [PAYMENT_METHOD.PIX]:        { label: 'Pix',        icon: '⚡', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950', border: 'border-emerald-300 dark:border-emerald-700' },
  [PAYMENT_METHOD.BOLETO]:     { label: 'Boleto',     icon: '🧾', color: 'text-orange-600',  bg: 'bg-orange-50  dark:bg-orange-950',  border: 'border-orange-300  dark:border-orange-700'  },
  [PAYMENT_METHOD.CREDITO]:    { label: 'Crédito',    icon: '💳', color: 'text-violet-600',  bg: 'bg-violet-50  dark:bg-violet-950',  border: 'border-violet-300  dark:border-violet-700'  },
  [PAYMENT_METHOD.A_COMBINAR]: { label: 'A combinar', icon: '🤝', color: 'text-slate-500',   bg: 'bg-slate-50   dark:bg-slate-900',   border: 'border-slate-300   dark:border-slate-700'   },
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

/* ─── Calcula totais de um pedido ───
 * Considera qty_returned (devoluções parciais — #117) e ignora itens cancelados.
 * `effectiveQty` é qty - qtyReturned. */
export function calcOrderTotals(items) {
  const list = items ?? []
  const active = list.filter(i => i.status !== 'cancelado')
  const subtotal = active.reduce(
    (s, i) => s + (Number(i.priceUnit) * (Number(i.qty) - Number(i.qtyReturned ?? 0))),
    0
  )
  const totalUnits = active.reduce(
    (s, i) => s + (Number(i.qty) - Number(i.qtyReturned ?? 0)),
    0
  )
  return { subtotal, total: subtotal, totalUnits }
}

/* ─── Gera número de pedido legível ─── */
// ref: presente em pedidos da loja (ex: FM070626-1042) — exibido como complemento
export function orderNumber(id, number, ref) {
  const base = number != null ? `#${number}` : `#${String(id).slice(-6).toUpperCase()}`
  if (ref) return `${base} · ${ref}`
  return base
}
