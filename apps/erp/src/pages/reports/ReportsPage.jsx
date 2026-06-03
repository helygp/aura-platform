/**
 * ReportsPage.jsx — 6 relatórios operacionais do ERP
 *
 * Cada relatório:
 *  - Filtros simples (período, busca)
 *  - Tabela com dados reais do banco
 *  - Exportação CSV e PDF com logo da empresa
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart2, Package, AlertTriangle, TrendingDown,
  ArrowLeftRight, Calendar, Download, FileText,
  RefreshCw, ChevronDown, Filter, Search
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { useAuth }       from '../../auth/AuthContext.jsx'
import { useReport, today, firstOfMonth } from './useReports.js'
import { exportCSV, exportPDF }           from './exportUtils.js'

/* ─── formatadores ─── */
const R$ = v => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(+v||0)
const N  = v => new Intl.NumberFormat('pt-BR').format(+v||0)
const D  = iso => iso ? new Date(iso+'T12:00:00').toLocaleDateString('pt-BR') : '—'
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

function ExportBar({ onCSV, onPDF, loading }) {
  return (
    <div className="flex items-center gap-2">
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

function TableShell({ headers, rows, loading, empty }) {
  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <RefreshCw size={24} className="animate-spin text-[var(--color-primary)]" />
    </div>
  )
  if (!rows?.length) return (
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
            {headers.map((h,i) => (
              <th key={i} className={`px-3 py-2.5 font-semibold text-[var(--color-text-muted)] whitespace-nowrap ${h.align==='right'?'text-right':h.align==='center'?'text-center':'text-left'}`}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-subtle)] transition-colors">
              {headers.map((h, j) => (
                <td key={j} className={`px-3 py-2 text-[var(--color-text)] ${h.align==='right'?'text-right':h.align==='center'?'text-center':''}`}>
                  {h.render ? h.render(row) : (row[h.key] ?? '—')}
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
    </div>
  )
}

/* ═══════════════════════════════════════════
   1. VENDAS
═══════════════════════════════════════════ */
function SalesReport({ companyName }) {
  const [start, setStart] = useState(firstOfMonth())
  const [end,   setEnd]   = useState(today())
  const { data, loading, error, fetch: load } = useReport('sales')

  useEffect(() => { load({ start, end }) }, [start, end])

  const kpi  = data?.kpi  || {}
  const rows = data?.byDay || []

  const pdfCols = [
    { label:'Dia',          key:'dia',         get: r => D(r.dia) },
    { label:'Pedidos',      key:'pedidos',      align:'right' },
    { label:'Faturamento',  key:'faturamento',  get: r => R$(r.faturamento), align:'right' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRange start={start} end={end} onStart={setStart} onEnd={setEnd} />
        <ExportBar loading={loading}
          onCSV={() => exportCSV('vendas', pdfCols, rows)}
          onPDF={() => exportPDF({
            title: 'Relatório de Vendas',
            subtitle: `Período: ${D(start)} a ${D(end)}`,
            companyName,
            columns: pdfCols,
            rows,
            summary: [
              { label:'Faturamento',   value: R$(kpi.faturamento) },
              { label:'Pedidos',       value: N(kpi.total_pedidos) },
              { label:'Ticket Médio',  value: R$(kpi.ticket_medio) },
              { label:'Cancelados',    value: N(kpi.pedidos_cancelados) },
            ],
          })}
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Faturamento"   value={R$(kpi.faturamento)}       />
        <KpiCard label="Pedidos"       value={N(kpi.total_pedidos)}       />
        <KpiCard label="Ticket Médio"  value={R$(kpi.ticket_medio)}       />
        <KpiCard label="Cancelamentos" value={N(kpi.pedidos_cancelados)}  color="text-red-500" />
      </div>

      {/* Gráfico */}
      {rows.length > 0 && (
        <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
          <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-3 uppercase tracking-wide">Faturamento por dia</p>
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
              <YAxis tick={{fontSize:10}} tickFormatter={v=>R$(v)} width={80} />
              <Tooltip formatter={v=>[R$(v),'Faturamento']} labelFormatter={D} />
              <Area type="monotone" dataKey="faturamento" stroke="var(--color-primary)"
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

  useEffect(() => { load({ start, end }) }, [start, end])
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
    { label:'Produto',      render: r => r.produto },
    { label:'SKU',          key:'sku' },
    { label:'Variação',     render: r => attrStr(r.atributos) || '—' },
    { label:'Qtd',          key:'qtd_vendida',   align:'right' },
    { label:'Valor Vendido',render: r => R$(r.valor_vendido), align:'right' },
    { label:'Preço Médio',  render: r => R$(r.preco_medio),   align:'right' },
    { label:'Estoque',      key:'estoque_atual', align:'right' },
    { label:'Status',       render: r => (
        <Badge text={r.status_estoque} color={STATUS_COLORS[r.status_estoque] || ''} />
      )},
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRange start={start} end={end} onStart={setStart} onEnd={setEnd} />
        <ExportBar loading={loading}
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
    { label:'Mínimo',           key:'estoque_minimo', align:'right' },
    { label:'Preço',            key:'preco',         get: r => R$(r.preco), align:'right' },
    { label:'Valor em Estoque', key:'valor_em_estoque', get: r => R$(r.valor_em_estoque), align:'right' },
    { label:'Status',           key:'status' },
  ]

  const headers = [
    { label:'Produto',      key:'produto' },
    { label:'SKU',          key:'sku' },
    { label:'Variação',     render: r => attrStr(r.atributos) || '—' },
    { label:'Categoria',    key:'categoria' },
    { label:'Estoque',      key:'estoque',    align:'right' },
    { label:'Mínimo',       key:'estoque_minimo', align:'right' },
    { label:'Preço',        render: r => R$(r.preco), align:'right' },
    { label:'Val. Estoque', render: r => R$(r.valor_em_estoque), align:'right' },
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
              { label:'Total SKUs',    value: N(summary.total_skus) },
              { label:'Valor Total',   value: R$(summary.valor_total) },
              { label:'SKUs Críticos', value: N(summary.skus_criticos) },
            ],
          })}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Total SKUs"    value={N(summary.total_skus)} />
        <KpiCard label="Valor em Estoque" value={R$(summary.valor_total)} />
        <KpiCard label="SKUs Críticos" value={N(summary.skus_criticos)} color="text-amber-500" />
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
    { label:'Produto',       key:'produto' },
    { label:'SKU',           key:'sku' },
    { label:'Variação',      render: r => attrStr(r.atributos)||'—' },
    { label:'Categoria',     key:'categoria' },
    { label:'Atual',         key:'estoque_atual',   align:'right' },
    { label:'Mínimo',        key:'estoque_minimo',  align:'right' },
    { label:'Falta',         render: r => (
        <span className="font-semibold text-red-500">+{r.diferenca}</span>
      ), align:'right' },
    { label:'Status',        render: r => <Badge text={r.status} color={STATUS_COLORS[r.status]||''} /> },
    { label:'Última Venda',  render: r => D(r.ultima_venda) },
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

  useEffect(() => { load({ dias }) }, [dias])
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
    { label:'Produto',      key:'produto' },
    { label:'SKU',          key:'sku' },
    { label:'Variação',     render: r => attrStr(r.atributos)||'—' },
    { label:'Estoque',      key:'estoque_atual', align:'right' },
    { label:'Valor Parado', render: r => R$(r.valor_parado), align:'right' },
    { label:'Última Venda', render: r => r.ultima_venda ? D(r.ultima_venda) : <span className="text-amber-500">Nunca</span> },
    { label:'Dias Parado',  render: r => (
        <span className={r.dias_sem_venda>60?'text-red-500 font-semibold':r.dias_sem_venda>30?'text-amber-500':''}>
          {r.dias_sem_venda >= 9999 ? '∞' : r.dias_sem_venda}d
        </span>
      ), align:'right'},
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
        <ExportBar loading={loading}
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

  useEffect(() => { load({ start, end }) }, [start, end])

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
    { label:'Usuário',       key:'usuario' },
  ]
  const MOV_COLOR = { entrada:'text-green-600', saida:'text-red-500', ajuste:'text-blue-500' }

  const headers = [
    { label:'Data',     render: r => D(r.data) },
    { label:'Produto',  key:'produto' },
    { label:'SKU',      key:'sku' },
    { label:'Variação', render: r => attrStr(r.atributos)||'—' },
    { label:'Tipo',     render: r => (
        <span className={`font-medium ${MOV_COLOR[r.tipo]||''}`}>
          {MOV_LABEL[r.tipo]||r.tipo}
        </span>
      )},
    { label:'Qtd',      render: r => (
        <span className={`font-semibold ${MOV_COLOR[r.tipo]||''}`}>
          {r.tipo==='saida'?'-':r.tipo==='entrada'?'+':''}{r.quantidade}
        </span>
      ), align:'right'},
    { label:'Ant.',     key:'saldo_anterior', align:'right' },
    { label:'Atual',    key:'saldo_atual',    align:'right' },
    { label:'Motivo',   key:'motivo' },
    { label:'Usuário',  key:'usuario' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRange start={start} end={end} onStart={setStart} onEnd={setEnd} />
        <ExportBar loading={loading}
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
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Entradas"  value={N(summary.entradas)} color="text-green-500" />
        <KpiCard label="Saídas"    value={N(summary.saidas)}   color="text-red-500" />
        <KpiCard label="Ajustes"   value={N(summary.ajustes)} />
      </div>
      <TableShell headers={headers} rows={rows} loading={loading} empty="Nenhuma movimentação no período." />
    </div>
  )
}
