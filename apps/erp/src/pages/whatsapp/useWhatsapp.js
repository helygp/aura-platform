/**
 * pages/whatsapp/useWhatsapp.js — sem dados mockados
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../auth/AuthContext.jsx'
import { SESSION_STATUS, BOT_ORDER_STATUS } from './whatsappTypes.js'

function authFetch(url, opts = {}) {
  const token = window.__aura_mem_token__ || ''
  return fetch(url, {
    ...opts,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(opts.headers ?? {}),
    },
  })
}

export function useWhatsapp() {
  const { user } = useAuth()
  const [session,  setSession]  = useState({ status: SESSION_STATUS.STOPPED, phone: null, name: null })
  const [qrCode,   setQrCode]   = useState(null)
  const [orders,   setOrders]   = useState([])
  const [messages, setMessages] = useState([])
  const [loading,  setLoading]  = useState({ session: true, orders: true, messages: true })
  const [sending,  setSending]  = useState(false)
  const pollRef = useRef(null)

  const fetchSession = useCallback(async () => {
    try {
      const res = await authFetch('/api/whatsapp/session')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSession(data)
      if (data.status === SESSION_STATUS.SCAN_QR) {
        const qRes = await authFetch('/api/whatsapp/qr')
        if (qRes.ok) { const q = await qRes.json(); setQrCode(q.qr) }
      } else {
        setQrCode(null)
      }
    } catch (_e) {
      setSession(s => s ?? { status: SESSION_STATUS.STOPPED, phone: null, name: null })
    } finally {
      setLoading(p => ({ ...p, session: false }))
    }
  }, [])

  const fetchOrders = useCallback(async () => {
    try {
      const res = await authFetch('/api/whatsapp/orders')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setOrders(data.orders ?? [])
    } catch (_e) {
      setOrders([])
    } finally {
      setLoading(p => ({ ...p, orders: false }))
    }
  }, [])

  const fetchMessages = useCallback(async () => {
    try {
      const res = await authFetch('/api/whatsapp/messages')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMessages(data.messages ?? [])
    } catch (_e) {
      setMessages([])
    } finally {
      setLoading(p => ({ ...p, messages: false }))
    }
  }, [])

  useEffect(() => {
    if (!user) return
    fetchSession()
    fetchOrders()
    fetchMessages()
    pollRef.current = setInterval(() => fetchSession(), 10000)
    return () => clearInterval(pollRef.current)
  }, [user, fetchSession, fetchOrders, fetchMessages])

  const startSession = useCallback(async () => {
    setLoading(p => ({ ...p, session: true }))
    try { await authFetch('/api/whatsapp/session/start', { method: 'POST', body: '{}' }) } catch (_e) {}
    setTimeout(fetchSession, 1500)
  }, [fetchSession])

  const stopSession = useCallback(async () => {
    setLoading(p => ({ ...p, session: true }))
    try { await authFetch('/api/whatsapp/session/stop', { method: 'POST', body: '{}' }) } catch (_e) {}
    setSession(p => ({ ...p, status: SESSION_STATUS.STOPPED }))
    setLoading(p => ({ ...p, session: false }))
  }, [])

  const reviewOrder = useCallback(async (orderId, approved, note = '') => {
    const newStatus = approved ? BOT_ORDER_STATUS.APPROVED : BOT_ORDER_STATUS.REJECTED
    try {
      await authFetch(`/api/whatsapp/orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus, note }),
      })
    } catch (_e) {}
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o))
  }, [])

  const sendMessage = useCallback(async ({ to, message }) => {
    setSending(true)
    try {
      const res = await authFetch('/api/whatsapp/send', {
        method: 'POST',
        body: JSON.stringify({ to, message }),
      })
      if (!res.ok) throw new Error()
      setMessages(prev => [{
        id: `msg-manual-${Date.now()}`, from: 'bot',
        text: message, phone: to, contactName: to,
        at: new Date().toISOString(),
      }, ...prev])
      return true
    } catch (_e) {
      throw new Error('Erro ao enviar mensagem')
    } finally {
      setSending(false)
    }
  }, [])

  const pendingCount = orders.filter(o => o.status === BOT_ORDER_STATUS.PENDING_APPROVAL).length

  return {
    session, qrCode, orders, messages,
    loading, sending, pendingCount,
    startSession, stopSession, reviewOrder, sendMessage,
    refetch: () => { fetchSession(); fetchOrders(); fetchMessages() },
  }
}
