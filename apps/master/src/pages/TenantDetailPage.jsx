/**
 * TenantDetailPage.jsx
 * Tabs: Visão Geral / Usuários & Acessos / Eventos / Saúde & Logs
 */
import React, { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Globe, Users, Play, Pause, XCircle, RefreshCw,
  ExternalLink, Activity, Terminal, Wifi, WifiOff,
  CheckCircle, XCircle as XC, ShieldAlert, LogOut, Clock,
} from 'lucide-react'
import { StatusBadge }  from '../components/StatusBadge.jsx'
import { PageSpinner }  from '../components/Spinner.jsx'
import { ErrorState }   from '../components/ErrorState.jsx'
import { fmtDate, fmtBRL, fmtPeriod } from '../lib/fmt.js'
import { useTenant }    from '../hooks/useTenants.js'
import {
  useAnalyticsUsers,
  useAnalyticsHealth,
  useAnalyticsLogs,
  useAnalyticsHeatmap,
  useAnalyticsSuspicious,
} from '../hooks/useAnalytics.js'
import { api } from '../lib/api.js'

const DOMAIN = import.meta.env.VITE_DOMAIN ?? 'aurabr.app'
const DAYS   = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/* ─── helpers ─── */
function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-[var(--color-border)] last:border-0">
      <span className="text-sm text-[var(--color-text-muted)] shrink-0 w-40">{label}</span>
      <span className="text-sm text-[var(--color-text)] text-right">{value ?? '—'}</span>
    </div>
  )
}

function Tab({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
        ${active
          ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
          : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
        }`}
    >{children}</button>
  )
}

function KpiMini({ label, value, sub, color = 'text-[var(--color-text)]' }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <p className="text-xs text-[var(--color-text-muted)] mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{sub}</p>}
    </div>
  )
}

function DeviceIcon({ device, size = 14 }) {
  if (device === 'mobile')  return <span title="Mobile"  style={{ fontSize: size }}>📱</span>
  if (device === 'tablet')  return <span title="Tablet"  style={{ fontSize: size }}>📲</span>
  if (device === 'desktop') return <span title="Desktop" style={{ fontSize: size }}>🖥️</span>
  return <span title="Desconhecido" style={{ fontSize: size }}>❓</span>
}

function DeviceInfo({ d }) {
  if (!d) return <span className="text-[var(--color-text-muted)] text-xs">—</span>
  return (
    <div className="flex items-center gap-1.5">
      <DeviceIcon device={d.device} />
      <div>
        <div className="text-xs text-[var(--color-text)]">
          {d.vendor ? `${d.vendor} ${d.model ?? ''}`.trim() : d.os ?? '—'}
        </div>
        <div className="text-[10px] text-[var(--color-text-muted)]">
          {d.os && d.vendor ? d.os : d.browser ?? ''}
        </div>
      </div>
    </div>
  )
}

function RoleBadge({ role }) {
  const map = {
    ADMIN:      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    FINANCEIRO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    OPERADOR:   'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[role] ?? map.OPERADOR}`}>
      {role}
    </span>
  )
}

/* ─── Heatmap 7×24 ─── */
function HeatmapChart({ data }) {
  if (!data) return null
  const { matrix, max } = data

  function cellColor(count) {
    if (!count) return 'bg-[var(--color-surface)]'
    const pct = count / (max || 1)
    if (pct < 0.25) return 'bg-blue-100 dark:bg-blue-900/30'
    if (pct < 0.50) return 'bg-blue-300 dark:bg-blue-700/50'
    if (pct < 0.75) return 'bg-blue-500 dark:bg-blue-500/70'
    return 'bg-blue-700 dark:bg-blue-400'
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">
          Mapa de calor — logins por dia/hora (últimos 30d)
        </h2>
        <span className="text-xs text-[var(--color-text-muted)]">{data.totalLogins} logins</span>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {/* Horas no eixo X */}
          <div className="flex flex-col gap-1">
            <div className="w-8 h-4" /> {/* espaço header */}
            {DAYS.map(d => (
              <div key={d} className="h-4 w-8 flex items-center text-xs text-[var(--color-text-muted)]">{d}</div>
            ))}
          </div>
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="flex flex-col gap-1">
              <div className="h-4 w-4 flex items-center justify-center text-[10px] text-[var(--color-text-muted)]">
                {h % 6 === 0 ? `${h}h` : ''}
              </div>
              {matrix.map((row, d) => (
                <div
                  key={d}
                  title={`${DAYS[d]} ${h}h — ${row[h]} login(s)`}
                  className={`h-4 w-4 rounded-sm cursor-default transition-colors ${cellColor(row[h])}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs text-[var(--color-text-muted)]">Menos</span>
        {['bg-[var(--color-surface)]', 'bg-blue-100 dark:bg-blue-900/30', 'bg-blue-300 dark:bg-blue-700/50',
          'bg-blue-500 dark:bg-blue-500/70', 'bg-blue-700 dark:bg-blue-400'].map((c, i) => (
          <div key={i} className={`w-4 h-4 rounded-sm ${c} border border-[var(--color-border)]`} />
        ))}
        <span className="text-xs text-[var(--color-text-muted)]">Mais</span>
      </div>
    </div>
  )
}

/* ─── Tab Visão Geral ─── */
function TabOverview({ tenant, refetch }) {
  const [action, setAction] = useState(null)

  async function changeStatus(status) {
    const reason = window.prompt(`Motivo para ${status} (opcional):`) ?? undefined
    setAction(status)
    try { await api.tenants.status(tenant.slug, status, reason); refetch() }
    catch (e) { alert(e.message) }
    finally { setAction(null) }
  }

  const canActivate = ['TRIAL', 'SUSPENDED'].includes(tenant.status)
  const canSuspend  = ['TRIAL', 'ACTIVE'].includes(tenant.status)
  const canCancel   = tenant.status !== 'CANCELLED'

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-6">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
          <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4">Informações</h2>
          <InfoRow label="Slug"       value={tenant.slug} />
          <InfoRow label="Plano"      value={tenant.plan?.name} />
          <InfoRow label="Banco"      value={tenant.dbName} />
          <InfoRow label="Criado em"  value={fmtDate(tenant.createdAt)} />
          <InfoRow label="Atualizado" value={fmtDate(tenant.updatedAt)} />
          <InfoRow label="Usuários"   value={tenant.users} />
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
          <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4">Acessos</h2>
          <div className="space-y-2">
            {[
              { label: 'ERP',      url: `https://${tenant.slug}.${DOMAIN}` },
              { label: 'Loja B2B', url: `https://loja.${tenant.slug}.${DOMAIN}` },
              { label: 'API',      url: `https://api.${tenant.slug}.${DOMAIN}` },
            ].map(({ label, url }) => (
              <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-border)] transition-colors group">
                <div className="flex items-center gap-2">
                  <Globe size={14} className="text-[var(--color-text-muted)]" />
                  <span className="text-sm text-[var(--color-text-muted)]">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--color-text-muted)] font-mono">{url.replace('https://', '')}</span>
                  <ExternalLink size={12} className="text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </a>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
          <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4">Histórico de Cobrança</h2>
          {tenant.billings?.length ? (
            <div className="space-y-2">
              {tenant.billings.map(b => (
                <div key={b.id} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
                  <div>
                    <span className="text-sm text-[var(--color-text)]">{fmtPeriod(b.period)}</span>
                    <span className="ml-2 text-xs text-[var(--color-text-muted)]">{b.type}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-[var(--color-text)]">{fmtBRL(b.amount)}</span>
                    <StatusBadge status={b.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">Nenhum registro de cobrança.</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
          <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4">Ações</h2>
          <div className="space-y-2">
            {canActivate && (
              <button disabled={!!action} onClick={() => changeStatus('ACTIVE')}
                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-60">
                <Play size={14} />{action === 'ACTIVE' ? 'Ativando...' : 'Ativar tenant'}
              </button>
            )}
            {canSuspend && (
              <button disabled={!!action} onClick={() => changeStatus('SUSPENDED')}
                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg bg-yellow-500 text-white text-sm font-medium hover:bg-yellow-600 transition-colors disabled:opacity-60">
                <Pause size={14} />{action === 'SUSPENDED' ? 'Suspendendo...' : 'Suspender'}
              </button>
            )}
            {canCancel && (
              <button disabled={!!action}
                onClick={() => { if (confirm(`Cancelar ${tenant.name}?`)) changeStatus('CANCELLED') }}
                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-60">
                <XCircle size={14} />{action === 'CANCELLED' ? 'Cancelando...' : 'Cancelar tenant'}
              </button>
            )}
          </div>
        </div>
        {tenant.plan && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
            <h2 className="text-sm font-semibold text-[var(--color-text)] mb-3">Plano Atual</h2>
            <p className="text-lg font-bold text-[var(--color-primary)] capitalize">{tenant.plan.name}</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">{fmtBRL(tenant.plan.priceMonthly)}/mês</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Tab Usuários & Acessos ─── */
function TabUsers({ slug }) {
  const { data, loading, error, refetch }       = useAnalyticsUsers(slug)
  const { data: heatmap, loading: heatLoading } = useAnalyticsHeatmap(slug)
  const { data: suspicious }                    = useAnalyticsSuspicious(slug)
  const [revoking, setRevoking] = useState(null)

  const suspiciousIds = new Set((suspicious?.suspicious ?? []).map(s => s.userId).filter(Boolean))

  async function handleRevoke(userId, name) {
    if (!confirm(`Forçar logout de ${name}? Todas as sessões ativas serão encerradas.`)) return
    setRevoking(userId)
    try {
      const r = await api.analytics.revoke(slug, userId)
      alert(`${r.revoked} sessão(ões) revogada(s) para ${r.user.name}`)
      refetch()
    } catch (e) {
      alert(e.message)
    } finally {
      setRevoking(null)
    }
  }

  if (loading) return <PageSpinner />
  if (error)   return <ErrorState message={error} onRetry={refetch} />
  if (!data)   return null

  const { stats, users } = data
  const now = Date.now()

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiMini label="Total usuários"  value={stats.total} />
        <KpiMini label="Ativos (conta)"  value={stats.active} />
        <KpiMini label="Logaram 24h"     value={stats.active24h}
          color={stats.active24h > 0 ? 'text-green-600' : 'text-[var(--color-text)]'} />
        <KpiMini label="Sessão aberta"   value={stats.withSession}
          color={stats.withSession > 0 ? 'text-green-600' : 'text-[var(--color-text)]'} />
        <KpiMini label="Inativos 30d"    value={stats.inactive30d}
          color={stats.inactive30d > 0 ? 'text-yellow-600' : 'text-[var(--color-text)]'}
          sub="possível churn" />
      </div>

      {/* Alerta de atividade suspeita */}
      {suspicious?.suspicious?.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert size={16} className="text-red-600" />
            <span className="text-sm font-semibold text-red-700 dark:text-red-400">
              Atividade suspeita detectada
            </span>
          </div>
          <div className="space-y-1">
            {suspicious.suspicious.map((s, i) => (
              <p key={i} className="text-xs text-red-600 dark:text-red-400">
                <span className="font-medium">{s.user?.name ?? s.identifier}</span>
                {' — '}{s.failures24h} falhas de login nas últimas 24h
                {s.ips.length > 0 && ` · IPs: ${s.ips.join(', ')}`}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Tabela de usuários */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Usuários</h2>
          <button onClick={refetch} className="p-1.5 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-muted)] transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                {['Usuário', 'Role', 'Dispositivo', 'Último login', 'Sessão', 'Logins 7d', 'Falhas 7d', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[var(--color-text-muted)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const daysSince = u.lastLoginAt
                  ? Math.floor((now - new Date(u.lastLoginAt)) / 86400000) : null
                const isInactive  = daysSince === null || daysSince > 30
                const isSuspicious = suspiciousIds.has(u.id)
                return (
                  <tr key={u.id}
                    className={`border-b border-[var(--color-border)] last:border-0 transition-colors
                      ${isSuspicious ? 'bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20'
                        : 'hover:bg-[var(--color-surface)]'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isSuspicious && <ShieldAlert size={13} className="text-red-500 shrink-0" />}
                        <div>
                          <div className="font-medium text-[var(--color-text)]">{u.name}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">{u.login ?? u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                    <td className="px-4 py-3"><DeviceInfo d={u.lastDevice} /></td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">
                      {u.lastLoginAt
                        ? <span title={fmtDate(u.lastLoginAt)}>
                            {daysSince === 0 ? 'Hoje' : `${daysSince}d atrás`}
                          </span>
                        : <span className="text-yellow-600">Nunca</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {u.activeSessions > 0
                        ? <span className="flex items-center gap-1 text-green-600"><Wifi size={12}/>{u.activeSessions}</span>
                        : <span className="flex items-center gap-1 text-[var(--color-text-muted)]"><WifiOff size={12}/>—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text)]">{u.logins7d}</td>
                    <td className="px-4 py-3">
                      {u.failures7d > 0
                        ? <span className="text-red-600 font-medium">{u.failures7d}</span>
                        : <span className="text-[var(--color-text-muted)]">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {!u.active
                        ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Inativo</span>
                        : isInactive
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Sem acesso</span>
                          : <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Ativo</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {u.activeSessions > 0 && (
                        <button
                          disabled={revoking === u.id}
                          onClick={() => handleRevoke(u.id, u.name)}
                          title="Forçar logout"
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-600 border border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50">
                          <LogOut size={11} />
                          {revoking === u.id ? '...' : 'Logout'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Heatmap */}
      {heatLoading
        ? <div className="rounded-xl border border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-text-muted)]">Carregando heatmap...</div>
        : <HeatmapChart data={heatmap} />
      }
    </div>
  )
}

/* ─── Tab Eventos ─── */
function TabEvents({ slug }) {
  const [filters, setFilters] = useState({ success: '', page: 1, limit: 50 })
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const load = useCallback(async (f = filters) => {
    setLoading(true); setError(null)
    try {
      const params = { page: f.page, limit: f.limit }
      if (f.success !== '') params.success = f.success
      setData(await api.analytics.events(slug, params))
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [slug, filters])

  function apply(patch) {
    const next = { ...filters, ...patch, page: 1 }
    setFilters(next); load(next)
  }

  function page(n) {
    const next = { ...filters, page: n }
    setFilters(next); load(next)
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filters.success}
          onChange={e => apply({ success: e.target.value })}
          className="text-sm px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]">
          <option value="">Todos</option>
          <option value="true">Sucesso</option>
          <option value="false">Falha</option>
        </select>
        <button onClick={() => load()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {data ? 'Atualizar' : 'Carregar'}
        </button>
        {data && (
          <span className="text-xs text-[var(--color-text-muted)]">
            {data.meta.total} eventos
          </span>
        )}
      </div>

      {!data && !loading && (
        <div className="rounded-xl border border-[var(--color-border)] p-12 text-center text-sm text-[var(--color-text-muted)]">
          Clique em "Carregar" para buscar os eventos.
        </div>
      )}
      {loading && <PageSpinner />}
      {error   && <ErrorState message={error} onRetry={load} />}

      {data && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                  {['Data/hora', 'Identificador', 'Usuário', 'Dispositivo', 'Resultado', 'IP'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[var(--color-text-muted)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.data.map(e => (
                  <tr key={e.id}
                    className={`border-b border-[var(--color-border)] last:border-0 transition-colors
                      ${!e.success ? 'bg-red-50/30 dark:bg-red-900/10' : 'hover:bg-[var(--color-surface)]'}`}>
                    <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                      {fmtDate(e.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-text)]">
                      {e.identifier}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">
                      {e.user?.name ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {e.success
                        ? <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle size={11}/>OK</span>
                        : <span className="flex items-center gap-1 text-red-600 text-xs">
                            <XC size={11}/>{e.failureReason ?? 'falha'}
                          </span>
                      }
                    </td>
                    <td className="px-4 py-2.5">
                      <DeviceInfo d={e.device} />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-text-muted)]">
                      {e.ip ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {data.meta.pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-border)]">
              <button disabled={filters.page <= 1} onClick={() => page(filters.page - 1)}
                className="text-sm px-3 py-1 rounded border border-[var(--color-border)] disabled:opacity-40">
                ← Anterior
              </button>
              <span className="text-xs text-[var(--color-text-muted)]">
                Página {data.meta.page} de {data.meta.pages}
              </span>
              <button disabled={filters.page >= data.meta.pages} onClick={() => page(filters.page + 1)}
                className="text-sm px-3 py-1 rounded border border-[var(--color-border)] disabled:opacity-40">
                Próxima →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Tab Saúde & Logs ─── */
function ContainerStatus({ name, data }) {
  const isUp = data?.running
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full ${isUp ? 'bg-green-500' : 'bg-red-500'}`} />
        <div>
          <p className="text-sm font-medium text-[var(--color-text)]">{name}</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {data?.status ?? 'desconhecido'}
            {data?.restartCount > 0 && ` · ${data.restartCount} restart(s)`}
          </p>
        </div>
      </div>
      {isUp ? <CheckCircle size={16} className="text-green-500" /> : <XC size={16} className="text-red-500" />}
    </div>
  )
}

function LogViewer({ slug }) {
  const [container, setContainer] = useState('api')
  const { data, loading, error, fetch: fetchLogs } = useAnalyticsLogs(slug, container)
  const load = useCallback(() => fetchLogs(200), [fetchLogs])

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <Terminal size={16} className="text-[var(--color-text-muted)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Logs</h2>
          <div className="flex gap-1">
            {['api', 'erp', 'store'].map(c => (
              <button key={c} onClick={() => setContainer(c)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors
                  ${container === c
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}>{c}</button>
            ))}
          </div>
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xs font-medium transition-colors">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Carregando...' : 'Buscar logs'}
        </button>
      </div>
      <div className="bg-[#0d1117] min-h-48 max-h-96 overflow-y-auto font-mono text-xs p-4">
        {!data && !loading && <p className="text-gray-500">Clique em "Buscar logs" para carregar.</p>}
        {loading && <p className="text-gray-500">Carregando...</p>}
        {error   && <p className="text-red-400">{error}</p>}
        {data?.lines?.map((line, i) => {
          const isErr = /error|erro|warn|fatal/i.test(line)
          return (
            <div key={i} className={`leading-5 ${isErr ? 'text-red-400' : 'text-gray-300'}`}>{line}</div>
          )
        })}
      </div>
      {data && (
        <div className="px-5 py-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
          {data.lines?.length} linhas · {data.container} · {fmtDate(data.fetchedAt)}
        </div>
      )}
    </div>
  )
}

function TabHealth({ slug }) {
  const { data, loading, error, refetch } = useAnalyticsHealth(slug)
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Containers</h2>
          <button onClick={refetch}
            className="p-1.5 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-muted)] transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        {loading && <PageSpinner />}
        {error   && <ErrorState message={error} onRetry={refetch} />}
        {data && (
          <div className="grid md:grid-cols-3 gap-3">
            <ContainerStatus name={`api-${slug}`}   data={data.containers.api}   />
            <ContainerStatus name={`erp-${slug}`}   data={data.containers.erp}   />
            <ContainerStatus name={`store-${slug}`} data={data.containers.store} />
          </div>
        )}
        {data && (
          <p className="text-xs text-[var(--color-text-muted)] mt-3">
            Verificado em {fmtDate(data.checkedAt)}
          </p>
        )}
      </div>
      <LogViewer slug={slug} />
    </div>
  )
}

/* ─── Página principal ─── */
export function TenantDetailPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { data: tenant, loading, error, refetch } = useTenant(slug)
  const [tab, setTab] = useState('overview')

  if (loading) return <PageSpinner />
  if (error)   return <ErrorState message={error} onRetry={refetch} />
  if (!tenant) return null

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/tenants')}
          className="p-2 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-muted)] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--color-text)]">{tenant.name}</h1>
            <StatusBadge status={tenant.status} />
          </div>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">/{tenant.slug}</p>
        </div>
        <button onClick={refetch} className="p-2 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-muted)]">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--color-border)] flex gap-1 -mb-2">
        <Tab active={tab === 'overview'} onClick={() => setTab('overview')}>Visão Geral</Tab>
        <Tab active={tab === 'users'}    onClick={() => setTab('users')}>
          <span className="flex items-center gap-1.5"><Users size={13}/>Usuários & Acessos</span>
        </Tab>
        <Tab active={tab === 'events'}   onClick={() => setTab('events')}>
          <span className="flex items-center gap-1.5"><Clock size={13}/>Eventos</span>
        </Tab>
        <Tab active={tab === 'health'}   onClick={() => setTab('health')}>
          <span className="flex items-center gap-1.5"><Activity size={13}/>Saúde & Logs</span>
        </Tab>
      </div>

      <div className="pt-2">
        {tab === 'overview' && <TabOverview tenant={tenant} refetch={refetch} />}
        {tab === 'users'    && <TabUsers    slug={slug} />}
        {tab === 'events'   && <TabEvents   slug={slug} />}
        {tab === 'health'   && <TabHealth   slug={slug} />}
      </div>
    </div>
  )
}
