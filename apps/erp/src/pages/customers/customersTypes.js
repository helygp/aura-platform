/**
 * pages/customers/customersTypes.js
 *
 * Constantes, helpers e formatadores do módulo de clientes.
 */

/* ─── Tipo de pessoa ─── */
export const PERSON_TYPE = {
  PJ: 'pj',  // CNPJ
  PF: 'pf',  // CPF
}

/* ─── Status do cliente ─── */
export const CUSTOMER_STATUS = {
  ACTIVE:   'ativo',
  INACTIVE: 'inativo',
  BLOCKED:  'bloqueado',
}

export const STATUS_META = {
  [CUSTOMER_STATUS.ACTIVE]:   { label: 'Ativo',     dot: 'bg-green-500', color: 'text-green-600', bg: 'bg-green-50  dark:bg-green-950',  border: 'border-green-300 dark:border-green-700'  },
  [CUSTOMER_STATUS.INACTIVE]: { label: 'Inativo',   dot: 'bg-gray-400',  color: 'text-gray-500',  bg: 'bg-gray-50   dark:bg-gray-900',   border: 'border-gray-300  dark:border-gray-700'   },
  [CUSTOMER_STATUS.BLOCKED]:  { label: 'Bloqueado', dot: 'bg-red-500',   color: 'text-red-600',   bg: 'bg-red-50    dark:bg-red-950',    border: 'border-red-300   dark:border-red-700'    },
}

/* ─── Estados brasileiros ─── */
export const BR_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
]

/* ─── Formatadores ─── */
export const fmtBRL = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)

export const fmtDate = (iso) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(iso))

/* ─── Máscaras ─── */
export function maskCNPJ(v = '') {
  return v.replace(/\D/g, '').slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function maskCPF(v = '') {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export function maskPhone(v = '') {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{4,5})(\d{4})$/, '$1-$2')
}

export function maskCEP(v = '') {
  return v.replace(/\D/g, '').slice(0, 8)
    .replace(/^(\d{5})(\d)/, '$1-$2')
}

/* ─── Validação básica ─── */
export function validateCustomer(form) {
  const errors = {}
  if (!form.name?.trim())     errors.name     = 'Nome é obrigatório.'
  if (!form.document?.trim()) errors.document = 'CNPJ/CPF é obrigatório.'
  if (!form.whatsapp?.trim()) errors.whatsapp = 'WhatsApp é obrigatório.'
  if (form.creditLimit !== '' && isNaN(Number(form.creditLimit)))
    errors.creditLimit = 'Valor inválido.'
  return errors
}

/* ─── Resumo de pedidos do cliente ─── */
export function customerOrderStats(orders) {
  const total      = orders.length
  const totalValue = orders.reduce((s, o) => s + (Number(o.total) || 0), 0)
  const last       = orders.length
    ? orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
    : null
  return { total, totalValue, last }
}
