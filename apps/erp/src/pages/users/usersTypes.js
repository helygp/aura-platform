/**
 * pages/users/usersTypes.js
 *
 * Constantes, permissões e helpers do módulo de usuários.
 *
 * Multi-role: usuários podem ter múltiplos perfis. Admin > todos.
 */

/* ─── Papéis disponíveis (igual ao authorize.js da API) ─── */
export const ROLES = {
  admin:      { key: 'admin',      label: 'Admin',      level: 4, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950', border: 'border-violet-300 dark:border-violet-700' },
  financeiro: { key: 'financeiro', label: 'Financeiro', level: 3, color: 'text-blue-600',   bg: 'bg-blue-50   dark:bg-blue-950',   border: 'border-blue-300   dark:border-blue-700'   },
  estoque:    { key: 'estoque',    label: 'Estoque',    level: 2, color: 'text-amber-600',  bg: 'bg-amber-50  dark:bg-amber-950',  border: 'border-amber-300  dark:border-amber-700'  },
  operador:   { key: 'operador',   label: 'Operador',   level: 1, color: 'text-green-600',  bg: 'bg-green-50  dark:bg-green-950',  border: 'border-green-300  dark:border-green-700'  },
}

export const ROLE_LIST = Object.values(ROLES)

/* Normaliza qualquer entrada de roles em array de keys lowercase válidos */
export function normalizeRoles(input) {
  if (!input) return []
  const arr = Array.isArray(input) ? input : [input]
  const seen = new Set()
  const out  = []
  for (const r of arr) {
    if (!r) continue
    const k = String(r).toLowerCase().trim()
    if (ROLES[k] && !seen.has(k)) { seen.add(k); out.push(k) }
  }
  return out
}

/* Retorna o role de maior hierarquia */
export function maxRole(roles) {
  const arr = normalizeRoles(roles)
  if (!arr.length) return null
  return arr.reduce((best, r) => (ROLES[r].level > ROLES[best].level ? r : best), arr[0])
}

/* ─── Status do convite / conta ─── */
export const USER_STATUS = {
  ACTIVE:  'ativo',
  INVITED: 'convidado',
  REVOKED: 'revogado',
}

export const STATUS_META = {
  [USER_STATUS.ACTIVE]:  { label: 'Ativo',      dot: 'bg-green-500', color: 'text-green-600', bg: 'bg-green-50  dark:bg-green-950',  border: 'border-green-300 dark:border-green-700'  },
  [USER_STATUS.INVITED]: { label: 'Convidado',  dot: 'bg-amber-400 animate-pulse', color: 'text-amber-600', bg: 'bg-amber-50  dark:bg-amber-950',  border: 'border-amber-300 dark:border-amber-700'  },
  [USER_STATUS.REVOKED]: { label: 'Revogado',   dot: 'bg-gray-400',  color: 'text-gray-500',  bg: 'bg-gray-50   dark:bg-gray-900',   border: 'border-gray-300  dark:border-gray-700'   },
}

/* ─── Matriz de permissões por módulo × papel ───
 * Usada apenas como referência visual (matrix). Permissão efetiva é calculada
 * server-side via settings.access_permissions.
 */
export const MODULE_PERMISSIONS = [
  { module: 'Dashboard',     key: 'dashboard', perms: { admin: 'total', financeiro: 'leitura', estoque: 'leitura', operador: 'leitura' } },
  { module: 'Produtos',      key: 'products',  perms: { admin: 'total', financeiro: '—',       estoque: 'total',   operador: 'leitura' } },
  { module: 'Estoque',       key: 'inventory', perms: { admin: 'total', financeiro: 'leitura', estoque: 'total',   operador: '—'       } },
  { module: 'Pedidos',       key: 'orders',    perms: { admin: 'total', financeiro: 'leitura', estoque: '—',       operador: 'total'   } },
  { module: 'Clientes',      key: 'customers', perms: { admin: 'total', financeiro: 'leitura', estoque: '—',       operador: 'total'   } },
  { module: 'WhatsApp',      key: 'whatsapp',  perms: { admin: 'total', financeiro: '—',       estoque: '—',       operador: 'total'   } },
  { module: 'Configurações', key: 'settings',  perms: { admin: 'total', financeiro: '—',       estoque: '—',       operador: '—'       } },
  { module: 'Usuários',      key: 'users',     perms: { admin: 'total', financeiro: '—',       estoque: '—',       operador: '—'       } },
]

/* ─── Formatadores ─── */
export const fmtDate = (iso) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(iso))

/* ─── Validação do login ───
 * Regras: 3-20 chars, [a-z0-9_.-], sem espaço.
 */
const LOGIN_RE = /^[a-z0-9_.-]{3,20}$/

export function validateLoginField(value) {
  if (!value) return 'Login é obrigatório.'
  const v = String(value).toLowerCase().trim()
  if (!LOGIN_RE.test(v)) return 'Use 3-20 letras minúsculas, números, ponto, traço ou sublinhado.'
  return null
}

/* ─── Validação do formulário de convite/edição ─── */
export function validateInvite(form, { isEdit = false } = {}) {
  const errors = {}
  if (!form.name?.trim())             errors.name  = 'Nome é obrigatório.'

  if (!form.email?.trim())            errors.email = 'E-mail é obrigatório.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    errors.email = 'E-mail inválido.'

  if (form.login) {
    const e = validateLoginField(form.login)
    if (e) errors.login = e
  } else if (!isEdit) {
    // No invite, se vazio, o backend deriva. Aqui só validamos se preenchido.
  }

  const roles = normalizeRoles(form.roles ?? (form.role ? [form.role] : []))
  if (!roles.length) errors.roles = 'Selecione ao menos um perfil.'

  return errors
}

/* ─── Helper: extrai array normalizado de roles de um user record ─── */
export function userRoles(u) {
  if (!u) return []
  if (Array.isArray(u.roles) && u.roles.length) return normalizeRoles(u.roles)
  if (u.role) return normalizeRoles([u.role])
  return []
}
