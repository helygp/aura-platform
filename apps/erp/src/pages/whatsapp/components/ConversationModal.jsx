/**
 * pages/whatsapp/components/ConversationModal.jsx
 *
 * Modal que exibe o histórico de conversa entre cliente e agente IA
 * para um bot_order específico.
 *
 * Props:
 *   order : objeto bot_order com conversation: [{role, content, at}]
 *   open  : boolean
 *   onClose : () => void
 */

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, User, Bot, Clock } from 'lucide-react'

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  const time   = msg.at ? new Date(msg.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
        isUser ? 'bg-[var(--color-primary)] text-white' : 'bg-purple-500 text-white'
      }`}>
        {isUser ? <User size={13} /> : <Bot size={13} />}
      </div>
      <div className={`flex-1 max-w-[75%] ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block px-3 py-2 rounded-2xl text-sm ${
          isUser
            ? 'bg-[var(--color-primary)] text-white rounded-br-sm'
            : 'bg-[var(--color-bg-subtle)] text-[var(--color-text)] rounded-bl-sm'
        }`}>
          {msg.content}
        </div>
        {time && (
          <p className="text-[10px] text-[var(--color-text-disabled)] mt-0.5 px-1 flex items-center gap-0.5 justify-start">
            {!isUser && <Clock size={9} />} {time}
          </p>
        )}
      </div>
    </div>
  )
}

export function ConversationModal({ order, open, onClose }) {
  if (!order) return null

  const conversation = Array.isArray(order.conversation) ? order.conversation : []

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1,    opacity: 1 }}
            exit={{    scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-lg max-h-[85vh] bg-[var(--color-bg)] rounded-2xl border border-[var(--color-border)] shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 p-4 border-b border-[var(--color-border)]">
              <div className="min-w-0">
                <p className="text-xs font-mono font-bold text-[var(--color-primary)]">#{order.botOrderId}</p>
                <p className="text-sm font-semibold text-[var(--color-text)] truncate">{order.customerName}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{order.customerPhone}</p>
              </div>
              <button onClick={onClose} className="shrink-0 w-7 h-7 rounded-lg hover:bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-text-muted)]">
                <X size={14} />
              </button>
            </div>

            {/* Conversa */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {conversation.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Bot size={28} className="text-[var(--color-text-disabled)] mb-2" />
                  <p className="text-sm text-[var(--color-text-muted)]">Nenhuma mensagem registrada nesta conversa.</p>
                </div>
              ) : (
                conversation.map((msg, i) => (
                  <MessageBubble key={i} msg={msg} />
                ))
              )}
            </div>

            {/* Footer com resumo do pedido */}
            <div className="border-t border-[var(--color-border)] p-3 bg-[var(--color-bg-subtle)] rounded-b-2xl">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-muted)]">
                  {order.items?.length ?? 0} {order.items?.length === 1 ? 'item' : 'itens'}
                </span>
                <span className="font-bold text-[var(--color-text)] tabular-nums">
                  R$ {Number(order.total ?? 0).toFixed(2).replace('.', ',')}
                </span>
              </div>
              {order.orderId && (
                <p className="text-[10px] text-green-600 mt-1">
                  ✓ Convertido em pedido (ref interna)
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
