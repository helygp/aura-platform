/**
 * pages/whatsapp/WhatsappPage.jsx — Inbox style
 *
 * Layout 2 colunas:
 *   Esq  (320px): lista de conversas por cliente
 *   Dir  (flex):  conversa selecionada + input de resposta
 *
 * Identificação automática:
 *   - Cliente cadastrado em customers → nome + badge status
 *   - Não cadastrado → "Sem identificação" + número +55 (XX) XXXXX-XXXX
 *
 * Fila de aprovação: filtro "Aguardando aprovação" na sidebar.
 * Conexão / QR / Aprovador: apenas em Configurações > WhatsApp.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  RefreshCw, MessageSquare, Search, Check, X,
  ShoppingCart, Bot, User, Send, Clock, ChevronRight,
} from 'lucide-react'
import { useAuth }        from '../../auth/AuthContext.jsx'
import { useWhatsappMenuStatus } from '../../hooks/useWhatsappMenuStatus.js'
import { PhoneInput }     from './components/PhoneInput.jsx'
import { BOT_ORDER_STATUS, fmtBRL } from './whatsappTypes.js'

/* ── helpers ── */
function authFetch(url, opts = {}) {
  return fetch(url, {
    ...opts,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
    },
  })
}

function fmtPhone(digits = '') {
  const d = String(digits).replace(/\D/g, '')
  const local = d.startsWith('55') && d.length > 11 ? d.slice(2) : d
  if (local.length <= 2)  return `+55 (${local}`
  if (local.length <= 7)  return `+55 (${local.slice(0,2)}) ${local.slice(2)}`
  if (local.length <= 11) return `+55 (${local.slice(0,2)}) ${local.slice(2,7)}-${local.slice(7)}`
  return `+55 ${local}`
}

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'agora'
  if (mins < 60) return `${mins}min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return days === 1 ? 'ontem' : `${days}d`
}

/* ── Badge de estado da conversa ── */
function StatusDot({ status }) {
  const map = {
    pending_approval: { color: 'bg-yellow-400', title: 'Aguardando aprovação' },
    bot:              { color: 'bg-blue-400',   title: 'Bot ativo' },
    human:            { color: 'bg-orange-400', title: 'Aguardando atendente' },
    resolved:         { color: 'bg-green-400',  title: 'Resolvido' },
    unidentified:     { color: 'bg-gray-300',   title: 'Sem identificação' },
  }
  const s = map[status] ?? map.bot
  return <span className={`w-2 h-2 rounded-full shrink-0 ${s.color}`} title={s.title} />
}

/* ── Bolha de mensagem ── */
/**
 * Converte texto com formatação WhatsApp em JSX.
 * Suporta: *bold*, _italic_, ~strike~, `mono`, quebras de linha, URLs.
 */
function formatWAText(text) {
  if (!text) return null
  const esc = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const html = esc
    .replace(/\*([^*\r\n]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_\r\n]+)_/g, '<em>$1</em>')
    .replace(/~([^~\r\n]+)~/g, '<del>$1</del>')
    .replace(/`([^`\r\n]+)`/g, '<code style="background:rgba(0,0,0,.12);padding:0 3px;border-radius:3px;font-size:.85em;font-family:monospace">$1</code>')
    .replace(/(https?:\/\/[^\s<>"]+)/g, '<a href="$1" target="_blank" rel="noopener" style="text-decoration:underline;opacity:.85">$1</a>')
    .replace(/\r?\n/g, '<br />')
  return React.createElement('span', { dangerouslySetInnerHTML: { __html: html } })
}

function Bubble({ msg }) {
  const isBot    = msg.from_me || msg.sender === 'bot'
  const isSystem = msg.sender === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-[10px] px-3 py-1 rounded-full bg-[var(--color-surface)] text-[var(--color-text-muted)]">
          {msg.text}
        </span>
      </div>
    )
  }

  return (
    <div className={`flex ${isBot ? 'justify-end' : 'justify-start'} mb-1.5`}>
      <div className={`
        max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-snug break-words
        ${isBot
          ? 'bg-[var(--color-primary)] text-white rounded-br-sm'
          : 'bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] rounded-bl-sm'
        }
      `}>
        {formatWAText(msg.text)}
        <div className={`text-[10px] mt-0.5 ${isBot ? 'text-white/60 text-right' : 'text-[var(--color-text-muted)]'}`}>
          {timeAgo(msg.at || msg.created_at)}
          {isBot && <> · <Bot size={9} className="inline mb-0.5" /></>}
        </div>
      </div>
    </div>
  )
}

/* ── Card de pedido pendente inline na conversa ── */
function PendingOrderBanner({ order, onApprove, onReject }) {
  const [acting, setActing] = useState(null)

  const handle = async (approve) => {
    setActing(approve ? 'approve' : 'reject')
    try { await (approve ? onApprove() : onReject()) } finally { setActing(null) }
  }

  return (
    <div className="mx-4 my-2 rounded-xl border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-700 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-300 flex items-center gap-1.5 mb-1">
            <ShoppingCart size={12} /> Pedido pendente — {order.bot_order_id}
          </p>
          {Array.isArray(order.items) && order.items.length > 0 && (
            <ul className="text-xs text-yellow-700 dark:text-yellow-400 space-y-0.5 mb-1.5">
              {order.items.slice(0, 4).map((it, i) => (
                <li key={i}>• {it.quantity ?? it.qty}x {it.name || it.sku_code} — {fmtBRL(it.price ?? it.price_unit)}</li>
              ))}
            </ul>
          )}
          <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-300">
            Total: {fmtBRL(order.total)}
          </p>
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={() => handle(true)} disabled={!!acting}
            className="flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-medium bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
          >
            {acting === 'approve' ? <RefreshCw size={10} className="animate-spin" /> : <Check size={10} />} Aprovar
          </button>
          <button
            onClick={() => handle(false)} disabled={!!acting}
            className="flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700 hover:bg-red-200 dark:hover:bg-red-900/60 disabled:opacity-50 transition-colors"
          >
            {acting === 'reject' ? <RefreshCw size={10} className="animate-spin" /> : <X size={10} />} Rejeitar
          </button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════
   Hook de conversas
══════════════════════════════════════ */
function useInbox() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [messages,      setMessages]      = useState({}) // phone → []
  const [loading,       setLoading]       = useState(true)
  const [loadingMsgs,   setLoadingMsgs]   = useState(false)
  const [sending,       setSending]       = useState(false)
  const pollRef    = useRef(null)
  const msgPollRef = useRef(null)
  const selectedRef = useRef(null)  // phone da conversa selecionada

  const fetchConversations = useCallback(async () => {
    try {
      const res = await authFetch('/api/whatsapp/inbox')
      if (!res.ok) throw new Error(res.statusText)
      const { conversations: list } = await res.json()
      setConversations(list ?? [])
    } catch (err) {
      console.error('[inbox]', err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchMessages = useCallback(async (phone) => {
    if (!phone) return
    setLoadingMsgs(true)
    try {
      const res = await authFetch(`/api/whatsapp/inbox/${phone}`)
      if (!res.ok) throw new Error(res.statusText)
      const { messages: list, pendingOrders } = await res.json()
      setMessages(prev => ({ ...prev, [phone]: list ?? [] }))
      // Atualiza pedidos pendentes da conversa selecionada no estado global
      // Atualiza pendingOrders na conversa — merge estável para não causar flickering
      if (pendingOrders) {
        setConversations(prev => prev.map(c => {
          if (c.phone !== phone) return c
          // Só atualiza se a lista mudou (evita re-render desnecessário)
          const prevIds = (c.pendingOrders ?? []).map(o => o.id).sort().join()
          const newIds  = pendingOrders.map(o => o.id).sort().join()
          if (prevIds === newIds) return c
          return {
            ...c,
            pendingOrders,
            pendingOrdersCount: pendingOrders.filter(o => o.status === 'pending_approval').length,
            state: pendingOrders.filter(o => o.status === 'pending_approval').length > 0 ? 'pending_approval' : c.state,
          }
        }))
      }
    } catch (err) {
      console.error('[inbox/phone]', err.message)
    } finally {
      setLoadingMsgs(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    fetchConversations()
    pollRef.current = setInterval(fetchConversations, 8000)
    return () => clearInterval(pollRef.current)
  }, [user, fetchConversations])

  const sendMessage = useCallback(async (phone, text) => {
    if (!phone || !text.trim()) return
    setSending(true)
    try {
      const e164 = phone.startsWith('55') ? phone : '55' + phone.replace(/\D/g, '')
      const res = await authFetch('/api/whatsapp/send', {
        method: 'POST',
        body: JSON.stringify({ to: e164, message: text.trim() }),
      })
      if (!res.ok) throw new Error('Erro ao enviar')
      const sentMsg = {
        id: `sent-${Date.now()}`,
        from_me: true,
        text: text.trim(),
        at: new Date().toISOString(),
        sender: 'human',
      }
      setMessages(prev => ({ ...prev, [phone]: [...(prev[phone] ?? []), sentMsg] }))
    } finally {
      setSending(false)
    }
  }, [])

  const reviewOrder = useCallback(async (orderId, approved) => {
    const newStatus = approved ? BOT_ORDER_STATUS.APPROVED : BOT_ORDER_STATUS.REJECTED
    await authFetch(`/api/whatsapp/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus }),
    }).catch(() => {})
    setConversations(prev => prev.map(c => {
      const updated = (c.pendingOrders ?? []).filter(o => o.id !== orderId)
      return { ...c, pendingOrders: updated, pendingOrdersCount: updated.length, state: updated.length > 0 ? 'pending_approval' : 'bot' }
    }))
  }, [])

  // Seleciona conversa e inicia polling de mensagens a cada 4s
  const selectConversation = useCallback((phone) => {
    selectedRef.current = phone
    clearInterval(msgPollRef.current)
    if (phone) {
      fetchMessages(phone)
      msgPollRef.current = setInterval(() => {
        if (selectedRef.current) fetchMessages(selectedRef.current)
      }, 4000)
    }
  }, [fetchMessages])

  // Cleanup quando desmonta
  useEffect(() => () => clearInterval(msgPollRef.current), [])

  return { conversations, messages, loading, loadingMsgs, sending, fetchConversations, fetchMessages, selectConversation, sendMessage, reviewOrder }
}

/* ══════════════════════════════════════
   Componente principal
══════════════════════════════════════ */
export function WhatsappPage() {
  const { conversations, messages, loading, loadingMsgs, sending, fetchConversations, fetchMessages, selectConversation, sendMessage, reviewOrder } = useInbox()
  const { hasRole } = useAuth()
  const wppStatus = useWhatsappMenuStatus()
  const isOffline = wppStatus.ready && !wppStatus.connected

  const [selected,  setSelected]  = useState(null)   // phone string
  const [filter,    setFilter]    = useState('all')   // 'all' | 'pending' | 'unidentified'
  const [search,    setSearch]    = useState('')
  const [input,     setInput]     = useState('')
  const [newPhone,  setNewPhone]  = useState('')      // nova conversa
  const [showNew,   setShowNew]   = useState(false)
  const msgEndRef = useRef(null)

  const selConv = conversations.find(c => c.phone === selected)
  const selMsgs = messages[selected] ?? []

  // Seleciona conversa e inicia polling de mensagens
  useEffect(() => {
    selectConversation(selected)
  }, [selected, selectConversation])

  // Scroll to bottom quando abre conversa
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selMsgs.length, selected])

  // Filtragem
  const filtered = conversations.filter(c => {
    if (filter === 'pending')      return c.pendingOrders?.length > 0
    if (filter === 'unidentified') return !c.isIdentified
    return true
  }).filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.customerName?.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.lastText?.toLowerCase().includes(q)
    )
  })

  const handleSend = async () => {
    if (!selected || !input.trim()) return
    await sendMessage(selected, input)
    setInput('')
  }

  const handleNewConv = async () => {
    if (!newPhone) return
    const phone = newPhone.replace(/\D/g, '').replace(/^55/, '')
    setSelected(phone)
    setShowNew(false)
    setNewPhone('')
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-h-[900px]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] shrink-0">
        <h2 className="text-base font-bold text-[var(--color-text)] flex items-center gap-2">
          <MessageSquare size={18} className="text-[var(--color-primary)]" />
          Atendimento WhatsApp
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNew(v => !v)}
            className="h-8 px-3 rounded-lg text-xs font-medium bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            + Nova conversa
          </button>
          <button
            onClick={fetchConversations}
            disabled={loading}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] disabled:opacity-40 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Banner: sessão desconectada */}
      {isOffline && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-400 shrink-0">
          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          <span>WhatsApp desconectado — apenas visualização do histórico.{" "}{hasRole && hasRole("admin") ? <a href="/settings" className="underline font-medium">Reconecte em Configurações.</a> : "Entre em contato com o administrador."}</span>
        </div>
      )}

      {/* Modal nova conversa */}
      {showNew && (
        <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-end gap-2 shrink-0">
          <div className="flex-1">
            <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Número do destinatário</p>
            <PhoneInput value={newPhone} onChange={setNewPhone} />
          </div>
          <button
            onClick={handleNewConv}
            disabled={newPhone.length < 13}
            className="h-9 px-4 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white disabled:opacity-40 hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            Abrir
          </button>
          <button onClick={() => setShowNew(false)} className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Corpo ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ════════════════════════
            SIDEBAR — Lista conversas
        ════════════════════════ */}
        <div className={`
          flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg)] shrink-0
          ${selected ? 'hidden md:flex md:w-72 lg:w-80' : 'flex w-full md:w-72 lg:w-80'}
        `}>

          {/* Busca */}
          <div className="p-3 border-b border-[var(--color-border)]">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="text"
                placeholder="Buscar…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-8 pl-8 pr-3 rounded-lg text-xs bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>

          {/* Filtros */}
          <div className="flex gap-1 px-3 py-2 border-b border-[var(--color-border)] overflow-x-auto">
            {[
              { id: 'all',          label: 'Todos' },
              { id: 'pending',      label: '🟡 Aprovação' },
              { id: 'unidentified', label: '⚪ Sem ident.' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`whitespace-nowrap h-6 px-2.5 rounded-full text-[10px] font-medium transition-colors ${
                  filter === f.id
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center h-24 text-xs text-[var(--color-text-muted)]">
                <RefreshCw size={14} className="animate-spin mr-2" /> Carregando…
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-xs text-[var(--color-text-muted)] gap-2">
                <MessageSquare size={24} className="opacity-30" />
                <span>Nenhuma conversa{filter !== 'all' ? ' nesse filtro' : ''}</span>
              </div>
            )}
            {filtered.map(conv => {
              const isActive = conv.phone === selected
              const name = conv.isIdentified
                ? conv.customerName
                : `Sem identificação`
              const sub = conv.isIdentified ? fmtPhone(conv.phone) : fmtPhone(conv.phone)
              const hasPending = conv.pendingOrders?.length > 0

              return (
                <button
                  key={conv.phone}
                  onClick={() => setSelected(conv.phone)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-3 text-left border-b border-[var(--color-border)] transition-colors
                    ${isActive
                      ? 'bg-[var(--color-primary)]/10 border-l-2 border-l-[var(--color-primary)]'
                      : 'hover:bg-[var(--color-surface)]'
                    }
                  `}
                >
                  {/* Avatar */}
                  <div className={`
                    w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                    ${conv.isIdentified
                      ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                      : 'bg-[var(--color-border)] text-[var(--color-text-muted)]'
                    }
                  `}>
                    {conv.isIdentified
                      ? (conv.customerName?.[0] ?? '?').toUpperCase()
                      : '?'
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-xs font-semibold truncate ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
                        {name}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">
                        {timeAgo(conv.lastMsgAt)}
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--color-text-muted)] truncate">{sub}</p>
                    {conv.lastText && (
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">{conv.lastText}</p>
                    )}
                  </div>

                  {/* Estado */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusDot status={hasPending ? 'pending_approval' : conv.state} />
                    {hasPending && (
                      <span className="text-[9px] font-bold w-4 h-4 rounded-full bg-yellow-400 text-white flex items-center justify-center">
                        {conv.pendingOrders.length}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ════════════════════════
            CHAT — Conversa selecionada
        ════════════════════════ */}
        <div className={`
          flex-1 flex flex-col min-w-0
          ${!selected ? 'hidden md:flex' : 'flex'}
        `}>
          {!selected ? (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-text-muted)] gap-3">
              <MessageSquare size={40} className="opacity-20" />
              <p className="text-sm">Selecione uma conversa</p>
            </div>
          ) : (
            <>
              {/* ── Cabeçalho da conversa ── */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
                <button
                  onClick={() => setSelected(null)}
                  className="md:hidden w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-border)] transition-colors"
                >
                  <ChevronRight size={16} className="rotate-180" />
                </button>
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  ${selConv?.isIdentified
                    ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                    : 'bg-[var(--color-border)] text-[var(--color-text-muted)]'
                  }
                `}>
                  {selConv?.isIdentified ? (selConv.customerName?.[0] ?? '?').toUpperCase() : '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text)] truncate">
                    {selConv?.isIdentified ? selConv.customerName : 'Sem identificação'}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">{fmtPhone(selected)}</p>
                </div>
                {selConv?.isIdentified && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
                    Cliente cadastrado
                  </span>
                )}
                {!selConv?.isIdentified && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)] font-medium">
                    Sem cadastro
                  </span>
                )}
              </div>

              {/* ── Pedidos pendentes — fora da área de scroll ── */}
              {(() => {
                const pending = (selConv?.pendingOrders ?? [])
                  .filter(o => o.status === BOT_ORDER_STATUS.PENDING_APPROVAL)
                  // Deduplica por bot_order_id
                  .filter((o, i, arr) => arr.findIndex(x => x.bot_order_id === o.bot_order_id) === i)
                return pending.map(order => (
                  <PendingOrderBanner
                    key={order.bot_order_id ?? order.id}
                    order={order}
                    onApprove={() => reviewOrder(order.id, true)}
                    onReject={() => reviewOrder(order.id, false)}
                  />
                ))
              })()}

              {/* ── Mensagens ── */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {selMsgs.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)] gap-2">
                    <Clock size={24} className="opacity-30" />
                    <p className="text-xs">Nenhuma mensagem carregada</p>
                    <p className="text-[10px] opacity-70">Histórico disponível após a primeira interação</p>
                  </div>
                )}
                {selMsgs.map((msg, i) => (
                  <Bubble key={msg.id ?? i} msg={msg} />
                ))}
                <div ref={msgEndRef} />
              </div>

              {/* ── Input de resposta ── */}
              <div className="border-t border-[var(--color-border)] px-4 py-3 shrink-0 bg-[var(--color-surface)]">
                <div className="flex gap-2 items-end">
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    disabled={isOffline}
                    placeholder={isOffline ? 'Reconecte o WhatsApp para enviar…' : 'Mensagem… (Enter envia · Shift+Enter nova linha)'}
                    rows={2}
                    className="flex-1 px-3 py-2 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || sending || isOffline}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--color-primary)] text-white disabled:opacity-40 hover:bg-[var(--color-primary-hover)] transition-colors shrink-0"
                  >
                    {sending
                      ? <RefreshCw size={15} className="animate-spin" />
                      : <Send size={15} />
                    }
                  </button>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5 flex items-center gap-1">
                  <Bot size={10} /> Mensagem enviada como atendente humano
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
