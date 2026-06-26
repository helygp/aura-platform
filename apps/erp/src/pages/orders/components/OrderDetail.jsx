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
 *   onStatusChange: (orderId, newStatus, note?, reason?) => Promise
 *   onItemCancel : (orderId, itemId, cancelQty) => Promise
 *   onReturn     : (orderId, items[], reason) => Promise  // #117 devolução
 */

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Printer, ChevronRight, MessageCircle, Send,
  User, Clock, Package, CheckCircle2, XCircle, Ban, Undo2,
} from 'lucide-react'
import { Button, useToast } from '@aura/ui'
import { StatusBadge } from './StatusBadge.jsx'
import {
  STATUS_META, STATUS_TRANSITIONS, CHANNEL_META, ORDER_STATUS,
  fmtBRL, fmtDate, orderNumber, calcOrderTotals,
} from '../ordersTypes.js'

/* ─── Linha de item ─── */
function OrderItem({ item, onCancel, cancelling }) {
  const attrStr     = Object.values(item.attributes ?? {}).join(' / ')
  const cancelled   = item.status === 'cancelado'
  const qtyReturned = Number(item.qtyReturned ?? 0)
  const effectiveQty = Math.max(0, Number(item.qty) - qtyReturned)
  const allReturned = !cancelled && qtyReturned > 0 && effectiveQty === 0
  return (
    <div className={`flex items-start gap-3 py-2.5 border-b border-[var(--color-border)] last:border-0 ${cancelled || allReturned ? 'opacity-60' : ''}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cancelled ? 'bg-red-50 dark:bg-red-950/30' : allReturned ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-[var(--color-surface)]'}`}>
        {cancelled
          ? <Ban size={14} className="text-red-400" />
          : allReturned
            ? <Undo2 size={14} className="text-amber-500" />
            : <Package size={14} className="text-[var(--color-text-muted)]" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-medium text-[var(--color-text)] truncate ${cancelled || allReturned ? 'line-through' : ''}`}>{item.productName}</p>
          {cancelled && <span className="text-[10px] font-semibold bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full shrink-0">Cancelado</span>}
          {!cancelled && qtyReturned > 0 && (
            <span className="text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full shrink-0">
              {allReturned ? 'Devolvido' : `${qtyReturned}x devolvido${qtyReturned > 1 ? 's' : ''}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {attrStr && <span className="text-xs text-[var(--color-text-muted)]">{attrStr}</span>}
          <span className="text-[10px] font-mono text-[var(--color-text-disabled)]">{item.skuCode}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-semibold ${cancelled || allReturned ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text)]'}`}>{fmtBRL(item.priceUnit * effectiveQty)}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{effectiveQty}x {fmtBRL(item.priceUnit)}</p>
      </div>
      {onCancel && !cancelled && !allReturned && (
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
    <html><head><title>Pedido ${orderNumber(order.id, order.number, order.ref)}</title>
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
    <h1>Pedido ${orderNumber(order.id, order.number, order.ref)}</h1>
    <div class="sub">${order.customerName} · ${fmtDate(order.createdAt)}</div>
    <table>
      <tr><th>Produto</th><th>Qtd</th><th>Unit.</th><th>Total</th></tr>
      ${order.items.map(i => {
        const eff = Math.max(0, Number(i.qty) - Number(i.qtyReturned ?? 0))
        return `
        <tr>
          <td>${i.productName}${Object.values(i.attributes ?? {}).length ? ' (' + Object.values(i.attributes).join('/') + ')' : ''}</td>
          <td>${eff}${i.qtyReturned ? ` (de ${i.qty})` : ''}</td>
          <td>R$ ${Number(i.priceUnit).toFixed(2)}</td>
          <td>R$ ${(i.priceUnit * eff).toFixed(2)}</td>
        </tr>`
      }).join('')}
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
  const num  = orderNumber(order.id, order.number, order.ref)
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

export function OrderDetail({ order, onClose, onStatusChange, onItemCancel, onReturn }) {
  const [changingStatus,  setChangingStatus]  = useState(false)
  const [confirmStatus,   setConfirmStatus]   = useState(null)
  const [cancelReason,    setCancelReason]    = useState('')
  const [wppSending,      setWppSending]      = useState(false)
  const [wppSent,         setWppSent]         = useState(false)
  const [cancellingItem,  setCancellingItem]  = useState(null)
  const [cancelModal,     setCancelModal]     = useState(null) // { id, productName, qty, cancelQty }
  const [returnModal,     setReturnModal]     = useState(null) // { items: {itemId: qty}, reason }
  const [returning,       setReturning]       = useState(false)

  const { toast } = useToast()

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
  const { subtotal, totalUnits } = order ? calcOrderTotals(order.items) : { subtotal: 0, totalUnits: 0 }
  const channelMeta = CHANNEL_META[order?.channel] ?? { label: order?.channel, icon: '•' }

  const handleCancelItem = async () => {
    if (!onItemCancel || !cancelModal) return
    const { id: itemId, cancelQty } = cancelModal
    setCancellingItem(itemId)
    try {
      await onItemCancel(order.id, itemId, cancelQty)
      toast({ variant: 'success', title: 'Item cancelado', description: 'Estoque devolvido ao produto.' })
    } catch (e) {
      console.error('cancelItem', e.message)
      toast({ variant: 'error', title: 'Não foi possível cancelar', description: e.message || 'Tente novamente.' })
    } finally {
      setCancellingItem(null)
      setCancelModal(null)
    }
  }

  const handleStatusClick = (newStatus) => {
    setConfirmStatus(newStatus)
    setCancelReason('')
  }

  const handleStatusConfirm = async () => {
    if (!confirmStatus) return
    // Motivo obrigatório para cancelamento (#117)
    if (confirmStatus === ORDER_STATUS.CANCELLED && !cancelReason.trim()) {
      toast({ variant: 'error', title: 'Motivo é obrigatório', description: 'Informe um motivo para o cancelamento.' })
      return
    }
    setChangingStatus(true)
    try {
      await onStatusChange(order.id, confirmStatus, '', cancelReason.trim())
      setConfirmStatus(null)
      setCancelReason('')
    } catch (e) {
      toast({ variant: 'error', title: 'Falha ao atualizar', description: e.message || 'Tente novamente.' })
    } finally {
      setChangingStatus(false)
    }
  }

  /* ── Abrir modal de devolução (#117) ── */
  const openReturnModal = () => {
    if (!order || order.status !== ORDER_STATUS.DELIVERED) return
    // Pré-popula com qty 0 (operador escolhe quanto devolver por item)
    const items = {}
    for (const it of order.items ?? []) {
      if (it.status === 'cancelado') continue
      const remaining = Number(it.qty) - Number(it.qtyReturned ?? 0)
      if (remaining > 0) items[it.id] = 0
    }
    setReturnModal({ items, reason: '' })
  }

  const handleConfirmReturn = async () => {
    if (!returnModal || !onReturn) return
    const reason = returnModal.reason.trim()
    if (!reason) {
      toast({ variant: 'error', title: 'Motivo obrigatório', description: 'Informe o motivo da devolução.' })
      return
    }
    const selected = Object.entries(returnModal.items)
      .filter(([_, q]) => Number(q) > 0)
      .map(([itemId, qty]) => ({ itemId, qty: Number(qty) }))

    setReturning(true)
    try {
      // selected vazio = devolução total (backend interpreta)
      await onReturn(order.id, selected, reason)
      toast({
        variant: 'success',
        title: selected.length === 0 ? 'Devolução total registrada' : 'Devolução parcial registrada',
        description: 'Estoque devolvido e saldo do cliente estornado.',
      })
      setReturnModal(null)
    } catch (e) {
      console.error('return', e.message)
      toast({ variant: 'error', title: 'Não foi possível processar', description: e.message || 'Tente novamente.' })
    } finally {
      setReturning(false)
    }
  }

  // Itens disponíveis para devolução (não-cancelados, com saldo > 0)
  const returnableItems = (order?.items ?? []).filter(
    i => i.status !== 'cancelado' && (Number(i.qty) - Number(i.qtyReturned ?? 0)) > 0
  )

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
                  <span className="text-lg font-bold text-[var(--color-text)]">{orderNumber(order.id, order.number, order.ref)}</span>
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
              {(transitions.length > 0 || order.status === ORDER_STATUS.DELIVERED) && (
                <div className="p-4 border-b border-[var(--color-border)]">
                  <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Ações</p>
                  {confirmStatus ? (
                    <div className="space-y-2">
                      <p className="text-sm text-[var(--color-text)]">
                        Confirmar: <strong>{STATUS_META[confirmStatus]?.label}</strong>?
                      </p>
                      {confirmStatus === ORDER_STATUS.CANCELLED && (
                        <textarea
                          autoFocus
                          value={cancelReason}
                          onChange={e => setCancelReason(e.target.value)}
                          placeholder="Motivo do cancelamento (obrigatório)…"
                          rows={2}
                          className="w-full text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-400 resize-none"
                        />
                      )}
                      <div className="flex items-center gap-2 justify-end">
                        <Button size="sm" variant="secondary" onClick={() => { setConfirmStatus(null); setCancelReason('') }} disabled={changingStatus}>Não</Button>
                        <Button size="sm" onClick={handleStatusConfirm} disabled={changingStatus}>
                          {changingStatus ? 'Salvando…' : 'Sim'}
                        </Button>
                      </div>
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
                      {/* Botão de devolução (#117): só quando entregue e ainda há itens devolvíveis */}
                      {order.status === ORDER_STATUS.DELIVERED && onReturn && returnableItems.length > 0 && (
                        <button
                          onClick={openReturnModal}
                          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border transition-colors duration-150 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 hover:opacity-80"
                        >
                          <Undo2 size={12} /> Devolução
                        </button>
                      )}
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
                  <OrderItem key={item.id} item={item}
                    onCancel={onItemCancel && item.status !== 'cancelado' && ['pendente','confirmado','separando'].includes(order.status)
                      ? () => setCancelModal({ id: item.id, productName: item.productName, qty: item.qty - Number(item.qtyReturned ?? 0), cancelQty: 1 })
                      : null}
                    cancelling={cancellingItem === item.id} />
                ))}
                {/* Modal cancelamento parcial */}
                {cancelModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setCancelModal(null)}>
                    <div className="bg-[var(--color-bg)] rounded-xl shadow-xl p-5 w-72 space-y-3" onClick={e=>e.stopPropagation()}>
                      <p className="text-sm font-semibold text-[var(--color-text)]">Cancelar item</p>
                      <p className="text-xs text-[var(--color-text-muted)] truncate">{cancelModal.productName}</p>
                      {cancelModal.qty > 1 && (
                        <div className="space-y-1">
                          <label className="text-xs text-[var(--color-text-muted)]">Quantidade a cancelar (máx {cancelModal.qty})</label>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setCancelModal(m=>({...m, cancelQty: Math.max(1, m.cancelQty-1)}))}
                              className="w-7 h-7 rounded-lg border border-[var(--color-border)] text-sm hover:bg-[var(--color-surface)] flex items-center justify-center">-</button>
                            <span className="flex-1 text-center font-semibold text-[var(--color-text)]">{cancelModal.cancelQty}</span>
                            <button onClick={() => setCancelModal(m=>({...m, cancelQty: Math.min(m.qty, m.cancelQty+1)}))}
                              className="w-7 h-7 rounded-lg border border-[var(--color-border)] text-sm hover:bg-[var(--color-surface)] flex items-center justify-center">+</button>
                          </div>
                          <p className="text-[10px] text-[var(--color-text-disabled)] text-center">{cancelModal.cancelQty === cancelModal.qty ? 'Cancelamento total' : `Parcial — ${cancelModal.qty - cancelModal.cancelQty}x permanecem`}</p>
                        </div>
                      )}
                      <p className="text-xs text-red-500">{cancelModal.cancelQty}x serão devolvidos ao estoque.</p>
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => setCancelModal(null)} className="flex-1 text-xs py-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface)]">Não</button>
                        <button onClick={handleCancelItem} disabled={cancellingItem === cancelModal.id}
                          className="flex-1 text-xs py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">
                          {cancellingItem === cancelModal.id ? '…' : 'Cancelar'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Modal devolução (#117) */}
                {returnModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !returning && setReturnModal(null)}>
                    <div className="bg-[var(--color-bg)] rounded-xl shadow-xl p-5 w-full max-w-md max-h-[85vh] flex flex-col space-y-3" onClick={e=>e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <Undo2 size={16} className="text-amber-500" />
                        <p className="text-sm font-semibold text-[var(--color-text)]">Devolução de pedido</p>
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Selecione a quantidade a devolver por item. Deixe tudo em zero para devolução total (o pedido será cancelado).
                      </p>
                      <div className="flex-1 overflow-y-auto space-y-2 border-y border-[var(--color-border)] py-2">
                        {returnableItems.map(it => {
                          const remaining = Number(it.qty) - Number(it.qtyReturned ?? 0)
                          const v = returnModal.items[it.id] ?? 0
                          return (
                            <div key={it.id} className="flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-[var(--color-text)] truncate">{it.productName}</p>
                                <p className="text-[10px] text-[var(--color-text-muted)]">disponível: {remaining}x · {fmtBRL(it.priceUnit)}</p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => setReturnModal(m => ({ ...m, items: { ...m.items, [it.id]: Math.max(0, Number(v) - 1) } }))}
                                  className="w-6 h-6 rounded border border-[var(--color-border)] text-xs hover:bg-[var(--color-surface)] flex items-center justify-center">-</button>
                                <span className="w-7 text-center text-xs font-semibold">{v}</span>
                                <button onClick={() => setReturnModal(m => ({ ...m, items: { ...m.items, [it.id]: Math.min(remaining, Number(v) + 1) } }))}
                                  className="w-6 h-6 rounded border border-[var(--color-border)] text-xs hover:bg-[var(--color-surface)] flex items-center justify-center">+</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <textarea
                        value={returnModal.reason}
                        onChange={e => setReturnModal(m => ({ ...m, reason: e.target.value }))}
                        placeholder="Motivo da devolução (obrigatório)…"
                        rows={2}
                        className="w-full text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none"
                      />
                      <p className="text-[10px] text-[var(--color-text-disabled)]">
                        {Object.values(returnModal.items).every(q => Number(q) === 0)
                          ? '→ Devolução total: pedido será cancelado e tudo estornado.'
                          : `→ Devolução parcial: ${Object.values(returnModal.items).reduce((s,q) => s + Number(q), 0)}x ser${Object.values(returnModal.items).reduce((s,q) => s + Number(q), 0) > 1 ? 'ão' : 'á'} devolvido${Object.values(returnModal.items).reduce((s,q) => s + Number(q), 0) > 1 ? 's' : ''} ao estoque.`}
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => setReturnModal(null)} disabled={returning} className="flex-1 text-sm py-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface)] disabled:opacity-50">Cancelar</button>
                        <button onClick={handleConfirmReturn} disabled={returning}
                          className="flex-1 text-sm py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50">
                          {returning ? 'Processando…' : 'Confirmar devolução'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Resumo financeiro ── */}
              <div className="p-4 border-b border-[var(--color-border)]">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm text-[var(--color-text-muted)]">
                    <span>Unidades</span><span className="tabular-nums">{totalUnits}</span>
                  </div>
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
