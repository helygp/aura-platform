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
    whatsapp: {
      get:        (slug)       => request(`/master/tenants/${slug}/whatsapp`),
      update:     (slug, patch) => request(`/master/tenants/${slug}/whatsapp`, { method: 'PUT', body: JSON.stringify(patch) }),
      rotateKeys: (slug)       => request(`/master/tenants/${slug}/whatsapp/rotate-keys`, { method: 'POST' }),
      provision:  (slug, body) => request(`/master/tenants/${slug}/whatsapp/provision`, { method: 'POST', body: JSON.stringify(body ?? {}) }),
    },
  },
  billing: {
    overview: (months = 12) => request(`/master/billing?months=${months}`),
  },
  metrics: {
    get: () => request('/master/metrics'),
  },
  analytics: {
    users:      (slug)            => request(`/master/analytics/${slug}/users`),
    sessions:   (slug, params={}) => {
      const q = new URLSearchParams(params).toString()
      return request(`/master/analytics/${slug}/sessions${q ? '?' + q : ''}`)
    },
    health:     (slug)            => request(`/master/analytics/${slug}/health`),
    logs:       (slug, container, tail=200) =>
      request(`/master/analytics/${slug}/logs/${container}?tail=${tail}`),
    heatmap:    (slug)            => request(`/master/analytics/${slug}/heatmap`),
    events:     (slug, params={}) => {
      const q = new URLSearchParams(params).toString()
      return request(`/master/analytics/${slug}/events${q ? '?' + q : ''}`)
    },
    revoke:     (slug, userId)    =>
      request(`/master/analytics/${slug}/users/${userId}/revoke`, { method: 'POST' }),
    suspicious: (slug)            => request(`/master/analytics/${slug}/suspicious`),
  },
  backups: {
    summary:    ()       => request('/master/backups'),
    policies:   ()       => request('/master/backups/policies'),
    jobs:       (limit=100) => request(`/master/backups/jobs?limit=${limit}`),
    heatmap:    ()       => request('/master/backups/jobs/heatmap'),
    runNow:     (slug, label) =>
      request(`/master/backups/run-now/${slug}`, {
        method: 'POST',
        body:   JSON.stringify({ label: label || null }),
      }),
    snapshotAll:(label)  =>
      request('/master/backups/snapshot-all', {
        method: 'POST',
        body:   JSON.stringify({ label: label || null }),
      }),
    settings: {
      get:    ()           => request('/master/backups/settings'),
      update: (changes)    => request('/master/backups/settings', {
        method: 'PATCH',
        body:   JSON.stringify(changes),
      }),
    },
    updatePolicy: (slug, changes) =>
      request(`/master/backups/policies/${slug}`, {
        method: 'PATCH',
        body:   JSON.stringify(changes),
      }),
  },
}
