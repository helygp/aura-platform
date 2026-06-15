/**
 * pages/orders/useOrderDraft.js
 *
 * Ticket #49: rascunho de pedido persistido no servidor com fallback localStorage.
 *
 * API:
 *   draft          — { customerId, customerName, customerWhatsapp, channel, notes, items, updatedAt } | null
 *   status         — 'idle' | 'loading' | 'saving' | 'saved' | 'offline'
 *   lastSavedAt    — Date | null (horário do último save confirmado pelo servidor)
 *   load()         — busca do servidor (chamado ao abrir modal)
 *   save(payload)  — autosave debounced — servidor + localStorage fallback
 *   discard()      — apaga no servidor + localStorage
 *   clearLocal()   — limpa só o cache local (após pedido criado com sucesso)
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { authFetch } from '../../auth/authFetch.js'
import { useAuth } from '../../auth/AuthContext.jsx'

const DEBOUNCE_MS   = 1000
const LS_KEY_PREFIX = 'aura:order-draft:v1'

function lsKey(tenantSlug, userId) {
  return `${LS_KEY_PREFIX}:${tenantSlug ?? 'unknown'}:${userId}`
}

function readLS(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function writeLS(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch { /* quota etc */ }
}

function clearLS(key) {
  try { localStorage.removeItem(key) } catch {}
}

export function useOrderDraft() {
  const { user } = useAuth()
  const [draft,       setDraft]       = useState(null)
  const [status,      setStatus]      = useState('idle')   // idle | loading | saving | saved | offline
  const [lastSavedAt, setLastSavedAt] = useState(null)

  const timerRef = useRef(null)
  const key      = user ? lsKey(user.tenantSlug, user.id ?? user.tokenId) : null

  /* ─── load ─── */
  const load = useCallback(async () => {
    if (!user) return null
    setStatus('loading')
    try {
      const res = await authFetch('/api/orders/drafts/mine')
      if (res.ok) {
        const { draft: serverDraft } = await res.json()
        if (serverDraft) {
          setDraft(serverDraft)
          setLastSavedAt(serverDraft.updatedAt ? new Date(serverDraft.updatedAt) : null)
          // espelha no localStorage
          if (key) writeLS(key, serverDraft)
          setStatus('saved')
          return serverDraft
        }

        // Servidor respondeu OK com draft: null → não existe rascunho.
        // Limpa localStorage pra manter sincronia (draft pode ter sido
        // descartado em outro dispositivo).
        if (key) clearLS(key)
        setDraft(null)
        setStatus('idle')
        return null
      }
      // res não ok (ex: 500) — cai no fallback abaixo
    } catch {
      // servidor indisponível — cai no fallback abaixo
    }

    // fallback: localStorage — SÓ quando o servidor está inacessível/com erro
    if (key) {
      const local = readLS(key)
      if (local) {
        setDraft(local)
        setStatus('offline')
        return local
      }
    }

    setDraft(null)
    setStatus('idle')
    return null
  }, [user, key])

  /* ─── save (debounced) ─── */
  const save = useCallback((payload) => {
    if (!user) return
    // Snapshot local imediato (proteção contra crash/reload)
    if (key) writeLS(key, { ...payload, updatedAt: new Date().toISOString() })

    // Debounce do request ao servidor
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setStatus('saving')
      try {
        const res = await authFetch('/api/orders/drafts/mine', {
          method: 'PUT',
          body: JSON.stringify({
            customerId:        payload.customerId   || null,
            customerName:      payload.customerName || null,
            customerWhatsapp:  payload.customerWhatsapp || null,
            channel:           payload.channel      || 'manual',
            notes:             payload.notes        || '',
            items:             payload.items        || [],
          }),
        })
        if (res.ok) {
          const data = await res.json()
          setLastSavedAt(data.updatedAt ? new Date(data.updatedAt) : new Date())
          setStatus('saved')
        } else {
          setStatus('offline')
        }
      } catch {
        setStatus('offline')
      }
    }, DEBOUNCE_MS)
  }, [user, key])

  /* ─── discard ─── */
  const discard = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (key) clearLS(key)
    setDraft(null)
    setStatus('idle')
    setLastSavedAt(null)
    try {
      await authFetch('/api/orders/drafts/mine', { method: 'DELETE' })
    } catch { /* best-effort */ }
  }, [key])

  /* ─── clearLocal (chamado após criar pedido — backend já apagou) ─── */
  const clearLocal = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (key) clearLS(key)
    setDraft(null)
    setStatus('idle')
    setLastSavedAt(null)
  }, [key])

  /* cleanup on unmount */
  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  return { draft, status, lastSavedAt, load, save, discard, clearLocal }
}
