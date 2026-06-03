/**
 * lib/api.js — cliente HTTP para /master/*
 * Injeta x-master-secret em todas as requisições.
 */

const BASE   = import.meta.env.VITE_API_URL ?? ''
const SECRET = import.meta.env.VITE_MASTER_SECRET ?? ''

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-master-secret': SECRET,
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err  = new Error(body.error ?? `HTTP ${res.status}`)
    err.status = res.status
    err.fields  = body.fields
    throw err
  }
  return res.json()
}

export const api = {
  tenants: {
    list:   (params = {}) => {
      const q = new URLSearchParams(params).toString()
      return request(`/master/tenants${q ? '?' + q : ''}`)
    },
    get:    (slug) => request(`/master/tenants/${slug}`),
    create: (body) => request('/master/tenants', { method: 'POST', body: JSON.stringify(body) }),
    status: (slug, status, reason) =>
      request(`/master/tenants/${slug}/status`, {
        method: 'PATCH',
        body:   JSON.stringify({ status, reason }),
      }),
  },
  billing: {
    overview: (months = 12) => request(`/master/billing?months=${months}`),
  },
  metrics: {
    get: () => request('/master/metrics'),
  },
}
