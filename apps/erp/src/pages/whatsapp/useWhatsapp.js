/**
 * pages/whatsapp/useWhatsapp.js
 *
 * Hook de dados do módulo WhatsApp.
 *
 * Integra com:
 *   GET  /api/whatsapp/session       — status da sessão WAHA
 *   GET  /api/whatsapp/qr            — QR code (base64) quando SCAN_QR
 *   POST /api/whatsapp/session/start — inicia sessão
 *   POST /api/whatsapp/session/stop  — para sessão
 *   GET  /api/whatsapp/orders        — pedidos pendentes de aprovação
 *   PUT  /api/whatsapp/orders/:id    — aprovar / recusar
 *   GET  /api/whatsapp/messages      — histórico de mensagens do bot
 *   POST /api/whatsapp/send          — envio manual { to, message }
 *
 * Polling automático de status a cada 5s quando STARTING ou SCAN_QR.
 * Mock completo quando a API não responde.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { SESSION_STATUS, BOT_ORDER_STATUS } from './whatsappTypes.js'

/* ─── Mock ─── */
function mockSession() {
  return { status: SESSION_STATUS.STOPPED, phone: null, name: null }
}

function mockOrders() {
  return [
    {
      id: 'bot-ord-1',
      botOrderId: 'BOT-001',
      customerName: 'Distribuidora São Paulo',
      customerPhone: '11999990001',
      items: [
        { productName: 'Tênis Runner Pro', attributes: { Tamanho: 'M', Cor: 'Preto' }, qty: 4, priceUnit: 89.90 },
        { productName: 'Camiseta Básica',  attributes: {},                             qty: 10, priceUnit: 39.90 },
      ],
      total: 758.60,
      status: BOT_ORDER_STATUS.PENDING_APPROVAL,
      receivedAt: new Date(Date.now() - 8 * 60000).toISOString(),
    },
    {
      id: 'bot-ord-2',
      botOrderId: 'BOT-002',
      customerName: 'Moda Rápida Ltda',
      customerPhone: '11999990002',
      items: [
        { productName: 'Bolsa Couro Clássica', attributes: { Cor: 'Azul' }, qty: 2, priceUnit: 149.90 },
      ],
      total: 299.80,
      status: BOT_ORDER_STATUS.PENDING_APPROVAL,
      receivedAt: new Date(Date.now() - 22 * 60000).toISOString(),
    },
  ]
}

function mockMessages() {
  const contacts = [
    { name: 'Distribuidora São Paulo', phone: '11999990001' },
    { name: 'Moda Rápida Ltda',        phone: '11999990002' },
    { name: 'Atacado Norte EIRELI',    phone: '92999990003' },
  ]
  const msgs = []
  let t = Date.now() - 3600000 * 2
  contacts.forEach((c, ci) => {
    const pairs = [
      { from: 'customer', text: 'Olá! Quero fazer um pedido.' },
      { from: 'bot',      text: 'Olá! 😊 Bem-vindo à Aura Atacado. Me informe os produtos e quantidades.' },
      { from: 'customer', text: ci === 0 ? '4x Tênis M Preto e 10x Camiseta Básica' : ci === 1 ? '2x Bolsa Couro Azul' : 'Qual o preço do Tênis?' },
      { from: 'bot',      text: ci === 0 ? 'Pedido recebido! ✅ Total: R$ 758,60. Aguarde confirmação.' : ci === 1 ? 'Pedido recebido! ✅ Total: R$ 299,80. Aguarde confirmação.' : 'Tênis Runner Pro: R$ 89,90/un (atacado min. 6 pares).' },
    ]
    pairs.forEach((p, pi) => {
      msgs.push({
        id:        `msg-${ci}-${pi}`,
        from:      p.from,
        text:      p.text,
        phone:     c.phone,
        contactName: c.name,
        at:        new Date(t + (ci * 1800000) + (pi * 120000)).toISOString(),
      })
    })
  })
  return msgs.sort((a, b) => new Date(b.at) - new Date(a.at))
}

/* ─── Hook ─── */
export function useWhatsapp() {
  const [session,   setSession]   = useState(null)
  const [qrCode,    setQrCode]    = useState(null)
  const [orders,    setOrders]    = useState([])
  const [messages,  setMessages]  = useState([])
  const [loading,   setLoading]   = useState({ session: true, orders: true, messages: true })
  const [sending,   setSending]   = useState(false)
  const pollRef = useRef(null)

  /* ─── Fetch sessão ─── */
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/session', { credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSession(data)
      if (data.status === SESSION_STATUS.SCAN_QR) {
        fetchQr()
      } else {
        setQrCode(null)
      }
    } catch {
      setSession(mockSession())
      setQrCode(null)
    } finally {
      setLoading(p => ({ ...p, session: false }))
    }
  }, [])

  const fetchQr = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/qr', { credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setQrCode(data.qr)
    } catch {
      setQrCode(null)
    }
  }, [])

  /* ─── Fetch pedidos bot ─── */
  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/orders', { credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setOrders(data.orders ?? [])
    } catch {
      setOrders(mockOrders())
    } finally {
      setLoading(p => ({ ...p, orders: false }))
    }
  }, [])

  /* ─── Fetch mensagens ─── */
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/messages', { credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMessages(data.messages ?? [])
    } catch {
      setMessages(mockMessages())
    } finally {
      setLoading(p => ({ ...p, messages: false }))
    }
  }, [])

  /* ─── Init + polling ─── */
  useEffect(() => {
    fetchSession()
    fetchOrders()
    fetchMessages()

    // Polling a cada 10s para manter status atualizado
    pollRef.current = setInterval(() => {
      fetchSession()
    }, 10000)

    return () => clearInterval(pollRef.current)
  }, [fetchSession, fetchOrders, fetchMessages])

  /* ─── Ações de sessão ─── */
  const startSession = useCallback(async () => {
    setLoading(p => ({ ...p, session: true }))
    try {
      await fetch('/api/whatsapp/session/start', { method: 'POST', credentials: 'include' })
    } catch {}
    setTimeout(fetchSession, 1500)
  }, [fetchSession])

  const stopSession = useCallback(async () => {
    setLoading(p => ({ ...p, session: true }))
    try {
      await fetch('/api/whatsapp/session/stop', { method: 'POST', credentials: 'include' })
    } catch {}
    setSession(p => ({ ...p, status: SESSION_STATUS.STOPPED }))
    setLoading(p => ({ ...p, session: false }))
  }, [])

  /* ─── Aprovar / recusar pedido ─── */
  const reviewOrder = useCallback(async (orderId, approved, note = '') => {
    const newStatus = approved ? BOT_ORDER_STATUS.APPROVED : BOT_ORDER_STATUS.REJECTED
    try {
      const res = await fetch(`/api/whatsapp/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus, note }),
      })
      if (!res.ok) throw new Error()
    } catch {}
    // atualiza local imediatamente
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, status: newStatus } : o
    ))
  }, [])

  /* ─── Envio manual ─── */
  const sendMessage = useCallback(async ({ to, message }) => {
    setSending(true)
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ to, message }),
      })
      if (!res.ok) throw new Error()
      // Adiciona ao histórico local
      setMessages(prev => [{
        id:          `msg-manual-${Date.now()}`,
        from:        'bot',
        text:        message,
        phone:       to,
        contactName: to,
        at:          new Date().toISOString(),
      }, ...prev])
      return true
    } catch {
      // Mock: simula sucesso
      setMessages(prev => [{
        id:          `msg-manual-${Date.now()}`,
        from:        'bot',
        text:        message,
        phone:       to,
        contactName: to,
        at:          new Date().toISOString(),
      }, ...prev])
      return true
    } finally {
      setSending(false)
    }
  }, [])

  const pendingCount = orders.filter(o => o.status === BOT_ORDER_STATUS.PENDING_APPROVAL).length

  return {
    session,
    qrCode,
    orders,
    messages,
    loading,
    sending,
    pendingCount,
    startSession,
    stopSession,
    reviewOrder,
    sendMessage,
    refetch: () => { fetchSession(); fetchOrders(); fetchMessages() },
  }
}
