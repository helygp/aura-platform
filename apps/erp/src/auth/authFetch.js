/**
 * auth/authFetch.js
 *
 * Helper centralizado para chamadas autenticadas à API.
 *
 * Diferença para um fetch padrão:
 *   - Envia cookies (`credentials: 'include'`) e Bearer token (se existir)
 *   - Em 401 de endpoint NÃO-auth, tenta /auth/refresh UMA vez e re-executa
 *   - Refresh é dedupado: requests concorrentes que ganharem 401 compartilham 1 refresh em vôo
 *   - Sem loop infinito: cada request tem no máximo 1 tentativa de refresh
 *
 * Uso:
 *   import { authFetch } from '@/auth/authFetch'
 *   const res = await authFetch('/api/products', { method: 'POST', body: ... })
 *
 * NÃO usar para /auth/login, /auth/refresh, /auth/logout (a request seria recursiva).
 * Para esses, use diretamente o fetch ou o helper `api()` em ./api.js
 */

const API_BASE = import.meta.env.VITE_API_URL ?? ''

/* Promise compartilhada: dedupa refresh quando múltiplas requests recebem 401 simultaneamente */
let _refreshInFlight = null

function isAuthPath(path) {
  return /^\/?auth\//.test(path) || /^\/?onboarding\//.test(path)
}

async function doRefresh() {
  if (_refreshInFlight) return _refreshInFlight
  _refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) return false
      const data = await res.json().catch(() => ({}))
      // Se a resposta trouxer um novo accessToken em memória, atualiza
      if (data.accessToken) {
        try { window.__aura_mem_token__ = data.accessToken } catch {}
      }
      return true
    } catch {
      return false
    } finally {
      // Libera o slot após o ciclo de microtasks atual
      setTimeout(() => { _refreshInFlight = null }, 0)
    }
  })()
  return _refreshInFlight
}

function buildInit(opts = {}) {
  const token = (typeof window !== 'undefined' && window.__aura_mem_token__) || ''
  return {
    ...opts,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
      ...(opts.headers ?? {}),
    },
  }
}

/**
 * Fetch autenticado com refresh automático em 401.
 * Retorna o Response — não desempacota o body (consumidor decide se .json() ou .text()).
 *
 * @param {string} url        URL relativa (ex: '/api/products')
 * @param {object} opts       Opções padrão de fetch (method, body, headers...)
 * @returns {Promise<Response>}
 */
export async function authFetch(url, opts = {}) {
  const fullUrl = `${API_BASE}${url}`

  // Primeira tentativa
  let res = await fetch(fullUrl, buildInit(opts))

  // Se passou ou não é 401 → retorna direto
  if (res.status !== 401) return res

  // 401 em endpoint de /auth/* → propaga (não tem como refrescar refresh)
  if (isAuthPath(url)) return res

  // Tenta refresh (dedupado entre requests concorrentes)
  const refreshed = await doRefresh()
  if (!refreshed) return res

  // Re-executa request original com o token novo (cookie já foi atualizado pelo servidor)
  res = await fetch(fullUrl, buildInit(opts))
  return res
}

/**
 * Conveniência: authFetch + .json() + tratamento de erro.
 * Lança Error com .status/.code/.fields quando !ok.
 */
export async function authFetchJson(url, opts = {}) {
  const res = await authFetch(url, opts)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error ?? `Erro ${res.status}`)
    err.status = res.status
    err.code   = data.code
    err.fields = data.fields
    throw err
  }
  return data
}
