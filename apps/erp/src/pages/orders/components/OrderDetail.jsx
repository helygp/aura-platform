/**
 * pages/orders/components/OrderDetail.jsx
 *
 * Drawer lateral com detalhe completo do pedido.
 * Mobile: tela cheia. Desktop: 520px fixo à direita.
 *
 * Seções:
 *   - Header: número, canal, status badge, botão fechar
 *   - Cliente + WhatsApp
 *   - Ações de status (botões de transição permitida)
 *   - Itens do pedido com subtotais
 *   - Resumo financeiro
 *   - Histórico de status (timeline)
 *   - Botão de impressão
 *
 * Props:
 *   order        : objeto pedido completo (null = fechado)
 *   onClose      : fn
 *   onStatusChange: (orderId, newStatus) => Promise
 */

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Printer, ChevronRight, MessageCircle, Send,
  User, Clock, Package, CheckCircle2, XCircle, Ban,
} from 'lucide-react'
import { Button } from '@aura/ui'
import { StatusBadge } from './StatusBadge.jsx'
import {
  STATUS_META, STATUS_TRANSITIONS, CHANNEL_META,
  fmtBRL, fmtDate, orderNumber, calcOrderTotals,
} from '../ordersTypes.js'

/* ─── Linha de item ─── */
function OrderItem({ item, onCancel, cancelling }) {
  const attrStr   = Object.values(item.attributes ?? {}).join(' / ')
  const cancelled = item.status === 'cancelado'
  return (
    <div className={`flex items-start gap-3 py-2.5 border-b border-[var(--color-border)] last:border-0 ${cancelled ? 'opacity-60' : ''}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cancelled ? 'bg-red-50 dark:bg-red-950/30' : 'bg-[var(--color-surface)]'}`}>
        {cancelled
          ? <Ban size={14} className="text-red-400" />
          : <Package size={14} className="text-[var(--color-text-muted)]" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-medium text-[var(--color-text)] truncate ${cancelled ? 'line-through' : ''}`}>{item.productName}</p>
          {cancelled && <span className="text-[10px] font-semibold bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full shrink-0">Cancelado</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {attrStr && <span className="text-xs text-[var(--color-text-muted)]">{attrStr}</span>}
          <span className="text-[10px] font-mono text-[var(--color-text-disabled)]">{item.skuCode}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-semibold ${cancelled ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text)]'}`}>{fmtBRL(item.priceUnit * item.qty)}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{item.qty}x {fmtBRL(item.priceUnit)}</p>
      </div>
      {onCancel && !cancelled && (
        <button onClick={onCancel} disabled={cancelling}
          title="Cancelar item (devolve ao estoque)"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0 disabled:opacity-40">
          <XCircle size={14} />
        </button>
      )}
    </div>
  )
}

/* ─── Linha do timeline ─── */
function TimelineItem({ entry, isLast }) {
  const meta = STATUS_META[entry.status]
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${meta?.dot ?? 'bg-gray-400'}`} />
        {!isLast && <div className="w-px flex-1 bg-[var(--color-border)] mt-1" />}
      </div>
      <div className="pb-4 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${meta?.color}`}>{meta?.label ?? entry.status}</span>
          <span className="text-[10px] text-[var(--color-text-disabled)]">{entry.user}</span>
        </div>
        {entry.note && (
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{entry.note}</p>
        )}
        <p className="text-[10px] text-[var(--color-text-disabled)] mt-0.5">{fmtDate(entry.at)}</p>
      </div>
    </div>
  )
}

/* ─── Impressão ─── */
function printOrder(order) {
  const { subtotal } = calcOrderTotals(order.items)
  const win = window.open('', '_blank')
  win.document.write(`
    <html><head><title>Pedido ${orderNumber(order.id, order.number)}</title>
    <style>
      body { font-family: sans-serif; padding: 24px; max-width: 480px; margin: 0 auto; }
      h1 { font-size: 18px; margin-bottom: 4px; }
      .sub { color: #666; font-size: 13px; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; font-size: 13px; }
      th { background: #f5f5f5; font-weight: 600; }
      .total { font-size: 15px; font-weight: bold; text-align: right; margin-top: 8px; }
      .footer { margin-top: 24px; font-size: 11px; color: #999; }
    </style></head><body>
    <h1>Pedido ${orderNumber(order.id, order.number)}</h1>
    <div class="sub">${order.customerName} · ${fmtDate(order.createdAt)}</div>
    <table>
      <tr><th>Produto</th><th>Qtd</th><th>Unit.</th><th>Total</th></tr>
      ${order.items.map(i => `
        <tr>
          <td>${i.productName}${Object.values(i.attributes ?? {}).length ? ' (' + Object.values(i.attributes).join('/') + ')' : ''}</td>
          <td>${i.qty}</td>
          <td>R$ ${Number(i.priceUnit).toFixed(2)}</td>
          <td>R$ ${(i.priceUnit * i.qty).toFixed(2)}</td>
        </tr>`).join('')}
    </table>
    <div class="total">Total: R$ ${subtotal.toFixed(2)}</div>
    ${order.notes ? `<p style="font-size:12px;margin-top:12px"><b>Obs:</b> ${order.notes}</p>` : ''}
    <div class="footer">Gerado em ${fmtDate(new Date().toISOString())} · Aura Platform</div>
    </body></html>
  `)
  win.document.close()
  win.focus()
  win.print()
}

/* ── Compõe mensagem de confirmação WhatsApp ── */
function composeWhatsAppMessage(order) {
  const { subtotal } = calcOrderTotals(order.items)
  const num  = orderNumber(order.id, order.number)
  const date = fmtDate(order.createdAt)

  const itemLines = (order.items ?? []).map(i => {
    const attrs = Object.values(i.attributes ?? {}).filter(Boolean).join('/')
    const label = attrs ? `${i.productName} (${attrs})` : i.productName
    return `• ${label} — ${i.qty}x ${fmtBRL(i.priceUnit)} = ${fmtBRL(i.priceUnit * i.qty)}`
  }).join('\n')

  return [
    `Olá, ${order.customerName}! 👋`,
    ``,
    `Seu pedido *${num}* de ${date} foi recebido.`,
    ``,
    `*Itens:*`,
    itemLines,
    ``,
    `*Total: ${fmtBRL(subtotal)}*`,
    ``,
    `Para confirmar responda *SIM*, para cancelar responda *NÃO*.`,
    `Obrigado pela preferência! 🙏`,
  ].join('\n')
}

async function sendWhatsAppConfirmation(order) {
  const msg   = composeWhatsAppMessage(order)
  const phone = order.customerWhatsapp?.replace(/\D/g,'')
  if (!phone) return

  const token = window.__aura_mem_token__ || ''
  try {
    const res = await fetch('/api/whatsapp/send', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: JSON.stringify({ to: phone, message: msg }),
    })
    if (res.ok) return { ok: true }
    throw new Error((await res.json().catch(()=>({}))).error || 'Erro WAHA')
  } catch (e) {
    // Fallback: abre wa.me com texto pré-preenchido
    const url = `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
    return { ok: true, fallback: true }
  }
}

export function OrderDetail({ order, onClose, onStatusChange, onItemCancel }) {
  const [changingStatus,  setChangingStatus]  = useState(false)
  const [confirmStatus,   setConfirmStatus]   = useState(null)
  const [wppSending,      setWppSending]      = useState(false)
  const [wppSent,         setWppSent]         = useState(false)
  const [cancellingItem,  setCancellingItem]  = useState(null)
  const [confirmCancelId, setConfirmCancelId] = useState(null)

  const handleSendWhatsApp = async () => {
    setWppSending(true)
    try {
      await sendWhatsAppConfirmation(order)
      setWppSent(true)
      setTimeout(() => setWppSent(false), 3000)
    } finally {
      setWppSending(false)
    }
  }

  const transitions = order ? STATUS_TRANSITIONS[order.status] ?? [] : []
  const { subtotal } = order ? calcOrderTotals(order.items) : { subtotal: 0 }
  const channelMeta = CHANNEL_META[order?.channel] ?? { label: order?.channel, icon: '•' }

  const handleCancelItem = async (itemId) => {
    if (!onItemCancel) return
    setCancellingItem(itemId)
    try { await onItemCancel(order.id, itemId) }
    catch (e) { console.error('cancelItem', e.message) }
    finally { setCancellingItem(null); setConfirmCancelId(null) }
  }

  const handleStatusClick = (newStatus) => setConfirmStatus(newStatus)

  const handleStatusConfirm = async () => {
    if (!confirmStatus) return
    setChangingStatus(true)
    try {
      await onStatusChange(order.id, confirmStatus)
      setConfirmStatus(null)
    } finally {
      setChangingStatus(false)
    }
  }

  return (
    <AnimatePresence>
      {order && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="
              fixed inset-y-0 right-0 z-50
              w-full md:w-[520px]
              flex flex-col
              bg-[var(--color-bg)] border-l border-[var(--color-border)]
              shadow-2xl
            "
          >
            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-3 p-4 border-b border-[var(--color-border)] shrink-0">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-bold text-[var(--color-text)]">{orderNumber(order.id, order.number)}</span>
                  <span className="text-sm text-[var(--color-text-muted)]">{channelMeta.icon} {channelMeta.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={order.status} />
                  <span className="text-xs text-[var(--color-text-muted)]">{fmtDate(order.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => printOrder(order)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors"
                  title="Imprimir pedido"
                >
                  <Printer size={15} />
                </button>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* ── Scroll ── */}
            <div className="flex-1 overflow-y-auto">

              {/* ── Cliente ── */}
              <div className="p-4 border-b border-[var(--color-border)]">
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Cliente</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[var(--color-surface)] flex items-center justify-center shrink-0">
                    <User size={16} className="text-[var(--color-text-muted)]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">{order.customerName}</p>
                    {order.customerWhatsapp && (
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <a
                          href={`https://wa.me/55${order.customerWhatsapp}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-green-600 hover:underline"
                        >
                          <MessageCircle size={11} />
                          {order.customerWhatsapp}
                        </a>
                        <button
                          type="button"
                          onClick={handleSendWhatsApp}
                          disabled={wppSending}
                          className={[
                            'flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full transition-colors',
                            wppSent
                              ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                              : 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950/50 dark:text-green-400',
                          ].join(' ')}
                        >
                          <Send size={10} />
                          {wppSent ? 'Enviado!' : wppSending ? 'Enviando…' : 'Enviar confirmação'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {order.notes && (
                  <p className="mt-2 text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-subtle)] rounded-lg p-2.5 border border-[var(--color-border)]">
                    <strong>Obs:</strong> {order.notes}
                  </p>
                )}
              </div>

              {/* ── Transições de status ── */}
              {transitions.length > 0 && (
                <div className="p-4 border-b border-[var(--color-border)]">
                  <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Avançar status</p>
                  {confirmStatus ? (
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-[var(--color-text)] flex-1">
                        Confirmar: <strong>{STATUS_META[confirmStatus]?.label}</strong>?
                      </p>
                      <Button size="sm" variant="secondary" onClick={() => setConfirmStatus(null)} disabled={changingStatus}>Não</Button>
                      <Button size="sm" onClick={handleStatusConfirm} disabled={changingStatus}>
                        {changingStatus ? 'Salvando…' : 'Sim'}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {transitions.map(s => {
                        const meta = STATUS_META[s]
                        return (
                          <button
                            key={s}
                            onClick={() => handleStatusClick(s)}
                            className={`
                              flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold
                              border transition-colors duration-150
                              ${meta.bg} ${meta.color} ${meta.border}
                              hover:opacity-80
                            `}
                          >
                            {meta.label} <ChevronRight size={12} />
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Itens ── */}
              <div className="p-4 border-b border-[var(--color-border)]">
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                  Itens ({order.items.filter(i=>i.status!=='cancelado').length}{order.items.some(i=>i.status==='cancelado')?` (+${order.items.filter(i=>i.status==='cancelado').length} cancelado${order.items.filter(i=>i.status==='cancelado').length>1?'s':''})`:''}) 
                </p>
                {order.items.map(item => (
                  confirmCancelId === item.id ? (
                    <div key={item.id} className="flex items-center gap-2 py-2.5 border-b border-[var(--color-border)] last:border-0 bg-red-50 dark:bg-red-950/20 rounded-lg px-2">
                      <p className="text-xs text-red-600 flex-1">Cancelar <strong>{item.productName}</strong>? Estoque devolvido.</p>
                      <button onClick={() => setConfirmCancelId(null)} className="text-xs px-2 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-surface)]">Não</button>
                      <button onClick={() => handleCancelItem(item.id)} disabled={cancellingItem === item.id}
                        className="text-xs px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">
                        {cancellingItem === item.id ? '…' : 'Sim'}
                      </button>
                    </div>
                  ) : (
                    <OrderItem key={item.id} item={item}
                      onCancel={onItemCancel && item.status !== 'cancelado' && ['pendente','confirmado','separando'].includes(order.status) ? () => setConfirmCancelId(item.id) : null}
                      cancelling={cancellingItem === item.id} />
                  )
                ))}
              </div>

              {/* ── Resumo financeiro ── */}
              <div className="p-4 border-b border-[var(--color-border)]">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm text-[var(--color-text-muted)]">
                    <span>Subtotal</span><span>{fmtBRL(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-[var(--color-text)] pt-1.5 border-t border-[var(--color-border)]">
                    <span>Total</span><span>{fmtBRL(subtotal)}</span>
                  </div>
                </div>
              </div>

              {/* ── Histórico / Timeline ── */}
              <div className="p-4">
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">Histórico</p>
                <div>
                  {[...(order.history ?? [])].reverse().map((entry, i, arr) => (
                    <TimelineItem key={i} entry={entry} isLast={i === arr.length - 1} />
                  ))}
                </div>
              </div>

            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
