/**
 * pages/whatsapp/components/PendingOrders.jsx
 *
 * Fila de pedidos recebidos via bot aguardando aprovação.
 * Cada card mostra: cliente, itens resumidos, total, tempo decorrido.
 * Ações: Aprovar (verde) / Recusar (vermelho) com 1 clique.
 * Após ação, card some com animação de saída.
 *
 * Props:
 *   orders   : array de pedidos bot
 *   loading  : boolean
 *   onReview : (orderId, approved) => Promise
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, Clock, ShoppingCart, Package, MessageSquare } from 'lucide-react'
import { ConversationModal } from './ConversationModal.jsx'
import { Skeleton } from '@aura/ui'
import { BOT_ORDER_STATUS, fmtBRL, fmtDateTime } from '../whatsappTypes.js'

/* Tempo decorrido legível */
function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins   = Math.floor(diffMs / 60000)
  if (mins < 1)   return 'agora'
  if (mins < 60)  return `${mins}min atrás`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h atrás`
  return fmtDateTime(iso)
}

function OrderCard({ order, onReview }) {
  const [acting, setActing] = useState(null) // 'approve' | 'reject'
  const [showConv, setShowConv] = useState(false)
  const hasConv = Array.isArray(order.conversation) && order.conversation.length > 0

  const isPending  = order.status === BOT_ORDER_STATUS.PENDING_APPROVAL
  const isApproved = order.status === BOT_ORDER_STATUS.APPROVED
  const isRejected = order.status === BOT_ORDER_STATUS.REJECTED

  const handle = async (approved) => {
    const key = approved ? 'approve' : 'reject'
    setActing(key)
    try {
      await onReview(order.id, approved)
    } finally {
      setActing(null)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: isApproved ? 60 : -60, transition: { duration: 0.25 } }}
      className={`
        rounded-xl border p-4 space-y-3
        ${isApproved ? 'border-green-300 bg-green-50 dark:bg-green-950 dark:border-green-800'
          : isRejected ? 'border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-800'
          : 'border-[var(--color-border)] bg-[var(--color-bg)]'
        }
      `}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs font-mono font-bold text-[var(--color-primary)]">
              #{order.botOrderId}
            </span>
            <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-0.5">
              <Clock size={10} /> {timeAgo(order.receivedAt)}
            </span>
          </div>
          <p className="text-sm font-semibold text-[var(--color-text)]">{order.customerName}</p>
          <a
            href={`https://wa.me/55${order.customerPhone.replace(/\D/g,'')}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-green-600 hover:underline"
            onClick={e => e.stopPropagation()}
          >
            {order.customerPhone}
          </a>
        </div>
        <span className="text-base font-bold text-[var(--color-text)] tabular-nums shrink-0">
          {fmtBRL(order.total)}
        </span>
      </div>

      {/* ── Itens ── */}
      <div className="space-y-1">
        {order.items.map((item, i) => {
          const attrs = Object.values(item.attributes ?? {}).join('/')
          return (
            <div key={i} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <Package size={11} className="text-[var(--color-text-muted)] shrink-0" />
                <span className="text-[var(--color-text)] truncate">
                  {item.productName}{attrs ? ` (${attrs})` : ''}
                </span>
              </div>
              <span className="text-[var(--color-text-muted)] shrink-0 tabular-nums">
                {item.qty}x {fmtBRL(item.priceUnit)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Botão Ver conversa */}
      {hasConv && (
        <button
          onClick={() => setShowConv(true)}
          className="flex items-center gap-1.5 text-xs text-[var(--color-primary)] hover:underline"
        >
          <MessageSquare size={11} /> Ver conversa ({order.conversation.length} mensagens)
        </button>
      )}

      <ConversationModal order={order} open={showConv} onClose={() => setShowConv(false)} />

      {/* ── Ações ── */}
      {isPending ? (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => handle(false)}
            disabled={Boolean(acting)}
            className="
              flex-1 flex items-center justify-center gap-1.5
              h-9 rounded-lg border border-red-300 text-red-600
              text-sm font-semibold
              hover:bg-red-50 dark:hover:bg-red-950
              disabled:opacity-50 transition-colors
            "
          >
            {acting === 'reject'
              ? <span className="text-xs">Recusando…</span>
              : <><X size={15} /> Recusar</>
            }
          </button>
          <button
            onClick={() => handle(true)}
            disabled={Boolean(acting)}
            className="
              flex-1 flex items-center justify-center gap-1.5
              h-9 rounded-lg bg-green-500 text-white
              text-sm font-semibold
              hover:bg-green-600
              disabled:opacity-50 transition-colors
            "
          >
            {acting === 'approve'
              ? <span className="text-xs">Aprovando…</span>
              : <><Check size={15} /> Aprovar</>
            }
          </button>
        </div>
      ) : (
        <div className={`flex items-center gap-1.5 text-xs font-semibold pt-1 ${isApproved ? 'text-green-600' : 'text-red-500'}`}>
          {isApproved ? <Check size={13} /> : <X size={13} />}
          {isApproved ? 'Aprovado' : 'Recusado'}
        </div>
      )}
    </motion.div>
  )
}

export function PendingOrders({ orders, loading, onReview }) {
  const pending  = orders.filter(o => o.status === BOT_ORDER_STATUS.PENDING_APPROVAL)
  const resolved = orders.filter(o => o.status !== BOT_ORDER_STATUS.PENDING_APPROVAL)

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton width="100%" height={140} className="rounded-xl" />
        <Skeleton width="100%" height={140} className="rounded-xl" />
      </div>
    )
  }

  if (!orders.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-950 flex items-center justify-center">
          <Check size={24} className="text-green-500" />
        </div>
        <p className="text-sm font-semibold text-[var(--color-text)]">Fila em dia!</p>
        <p className="text-xs text-[var(--color-text-muted)]">Nenhum pedido aguardando aprovação.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Pendentes primeiro */}
      <AnimatePresence mode="popLayout">
        {pending.map(o => (
          <OrderCard key={o.id} order={o} onReview={onReview} />
        ))}
      </AnimatePresence>

      {/* Resolvidos com opacidade */}
      {resolved.length > 0 && (
        <>
          {pending.length > 0 && (
            <div className="flex items-center gap-2 py-1">
              <div className="flex-1 h-px bg-[var(--color-border)]" />
              <span className="text-[10px] text-[var(--color-text-disabled)] uppercase tracking-wide">Resolvidos</span>
              <div className="flex-1 h-px bg-[var(--color-border)]" />
            </div>
          )}
          <div className="space-y-2 opacity-60">
            {resolved.map(o => (
              <OrderCard key={o.id} order={o} onReview={onReview} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
