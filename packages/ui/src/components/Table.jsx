import React from 'react'
import { cn } from '../cn.js'
import { Skeleton } from './Skeleton.jsx'
import { Button } from './Button.jsx'

/**
 * Table — Aura UI
 *
 * Uso:
 *   <Table
 *     columns={[
 *       { key: 'name',  header: 'Nome',   className: 'font-medium' },
 *       { key: 'email', header: 'E-mail'  },
 *       { key: 'role',  header: 'Perfil', render: (row) => <Badge>{row.role}</Badge> },
 *     ]}
 *     data={rows}
 *     keyField="id"
 *     loading={false}
 *     emptyMessage="Nenhum resultado encontrado."
 *     pagination={{ page: 1, pageSize: 10, total: 48, onChange: (p) => setPage(p) }}
 *   />
 *
 * columns[]:
 *   key       : keyof row (usado para extrair valor padrão)
 *   header    : ReactNode
 *   render    : (row, index) => ReactNode  — override do conteúdo da célula
 *   className : string — classes extras em td e th
 *   width     : string — ex. '120px', '20%'
 *
 * pagination:
 *   page, pageSize, total, onChange(newPage)
 */

/* ─── Primitivos de tabela (estilizados) ─── */

const TableRoot = React.forwardRef(function TableRoot({ className, ...props }, ref) {
  return (
    <div className="w-full overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)]">
      <table
        ref={ref}
        className={cn('w-full caption-bottom text-sm border-collapse', className)}
        {...props}
      />
    </div>
  )
})

const TableHead = React.forwardRef(function TableHead({ className, ...props }, ref) {
  return (
    <thead
      ref={ref}
      className={cn('bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]', className)}
      {...props}
    />
  )
})

const TableBody = React.forwardRef(function TableBody({ className, ...props }, ref) {
  return (
    <tbody
      ref={ref}
      className={cn('divide-y divide-[var(--color-border)]', className)}
      {...props}
    />
  )
})

const TableRow = React.forwardRef(function TableRow({ className, ...props }, ref) {
  return (
    <tr
      ref={ref}
      className={cn(
        'bg-[var(--color-bg)] transition-colors',
        'hover:bg-[var(--color-bg-subtle)]',
        'data-[selected=true]:bg-[var(--color-surface)]',
        className
      )}
      {...props}
    />
  )
})

const TableTh = React.forwardRef(function TableTh({ className, style, ...props }, ref) {
  return (
    <th
      ref={ref}
      style={style}
      className={cn(
        'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide',
        'text-[var(--color-text-muted)]',
        className
      )}
      {...props}
    />
  )
})

const TableTd = React.forwardRef(function TableTd({ className, ...props }, ref) {
  return (
    <td
      ref={ref}
      className={cn('px-4 py-3 text-[var(--color-text)] align-middle', className)}
      {...props}
    />
  )
})

/* ─── Empty State ─── */
function EmptyState({ colSpan, message }) {
  return (
    <TableRow>
      <TableTd colSpan={colSpan} className="text-center py-12">
        <div className="flex flex-col items-center gap-2 text-[var(--color-text-muted)]">
          <span className="text-3xl">📭</span>
          <p className="text-sm">{message}</p>
        </div>
      </TableTd>
    </TableRow>
  )
}

/* ─── Loading Skeleton Rows ─── */
function SkeletonRows({ columns, rows = 5 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <TableRow key={i}>
      {columns.map((col) => (
        <TableTd key={col.key}>
          <Skeleton height={14} width={col.skeletonWidth ?? '75%'} />
        </TableTd>
      ))}
    </TableRow>
  ))
}

/* ─── Paginação ─── */
function Pagination({ page, pageSize, total, onChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = Math.min((page - 1) * pageSize + 1, total)
  const to   = Math.min(page * pageSize, total)

  // Janela de páginas visíveis (máx 5)
  const getPages = () => {
    const delta = 2
    const range = []
    const left  = Math.max(1, page - delta)
    const right = Math.min(totalPages, page + delta)
    for (let i = left; i <= right; i++) range.push(i)
    // dots à esquerda
    if (left > 2) range.unshift('...', 1)
    else if (left === 2) range.unshift(1)
    // dots à direita
    if (right < totalPages - 1) range.push('...', totalPages)
    else if (right === totalPages - 1) range.push(totalPages)
    return range
  }

  return (
    <div className={cn(
      'flex flex-col sm:flex-row items-center justify-between gap-3',
      'px-4 py-3 border-t border-[var(--color-border)]',
      'bg-[var(--color-bg-subtle)] rounded-b-[var(--radius-lg)]',
      'text-xs text-[var(--color-text-muted)]'
    )}>
      <span>
        {total === 0
          ? 'Sem resultados'
          : `Exibindo ${from}–${to} de ${total} ${total === 1 ? 'item' : 'itens'}`}
      </span>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Página anterior"
        >
          ‹
        </Button>

        {getPages().map((p, i) =>
          p === '...'
            ? <span key={`dot-${i}`} className="px-1 select-none">…</span>
            : (
              <Button
                key={p}
                variant={p === page ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => onChange(p)}
                aria-current={p === page ? 'page' : undefined}
                className="min-w-[2rem]"
              >
                {p}
              </Button>
            )
        )}

        <Button
          variant="ghost"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="Próxima página"
        >
          ›
        </Button>
      </div>
    </div>
  )
}

/* ─── Componente principal ─── */
const Table = React.forwardRef(function Table(
  {
    columns = [],
    data = [],
    keyField = 'id',
    loading = false,
    emptyMessage = 'Nenhum item encontrado.',
    skeletonRows = 5,
    pagination,
    className,
    onRowClick,
    ...props
  },
  ref
) {
  const isEmpty = !loading && data.length === 0

  return (
    <div ref={ref} className={cn('flex flex-col', className)} {...props}>
      <TableRoot>
        <TableHead>
          <tr>
            {columns.map((col) => (
              <TableTh
                key={col.key}
                className={col.className}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </TableTh>
            ))}
          </tr>
        </TableHead>

        <TableBody>
          {loading && (
            <SkeletonRows columns={columns} rows={skeletonRows} />
          )}

          {isEmpty && (
            <EmptyState colSpan={columns.length} message={emptyMessage} />
          )}

          {!loading && data.map((row, rowIndex) => (
            <TableRow
              key={row[keyField] ?? rowIndex}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? 'cursor-pointer' : undefined}
            >
              {columns.map((col) => (
                <TableTd key={col.key} className={col.className}>
                  {col.render
                    ? col.render(row, rowIndex)
                    : (row[col.key] ?? '—')}
                </TableTd>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </TableRoot>

      {pagination && !loading && (
        <Pagination {...pagination} />
      )}
    </div>
  )
})

Table.displayName = 'Table'

export {
  Table,
  TableRoot,
  TableHead,
  TableBody,
  TableRow,
  TableTh,
  TableTd,
}
