/**
 * pages/inventory/InventoryPage.jsx
 *
 * Gestão de estoque — Sprint 2 Tarefa 4.
 *
 * Layout:
 *   1. Summary bar — totais por status (ok/baixo/zerado)
 *   2. Filtros — busca + categoria + facetas de atributo + status
 *   3. Tabela de SKUs com status visual, alertas, botão de movimentação
 *   4. Paginação
 *   5. MovementModal — nova movimentação
 *   6. MovementsDrawer — histórico lateral
 *
 * Alertas visuais:
 *   - Row com fundo âmbar suave quando baixo
 *   - Row com fundo vermelho suave quando zerado
 *   - Banner de alerta no topo quando há SKUs críticos
 */

import { useSortable } from '../../hooks/useSortable.js'
import { sortSkusByPreset, loadPresetPreference, savePresetPreference, DEFAULT_PRESET } from './sortPresets.js'
import { SortPicker } from './components/SortPicker.jsx'
import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Search, RefreshCw, AlertTriangle, CheckCircle2,
  ArrowDownToLine, History, ChevronLeft, ChevronRight,
  X, Package, ChevronUp, ChevronDown, Check,
  ChevronsUpDown,
} from 'lucide-react'
import { Card, Badge, Skeleton } from '@aura/ui'
import { MovementModal }  from './components/MovementModal.jsx'
import { MovementsDrawer } from './components/MovementsDrawer.jsx'
import { useInventory }   from './useInventory.js'
import { stockStatus, STATUS_META, fmtDate } from './inventoryTypes.js'

/* ─── Skeleton tabela ─── */
function TableSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]">
            <tr>
              {['SKU / Produto', 'Atributos', 'Estoque', 'Mínimo', 'Status', 'Ações'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {[...Array(8)].map((_, i) => (
              <tr key={i}>
                <td className="px-4 py-3"><div className="space-y-1.5"><Skeleton width="80%" height={12} /><Skeleton width="50%" height={10} /></div></td>
                <td className="px-4 py-3"><Skeleton width={80} height={12} /></td>
                <td className="px-4 py-3"><Skeleton width={40} height={20} /></td>
                <td className="px-4 py-3"><Skeleton width={30} height={12} /></td>
                <td className="px-4 py-3"><Skeleton width={80} height={20} /></td>
                <td className="px-4 py-3"><Skeleton width={60} height={32} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ─── Linha de SKU ─── */
function SkuRow({ sku, onMove, onHistory }) {
  const status    = stockStatus(sku)
  const meta      = STATUS_META[status]
  const attrStr   = Object.values(sku.attributes ?? {}).join(' / ') || '—'

  const rowBg =
    status === 'zerado' ? 'bg-red-50/60 dark:bg-red-950/30'
  : status === 'baixo'  ? 'bg-amber-50/60 dark:bg-amber-950/30'
  : ''

  return (
    <tr className={`border-b border-[var(--color-border)] hover:bg-[var(--color-bg-subtle)] transition-colors ${rowBg}`}>
      {/* SKU / Produto */}
      <td className="px-4 py-3">
        <p className="text-xs font-mono text-[var(--color-text-muted)]">{sku.code}</p>
        <p className="text-sm font-medium text-[var(--color-text)] mt-0.5 max-w-[200px] truncate">{sku.productName}</p>
      </td>

      {/* Atributos */}
      <td className="px-4 py-3">
        <span className="text-xs text-[var(--color-text-muted)]">{attrStr}</span>
      </td>

      {/* Estoque atual */}
      <td className="px-4 py-3">
        <span className={`text-lg font-bold tabular-nums ${
          status === 'zerado' ? 'text-[var(--color-error)]'
          : status === 'baixo' ? 'text-[var(--color-warning)]'
          : 'text-[var(--color-text)]'
        }`}>
          {sku.stock}
        </span>
      </td>

      {/* Mínimo */}
      <td className="px-4 py-3">
        <span className="text-sm text-[var(--color-text-muted)] tabular-nums">{sku.stockMin}</span>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span className={`
          inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
          border
          ${status === 'ok'
            ? 'bg-[var(--color-success-bg)] text-[var(--color-success-fg)] border-[var(--color-success)]'
            : status === 'baixo'
            ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning-fg)] border-[var(--color-warning)]'
            : 'bg-[var(--color-error-bg)] text-[var(--color-error-fg)] border-[var(--color-error)]'
          }
        `}>
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </td>

      {/* Ações */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMove(sku)}
            className="
              flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium
              bg-[var(--color-primary)] text-white
              hover:bg-[var(--color-primary-hover)]
              transition-colors
            "
            title="Movimentar estoque"
          >
            <ArrowDownToLine size={13} />
            <span className="hidden sm:inline">Movimentar</span>
          </button>
          <button
            onClick={() => onHistory(sku)}
            className="
              h-8 w-8 flex items-center justify-center rounded-lg
              text-[var(--color-text-muted)]
              hover:bg-[var(--color-surface)]
              transition-colors
            "
            title="Ver histórico"
          >
            <History size={15} />
          </button>
        </div>
      </td>
    </tr>
  )
}

/* ─── Summary card ─── */
function SummaryCard({ label, value, icon: Icon, color }) {
  return (
    <div className={`flex items-center gap-3 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-2xl font-bold text-[var(--color-text)] tabular-nums">{value}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      </div>
    </div>
  )
}

/* ─── Faceta de atributo (multi-select com chips) ─── */
function AttrFacet({ label, values, selected, onToggle, onClear }) {
  const [open, setOpen] = useState(false)
  const count = selected.length
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={[
          'h-9 px-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap inline-flex items-center gap-1.5',
          count > 0
            ? 'bg-[var(--color-primary)] text-white'
            : 'bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]',
        ].join(' ')}
      >
        {label}
        {count > 0 && (
          <span className="text-[10px] font-bold bg-white/25 px-1.5 rounded-full">{count}</span>
        )}
        <ChevronDown size={13} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 left-0 w-48 max-h-72 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg p-1">
            {count > 0 && (
              <button
                type="button"
                onClick={onClear}
                className="w-full text-left px-2 py-1.5 mb-0.5 text-xs text-[var(--color-text-muted)] hover:text-red-500 rounded-lg transition-colors"
              >
                Limpar {label}
              </button>
            )}
            {values.map(v => {
              const checked = selected.includes(v)
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => onToggle(v)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)] transition-colors text-left"
                >
                  <span className={[
                    'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                    checked ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-[var(--color-border)]',
                  ].join(' ')}>
                    {checked && <Check size={11} className="text-white" />}
                  </span>
                  <span className="truncate">{v}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/* ─── Paginação ─── */
function Pagination({ page, totalPages, onPage, total, pageSize }) {
  if (totalPages <= 1) return null
  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)
  return (
    <div className="flex items-center justify-between gap-4 pt-2">
      <p className="text-xs text-[var(--color-text-muted)]">
        {from}–{to} de {total} SKUs
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPage(page - 1)} disabled={page === 1}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] disabled:opacity-40 transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm text-[var(--color-text-muted)] px-1">{page} / {totalPages}</span>
        <button
          onClick={() => onPage(page + 1)} disabled={page === totalPages}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] disabled:opacity-40 transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

/* ─── Página principal ─── */
const INV_COLS = [
  { label: 'SKU / Produto', key: 'productName', sortable: true },
  { label: 'Atributos',     key: '_attrs',       sortable: false },
  { label: 'Estoque',       key: 'stock',        sortable: true, align: 'right' },
  { label: 'Mínimo',        key: 'stockMin',     sortable: true, align: 'right' },
  { label: 'Status',        key: '_status',       sortable: false },
  { label: 'Ações',         key: '_act',          sortable: false },
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
export function InventoryPage() {
  const {
    skus, total, totalPages, isLoading,
    filters, setFilters, attrFacets, page, setPage,
    refetch, addMovement, getMovements, fetchMovements,
    stats, PAGE_SIZE,
  } = useInventory()
  const [sortPreset, setSortPreset] = useState(loadPresetPreference)

  /* Lista pré-ordenada pelo preset escolhido */
  const presetSortedSkus = useMemo(() => sortSkusByPreset(skus, sortPreset), [skus, sortPreset])

  /* Clique no header da coluna sobrescreve o preset com sort por aquela coluna */
  const { sorted: sortedSkusInv, sortKey: iSortKey, sortDir: iSortDir, handleSort: iHandleSort } = useSortable(presetSortedSkus, null)

  const onChangePreset = (key) => { setSortPreset(key); savePresetPreference(key) }

  const location = useLocation()

  // Categorias do DB
  const [availableCategories, setAvailableCategories] = useState([])

  // Aplica filtro/ação vindo do Dashboard via navigate state
  useEffect(() => {
    const st = location.state?.status
    if (st) setFilters({ status: st })
    // Limpar state para não reaplicar em navegações futuras
    window.history.replaceState({}, '')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const token = window.__aura_mem_token__ || ''
    fetch('/api/product-categories', {
      credentials: 'include',
      headers: token ? { Authorization: 'Bearer ' + token } : {},
    }).then(r => r.json()).then(d => setAvailableCategories((d.categories ?? []).map(c => c.name))).catch(() => {})
  }, [])

  const [movingSku,  setMovingSku]  = useState(null)
  const [historySku, setHistorySku] = useState(null)

  const openHistory = useCallback((sku) => { setHistorySku(sku); if (sku) fetchMovements(sku.id); }, [fetchMovements])
  const closeHistory = useCallback(() => setHistorySku(null), [])

  const openMove = useCallback((sku) => {
    setHistorySku(null)  // fecha drawer se aberto
    setMovingSku(sku)
  }, [])

  const handleMoveConfirm = useCallback(async (skuId, data) => {
    await addMovement(skuId, data)
  }, [addMovement])

  /* Toggle de um valor de faceta (OR dentro do atributo) */
  const toggleAttr = useCallback((key, value) => {
    const cur  = filters.attrs?.[key] ?? []
    const next = cur.includes(value) ? cur.filter(x => x !== value) : [...cur, value]
    const attrs = { ...(filters.attrs ?? {}) }
    if (next.length) attrs[key] = next; else delete attrs[key]
    setFilters({ attrs })
  }, [filters.attrs, setFilters])

  const clearAttr = useCallback((key) => {
    const attrs = { ...(filters.attrs ?? {}) }
    delete attrs[key]
    setFilters({ attrs })
  }, [filters.attrs, setFilters])

  const attrCount = Object.values(filters.attrs ?? {}).reduce((a, arr) => a + (arr?.length ?? 0), 0)
  const hasActiveFilters = filters.search || filters.status !== 'all' || filters.category || attrCount > 0

  const clearAll = () => setFilters({ search: '', status: 'all', category: '', attrs: {} })

  return (
    <div className="space-y-5 max-w-screen-xl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text)]">Estoque</h2>
          {!isLoading && (
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
              {stats.total} SKU{stats.total !== 1 ? 's' : ''} monitorados
            </p>
          )}
        </div>
        <button
          onClick={refetch} disabled={isLoading}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] disabled:opacity-40 transition-colors"
          aria-label="Atualizar"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Banner alertas críticos ── */}
      {!isLoading && (stats.low > 0 || stats.zero > 0) && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
          <AlertTriangle size={18} className="text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>{stats.zero + stats.low} SKU{stats.zero + stats.low !== 1 ? 's' : ''}</strong> precisam de atenção
            {stats.zero > 0 && ` — ${stats.zero} zerado${stats.zero !== 1 ? 's' : ''}`}
            {stats.low  > 0 && ` — ${stats.low} com estoque baixo`}.
          </p>
          <button
            onClick={() => setFilters({ status: 'zerado' })}
            className="ml-auto text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline shrink-0"
          >
            Ver zerados
          </button>
        </div>
      )}

      {/* ── Summary bar ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} width="100%" height={76} className="rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label="Total de SKUs"   value={stats.total} icon={Package}       color="bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400" />
          <SummaryCard label="Em estoque"      value={stats.ok}    icon={CheckCircle2}  color="bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400" />
          <SummaryCard label="Estoque baixo"   value={stats.low}   icon={AlertTriangle} color="bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400" />
          <SummaryCard label="Zerados"         value={stats.zero}  icon={AlertTriangle} color="bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400" />
        </div>
      )}

      {/* ── Filtros ── */}
      <Card className="p-3">
        <div className="flex gap-2 flex-wrap">
          <div className="flex-1 min-w-[180px] relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por SKU, produto ou atributo (Preto, GG, 38…)"
              value={filters.search}
              onChange={e => setFilters({ search: e.target.value })}
              className="
                w-full h-9 pl-8 pr-3 rounded-lg text-sm
                bg-[var(--color-bg-subtle)] border border-[var(--color-border)]
                text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)]
                focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]
                focus:bg-[var(--color-bg)]
              "
            />
          </div>

          {availableCategories.length > 0 && (
            <select
              value={filters.category ?? ''}
              onChange={e => setFilters({ category: e.target.value })}
              className="h-9 px-3 rounded-lg text-sm bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] shrink-0"
            >
              <option value="">Todas as categorias</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          )}

          {/* Facetas de atributo (Cor, Tamanho, …) */}
          {Object.entries(attrFacets ?? {}).map(([key, values]) => (
            <AttrFacet
              key={key}
              label={key}
              values={values}
              selected={filters.attrs?.[key] ?? []}
              onToggle={(v) => toggleAttr(key, v)}
              onClear={() => clearAttr(key)}
            />
          ))}

          {/* Separador visual */}
          <div className="hidden md:block w-px h-6 bg-[var(--color-border)] mx-1" />

          {[
            { value: 'all',     label: 'Todos' },
            { value: 'ok',      label: 'Em estoque' },
            { value: 'critico', label: '\u26a0 Cr\u00edtico', warn: true },
            { value: 'baixo',   label: 'Baixo' },
            { value: 'zerado',  label: 'Zerado' },
          ].map(({ value, label, warn }) => {
            const active = filters.status === value
            const cls = [
              'h-9 px-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
              active
                ? (warn ? 'bg-amber-500 text-white' : 'bg-[var(--color-primary)] text-white')
                : 'bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]',
            ].join(' ')
            return (
              <button key={value} onClick={() => setFilters({ status: value })} className={cls}>
                {label}
              </button>
            )
          })}

          {/* Separador visual */}
          <div className="hidden md:block w-px h-6 bg-[var(--color-border)] mx-1" />

          {/* Picker de ordenação */}
          <SortPicker value={sortPreset} onChange={onChangePreset} />

          {hasActiveFilters && (
            <button
              onClick={clearAll}
              className="h-9 w-9 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </Card>

      {/* ── Tabela ── */}
      {isLoading ? (
        <TableSkeleton />
      ) : skus.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Package size={32} className="text-[var(--color-text-disabled)]" />
          <p className="font-semibold text-[var(--color-text)]">Nenhum SKU encontrado</p>
          {hasActiveFilters && (
            <button onClick={clearAll} className="text-sm text-[var(--color-primary)] hover:underline">
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]">
                  <tr>
                    {INV_COLS.map(col => (
                      <SortableTh key={col.key} col={col} sortKey={iSortKey} sortDir={iSortDir} onSort={iHandleSort} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedSkusInv.map(sku => (
                    <SkuRow
                      key={sku.id}
                      sku={sku}
                      onMove={openMove}
                      onHistory={openHistory}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPage={setPage}
            total={total}
            pageSize={PAGE_SIZE}
          />
        </>
      )}

      {/* ── Modal movimentação ── */}
      <MovementModal
        sku={movingSku}
        open={Boolean(movingSku)}
        onClose={() => setMovingSku(null)}
        onConfirm={handleMoveConfirm}
      />

      {/* ── Drawer histórico ── */}
      <MovementsDrawer
        sku={historySku}
        movements={historySku ? getMovements(historySku.id) : []}
        onClose={closeHistory}
        onNew={() => { openMove(historySku); closeHistory() }}
      />
    </div>
  )
}
