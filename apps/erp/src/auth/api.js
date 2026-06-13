/**
 * auth/api.js
 * Funções que conversam com services/api — sem expor fetch diretamente.
 * Cookies httpOnly são gerenciados pelo browser automaticamente.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? ''

// Token em memória para enviar via Bearer (além do cookie)
let _memToken = null
export function setMemToken(t) { _memToken = t; try { window.__aura_mem_token__ = t } catch(_) {} }
export function getMemToken()  { return _memToken }

export async function apiRequest(path, options = {}) { return api(path, options) }

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(_memToken ? { 'Authorization': 'Bearer ' + _memToken } : {}),
      ...(options.headers ?? {}),
    },
    ...options,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const err  = new Error(data.error ?? 'Erro desconhecido')
    err.status = res.status
    err.fields = data.fields
    err.code   = data.code
    throw err
  }

  return data
}

/* ─── Auth ─── */

/**
 * Login aceita { identifier, password } (novo) — identifier = login OU email.
 * Mantém compatibilidade com { email, password } legado.
 */
export async function apiLogin({ identifier, email, password }) {
  const body = identifier
    ? { identifier, password }
    : { email, password }   // legacy
  return api('/auth/login', {
    method: 'POST',
    body:   JSON.stringify(body),
  })
}

export async function apiRefresh() {
  return api('/auth/refresh', { method: 'POST' })
}

export async function apiLogout() {
  return api('/auth/logout', { method: 'POST' })
}

export async function apiMe() {
  return api('/auth/me')
}

/* ── Billing self-service ──────────────────────────────────── */

export async function apiBillingInfo() {
  return api('/api/tenant/billing')
}

export async function apiChangePlan(planId) {
  return api('/api/tenant/plan', {
    method: 'PATCH',
    body:   JSON.stringify({ planId }),
  })
}

export async function apiCancelSubscription() {
  return api('/api/tenant/cancel', {
    method: 'POST',
    body:   JSON.stringify({ confirm: true }),
  })
}

export async function apiListPlans() {
  return api('/onboarding/plans')
}

/* ── Troca de senha do próprio usuário (usado na troca forçada) ── */
export async function apiChangeMyPassword({ currentPassword, newPassword }) {
  return api('/api/users/me/password', {
    method: 'PUT',
    body:   JSON.stringify({ currentPassword, newPassword }),
  })
}
