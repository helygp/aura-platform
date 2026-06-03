/**
 * Billing Overview — receita mensal, inadimplentes, próximas cobranças
 */
import React, { useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { DollarSign, AlertTriangle, Clock, RefreshCw } from 'lucide-react'
import { KpiCard }     from '../components/KpiCard.jsx'
import { StatusBadge } from '../components/StatusBadge.jsx'
import { PageSpinner } from '../components/Spinner.jsx'
import { ErrorState }  from '../components/ErrorState.jsx'
import { fmtBRL, fmtPeriod, fmtDate } from '../lib/fmt.js'
import { useBilling }  from '../hooks/useBilling.js'

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-md px-3 py-2 text-sm">
      <p className="text-xs text-[var(--color-text-muted)] mb-1">{label}</p>
      <p className="font-semibold text-[var(--color-text)]">{fmtBRL(payload[0].value)}</p>
    </div>
  )
}

export function BillingPage() {
  const [months, setMonths] = useState(12)
  const { data, loading, error, refetch } = useBilling(months)

  if (loading) return <PageSpinner />
  if (error)   return <ErrorState message={error} onRetry={refetch} />

  const totals = data?.totals ?? {}

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Billing</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Visão financeira da plataforma</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={months}
            onChange={e => setMonths(Number(e.target.value))}
            className="px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none"
          >
            {[3, 6, 12, 24].map(m => <option key={m} value={m}>{m} meses</option>)}
          </select>
          <button onClick={refetch} className="p-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface)] text-[var(--color-text-muted)]">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon={DollarSign}    label="Receita Paga"  color="green"  value={fmtBRL(totals.paid)}    sub="no período" />
        <KpiCard icon={Clock}         label="A Receber"     color="blue"   value={fmtBRL(totals.pending)} sub="pendente" />
        <KpiCard icon={AlertTriangle} label="Inadimplente"  color="red"    value={fmtBRL(totals.overdue)} sub="vencido" />
      </div>

      {/* Gráfico receita */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
        <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4">Receita por Mês</h2>
        {data?.revenueChart?.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.revenueChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--color-primary)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="amount" stroke="var(--color-primary)" fill="url(#revGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center py-16 text-sm text-[var(--color-text-muted)]">Sem dados de receita no período.</p>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Inadimplentes */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
          <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-500" />
            Inadimplentes
          </h2>
          {data?.overdue?.length ? (
            <div className="space-y-3">
              {data.overdue.map((o, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">{o.tenantName}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{fmtPeriod(o.period)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-red-600">{fmtBRL(o.amount)}</span>
                    <StatusBadge status={o.tenantStatus} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">Nenhum inadimplente. 🎉</p>
          )}
        </div>

        {/* Próximas cobranças */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
          <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
            <Clock size={14} className="text-blue-500" />
            Próximas Cobranças
          </h2>
          {data?.upcoming?.length ? (
            <div className="space-y-3">
              {data.upcoming.map((u, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">{u.tenantName}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{fmtPeriod(u.period)}</p>
                  </div>
                  <span className="text-sm font-medium text-[var(--color-text)]">{fmtBRL(u.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">Nenhuma cobrança pendente.</p>
          )}
        </div>
      </div>
    </div>
  )
}
