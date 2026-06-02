/**
 * pages/users/usersTypes.js
 *
 * Constantes, permissões e helpers do módulo de usuários.
 */

/* ─── Papéis disponíveis (igual ao authorize.js da API) ─── */
export const ROLES = {
  admin:      { key: 'admin',      label: 'Admin',      level: 4, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950', border: 'border-violet-300 dark:border-violet-700' },
  financeiro: { key: 'financeiro', label: 'Financeiro', level: 3, color: 'text-blue-600',   bg: 'bg-blue-50   dark:bg-blue-950',   border: 'border-blue-300   dark:border-blue-700'   },
  estoque:    { key: 'estoque',    label: 'Estoque',    level: 2, color: 'text-amber-600',  bg: 'bg-amber-50  dark:bg-amber-950',  border: 'border-amber-300  dark:border-amber-700'  },
  operador:   { key: 'operador',   label: 'Operador',   level: 1, color: 'text-green-600',  bg: 'bg-green-50  dark:bg-green-950',  border: 'border-green-300  dark:border-green-700'  },
}

export const ROLE_LIST = Object.values(ROLES)

/* ─── Status do convite / conta ─── */
export const USER_STATUS = {
  ACTIVE:  'ativo',
  INVITED: 'convidado',  // convite enviado, ainda não aceitou
  REVOKED: 'revogado',
}

export const STATUS_META = {
  [USER_STATUS.ACTIVE]:  { label: 'Ativo',      dot: 'bg-green-500', color: 'text-green-600', bg: 'bg-green-50  dark:bg-green-950',  border: 'border-green-300 dark:border-green-700'  },
  [USER_STATUS.INVITED]: { label: 'Convidado',  dot: 'bg-amber-400 animate-pulse', color: 'text-amber-600', bg: 'bg-amber-50  dark:bg-amber-950',  border: 'border-amber-300 dark:border-amber-700'  },
  [USER_STATUS.REVOKED]: { label: 'Revogado',   dot: 'bg-gray-400',  color: 'text-gray-500',  bg: 'bg-gray-50   dark:bg-gray-900',   border: 'border-gray-300  dark:border-gray-700'   },
}

/* ─── Matriz de permissões por módulo × papel ─── */
export const MODULE_PERMISSIONS = [
  {
    module:  'Dashboard',
    key:     'dashboard',
    perms:   { admin: 'total', financeiro: 'leitura', estoque: 'leitura', operador: 'leitura' },
  },
  {
    module:  'Produtos',
    key:     'products',
    perms:   { admin: 'total', financeiro: '—', estoque: 'total', operador: 'leitura' },
  },
  {
    module:  'Estoque',
    key:     'inventory',
    perms:   { admin: 'total', financeiro: 'leitura', estoque: 'total', operador: '—' },
  },
  {
    module:  'Pedidos',
    key:     'orders',
    perms:   { admin: 'total', financeiro: 'leitura', estoque: '—', operador: 'total' },
  },
  {
    module:  'Clientes',
    key:     'customers',
    perms:   { admin: 'total', financeiro: 'leitura', estoque: '—', operador: 'total' },
  },
  {
    module:  'WhatsApp',
    key:     'whatsapp',
    perms:   { admin: 'total', financeiro: '—', estoque: '—', operador: 'total' },
  },
  {
    module:  'Configurações',
    key:     'settings',
    perms:   { admin: 'total', financeiro: '—', estoque: '—', operador: '—' },
  },
  {
    module:  'Usuários',
    key:     'users',
    perms:   { admin: 'total', financeiro: '—', estoque: '—', operador: '—' },
  },
]

/* ─── Formatadores ─── */
export const fmtDate = (iso) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(iso))

/* ─── Validação de convite ─── */
export function validateInvite(form) {
  const errors = {}
  if (!form.email?.trim())            errors.email = 'E-mail é obrigatório.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email ?? ''))
    errors.email = 'E-mail inválido.'
  if (!form.role)                     errors.role  = 'Selecione um papel.'
  if (!form.name?.trim())             errors.name  = 'Nome é obrigatório.'
  return errors
}
