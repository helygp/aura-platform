/**
 * pages/customers/CustomersPage.jsx
 *
 * Gestão de clientes — Sprint 2 Tarefa 6.
 *
 * Layout:
 *   1. Header: título + stats (total/ativo/bloqueado) + botão Novo cliente
 *   2. Barra de busca + filtro de status
 *   3. Tabela (desktop) / cards (mobile)
 *   4. Paginação
 *   5. CustomerDetail drawer — perfil + histórico de pedidos
 *   6. CustomerForm modal — cadastro / edição
 *   7. Confirm modal — exclusão
 */

import { useSortable } from '../../hooks/useSortable.js'
import React, { useState, useCallback, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Printer,
  Plus, Search, RefreshCw, X,
  Users, UserCheck, UserX, ChevronLeft,
  ChevronRight, Building2, User, Edit2,
  Trash2, Eye, ChevronUp, ChevronDown,
  ChevronsUpDown, AlertTriangle,
} from 'lucide-react'
import { Card, Skeleton, Button, Modal } from '@aura/ui'
import { printList } from '../../utils/printList.js'
import { CustomerForm }   from './components/CustomerForm.jsx'
import { CustomerDetail } from './components/CustomerDetail.jsx'
import { useCustomers }   from './useCustomers.js'
import {
  CUSTOMER_STATUS, STATUS_META, PERSON_TYPE,
  fmtBRL, fmtDate,
} from './customersTypes.js'

/* ─── Skeleton ─── */
function TableSkeleton() {
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]">
            <tr>
              {['Cliente', 'Documento', 'WhatsApp', 'Limite', 'Status', 'Pedidos', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {[...Array(8)].map((_, i) => (
              <tr key={i}>
                <td className="px-4 py-3"><div className="space-y-1.5"><Skeleton width="70%" height={13} /><Skeleton width="40%" height={10} /></div></td>
                <td className="px-4 py-3"><Skeleton width={120} height={12} /></td>
                <td className="px-4 py-3"><Skeleton width={110} height={12} /></td>
                <td className="px-4 py-3"><Skeleton width={80}  height={12} /></td>
                <td className="px-4 py-3"><Skeleton width={80}  height={22} /></td>
                <td className="px-4 py-3"><Skeleton width={30}  height={12} /></td>
                <td className="px-4 py-3"><Skeleton width={70}  height={30} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ─── KPI chip ─── */
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

/* ─── Status badge inline ─── */
function StatusBadge({ status }) {
  const meta = STATUS_META[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${meta.bg} ${meta.color} ${meta.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
      {meta.label}
    </span>
  )
}

/* ─── Linha de tabela ─── */
function CustomerRow({ customer, onView, onEdit, onDelete }) {
  const isPJ = customer.personType === PERSON_TYPE.PJ
  return (
    <tr
      onClick={() => onView(customer)}
      className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-subtle)] cursor-pointer transition-colors group"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[var(--color-surface)] flex items-center justify-center shrink-0">
            {isPJ
              ? <Building2 size={14} className="text-[var(--color-text-muted)]" />
              : <User      size={14} className="text-[var(--color-text-muted)]" />
            }
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text)] truncate max-w-[200px]">{customer.name}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{isPJ ? 'PJ' : 'PF'} · {customer.address?.state || '—'}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs font-mono text-[var(--color-text-muted)]">{customer.document}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-[var(--color-text-muted)]">{customer.whatsapp}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm font-medium text-[var(--color-text)] tabular-nums">
          {customer.creditLimit ? fmtBRL(customer.creditLimit) : '—'}
        </span>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={customer.status} />
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-[var(--color-text-muted)] tabular-nums">
          {customer.orders?.length ?? 0}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.stopPropagation(); onView(customer) }}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors"
            title="Ver perfil"
          >
            <Eye size={14} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onEdit(customer) }}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors"
            title="Editar"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(customer) }}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
            title="Excluir"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  )
}

/* ─── Card mobile ─── */
function CustomerCard({ customer, onView, onEdit, onDelete }) {
  const isPJ = customer.personType === PERSON_TYPE.PJ
  return (
    <div
      onClick={() => onView(customer)}
      className="p-4 border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-subtle)] cursor-pointer transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-[var(--color-surface)] flex items-center justify-center shrink-0">
            {isPJ ? <Building2 size={15} className="text-[var(--color-text-muted)]" /> : <User size={15} className="text-[var(--color-text-muted)]" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text)] truncate">{customer.name}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{customer.document}</p>
          </div>
        </div>
        <StatusBadge status={customer.status} />
      </div>
      <div className="flex items-center justify-between mt-2 pl-11">
        <p className="text-xs text-[var(--color-text-muted)]">
          {customer.whatsapp} · {customer.orders?.length ?? 0} pedido{customer.orders?.length !== 1 ? 's' : ''}
        </p>
        <div className="flex gap-1">
          <button
            onClick={e => { e.stopPropagation(); onEdit(customer) }}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(customer) }}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
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
      <p className="text-xs text-[var(--color-text-muted)]">{from}–{to} de {total} clientes</p>
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

/* ─── Modal de confirmação exclusão ─── */
function DeleteModal({ customer, onConfirm, onCancel }) {
  const [deleting, setDeleting] = useState(false)
  const go = async () => {
    setDeleting(true)
    try { await onConfirm(customer.id) } finally { setDeleting(false) }
  }
  return (
    <Modal open={Boolean(customer)} onOpenChange={v => !v && onCancel()}>
      <Modal.Content title="Excluir cliente" size="sm">
        <div className="py-2 space-y-3">
          <div className="flex gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
            <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">Esta ação não pode ser desfeita.</p>
          </div>
          <p className="text-sm text-[var(--color-text)]">
            Confirmar exclusão de <strong>{customer?.name}</strong>?
          </p>
        </div>
        <Modal.Footer>
          <Button variant="secondary" onClick={onCancel} disabled={deleting}>Cancelar</Button>
          <Button variant="destructive" onClick={go} disabled={deleting}>
            {deleting ? <><RefreshCw size={14} className="animate-spin" /> Excluindo…</> : 'Excluir'}
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  )
}

/* ─── Página ─── */
const CUST_COLS = [
  { label: 'Cliente',   key: 'name',         sortable: true },
  { label: 'Documento', key: 'document',      sortable: true },
  { label: 'WhatsApp',  key: 'whatsapp',      sortable: true },
  { label: 'Limite',    key: 'credit_limit',  sortable: true, align: 'right' },
  { label: 'Status',    key: 'portal_active', sortable: false },
  { label: 'Pedidos',   key: 'orders_count',  sortable: true, align: 'right' },
  { label: '',          key: '_act',           sortable: false },
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
export function CustomersPage() {
  const {
    customers, total, totalPages, isLoading,
    filters, setFilters, page, setPage,
    refetch, saveCustomer, deleteCustomer,
    getCustomerOrders, stats, PAGE_SIZE,
  } = useCustomers()
  const { sorted: sortedCustomers, sortKey: cSortKey, sortDir: cSortDir, handleSort: cHandleSort } = useSortable(customers, 'name')

  const location = useLocation()
  const [detailCustomer,  setDetailCustomer]  = useState(null)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [formOpen,        setFormOpen]        = useState(false)
  const [deletingCustomer, setDeletingCustomer] = useState(null)

  useEffect(() => {
    if (location.state?.openNew) { setEditingCustomer(null); setFormOpen(true); window.history.replaceState({}, '') }
  }, []) // eslint-disable-line

  const openNew   = () => { setEditingCustomer(null); setFormOpen(true) }
  const openEdit  = useCallback((c) => { setEditingCustomer(c); setFormOpen(true) }, [])
  const openView  = useCallback((c) => setDetailCustomer(c), [])
  const closeForm = () => { setFormOpen(false); setEditingCustomer(null) }

  const handleSave = useCallback(async (data) => {
    await saveCustomer(data)
  }, [saveCustomer])

  const handleDelete = useCallback(async (id) => {
    await deleteCustomer(id)
    setDeletingCustomer(null)
    if (detailCustomer?.id === id) setDetailCustomer(null)
  }, [deleteCustomer, detailCustomer])

  /* ─── Bug1 fix: handlePrintCustomers estava undefined ─── */
  const handlePrintCustomers = useCallback(() => {
    printList({
      title: 'Clientes',
      subtitle: filters.status ? `Filtro: ${filters.status}` : '',
      columns: [
        { label: 'Cliente',   get: c => c.name },
        { label: 'Tipo',      get: c => c.personType === 'pf' ? 'PF' : 'PJ' },
        { label: 'Documento', get: c => c.document || '—' },
        { label: 'WhatsApp',  get: c => c.whatsapp  || '—' },
        { label: 'Limite',    get: c => c.creditLimit ? fmtBRL(c.creditLimit) : '—', align: 'right' },
        { label: 'Status',    get: c => STATUS_META[c.status]?.label || c.status },
        { label: 'Pedidos',   get: c => c.orders?.length ?? 0, align: 'right' },
      ],
      rows: sortedCustomers,
      summary: [
        { label: 'Total',    value: stats.total },
        { label: 'Ativos',   value: stats.active },
        { label: 'Bloqueados', value: stats.blocked },
      ],
    })
  }, [sortedCustomers, filters, stats])

  const hasFilters = filters.search || filters.status
  const clearFilters = () => setFilters({ search: '', status: '' })

  return (
    <div className="space-y-5 max-w-screen-xl">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text)]">Clientes</h2>
          {!isLoading && (
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{stats.total} clientes cadastrados</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isLoading && (
            <div className="hidden sm:flex items-center gap-2">
              <StatChip icon={Users}     label="Total"     value={stats.total}    color="bg-sky-50    text-sky-600    dark:bg-sky-950    dark:text-sky-400"    />
              <StatChip icon={UserCheck} label="Ativos"    value={stats.active}   color="bg-green-50  text-green-600  dark:bg-green-950  dark:text-green-400"  />
              <StatChip icon={UserX}     label="Bloqueados" value={stats.blocked} color="bg-red-50    text-red-600    dark:bg-red-950    dark:text-red-400"    />
            </div>
          )}
          <button
            onClick={refetch} disabled={isLoading}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] disabled:opacity-40 transition-colors"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button onClick={handlePrintCustomers}
            className="flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors">
            <Printer size={14} /> Imprimir
          </button>
          <Button size="sm" onClick={openNew}>
            <Plus size={15} /> Novo cliente
          </Button>
        </div>
      </div>

      {/* ── Filtros ── */}
      <Card className="p-3">
        <div className="flex gap-2 flex-wrap">
          <div className="flex-1 min-w-[180px] relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nome, CNPJ/CPF ou WhatsApp…"
              value={filters.search}
              onChange={e => setFilters({ search: e.target.value })}
              className="w-full h-9 pl-8 pr-3 rounded-lg text-sm bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:bg-[var(--color-bg)]"
            />
          </div>
          {/* Pills de status */}
          {['', ...Object.values(CUSTOMER_STATUS)].map(s => (
            <button
              key={s}
              onClick={() => setFilters({ status: s })}
              className={`
                h-9 px-3 rounded-lg text-sm font-medium transition-colors border
                ${filters.status === s
                  ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                  : 'bg-[var(--color-bg-subtle)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]'
                }
              `}
            >
              {s === '' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="h-9 w-9 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </Card>

      {/* ── Conteúdo ── */}
      {isLoading ? (
        <TableSkeleton />
      ) : customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <Users size={32} className="text-[var(--color-text-disabled)]" />
          <div>
            <p className="font-semibold text-[var(--color-text)]">Nenhum cliente encontrado</p>
            {hasFilters
              ? <button onClick={clearFilters} className="text-sm text-[var(--color-primary)] hover:underline mt-1">Limpar filtros</button>
              : <p className="text-sm text-[var(--color-text-muted)] mt-1">Comece cadastrando seu primeiro cliente.</p>
            }
          </div>
          {!hasFilters && <Button size="sm" onClick={openNew}><Plus size={14} /> Novo cliente</Button>}
        </div>
      ) : (
        <>
          {/* Desktop: tabela */}
          <Card className="hidden md:block overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]">
                  <tr>
                    {CUST_COLS.map(col => (
                      <SortableTh key={col.key} col={col} sortKey={cSortKey} sortDir={cSortDir} onSort={cHandleSort} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedCustomers.map(c => (
                    <CustomerRow
                      key={c.id}
                      customer={c}
                      onView={openView}
                      onEdit={openEdit}
                      onDelete={setDeletingCustomer}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile: cards */}
          <Card className="md:hidden p-0 overflow-hidden">
            {customers.map(c => (
              <CustomerCard
                key={c.id}
                customer={c}
                onView={openView}
                onEdit={openEdit}
                onDelete={setDeletingCustomer}
              />
            ))}
          </Card>

          <Pagination page={page} totalPages={totalPages} onPage={setPage} total={total} pageSize={PAGE_SIZE} />
        </>
      )}

      {/* ── Drawer detalhe ── */}
      <CustomerDetail
        customer={detailCustomer}
        orders={detailCustomer ? getCustomerOrders(detailCustomer.id) : []}
        onClose={() => setDetailCustomer(null)}
        onEdit={() => openEdit(detailCustomer)}
      />

      {/* ── Formulário ── */}
      <CustomerForm
        open={formOpen}
        onClose={closeForm}
        customer={editingCustomer}
        onSave={handleSave}
      />

      {/* ── Confirm exclusão ── */}
      <DeleteModal
        customer={deletingCustomer}
        onConfirm={handleDelete}
        onCancel={() => setDeletingCustomer(null)}
      />
    </div>
  )
}
