/**
 * pages/whatsapp/whatsappTypes.js
 *
 * Constantes e helpers do módulo WhatsApp / WAHA.
 */

/* ─── Status da sessão WAHA ─── */
export const SESSION_STATUS = {
  STARTING:    'STARTING',
  SCAN_QR:     'SCAN_QR_CODE',
  WORKING:     'WORKING',
  FAILED:      'FAILED',
  STOPPED:     'STOPPED',
}

export const SESSION_META = {
  [SESSION_STATUS.STARTING]: {
    label:  'Iniciando…',
    color:  'text-amber-600',
    bg:     'bg-amber-50 dark:bg-amber-950',
    border: 'border-amber-300 dark:border-amber-700',
    dot:    'bg-amber-400 animate-pulse',
  },
  [SESSION_STATUS.SCAN_QR]: {
    label:  'Aguardando QR',
    color:  'text-blue-600',
    bg:     'bg-blue-50 dark:bg-blue-950',
    border: 'border-blue-300 dark:border-blue-700',
    dot:    'bg-blue-400 animate-pulse',
  },
  [SESSION_STATUS.WORKING]: {
    label:  'Conectado',
    color:  'text-green-600',
    bg:     'bg-green-50 dark:bg-green-950',
    border: 'border-green-300 dark:border-green-700',
    dot:    'bg-green-500',
  },
  [SESSION_STATUS.FAILED]: {
    label:  'Erro',
    color:  'text-red-600',
    bg:     'bg-red-50 dark:bg-red-950',
    border: 'border-red-300 dark:border-red-700',
    dot:    'bg-red-500',
  },
  [SESSION_STATUS.STOPPED]: {
    label:  'Desconectado',
    color:  'text-gray-500',
    bg:     'bg-gray-50 dark:bg-gray-900',
    border: 'border-gray-300 dark:border-gray-700',
    dot:    'bg-gray-400',
  },
}

/* ─── Status de pedido do bot ─── */
export const BOT_ORDER_STATUS = {
  PENDING_APPROVAL: 'pending_approval',
  APPROVED:         'approved',
  REJECTED:         'rejected',
}

/* ─── Formatadores ─── */
export const fmtBRL = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)

export const fmtTime = (iso) =>
  new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
    .format(new Date(iso))

export const fmtDateTime = (iso) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
