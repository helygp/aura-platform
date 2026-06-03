/**
 * pages/customers/components/CustomerDetail.jsx
 *
 * Drawer lateral com perfil completo do cliente.
 * Mobile: tela cheia. Desktop: 480px fixo à direita.
 *
 * Seções:
 *   - Header: nome, tipo, status badge, botões editar/fechar
 *   - Dados de contato (WhatsApp com link direto, e-mail, doc)
 *   - Endereço
 *   - Financeiro: limite de crédito, total comprado, nº pedidos
 *   - Histórico de pedidos (lista compacta com status)
 *
 * Props:
 *   customer : objeto completo (null = fechado)
 *   orders   : array de pedidos do cliente
 *   onClose  : fn
 *   onEdit   : fn
 */

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Edit2, MessageCircle, Mail, FileText,
  MapPin, CreditCard, ShoppingCart, Calendar,
  User, Building2,
} from 'lucide-react'
import { Button } from '@aura/ui'
import {
  PERSON_TYPE, STATUS_META, CUSTOMER_STATUS,
  fmtBRL, fmtDate, customerOrderStats,
} from '../customersTypes.js'

/* ─── Linha de info ─── */
function InfoRow({ icon: Icon, label, value, href }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[var(--color-border)] last:border-0">
      <Icon size={15} className="text-[var(--color-text-muted)] mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-[var(--color-text-disabled)] uppercase tracking-wide">{label}</p>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer"
            className="text-sm font-medium text-[var(--color-primary)] hover:underline truncate block">
            {value}
          </a>
        ) : (
          <p className="text-sm font-medium text-[var(--color-text)] truncate">{value || '—'}</p>
        )}
      </div>
    </div>
  )
}

/* ─── Badge de status de pedido (mini) ─── */
const ORDER_STATUS_COLORS = {
  pendente:    'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  confirmado:  'bg-blue-100  text-blue-700  dark:bg-blue-950  dark:text-blue-300',
  separando:   'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  enviado:     'bg-cyan-100  text-cyan-700  dark:bg-cyan-950  dark:text-cyan-300',
  entregue:    'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  cancelado:   'bg-red-100   text-red-600   dark:bg-red-950   dark:text-red-300',
}

function OrderRow({ order }) {
  const colorClass = ORDER_STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600'
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--color-border)] last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <ShoppingCart size={13} className="text-[var(--color-text-muted)] shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-mono font-semibold text-[var(--color-text)]">
            #{order.id.slice(-6).toUpperCase()}
          </p>
          <p className="text-[10px] text-[var(--color-text-disabled)]">{fmtDate(order.createdAt)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colorClass}`}>
          {order.status}
        </span>
        <span className="text-sm font-bold text-[var(--color-text)] tabular-nums">
          {fmtBRL(order.total)}
        </span>
      </div>
    </div>
  )
}

export function CustomerDetail({ customer, orders, onClose, onEdit }) {
  if (!customer) return null

  const meta       = STATUS_META[customer.status]
  const orderStats = customerOrderStats(orders ?? [])
  const isPJ       = customer.personType === PERSON_TYPE.PJ
  const addrParts  = [
    customer.address?.street,
    customer.address?.city,
    customer.address?.state,
    customer.address?.zip,
  ].filter(Boolean)

  return (
    <AnimatePresence>
      {customer && (
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
              w-full md:w-[480px]
              flex flex-col
              bg-[var(--color-bg)] border-l border-[var(--color-border)]
              shadow-2xl
            "
          >
            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-3 p-4 border-b border-[var(--color-border)] shrink-0">
              <div className="flex items-start gap-3 min-w-0">
                {/* Avatar */}
                <div className="w-11 h-11 rounded-xl bg-[var(--color-primary-muted,#e0f2fe)] flex items-center justify-center shrink-0">
                  {isPJ
                    ? <Building2 size={20} className="text-[var(--color-primary)]" />
                    : <User      size={20} className="text-[var(--color-primary)]" />
                  }
                </div>
                <div className="min-w-0">
                  <p className="text-base font-bold text-[var(--color-text)] truncate">{customer.name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-[var(--color-text-muted)]">{isPJ ? 'Pessoa Jurídica' : 'Pessoa Física'}</span>
                    <span className={`
                      inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border
                      ${meta.bg} ${meta.color} ${meta.border}
                    `}>
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => { onClose(); setTimeout(onEdit, 150) }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors"
                  title="Editar"
                >
                  <Edit2 size={15} />
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

              {/* ── Contato ── */}
              <div className="p-4 border-b border-[var(--color-border)]">
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Contato</p>
                <InfoRow
                  icon={MessageCircle}
                  label="WhatsApp"
                  value={customer.whatsapp}
                  href={`https://wa.me/55${customer.whatsapp.replace(/\D/g, '')}`}
                />
                {customer.email && (
                  <InfoRow
                    icon={Mail}
                    label="E-mail"
                    value={customer.email}
                    href={`mailto:${customer.email}`}
                  />
                )}
                <InfoRow
                  icon={FileText}
                  label={isPJ ? 'CNPJ' : 'CPF'}
                  value={customer.document}
                />
                <InfoRow
                  icon={Calendar}
                  label="Cliente desde"
                  value={fmtDate(customer.createdAt)}
                />
              </div>

              {/* ── Endereço ── */}
              {addrParts.length > 0 && (
                <div className="p-4 border-b border-[var(--color-border)]">
                  <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Endereço</p>
                  <InfoRow icon={MapPin} label="Endereço completo" value={addrParts.join(', ')} />
                </div>
              )}

              {/* ── Financeiro ── */}
              <div className="p-4 border-b border-[var(--color-border)]">
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">Financeiro</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Limite de crédito', value: fmtBRL(customer.creditLimit), icon: CreditCard },
                    { label: 'Total comprado',     value: fmtBRL(orderStats.totalValue), icon: ShoppingCart },
                    { label: 'Nº de pedidos',      value: orderStats.total,              icon: ShoppingCart },
                  ].map(stat => (
                    <div key={stat.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3 text-center">
                      <p className="text-lg font-bold text-[var(--color-text)] tabular-nums">{stat.value}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 leading-tight">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Histórico de pedidos ── */}
              <div className="p-4">
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                  Pedidos ({orders?.length ?? 0})
                </p>
                {orders?.length ? (
                  orders.map(o => <OrderRow key={o.id} order={o} />)
                ) : (
                  <div className="text-center py-8">
                    <ShoppingCart size={28} className="text-[var(--color-text-disabled)] mx-auto mb-2" />
                    <p className="text-sm text-[var(--color-text-muted)]">Nenhum pedido ainda.</p>
                  </div>
                )}
              </div>

            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
