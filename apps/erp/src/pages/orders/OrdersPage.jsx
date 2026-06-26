/**
 * pages/orders/OrdersPage.jsx
 *
 * Gestão de pedidos — Sprint 2 Tarefa 5.
 *
 * Layout:
 *   1. Header: título + stats (total, pendentes, hoje) + botão Novo pedido
 *   2. Filtros: busca, status (pills), canal, data from/to
 *   3. Tabela de pedidos (mobile: cards, desktop: table)
 *   4. Paginação
 *   5. OrderDetail drawer — detalhe + troca de status
 *   6. OrderForm modal — criação manual
 */

import { useSortable } from '../../hooks/useSortable.js'
import React, { useState, useCallback, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Plus, Search, RefreshCw, X,
  Printer, ShoppingCart, Clock, CalendarDays,
  ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { printList } from '../../utils/printList.js'
import { Card, Skeleton, Button } from '@aura/ui'
import { StatusBadge }  from './components/StatusBadge.jsx'
import { OrderDetail }  from './components/OrderDetail.jsx'
import { OrderForm }       from './components/OrderForm.jsx'
import { SeparationSheet } from './components/SeparationSheet.jsx'
import { useOrders }    from './useOrders.js'
import {
  ORDER_STATUS, ORDER_CHANNEL, CHANNEL_META,
  PAYMENT_METHOD_META,
  fmtBRL, fmtDateShort, orderNumber, calcOrderTotals,
} from './ordersTypes.js'

/* ─── PaymentBadge ─── */
function PaymentBadge({ method }) {
  const meta = PAYMENT_METHOD_META[method] ?? PAYMENT_METHOD_META['a_combinar']
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.color} ${meta.bg} ${meta.border}`}>
      <span>{meta.icon}</span>
      <span>{meta.label}</span>
    </span>
  )
}

/* ─── Skeleton ─── */
function OrdersSkeleton() {
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]">
            <tr>
              {['Pedido', 'Cliente', 'Canal', 'Pagamento', 'Unidades', 'Total', 'Status', 'Data', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {[...Array(7)].map((_, i) => (
              <tr key={i}>
                <td className="px-4 py-3"><Skeleton width={80} height={12} /></td>
                <td className="px-4 py-3"><Skeleton width={140} height={12} /></td>
                <td className="px-4 py-3"><Skeleton width={60}  height={12} /></td>
                <td className="px-4 py-3"><Skeleton width={80}  height={20} /></td>
                <td className="px-4 py-3"><Skeleton width={30}  height={12} /></td>
                <td className="px-4 py-3"><Skeleton width={80}  height={12} /></td>
                <td className="px-4 py-3"><Skeleton width={90}  height={22} /></td>
                <td className="px-4 py-3"><Skeleton width={80}  height={12} /></td>
                <td className="px-4 py-3"><Skeleton width={60}  height={30} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ─── KPI mini-card ─── */
function StatChip({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={14} />
      </div>
      <div>
        <p className="text-sm font-bold text-[var(--color-text)] tabular-nums leading-none">{value}</p>
        <p className="text-[10px] text-[var(--color-text-muted)] leading-none mt-0.5">{label}</p>
      </div>
    </div>
  )
}

/* ─── Linha de pedido ─── */
function OrderRow({ order, onClick }) {
  const ch = CHANNEL_META[order.channel] ?? { label: order.channel, icon: '•' }
  const { totalUnits } = calcOrderTotals(order.items)
  return (
    <tr
      onClick={() => onClick(order)}
      className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-subtle)] cursor-pointer transition-colors"
    >
      <td className="px-4 py-3">
        <span className="text-sm font-bold text-[var(--color-primary)] font-mono">
          {orderNumber(order.id, order.number)}
        </span>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-[var(--color-text)] max-w-[180px] truncate">{order.customerName}</p>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-[var(--color-text-muted)]">{ch.icon} {ch.label}</span>
      </td>
      <td className="px-4 py-3">
        <PaymentBadge method={order.paymentMethod} />
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm text-[var(--color-text-muted)] tabular-nums">{totalUnits}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm font-semibold text-[var(--color-text)] tabular-nums">{fmtBRL(order.total)}</span>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={order.status} size="sm" />
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">{fmtDateShort(order.createdAt)}</span>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={e => { e.stopPropagation(); onClick(order) }}
          className="h-7 px-2.5 rounded-lg text-xs font-medium bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] transition-colors"
        >
          Ver
        </button>
      </td>
    </tr>
  )
}

/* ─── Card mobile de pedido ─── */
function OrderCard({ order, onClick }) {
  const ch = CHANNEL_META[order.channel] ?? { label: order.channel, icon: '•' }
  const { totalUnits } = calcOrderTotals(order.items)
  return (
    <div
      onClick={() => onClick(order)}
      className="p-4 border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-subtle)] cursor-pointer transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-sm font-bold text-[var(--color-primary)] font-mono">{orderNumber(order.id, order.number)}</span>
        <StatusBadge status={order.status} size="sm" />
      </div>
      <p className="text-sm font-medium text-[var(--color-text)] truncate mb-1">{order.customerName}</p>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs text-[var(--color-text-muted)]">{ch.icon} {ch.label} · {totalUnits} unidade{totalUnits !== 1 ? 's' : ''} · {fmtDateShort(order.createdAt)}</span>
        <span className="text-sm font-bold text-[var(--color-text)] shrink-0">{fmtBRL(order.total)}</span>
      </div>
      <PaymentBadge method={order.paymentMethod} />
    </div>
  )
}

/* ─── Paginação ─── */
function Pagination({ page, totalPages, onPage, total, pageSize }) {
  if (totalPages <= 1) return null
  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-xs text-[var(--color-text-muted)]">{from}–{to} de {total} pedidos</p>
      <div className="flex items-center gap-2">
        <button onClick={() => onPage(page - 1)} disabled={page === 1}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] disabled:opacity-40 transition-colors">
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm text-[var(--color-text-muted)] px-1">{page} / {totalPages}</span>
        <button onClick={() => onPage(page + 1)} disabled={page === totalPages}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] disabled:opacity-40 transition-colors">
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

/* ─── Página ─── */
const ORDER_COLS = [
  { label: 'Pedido',    key: 'number',        sortable: true },
  { label: 'Cliente',   key: 'customerName',  sortable: true },
  { label: 'Canal',     key: 'channel',       sortable: true },
  { label: 'Pagamento', key: 'paymentMethod', sortable: true },
  { label: 'Unidades',  key: '_units',        sortable: false, align: 'right' },
  { label: 'Total',     key: 'total',         sortable: true,  align: 'right' },
  { label: 'Status',    key: 'status',        sortable: true },
  { label: 'Data',      key: 'createdAt',     sortable: true },
  { label: '',          key: '_act',          sortable: false },
]
function SortableTh({ col, sortKey, sortDir, onSort }) {
  const active = sortKey === (col.sortKey ?? col.key)
  const align  = col.align === 'right' ? 'text-right' : 'text-left'
  return (
    <th onClick={() => col.sortable && onSort(col)}
      className={`px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap select-none ${align} ${col.sortable ? 'cursor-pointer hover:text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)] transition-colors' : ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {col.label}
        {col.sortable && (active
          ? sortDir === 'asc' ? <ChevronUp size={11} className="shrink-0" /> : <ChevronDown size={11} className="shrink-0" />
          : <ChevronsUpDown size={11} className="shrink-0 opacity-30" />
        )}
      </span>
    </th>
  )
}
export function OrdersPage() {
  const {
    orders, total, totalPages, isLoading, error,
    filters, setFilters, page, setPage,
    refetch, createOrder, updateStatus, cancelItem, returnOrderItems,
    stats, PAGE_SIZE,
    customers, skus, products,
  } = useOrders()
  const { sorted: sortedOrders, sortKey: oSortKey, sortDir: oSortDir, handleSort: oHandleSort } = useSortable(orders, 'createdAt', 'desc')

  const location = useLocation()
  const [detailOrder, setDetailOrder] = useState(null)
  const [formOpen,        setFormOpen]        = useState(false)
  const [sheetOpen,       setSheetOpen]       = useState(false)
  const [sheetFilters,    setSheetFilters]    = useState({})

  useEffect(() => {
    if (location.state?.openNew) { setFormOpen(true); window.history.replaceState({}, '') }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sincroniza o pedido aberto no drawer com a lista atualizada do hook.
  // Quando algum item é cancelado, editado, ou o pedido tem status alterado em
  // background, o cancelItem/editItem do useOrders chama fetchAll() que recarrega
  // `orders`; esse effect propaga a versão fresca pro detailOrder. Se o pedido
  // sumir da lista (ex: deleted), fecha o drawer.
  useEffect(() => {
    setDetailOrder(prev => prev ? orders.find(o => o.id === prev.id) ?? null : prev)
  }, [orders])

  const openDetail = useCallback((order) => setDetailOrder(order), [])
  const closeDetail = useCallback(() => setDetailOrder(null), [])

  const handlePrintOrders = () => {
    printList({
      title: 'Pedidos',
      subtitle: filters.status ? `Status: ${filters.status}` : 'Todos os status',
      columns: [
        { label: 'Nº',       get: o => o.number ? `#${o.number}` : o.id.slice(-6).toUpperCase() },
        { label: 'Cliente',  key: 'customerName' },
        { label: 'Status',   key: 'status' },
        { label: 'Canal',    key: 'channel' },
        { label: 'Unidades', get: o => calcOrderTotals(o.items).totalUnits, align: 'right' },
        { label: 'Total',    get: o => `R$ ${Number(o.total).toFixed(2)}`, align: 'right' },
        { label: 'Data',     get: o => o.createdAt ? new Date(o.createdAt).toLocaleDateString('pt-BR') : '—' },
      ],
      rows: orders,
      summary: [
        { label: 'Pedidos',       value: stats.total },
        { label: 'Pendentes',     value: stats.pending },
      ],
    })
  }

  const handleStatusChange = useCallback(async (orderId, newStatus, note, reason) => {
    await updateStatus(orderId, newStatus, note, reason)
    setDetailOrder(prev => prev?.id === orderId
      ? {
          ...prev,
          status: newStatus,
          history: [
            ...prev.history,
            { status: newStatus, note: '', user: 'admin', at: new Date().toISOString() },
          ],
        }
      : prev
    )
  }, [updateStatus])

  // #117 — devolução parcial/total em pedido entregue
  const handleReturn = useCallback(async (orderId, items, reason) => {
    await returnOrderItems(orderId, items, reason)
  }, [returnOrderItems])

  const handleCreate = useCallback(async (payload) => {
    await createOrder(payload)
  }, [createOrder])

  const hasFilters = filters.search || filters.status || filters.channel || filters.dateFrom || filters.dateTo || filters.customerId
  const clearFilters = () => setFilters({ search: '', status: '', channel: '', dateFrom: '', dateTo: '', customerId: '' })

  const STATUS_FILTER_OPTIONS = [
    { value: '', label: 'Todos' },
    ...Object.values(ORDER_STATUS).map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })),
  ]

  return (
    <div className="space-y-5 max-w-screen-xl">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text)]">Pedidos</h2>
          {!isLoading && (
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
              {stats.total} pedido{stats.total !== 1 ? 's' : ''} no total
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isLoading && (
            <div className="hidden sm:flex items-center gap-2">
              <StatChip icon={ShoppingCart}  label="Total"     value={stats.total}   color="bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400" />
              <StatChip icon={Clock}         label="Pendentes" value={stats.pending}  color="bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400" />
              <StatChip icon={CalendarDays}  label="Hoje"      value={stats.today}   color="bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400" />
            </div>
          )}
          <button
            onClick={refetch} disabled={isLoading}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] disabled:opacity-40 transition-colors"
            aria-label="Atualizar"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
              onClick={() => {
                setSheetFilters({
                  customerId: filters.customerId || '',
                  dateFrom:   filters.dateFrom   || '',
                  dateTo:     filters.dateTo     || '',
                  status:     filters.status     || '',
                })
                setSheetOpen(true)
              }}
              className="flex items-center gap-2 h-9 px-3 text-sm font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-colors"
            >
              <Printer size={14} /> Ficha de Separação
            </button>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus size={15} /> Novo pedido
          </Button>
        </div>
      </div>

      {/* ── Filtros ── */}
      <Card className="p-3 space-y-2">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por #1001 ou nome do cliente…"
              value={filters.search}
              onChange={e => setFilters({ search: e.target.value })}
              className="w-full h-9 pl-8 pr-3 rounded-lg text-sm bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:bg-[var(--color-bg)]"
            />
          </div>
          {customers.length > 0 && (
            <select
              value={filters.customerId || ''}
              onChange={e => setFilters({ customerId: e.target.value })}
              className="h-9 px-2 rounded-lg text-sm bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              <option value="">Todos clientes</option>
              {customers.map(cu => <option key={cu.id} value={cu.id}>{cu.name}</option>)}
            </select>
          )}
          <select
            value={filters.channel}
            onChange={e => setFilters({ channel: e.target.value })}
            className="h-9 px-2 rounded-lg text-sm bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            <option value="">Canal</option>
            {Object.values(ORDER_CHANNEL).map(ch => (
              <option key={ch} value={ch}>{CHANNEL_META[ch]?.label}</option>
            ))}
          </select>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={e => setFilters({ dateFrom: e.target.value })}
            className="h-9 px-2 rounded-lg text-sm bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] hidden sm:block"
          />
          <input
            type="date"
            value={filters.dateTo}
            onChange={e => setFilters({ dateTo: e.target.value })}
            className="h-9 px-2 rounded-lg text-sm bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] hidden sm:block"
          />
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="h-9 w-9 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilters({ status: opt.value })}
              className={`
                h-7 px-3 rounded-full text-xs font-medium transition-colors border
                ${filters.status === opt.value
                  ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                  : 'bg-[var(--color-bg-subtle)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]'
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Card>

      {/* ── Conteúdo ── */}
      {isLoading ? (
        <OrdersSkeleton />
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <ShoppingCart size={32} className="text-[var(--color-text-disabled)]" />
          <div>
            <p className="font-semibold text-[var(--color-text)]">Nenhum pedido encontrado</p>
            {hasFilters
              ? <button onClick={clearFilters} className="text-sm text-[var(--color-primary)] hover:underline mt-1">Limpar filtros</button>
              : <p className="text-sm text-[var(--color-text-muted)] mt-1">Crie o primeiro pedido.</p>
            }
          </div>
          {!hasFilters && <Button size="sm" onClick={() => setFormOpen(true)}><Plus size={14} /> Novo pedido</Button>}
        </div>
      ) : (
        <>
          {/* Desktop: tabela */}
          <Card className="hidden md:block overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]">
                  <tr>
                    {ORDER_COLS.map(col => (
                      <SortableTh key={col.key} col={col} sortKey={oSortKey} sortDir={oSortDir} onSort={oHandleSort} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedOrders.map(o => <OrderRow key={o.id} order={o} onClick={openDetail} />)}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile: cards */}
          <Card className="md:hidden p-0 overflow-hidden">
            {orders.map(o => <OrderCard key={o.id} order={o} onClick={openDetail} />)}
          </Card>

          <Pagination page={page} totalPages={totalPages} onPage={setPage} total={total} pageSize={PAGE_SIZE} />
        </>
      )}

      {/* ── Detalhe ── */}
      <OrderDetail
        order={detailOrder}
        onClose={closeDetail}
        onStatusChange={handleStatusChange}
        onItemCancel={cancelItem}
        onReturn={handleReturn}
      />

      {/* ── Formulário de criação ── */}
      <SeparationSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={sheetFilters}
        customers={customers}
      />
      <OrderForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleCreate}
        customers={customers}
        skus={skus}
        products={products}
      />
    </div>
  )
}
