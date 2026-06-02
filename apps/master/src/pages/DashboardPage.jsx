/**
 * Dashboard Master
 * MRR, ARR, tenants ativos, novos, churn, gráfico de crescimento
 */
import React from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts'
import {
  DollarSign, Users, TrendingUp, AlertTriangle,
  UserPlus, UserMinus, RefreshCw,
} from 'lucide-react'
import { KpiCard }    from '../components/KpiCard.jsx'
import { PageSpinner } from '../components/Spinner.jsx'
import { ErrorState }  from '../components/ErrorState.jsx'
import { fmtBRL, fmtNum, fmtPeriod } from '../lib/fmt.js'
import { useMetrics }  from '../hooks/useMetrics.js'
import { useBilling }  from '../hooks/useBilling.js'

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-md px-3 py-2 text-sm">
      <p className="text-xs text-[var(--color-text-muted)] mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="font-semibold text-[var(--color-text)]">
          {p.name === 'amount' ? fmtBRL(p.value) : fmtNum(p.value)}
        </p>
      ))}
    </div>
  )
}

export function DashboardPage() {
  const metrics = useMetrics()
  const billing = useBilling(6)

  if (metrics.loading || billing.loading) return <PageSpinner />
  if (metrics.error) return <ErrorState message={metrics.error} onRetry={metrics.refetch} />

  const m  = metrics.data
  const b  = billing.data
  const active = m.tenants.byStatus.ACTIVE ?? 0
  const trial  = m.tenants.byStatus.TRIAL  ?? 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Dashboard</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            Visão geral da plataforma Aura
          </p>
        </div>
        <button
          onClick={() => { metrics.refetch(); billing.refetch() }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors"
        >
          <RefreshCw size={14} />
          Atualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="col-span-2 md:col-span-1">
          <KpiCard
            icon={DollarSign} label="MRR" color="green"
            value={fmtBRL(m.revenue.mrr)}
            sub="receita do mês"
          />
        </div>
        <div className="col-span-2 md:col-span-1">
          <KpiCard
            icon={TrendingUp} label="ARR Estimado" color="purple"
            value={fmtBRL(m.revenue.arr)}
            sub="projeção anual"
          />
        </div>
        <KpiCard
          icon={Users} label="Tenants Ativos" color="blue"
          value={fmtNum(active)}
          sub={`${trial} em trial`}
        />
        <KpiCard
          icon={UserPlus} label="Novos (mês)" color="green"
          value={fmtNum(m.tenants.newThisMonth)}
          sub="este mês"
        />
        <KpiCard
          icon={UserMinus} label="Churn (30d)" color="red"
          value={fmtNum(m.tenants.churnLast30)}
          sub="cancelamentos"
        />
        <KpiCard
          icon={AlertTriangle} label="Suspensos" color="yellow"
          value={fmtNum(m.tenants.byStatus.SUSPENDED ?? 0)}
          sub="requerem atenção"
        />
      </div>

      {/* Gráficos */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Receita mensal */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
          <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4">Receita Mensal (6 meses)</h2>
          {b?.revenueChart?.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={b.revenueChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--color-primary)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="amount" stroke="var(--color-primary)" fill="url(#colorRev)" strokeWidth={2} name="amount" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-16 text-sm text-[var(--color-text-muted)]">Sem dados de receita.</p>
          )}
        </div>

        {/* Novos tenants por mês */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
          <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4">Novos Tenants por Mês</h2>
          {m.growth?.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={m.growth} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="newTenants" fill="var(--color-primary)" radius={[4, 4, 0, 0]} name="newTenants" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-16 text-sm text-[var(--color-text-muted)]">Sem dados.</p>
          )}
        </div>
      </div>

      {/* Status breakdown */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
        <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4">Distribuição por Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(m.tenants.byStatus).map(([status, count]) => {
            const colors = {
              TRIAL:     'text-blue-600',
              ACTIVE:    'text-green-600',
              SUSPENDED: 'text-yellow-600',
              CANCELLED: 'text-red-500',
            }
            const labels = { TRIAL: 'Trial', ACTIVE: 'Ativo', SUSPENDED: 'Suspenso', CANCELLED: 'Cancelado' }
            return (
              <div key={status} className="text-center py-3 rounded-lg bg-[var(--color-surface)]">
                <p className={`text-3xl font-bold ${colors[status]}`}>{count}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">{labels[status]}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
