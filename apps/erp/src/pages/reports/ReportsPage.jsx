/**
 * ReportsPage.jsx — 6 relatórios operacionais do ERP
 *
 * Cada relatório:
 *  - Filtros simples (período, busca)
 *  - Tabela com dados reais do banco
 *  - Exportação CSV e PDF com logo da empresa
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  BarChart2, Package, AlertTriangle, TrendingDown,
  ArrowLeftRight, Calendar, Download, FileText,
  RefreshCw, ChevronDown, ChevronUp, ChevronsUpDown,
  Filter, Search, Users, Eye, Activity
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { useAuth }       from '../../auth/AuthContext.jsx'
import { useReport, today, firstOfMonth } from './useReports.js'
import { exportCSV, exportPDF }           from './exportUtils.js'

/* ─── formatadores ─── */
const R$ = v => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(+v||0)
const N  = v => new Intl.NumberFormat('pt-BR').format(+v||0)
// T3.3 — formatador de data robusto: nunca retorna "Invalid Date"
// Ticket #48: também trata "YYYY-MM-DDT00:00:00.000Z" (driver pg serializa
// colunas ::date assim) extraindo só a parte da data, evitando off-by-one.
const D  = v => {
  if (v == null || v === '' || v === 'Invalid Date') return '—'
  try {
    let d
    if (typeof v === 'number')   d = new Date(v)
    else if (v instanceof Date)  d = v
    else {
      let s = String(v).trim()
      // string ISO com hora 00:00 UTC = data-pura serializada pelo pg driver → trata como YYYY-MM-DD
      const isoMidnightUTC = s.match(/^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.0+)?Z$/)
      if (isoMidnightUTC) s = isoMidnightUTC[1]
      // YYYY-MM-DD → meio-dia LOCAL para evitar off-by-one de timezone
      d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T12:00:00') : new Date(s)
    }
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('pt-BR')
  } catch { return '—' }
}
const PCT= (a,b) => b ? ((+a/+b)*100).toFixed(1)+'%' : '—'

const STATUS_COLORS = {
  ok:      'text-green-600  bg-green-50  dark:bg-green-950/40',
  baixo:   'text-amber-600  bg-amber-50  dark:bg-amber-950/40',
  zerado:  'text-red-600    bg-red-50    dark:bg-red-950/40',
}
const CANAL_LABEL = { manual:'Manual', loja:'Loja B2B', whatsapp:'WhatsApp' }
const STATUS_LABEL = {
  pendente:'Pendente', confirmado:'Confirmado', separando:'Separando',
  enviado:'Enviado', entregue:'Entregue', cancelado:'Cancelado'
}
const MOV_LABEL = { entrada:'Entrada', saida:'Saída', ajuste:'Ajuste' }

/* ─── componentes compartilhados ─── */
function Badge({ text, color }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {text}
    </span>
  )
}

function DateRange({ start, end, onStart, onEnd }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Calendar size={14} className="text-[var(--color-text-muted)] shrink-0" />
      <input type="date" value={start} onChange={e=>onStart(e.target.value)}
        className="h-8 px-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
      <span className="text-[var(--color-text-muted)] text-sm">até</span>
      <input type="date" value={end} onChange={e=>onEnd(e.target.value)}
        className="h-8 px-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
    </div>
  )
}

/* Abre preview HTML em nova aba — o usuário pode imprimir de lá */
function openPreview({ title, subtitle, companyName, columns, rows, summary }) {
  const fmt = v => v ?? '—'
  const hdr = columns.map(c => `<th>${c.label}</th>`).join('')
  const body = rows.map(r => {
    const cells = columns.map(c => {
      const v = c.get ? c.get(r) : r[c.key] ?? '—'
      return `<td style="text-align:${c.align==='right'?'right':'left'}">${fmt(v)}</td>`
    }).join('')
    return `<tr>${cells}</tr>`
  }).join('')
  const sumHtml = (summary||[]).map(s=>`<div><strong>${s.label}:</strong> ${s.value}</div>`).join('')
  const win = window.open('','_blank')
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8"><title>${title}</title>
    <style>
      body{font-family:sans-serif;padding:24px;color:#111;font-size:13px}
      h1{font-size:18px;margin:0 0 4px}
      .sub{color:#666;font-size:12px;margin-bottom:8px}
      .summary{display:flex;gap:24px;margin:12px 0;padding:10px;background:#f5f5f5;border-radius:6px;font-size:12px}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th{background:#f0f0f0;padding:6px 10px;text-align:left;font-size:12px;font-weight:600;border:1px solid #ddd}
      td{padding:5px 10px;border:1px solid #ddd;font-size:12px}
      tr:nth-child(even) td{background:#fafafa}
      .print-btn{position:fixed;top:12px;right:12px;padding:8px 16px;background:#0070f3;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px}
      @media print{.print-btn{display:none}}
    </style></head><body>
    <button class="print-btn" onclick="window.print()">🖨️ Imprimir / PDF</button>
    <h1>${companyName ? companyName+' — ':''}${title}</h1>
    <div class="sub">${subtitle||''}</div>
    <div class="summary">${sumHtml}</div>
    <table><thead><tr>${hdr}</tr></thead><tbody>${body}</tbody></table>
  </body></html>`)
  win.document.close()
}

function FilterBtn({ onClick, loading, dirty }) {
  return (
    <button onClick={onClick} disabled={loading}
      className={`flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg transition-colors disabled:opacity-40
        ${dirty
          ? 'bg-[var(--color-primary)] text-white hover:opacity-90'
          : 'border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface)]'
        }`}>
      <Filter size={13}/> {loading ? 'Buscando…' : 'Filtrar'}
    </button>
  )
}

function ExportBar({ onCSV, onPDF, onPreview, loading }) {
  return (
    <div className="flex items-center gap-2">
      {onPreview && (
        <button onClick={onPreview} disabled={loading}
          className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface)] disabled:opacity-40 transition-colors">
          <Eye size={13}/> Visualizar
        </button>
      )}
      <button onClick={onCSV} disabled={loading}
        className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface)] disabled:opacity-40 transition-colors">
        <Download size={13}/> CSV
      </button>
      <button onClick={onPDF} disabled={loading}
        className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity">
        <FileText size={13}/> PDF
      </button>
    </div>
  )
}

function KpiCard({ label, value, sub, color='text-[var(--color-primary)]' }) {
  return (
    <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
      <p className="text-xs text-[var(--color-text-muted)] mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{sub}</p>}
    </div>
  )
}

function SortIcon({ dir }) {
  if (dir === 'asc')  return <ChevronUp   size={11} className="shrink-0" />
  if (dir === 'desc') return <ChevronDown size={11} className="shrink-0" />
  return <ChevronsUpDown size={11} className="shrink-0 opacity-30" />
}

function TableShell({ headers, rows, loading, empty }) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const handleSort = (h) => {
    if (!h.sortable) return
    const key = h.sortKey ?? h.key
    if (sortKey === key) {
      if (sortDir === 'asc') { setSortDir('desc') }
      else { setSortKey(null); setSortDir('asc') }
    } else {
      setSortKey(key); setSortDir('asc')
    }
  }

  const sortedRows = useMemo(() => {
    if (!sortKey || !rows?.length) return rows ?? []
    return [...rows].sort((a, b) => {
      const va = a[sortKey] ?? ''
      const vb = b[sortKey] ?? ''
      const na = parseFloat(String(va).replace(',', '.'))
      const nb = parseFloat(String(vb).replace(',', '.'))
      const cmp = (!isNaN(na) && !isNaN(nb))
        ? na - nb
        : String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, sortKey, sortDir])

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <RefreshCw size={24} className="animate-spin text-[var(--color-primary)]" />
    </div>
  )
  if (!sortedRows.length) return (
    <div className="flex flex-col items-center justify-center py-16 gap-2 text-[var(--color-text-muted)]">
      <BarChart2 size={32} />
      <p className="text-sm">{empty || 'Nenhum dado encontrado.'}</p>
    </div>
  )
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[var(--color-surface)] border-b border-[var(--color-border)]">
            {headers.map((h,i) => {
              const key = h.sortKey ?? h.key
              const active = sortKey === key
              return (
                <th
                  key={i}
                  onClick={() => handleSort(h)}
                  className={`px-3 py-2.5 font-semibold text-[var(--color-text-muted)] whitespace-nowrap select-none ${h.align==='right'?'text-right':h.align==='center'?'text-center':'text-left'} ${h.sortable ? 'cursor-pointer hover:text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)] transition-colors' : ''}`}
                >
                  <span className={`inline-flex items-center gap-1 ${h.align==='right'?'flex-row-reverse':''}`}>
                    {h.label}
                    {h.sortable && <SortIcon dir={active ? sortDir : null} />}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, i) => (
            <tr key={i} className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-subtle)] transition-colors">
              {headers.map((h, j) => (
                <td key={j} className={`px-3 py-2 text-[var(--color-text)] ${h.align==='right'?'text-right':h.align==='center'?'text-center':''}`}>
                  {h.render ? h.render(row, i) : (row[h.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function attrStr(attrs) {
  if (!attrs) return ''
  if (typeof attrs === 'string') { try { attrs = JSON.parse(attrs) } catch { return '' } }
  if (typeof attrs === 'object' && !Array.isArray(attrs)) return Object.values(attrs).filter(Boolean).join(' / ')
  return ''
}

/* ═══════════════════════════════════════════
   TABS
═══════════════════════════════════════════ */
const TABS = [
  { key:'sales',          label:'Vendas',            icon: BarChart2 },
  { key:'products',       label:'Ranking Produtos',  icon: Package },
  { key:'stock',          label:'Estoque Atual',     icon: Filter },
  { key:'stock-critical', label:'Estoque Crítico',   icon: AlertTriangle },
  { key:'stock-idle',     label:'Produtos Parados',  icon: TrendingDown },
  { key:'movements',      label:'Movimentação',      icon: ArrowLeftRight },
  { key:'seasonality',    label:'Sazonalidade',      icon: Activity },
]

/* ═══════════════════════════════════════════
   PAGE
═══════════════════════════════════════════ */
export function ReportsPage() {
  const { user }     = useAuth()
  const [tab, setTab] = useState('sales')
  const [companyName, setCompanyName] = useState('Minha Empresa')

  // Buscar nome da empresa
  useEffect(() => {
    const tok = window.__aura_mem_token__ || ''
    fetch('/api/tenant/me', { credentials:'include', headers: tok ? {Authorization:'Bearer '+tok}:{} })
      .then(r => r.json())
      .then(d => { if (d.name) setCompanyName(d.name) })
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-4 max-w-screen-xl">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-[var(--color-text)]">Relatórios</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Visão operacional do negócio</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={[
                'flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-medium whitespace-nowrap transition-colors shrink-0',
                active
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]'
              ].join(' ')}
            >
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Conteúdo */}
      {tab === 'sales'          && <SalesReport       companyName={companyName} />}
      {tab === 'products'       && <ProductsReport    companyName={companyName} />}
      {tab === 'stock'          && <StockReport       companyName={companyName} />}
      {tab === 'stock-critical' && <StockCritical     companyName={companyName} />}
      {tab === 'stock-idle'     && <StockIdle         companyName={companyName} />}
      {tab === 'movements'      && <MovementsReport   companyName={companyName} />}
      {tab === 'seasonality'    && <SeasonalityReport />}
    </div>
  )
}

/* ═══════════════════════════════════════════
   1. VENDAS — issue #35 (ticket AuraSuporte #76)
   • Card "Unidades Vendidas" (5º KPI)
   • Toggle valor R$ / unidades no gráfico
   • Filtros novos: categoria + atributo (key:value)
═══════════════════════════════════════════ */
function SalesReport({ companyName }) {
  const [start, setStart]           = useState(firstOfMonth())
  const [end,   setEnd]             = useState(today())
  const [customerId, setCustomerId] = useState('')
  const [category,   setCategory]   = useState('')
  const [attrIdx,    setAttrIdx]    = useState('')   // formato "key|value" no select
  const [customers,  setCustomers]  = useState([])
  const [categories, setCategories] = useState([])
  const [attributes, setAttributes] = useState([])   // [{key,value}]
  const [chartMetric, setChartMetric] = useState('valor') // 'valor' | 'unidades'
  const { data, loading, error, fetch: load } = useReport('sales')

  // clientes
  useEffect(() => {
    const tok = window.__aura_mem_token__ || ''
    fetch('/api/customers?limit=999', {
      credentials: 'include',
      headers: tok ? { Authorization: 'Bearer ' + tok } : {},
    })
      .then(r => r.json())
      .then(d => setCustomers(d.customers ?? []))
      .catch(() => {})
  }, [])

  // categorias + atributos (issue #35)
  useEffect(() => {
    const tok = window.__aura_mem_token__ || ''
    fetch('/api/reports/sales/filters', {
      credentials: 'include',
      headers: tok ? { Authorization: 'Bearer ' + tok } : {},
    })
      .then(r => r.json())
      .then(d => {
        setCategories(d.categories ?? [])
        setAttributes(d.attributes ?? [])
      })
      .catch(() => {})
  }, [])

  const [dirty, setDirty] = useState(false)
  const doLoad = () => {
    const p = { start, end }
    if (customerId) p.customer_id = customerId
    if (category)   p.category    = category
    if (attrIdx) {
      const [k, ...rest] = attrIdx.split('|')
      const v = rest.join('|')
      if (k && v) { p.attr_key = k; p.attr_value = v }
    }
    load(p); setDirty(false)
  }
  useEffect(() => { doLoad() }, []) // eslint-disable-line
  useEffect(() => { setDirty(true) }, [start, end, customerId, category, attrIdx])

  const kpi  = data?.kpi  || {}
  const rows = data?.byDay || []

  const isUnidades = chartMetric === 'unidades'
  const dataKey = isUnidades ? 'unidades' : 'faturamento'
  const yFmt    = isUnidades ? (v=>N(v)) : (v=>R$(v))
  const tipFmt  = isUnidades ? (v=>[N(v),'Unidades']) : (v=>[R$(v),'Faturamento'])
  const chartLabel = isUnidades ? 'Unidades por dia' : 'Faturamento por dia'

  const pdfCols = [
    { label:'Dia',          key:'dia',         get: r => D(r.dia) },
    { label:'Pedidos',      key:'pedidos',      align:'right' },
    { label:'Unidades',     key:'unidades',     align:'right' },
    { label:'Faturamento',  key:'faturamento',  get: r => R$(r.faturamento), align:'right' },
  ]

  const summaryItems = [
    { label:'Faturamento',       value: R$(kpi.faturamento) },
    { label:'Pedidos',           value: N(kpi.total_pedidos) },
    { label:'Unidades Vendidas', value: N(kpi.total_unidades) },
    { label:'Ticket Médio',      value: R$(kpi.ticket_medio) },
    { label:'Cancelados',        value: N(kpi.pedidos_cancelados) },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <DateRange start={start} end={end} onStart={setStart} onEnd={setEnd} />
          <div className="relative">
            <Users size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
            <select
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              className="h-8 pl-8 pr-3 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              <option value="">Todos os clientes</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {/* issue #35: filtro de categoria */}
          {categories.length > 0 && (
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="h-8 px-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              <option value="">Todas as categorias</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          {/* issue #35: filtro de atributo (chave:valor) */}
          {attributes.length > 0 && (
            <select
              value={attrIdx}
              onChange={e => setAttrIdx(e.target.value)}
              className="h-8 px-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              <option value="">Todos os atributos</option>
              {attributes.map((a, i) => {
                const v = `${a.key}|${a.value}`
                return <option key={i} value={v}>{a.key}: {a.value}</option>
              })}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <FilterBtn onClick={doLoad} loading={loading} dirty={dirty} />
          <ExportBar loading={loading}
            onPreview={() => openPreview({ title:'Relatório de Vendas', subtitle:`Período: ${D(start)} a ${D(end)}`, companyName, columns:pdfCols, rows, summary: summaryItems })}
            onCSV={() => exportCSV('vendas', pdfCols, rows)}
            onPDF={() => exportPDF({
              title: 'Relatório de Vendas',
              subtitle: `Período: ${D(start)} a ${D(end)}`,
              companyName,
              columns: pdfCols,
              rows,
              summary: summaryItems,
            })}
          />
        </div>
      </div>

      {/* KPIs — 5 cards (issue #35: Unidades Vendidas adicionado) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard label="Faturamento"       value={R$(kpi.faturamento)}       />
        <KpiCard label="Pedidos"           value={N(kpi.total_pedidos)}       />
        <KpiCard label="Unidades Vendidas" value={N(kpi.total_unidades)}      />
        <KpiCard label="Ticket Médio"      value={R$(kpi.ticket_medio)}       />
        <KpiCard label="Cancelamentos"     value={N(kpi.pedidos_cancelados)}  color="text-red-500" />
      </div>

      {/* Gráfico com toggle valor/unidades (issue #35) */}
      {rows.length > 0 && (
        <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{chartLabel}</p>
            <div className="inline-flex rounded-lg border border-[var(--color-border)] overflow-hidden">
              <button
                type="button"
                onClick={() => setChartMetric('valor')}
                className={`px-3 h-7 text-xs font-medium transition-colors ${chartMetric==='valor' ? 'bg-[var(--color-primary)] text-white' : 'bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]'}`}
              >Valor R$</button>
              <button
                type="button"
                onClick={() => setChartMetric('unidades')}
                className={`px-3 h-7 text-xs font-medium transition-colors border-l border-[var(--color-border)] ${chartMetric==='unidades' ? 'bg-[var(--color-primary)] text-white' : 'bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]'}`}
              >Unidades</button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={rows} margin={{ top:4, right:4, left:0, bottom:0 }}>
              <defs>
                <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--color-primary)" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="dia" tick={{fontSize:10}} tickFormatter={v=>D(v)} />
              <YAxis tick={{fontSize:10}} tickFormatter={yFmt} width={isUnidades ? 50 : 80} />
              <Tooltip formatter={tipFmt} labelFormatter={D} />
              <Area type="monotone" dataKey={dataKey} stroke="var(--color-primary)"
                strokeWidth={2} fill="url(#gSales)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Por canal */}
      {data?.byChannel?.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-3">
          {data.byChannel.map(c => (
            <div key={c.channel} className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
              <p className="text-xs text-[var(--color-text-muted)]">{CANAL_LABEL[c.channel] || c.channel}</p>
              <p className="font-bold text-[var(--color-text)] mt-0.5">{R$(c.faturamento)}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{N(c.pedidos)} pedido{c.pedidos!=1?'s':''}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════
   2. RANKING PRODUTOS
═══════════════════════════════════════════ */
function ProductsReport({ companyName }) {
  const [start, setStart] = useState(firstOfMonth())
  const [end,   setEnd]   = useState(today())
  const { data, loading, error, fetch: load } = useReport('products')

  const [dirty2, setDirty2] = useState(false)
  const doLoadProd = () => { load({ start, end }); setDirty2(false) }
  useEffect(() => { doLoadProd() }, []) // eslint-disable-line
  useEffect(() => { setDirty2(true) }, [start, end])
  const rows = data?.rows || []

  const cols = [
    { label:'Produto',          key:'produto' },
    { label:'SKU',              key:'sku' },
    { label:'Variação',         key:'atributos', get: r => attrStr(r.atributos) },
    { label:'Categoria',        key:'categoria' },
    { label:'Qtd Vendida',      key:'qtd_vendida',  align:'right' },
    { label:'Valor Vendido',    key:'valor_vendido', get: r => R$(r.valor_vendido), align:'right' },
    { label:'Preço Médio',      key:'preco_medio',   get: r => R$(r.preco_medio),   align:'right' },
    { label:'Estoque Atual',    key:'estoque_atual', align:'right' },
    { label:'Status Estoque',   key:'status_estoque' },
  ]

  const headers = [
    { label:'#',            render:(r,i)=>i+1,                              align:'center' },
    { label:'Produto',      render: r => r.produto,            sortable:true, sortKey:'produto' },
    { label:'SKU',          key:'sku',                          sortable:true },
    { label:'Variação',     render: r => attrStr(r.atributos) || '—' },
    { label:'Qtd',          key:'qtd_vendida',    align:'right', sortable:true },
    { label:'Valor Vendido',render: r => R$(r.valor_vendido),  align:'right', sortable:true, sortKey:'valor_vendido' },
    { label:'Preço Médio',  render: r => R$(r.preco_medio),    align:'right', sortable:true, sortKey:'preco_medio' },
    { label:'Estoque',      key:'estoque_atual',  align:'right', sortable:true },
    { label:'Status',       render: r => (
        <Badge text={r.status_estoque} color={STATUS_COLORS[r.status_estoque] || ''} />
      )},
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRange start={start} end={end} onStart={setStart} onEnd={setEnd} />
        <div className="flex items-center gap-2">
          <FilterBtn onClick={doLoadProd} loading={loading} dirty={dirty2} />
          <ExportBar loading={loading}
            onPreview={() => openPreview({ title:'Ranking de Produtos', subtitle:`Período: ${D(start)} a ${D(end)}`, companyName, columns:cols, rows, summary:[{label:'SKUs vendidos',value:N(rows.length)},{label:'Total vendido',value:R$(rows.reduce((a,r)=>a+(+r.valor_vendido||0),0))}] })}
            onCSV={() => exportCSV('ranking-produtos', cols, rows)}
          onPDF={() => exportPDF({
            title:'Ranking de Produtos',
            subtitle:`Período: ${D(start)} a ${D(end)} · Top ${rows.length} SKUs`,
            companyName, columns: cols, rows,
            summary:[
              { label:'SKUs vendidos', value: N(rows.length) },
              { label:'Total vendido', value: R$(rows.reduce((a,r)=>a+(+r.valor_vendido||0),0)) },
            ],
          })}
          />
        </div>
      </div>
      <TableShell headers={headers} rows={rows} loading={loading} empty="Nenhuma venda no período." />
    </div>
  )
}

/* ═══════════════════════════════════════════
   3. ESTOQUE ATUAL
═══════════════════════════════════════════ */
function StockReport({ companyName }) {
  const [search, setSearch]     = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const { data, loading, error, fetch: load } = useReport('stock')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { load({ search: debouncedSearch }) }, [debouncedSearch])

  const rows    = data?.rows    || []
  const summary = data?.summary || {}

  const cols = [
    { label:'Produto',          key:'produto' },
    { label:'SKU',              key:'sku' },
    { label:'Variação',         key:'atributos', get: r => attrStr(r.atributos) },
    { label:'Categoria',        key:'categoria' },
    { label:'Estoque',          key:'estoque',      align:'right' },
    { label:'Vendido',          key:'qtd_vendida',  align:'right' },
    { label:'Mínimo',           key:'estoque_minimo', align:'right' },
    { label:'Preço',            key:'preco',         get: r => R$(r.preco), align:'right' },
    { label:'Valor em Estoque', key:'valor_em_estoque', get: r => R$(r.valor_em_estoque), align:'right' },
    { label:'Status',           key:'status' },
  ]

  const headers = [
    { label:'Produto',      key:'produto',         sortable:true },
    { label:'SKU',          key:'sku',             sortable:true },
    { label:'Variação',     render: r => attrStr(r.atributos) || '—' },
    { label:'Categoria',    key:'categoria',       sortable:true },
    { label:'Estoque',      key:'estoque',    align:'right', sortable:true },
    { label:'Vendido',      key:'qtd_vendida', align:'right', sortable:true },
    { label:'Mínimo',       key:'estoque_minimo', align:'right', sortable:true },
    { label:'Preço',        render: r => R$(r.preco), align:'right', sortable:true, sortKey:'preco' },
    { label:'Val. Estoque', render: r => R$(r.valor_em_estoque), align:'right', sortable:true, sortKey:'valor_em_estoque' },
    { label:'Status',       render: r => <Badge text={r.status} color={STATUS_COLORS[r.status]||''} /> },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar produto ou SKU…"
            className="h-8 pl-8 pr-3 w-56 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
        </div>
        <ExportBar loading={loading}
          onCSV={() => exportCSV('estoque', cols, rows)}
          onPDF={() => exportPDF({
            title:'Estoque Atual', companyName, columns: cols, rows,
            summary:[
              { label:'Total SKUs',      value: N(summary.total_skus) },
              { label:'Total Unidades',   value: N(summary.total_units) },
              { label:'Unid. Vendidas',   value: N(summary.total_vendido) },
              { label:'Valor Total',      value: R$(summary.valor_total) },
              { label:'SKUs Críticos',    value: N(summary.skus_criticos) },
            ],
          })}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Total SKUs"      value={N(summary.total_skus)} />
        <KpiCard label="Total Unidades"   value={N(summary.total_units)} />
        <KpiCard label="Unidades Vendidas" value={N(summary.total_vendido)} />
        <KpiCard label="Valor em Estoque" value={R$(summary.valor_total)} />
        <KpiCard label="SKUs Críticos"    value={N(summary.skus_criticos)} color="text-amber-500" />
      </div>
      <TableShell headers={headers} rows={rows} loading={loading} empty="Nenhum SKU encontrado." />
    </div>
  )
}

/* ═══════════════════════════════════════════
   4. ESTOQUE CRÍTICO
═══════════════════════════════════════════ */
function StockCritical({ companyName }) {
  const { data, loading, error, fetch: load } = useReport('stock-critical')
  useEffect(() => { load() }, [])
  const rows = data?.rows || []

  const cols = [
    { label:'Produto',         key:'produto' },
    { label:'SKU',             key:'sku' },
    { label:'Variação',        key:'atributos', get: r => attrStr(r.atributos) },
    { label:'Categoria',       key:'categoria' },
    { label:'Estoque Atual',   key:'estoque_atual',    align:'right' },
    { label:'Estoque Mínimo',  key:'estoque_minimo',   align:'right' },
    { label:'Diferença',       key:'diferenca',        align:'right' },
    { label:'Status',          key:'status' },
    { label:'Última Venda',    key:'ultima_venda',     get: r => D(r.ultima_venda) },
  ]
  const headers = [
    { label:'Produto',       key:'produto',        sortable:true },
    { label:'SKU',           key:'sku',            sortable:true },
    { label:'Variação',      render: r => attrStr(r.atributos)||'—' },
    { label:'Categoria',     key:'categoria',      sortable:true },
    { label:'Atual',         key:'estoque_atual',  align:'right', sortable:true },
    { label:'Mínimo',        key:'estoque_minimo', align:'right', sortable:true },
    { label:'Falta',         render: r => (
        <span className="font-semibold text-red-500">+{r.diferenca}</span>
      ), align:'right', sortable:true, sortKey:'diferenca' },
    { label:'Status',        render: r => <Badge text={r.status} color={STATUS_COLORS[r.status]||''} /> },
    { label:'Última Venda',  render: r => D(r.ultima_venda), sortable:true, sortKey:'ultima_venda' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-[var(--color-text-muted)]">
          {rows.length} SKU{rows.length!==1?'s':''} abaixo do mínimo
        </p>
        <ExportBar loading={loading}
          onCSV={()=>exportCSV('estoque-critico', cols, rows)}
          onPDF={()=>exportPDF({
            title:'Estoque Crítico', companyName, columns: cols, rows,
            summary:[
              { label:'SKUs zerados', value: N(rows.filter(r=>r.status==='zerado').length) },
              { label:'SKUs baixos',  value: N(rows.filter(r=>r.status==='baixo').length) },
            ],
          })}
          />
      </div>
      {rows.length > 0 && !loading && (
        <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
          <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-3 uppercase tracking-wide">Diferença para o mínimo (top 10)</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={rows.slice(0,10)} margin={{top:0,right:0,left:0,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="sku" tick={{fontSize:9}} />
              <YAxis tick={{fontSize:9}} />
              <Tooltip />
              <Bar dataKey="diferenca" radius={[4,4,0,0]}>
                {rows.slice(0,10).map((r,i)=>(
                  <Cell key={i} fill={r.status==='zerado'?'#ef4444':'#f59e0b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <TableShell headers={headers} rows={rows} loading={loading} empty="✅ Nenhum SKU abaixo do mínimo!" />
    </div>
  )
}

/* ═══════════════════════════════════════════
   5. PRODUTOS PARADOS
═══════════════════════════════════════════ */
function StockIdle({ companyName }) {
  const [dias, setDias] = useState(30)
  const { data, loading, error, fetch: load } = useReport('stock-idle')

  const [dirtyIdle, setDirtyIdle] = useState(false)
  const doLoadIdle = () => { load({ dias }); setDirtyIdle(false) }
  useEffect(() => { doLoadIdle() }, []) // eslint-disable-line
  useEffect(() => { setDirtyIdle(true) }, [dias])
  const rows = data?.rows || []

  const cols = [
    { label:'Produto',        key:'produto' },
    { label:'SKU',            key:'sku' },
    { label:'Variação',       key:'atributos', get: r => attrStr(r.atributos) },
    { label:'Categoria',      key:'categoria' },
    { label:'Estoque',        key:'estoque_atual',  align:'right' },
    { label:'Valor Parado',   key:'valor_parado',   get: r => R$(r.valor_parado), align:'right' },
    { label:'Última Venda',   key:'ultima_venda',   get: r => D(r.ultima_venda) },
    { label:'Dias Parado',    key:'dias_sem_venda', align:'right' },
  ]
  const headers = [
    { label:'Produto',      key:'produto',        sortable:true },
    { label:'SKU',          key:'sku',            sortable:true },
    { label:'Variação',     render: r => attrStr(r.atributos)||'—' },
    { label:'Estoque',      key:'estoque_atual',  align:'right', sortable:true },
    { label:'Valor Parado', render: r => R$(r.valor_parado), align:'right', sortable:true, sortKey:'valor_parado' },
    { label:'Última Venda', render: r => r.ultima_venda ? D(r.ultima_venda) : <span className="text-amber-500">Nunca</span>, sortable:true, sortKey:'ultima_venda' },
    { label:'Dias Parado',  render: r => (
        <span className={r.dias_sem_venda>60?'text-red-500 font-semibold':r.dias_sem_venda>30?'text-amber-500':''}>
          {r.dias_sem_venda >= 9999 ? '∞' : r.dias_sem_venda}d
        </span>
      ), align:'right', sortable:true, sortKey:'dias_sem_venda'},
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--color-text-muted)]">Sem venda há mais de</span>
          <select value={dias} onChange={e=>setDias(+e.target.value)}
            className="h-8 px-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-text)]">
            {[15,30,60,90,180].map(d=><option key={d} value={d}>{d} dias</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <FilterBtn onClick={doLoadIdle} loading={loading} dirty={dirtyIdle} />
          <ExportBar loading={loading}
            onPreview={() => openPreview({ title:'Produtos Parados', subtitle:`Sem venda há mais de ${dias} dias`, companyName, columns:cols, rows, summary:[{label:'SKUs parados',value:N(rows.length)},{label:'Valor parado',value:R$(data?.valor_total)}] })}
            onCSV={()=>exportCSV('produtos-parados', cols, rows)}
          onPDF={()=>exportPDF({
            title:'Produtos Parados', companyName,
            subtitle:`Sem venda há mais de ${dias} dias`,
            columns: cols, rows,
            summary:[
              { label:'SKUs parados',  value: N(rows.length) },
              { label:'Valor parado',  value: R$(data?.valor_total) },
            ],
          })}
          />
        </div>
      </div>
      {rows.length > 0 && !loading && (
        <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 flex items-center gap-3">
          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
          <span className="text-sm text-amber-700 dark:text-amber-400">
            <strong>{R$(data?.valor_total)}</strong> parado em {N(rows.length)} SKU{rows.length!==1?'s':''} sem venda há mais de {dias} dias
          </span>
        </div>
      )}
      <TableShell headers={headers} rows={rows} loading={loading} empty={`✅ Nenhum produto parado há mais de ${dias} dias.`} />
    </div>
  )
}

/* ═══════════════════════════════════════════
   6. MOVIMENTAÇÃO
═══════════════════════════════════════════ */
function MovementsReport({ companyName }) {
  const [start, setStart] = useState(firstOfMonth())
  const [end,   setEnd]   = useState(today())
  const { data, loading, error, fetch: load } = useReport('movements')

  const [dirtyMov, setDirtyMov] = useState(false)
  const doLoadMov = () => { load({ start, end }); setDirtyMov(false) }
  useEffect(() => { doLoadMov() }, []) // eslint-disable-line
  useEffect(() => { setDirtyMov(true) }, [start, end])

  const rows    = data?.rows    || []
  const summary = data?.summary || {}

  const cols = [
    { label:'Data',          key:'data',         get: r => D(r.data) },
    { label:'Produto',       key:'produto' },
    { label:'SKU',           key:'sku' },
    { label:'Variação',      key:'atributos',    get: r => attrStr(r.atributos) },
    { label:'Tipo',          key:'tipo' },
    { label:'Quantidade',    key:'quantidade',   align:'right' },
    { label:'Saldo Anterior',key:'saldo_anterior', align:'right' },
    { label:'Saldo Atual',   key:'saldo_atual',  align:'right' },
    { label:'Motivo',        key:'motivo' },
    { label:'Cliente',       key:'cliente' },
    { label:'Nº Pedido',     key:'pedido_numero' },
    { label:'Usuário',       key:'usuario' },
  ]
  const MOV_COLOR = { entrada:'text-green-600', saida:'text-red-500', ajuste:'text-blue-500' }

  const headers = [
    { label:'Data',     render: r => D(r.data), sortable:true, sortKey:'data' },
    { label:'Produto',  key:'produto',  sortable:true },
    { label:'SKU',      key:'sku',      sortable:true },
    { label:'Variação', render: r => attrStr(r.atributos)||'—' },
    { label:'Tipo',     render: r => (
        <span className={`font-medium ${MOV_COLOR[r.tipo]||''}`}>
          {MOV_LABEL[r.tipo]||r.tipo}
        </span>
      ), sortable:true, sortKey:'tipo'},
    { label:'Qtd',      render: r => (
        <span className={`font-semibold ${MOV_COLOR[r.tipo]||''}`}>
          {r.tipo==='saida'?'-':r.tipo==='entrada'?'+':''}{r.quantidade}
        </span>
      ), align:'right', sortable:true, sortKey:'quantidade'},
    { label:'Ant.',     key:'saldo_anterior', align:'right', sortable:true },
    { label:'Atual',    key:'saldo_atual',    align:'right', sortable:true },
    { label:'Motivo',   key:'motivo' },
    { label:'Cliente',  key:'cliente', sortable:true },
    { label:'Pedido',   render: r => r.pedido_numero ? `#${r.pedido_numero}` : (r.pedido_id ? r.pedido_id.slice(-6).toUpperCase() : '—') },
    { label:'Usuário',  key:'usuario', sortable:true },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRange start={start} end={end} onStart={setStart} onEnd={setEnd} />
        <div className="flex items-center gap-2">
          <FilterBtn onClick={doLoadMov} loading={loading} dirty={dirtyMov} />
          <ExportBar loading={loading}
            onPreview={() => openPreview({ title:'Movimentação de Estoque', subtitle:`Período: ${D(start)} a ${D(end)}`, companyName, columns:cols, rows, summary:[{label:'Entradas',value:N(summary.entradas)},{label:'Saídas',value:N(summary.saidas)},{label:'Ajustes',value:N(summary.ajustes)}] })}
            onCSV={()=>exportCSV('movimentacao', cols, rows)}
          onPDF={()=>exportPDF({
            title:'Movimentação de Estoque',
            subtitle:`Período: ${D(start)} a ${D(end)}`,
            companyName, columns: cols, rows,
            summary:[
              { label:'Entradas', value: N(summary.entradas) },
              { label:'Saídas',   value: N(summary.saidas) },
              { label:'Ajustes',  value: N(summary.ajustes) },
            ],
          })}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Entradas"  value={N(summary.entradas)} color="text-green-500" />
        <KpiCard label="Saídas"    value={N(summary.saidas)}   color="text-red-500" />
        <KpiCard label="Ajustes"   value={N(summary.ajustes)} />
      </div>
      <TableShell headers={headers} rows={rows} loading={loading} empty="Nenhuma movimentação no período." />
    </div>
  )
}

/* ═══════════════════════════════════════════
   7. SAZONALIDADE — Ticket #121 (issue #95)
   • Gráfico 1: barras por dia da semana (seg → dom em ordem BR)
   • Gráfico 2: linha por hora do dia (0 → 23h)
   • Toggle de métrica: pedidos · itens · valor R$
   • Janela: 30 / 90 / 180 dias (default 90)
═══════════════════════════════════════════ */
const DOW_LABELS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']
// PG: 0=dom 1=seg 2=ter 3=qua 4=qui 5=sex 6=sáb. Reordenar para seg→dom (BR).
const DOW_ORDER  = [1, 2, 3, 4, 5, 6, 0]

const METRIC_OPTIONS = [
  { key:'count', label:'Pedidos' },
  { key:'qty',   label:'Itens'   },
  { key:'value', label:'Valor'   },
]

const DAYS_OPTIONS = [
  { key:30,  label:'30 dias'  },
  { key:90,  label:'90 dias'  },
  { key:180, label:'180 dias' },
]

function fmtMetric(metric, v) {
  if (metric === 'value') return R$(v)
  return N(v)
}

function SeasonalityReport() {
  const [metric, setMetric] = useState('count')
  const [days,   setDays]   = useState(90)

  const [dow,  setDow]    = useState(null)
  const [hour, setHour]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const tok = window.__aura_mem_token__ || ''
      const headers = tok ? { Authorization: 'Bearer ' + tok } : {}
      const [rDow, rHour] = await Promise.all([
        fetch(`/api/orders/seasonality?dimension=dow&metric=${metric}&days=${days}`,  { credentials:'include', headers }),
        fetch(`/api/orders/seasonality?dimension=hour&metric=${metric}&days=${days}`, { credentials:'include', headers }),
      ])
      if (!rDow.ok || !rHour.ok) throw new Error('Falha ao carregar.')
      const [jDow, jHour] = await Promise.all([rDow.json(), rHour.json()])
      setDow(jDow)
      setHour(jHour)
    } catch (e) {
      setError(e.message || 'Erro ao carregar sazonalidade.')
    } finally {
      setLoading(false)
    }
  }, [metric, days])

  useEffect(() => { load() }, [load])

  // Dados pro gráfico DOW reordenados para seg→dom.
  const dowChart = useMemo(() => {
    if (!dow?.buckets) return []
    const map = new Map(dow.buckets.map(b => [Number(b.label), Number(b.value) || 0]))
    return DOW_ORDER.map((pgDow, i) => ({
      day:   DOW_LABELS[i],
      value: map.get(pgDow) ?? 0,
    }))
  }, [dow])

  const hourChart = useMemo(() => {
    if (!hour?.buckets) return []
    return hour.buckets.map(b => ({
      hour:  String(b.label).padStart(2, '0') + 'h',
      value: Number(b.value) || 0,
    }))
  }, [hour])

  const insufficient = (dow?.insufficient_sample || hour?.insufficient_sample) === true
  const sampleSize   = dow?.sample_size ?? 0

  return (
    <div className="space-y-4">
      {/* Header / controles */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Toggle métrica */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--color-bg-subtle)]">
            {METRIC_OPTIONS.map(opt => {
              const active = metric === opt.key
              return (
                <button
                  key={opt.key}
                  onClick={() => setMetric(opt.key)}
                  className={[
                    'h-8 px-3 rounded-lg text-xs font-medium transition-colors',
                    active
                      ? 'bg-[var(--color-bg)] text-[var(--color-text)] shadow-[var(--shadow-sm)]'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>

          {/* Seletor de janela */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--color-bg-subtle)]">
            {DAYS_OPTIONS.map(opt => {
              const active = days === opt.key
              return (
                <button
                  key={opt.key}
                  onClick={() => setDays(opt.key)}
                  className={[
                    'h-8 px-3 rounded-lg text-xs font-medium transition-colors',
                    active
                      ? 'bg-[var(--color-bg)] text-[var(--color-text)] shadow-[var(--shadow-sm)]'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>

          <div className="ml-auto flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span>Amostra: <strong className="text-[var(--color-text)]">{N(sampleSize)}</strong> pedidos</span>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1 h-8 px-3 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-subtle)] disabled:opacity-40 transition-colors"
              aria-label="Recarregar"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Estado: erro */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Estado: amostra insuficiente */}
      {!error && !loading && insufficient && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-xl p-6 text-center">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Amostra insuficiente</p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 opacity-80">
            Menos de 30 pedidos no período selecionado. Aumente a janela ou aguarde mais dados para evitar decisões sobre ruído.
          </p>
        </div>
      )}

      {/* Gráficos */}
      {!error && !insufficient && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Gráfico 1 — DOW */}
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-4">
            <p className="text-sm font-semibold text-[var(--color-text)] mb-1">Por dia da semana</p>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">Distribuição ao longo dos últimos {days} dias</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dowChart} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => metric === 'value' ? R$(v) : N(v)} width={70} />
                  <Tooltip formatter={(v) => fmtMetric(metric, v)} />
                  <Bar dataKey="value" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico 2 — Hora */}
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-4">
            <p className="text-sm font-semibold text-[var(--color-text)] mb-1">Por hora do dia</p>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">Distribuição horária (0h → 23h, TZ Brasil)</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hourChart} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={1} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => metric === 'value' ? R$(v) : N(v)} width={70} />
                  <Tooltip formatter={(v) => fmtMetric(metric, v)} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

