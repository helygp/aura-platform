/**
 * pages/DashboardPage.jsx
 *
 * Dashboard principal do ERP — Sprint 2 Tarefa 2
 *
 * Seções:
 *   1. KPI cards (receita, pedidos pendentes, SKUs críticos, clientes ativos)
 *   2. Gráfico de vendas — últimos 7 dias (Recharts AreaChart)
 *   3. Cards de ações rápidas
 *
 * Estados:
 *   loading  → skeletons em todos os cards e gráfico
 *   erro     → empty state com botão retry
 *   vazio    → empty state no gráfico quando não há dados
 *
 * 100% mobile-first — grid adapta de 1 → 2 → 4 colunas.
 */

import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp, TrendingDown, ShoppingCart, Package,
  Users, AlertTriangle, Plus, RefreshCw,
  BarChart2, ArrowRight,
} from 'lucide-react'
import { Card, Skeleton, Badge } from '@aura/ui'
import { useAuth }      from '../auth/AuthContext.jsx'
import { useDashboard } from '../hooks/useDashboard.js'

/* ─── Formatadores ─── */
const fmtBRL = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtNum = (v) =>
  new Intl.NumberFormat('pt-BR').format(v)

/* ─── Tooltip customizado do gráfico ─── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="
      rounded-xl border border-[var(--color-border)]
      bg-[var(--color-bg)] shadow-[var(--shadow-md)]
      px-3 py-2 text-sm
    ">
      <p className="text-[var(--color-text-muted)] text-xs mb-1">{label}</p>
      <p className="font-semibold text-[var(--color-text)]">
        {fmtBRL(payload[0].value)}
      </p>
    </div>
  )
}

/* ─── Skeleton de KPI card ─── */
function KpiSkeleton() {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-4">
        <Skeleton width={80} height={12} />
        <Skeleton variant="circle" width={36} height={36} />
      </div>
      <Skeleton width={120} height={28} className="mb-2" />
      <Skeleton width={60} height={10} />
    </Card>
  )
}

/* ─── KPI Card ─── */
function KpiCard({ icon: Icon, label, value, trend, format = 'number', color = 'primary' }) {
  const isPositive = trend >= 0
  const TrendIcon  = isPositive ? TrendingUp : TrendingDown

  const iconColors = {
    primary: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
    success: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
    warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
    danger:  'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
  }

  const displayValue = format === 'currency' ? fmtBRL(value) : fmtNum(value)

  return (
    <Card className="p-5 transition-shadow duration-200 hover:shadow-[var(--shadow-md)]">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
          {label}
        </p>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconColors[color]}`}>
          <Icon size={18} />
        </div>
      </div>

      <p className="text-2xl font-bold text-[var(--color-text)] leading-none mb-2">
        {displayValue}
      </p>

      <div className="flex items-center gap-1">
        <TrendIcon
          size={13}
          className={isPositive ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}
        />
        <span
          className={`text-xs font-medium ${
            isPositive ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'
          }`}
        >
          {isPositive ? '+' : ''}{trend}%
        </span>
        <span className="text-xs text-[var(--color-text-disabled)]">vs. ontem</span>
      </div>
    </Card>
  )
}

/* ─── Gráfico de vendas ─── */
function SalesChart({ data, isLoading }) {
  if (isLoading) {
    return (
      <Card className="p-5">
        <Skeleton width={160} height={16} className="mb-1" />
        <Skeleton width={100} height={11} className="mb-6" />
        <Skeleton width="100%" height={200} />
      </Card>
    )
  }

  if (!data?.length) {
    return (
      <Card className="p-5">
        <p className="text-sm font-semibold text-[var(--color-text)] mb-1">Vendas — últimos 7 dias</p>
        <div className="h-52 flex flex-col items-center justify-center gap-2">
          <BarChart2 size={32} className="text-[var(--color-text-disabled)]" />
          <p className="text-sm text-[var(--color-text-muted)]">Nenhuma venda no período</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text)]">Vendas — últimos 7 dias</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Total por dia em R$</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="auraGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="var(--color-primary)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}    />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="total"
            stroke="var(--color-primary)"
            strokeWidth={2.5}
            fill="url(#auraGradient)"
            dot={false}
            activeDot={{ r: 5, fill: 'var(--color-primary)', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  )
}

/* ─── Ações rápidas ─── */
const QUICK_ACTIONS = [
  {
    icon:  ShoppingCart,
    label: 'Novo pedido',
    desc:  'Criar pedido manual',
    path:  '/orders',
    state: { openNew: true },
    color: 'text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400',
  },
  {
    icon:  Package,
    label: 'Novo produto',
    desc:  'Cadastrar produto ou variante',
    path:  '/products',
    state: { openNew: true },
    color: 'text-violet-600 bg-violet-50 dark:bg-violet-950 dark:text-violet-400',
  },
  {
    icon:  Users,
    label: 'Novo cliente',
    desc:  'Cadastrar atacadista',
    path:  '/customers',
    state: { openNew: true },
    color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400',
  },
  {
    icon:  AlertTriangle,
    label: 'Estoque crítico',
    desc:  'Ver SKUs em alerta',
    path:  '/inventory',
    state: { status: 'critico' },
    color: 'text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400',
  },
]

function QuickActions({ isLoading }) {
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <Card className="p-5">
        <Skeleton width={120} height={14} className="mb-4" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} width="100%" height={72} />
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-[var(--color-text)] mb-4">Ações rápidas</p>
      <div className="grid grid-cols-2 gap-3">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.label}
              onClick={() => navigate(action.path, { state: action.state })}
              className="
                group flex flex-col items-start gap-2 p-3.5
                rounded-xl border border-[var(--color-border)]
                bg-[var(--color-bg-subtle)]
                hover:bg-[var(--color-surface)]
                hover:border-[var(--color-border-strong)]
                hover:shadow-[var(--shadow-sm)]
                transition-all duration-150
                text-left
              "
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${action.color}`}>
                <Icon size={16} />
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--color-text)] leading-tight">
                  {action.label}
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)] leading-tight mt-0.5 hidden sm:block">
                  {action.desc}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

/* ─── Empty state erro ─── */
function ErrorState({ onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950 flex items-center justify-center">
        <AlertTriangle size={28} className="text-red-500" />
      </div>
      <div>
        <p className="font-semibold text-[var(--color-text)]">Falha ao carregar dashboard</p>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Verifique sua conexão e tente novamente.</p>
      </div>
      <button
        onClick={onRetry}
        className="
          flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
          bg-[var(--color-primary)] text-white
          hover:bg-[var(--color-primary-hover)]
          transition-colors duration-150
        "
      >
        <RefreshCw size={14} />
        Tentar novamente
      </button>
    </div>
  )
}

/* ─── Página principal ─── */
export function DashboardPage() {
  const { t }   = useTranslation()
  const { user } = useAuth()
  const { kpis, chartData, isLoading, isError, refetch } = useDashboard()

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Bom dia'
    if (h < 18) return 'Boa tarde'
    return 'Boa noite'
  }, [])

  if (isError) return <ErrorState onRetry={refetch} />

  return (
    <div className="space-y-5 max-w-screen-xl">

      {/* ── Cabeçalho ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text)]">
            {greeting}{user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            Aqui está um resumo de hoje
          </p>
        </div>
        <button
          onClick={refetch}
          disabled={isLoading}
          aria-label="Atualizar"
          className="
            w-9 h-9 flex items-center justify-center rounded-lg
            text-[var(--color-text-muted)]
            hover:bg-[var(--color-surface)]
            disabled:opacity-40 transition-colors duration-150
          "
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── KPIs — 1 col mobile / 2 col sm / 4 col lg ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={TrendingUp}
            label="Receita hoje"
            value={kpis.revenue.value}
            trend={kpis.revenue.trend}
            format="currency"
            color="primary"
          />
          <KpiCard
            icon={ShoppingCart}
            label="Pedidos pendentes"
            value={kpis.pendingOrders.value}
            trend={kpis.pendingOrders.trend}
            color="warning"
          />
          <KpiCard
            icon={AlertTriangle}
            label="SKUs críticos"
            value={kpis.criticalSkus.value}
            trend={kpis.criticalSkus.trend}
            color="danger"
          />
          <KpiCard
            icon={Users}
            label="Clientes ativos"
            value={kpis.activeCustomers.value}
            trend={kpis.activeCustomers.trend}
            color="success"
          />
        </div>
      )}

      {/* ── Gráfico + Ações — 1 col mobile / 3:2 desktop ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3">
          <SalesChart data={chartData} isLoading={isLoading} />
        </div>
        <div className="lg:col-span-2">
          <QuickActions isLoading={isLoading} />
        </div>
      </div>

    </div>
  )
}
