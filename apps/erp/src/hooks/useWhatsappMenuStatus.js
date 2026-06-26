/**
 * hooks/useWhatsappMenuStatus.js
 *
 * Determina se o item de menu WhatsApp deve ser exibido.
 *
 * Regras (espelhadas no backend /api/whatsapp/menu-status):
 *   connected  → exibe (modo completo)
 *   !connected && hasHistory → exibe (modo somente histórico)
 *   !connected && !hasHistory → oculta
 *
 * Cache em sessionStorage para evitar request em cada render.
 * TTL 60s para não travar após desconexão.
 */

import { useState, useEffect } from 'react'

const CACHE_KEY = 'aura_wpp_menu_status'
const TTL_MS    = 10_000

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { ts, data } = JSON.parse(raw)
    if (Date.now() - ts > TTL_MS) return null
    return data
  } catch {
    return null
  }
}

function writeCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }))
  } catch {}
}

export function useWhatsappMenuStatus() {
  const cached = readCache()
  const [status, setStatus] = useState(cached ?? { connected: false, hasHistory: false, show: false })
  const [ready,  setReady]  = useState(!!cached)

  useEffect(() => {
    let cancelled = false
    const doFetch = () => {
      fetch('/api/whatsapp/menu-status', { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data || cancelled) return
          writeCache(data)
          setStatus(data)
          setReady(true)
        })
        .catch(() => setReady(true))
    }
    doFetch()
    const interval = setInterval(doFetch, 10000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  return { ...status, ready }
}
