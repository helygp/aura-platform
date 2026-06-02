/**
 * Detalhe do tenant: dados, métricas de uso, histórico billing, ações
 */
import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Globe, Database, Users, Calendar,
  Play, Pause, XCircle, RefreshCw, ExternalLink,
} from 'lucide-react'
import { StatusBadge }  from '../components/StatusBadge.jsx'
import { PageSpinner }  from '../components/Spinner.jsx'
import { ErrorState }   from '../components/ErrorState.jsx'
import { fmtDate, fmtBRL, fmtPeriod } from '../lib/fmt.js'
import { useTenant }    from '../hooks/useTenants.js'
import { api }          from '../lib/api.js'

const DOMAIN = import.meta.env.VITE_DOMAIN ?? 'aurabr.app'

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-[var(--color-border)] last:border-0">
      <span className="text-sm text-[var(--color-text-muted)] shrink-0 w-40">{label}</span>
      <span className="text-sm text-[var(--color-text)] text-right">{value ?? '—'}</span>
    </div>
  )
}

export function TenantDetailPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { data: tenant, loading, error, refetch } = useTenant(slug)
  const [action, setAction] = useState(null) // loading state do botão

  if (loading) return <PageSpinner />
  if (error)   return <ErrorState message={error} onRetry={refetch} />
  if (!tenant) return null

  async function changeStatus(status) {
    const reason = window.prompt(`Motivo para ${status} (opcional):`) ?? undefined
    setAction(status)
    try {
      await api.tenants.status(slug, status, reason)
      refetch()
    } catch (e) {
      alert(e.message)
    } finally {
      setAction(null)
    }
  }

  const canActivate  = ['TRIAL', 'SUSPENDED'].includes(tenant.status)
  const canSuspend   = ['TRIAL', 'ACTIVE'].includes(tenant.status)
  const canCancel    = tenant.status !== 'CANCELLED'

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/tenants')}
          className="p-2 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-muted)] transition-colors"
        >
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

      <div className="grid md:grid-cols-3 gap-6">
        {/* Info */}
        <div className="md:col-span-2 space-y-6">
          {/* Dados do tenant */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
            <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4">Informações</h2>
            <InfoRow label="Slug"        value={tenant.slug} />
            <InfoRow label="Plano"       value={tenant.plan?.name} />
            <InfoRow label="Banco"       value={tenant.dbName} />
            <InfoRow label="Criado em"   value={fmtDate(tenant.createdAt)} />
            <InfoRow label="Atualizado"  value={fmtDate(tenant.updatedAt)} />
            <InfoRow label="Usuários"    value={tenant.users} />
          </div>

          {/* Links */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
            <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4">Acessos</h2>
            <div className="space-y-2">
              {[
                { label: 'ERP',       url: `https://${tenant.slug}.${DOMAIN}` },
                { label: 'Loja B2B',  url: `https://loja.${tenant.slug}.${DOMAIN}` },
                { label: 'API',       url: `https://api.${tenant.slug}.${DOMAIN}` },
              ].map(({ label, url }) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-border)] transition-colors group"
                >
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

          {/* Histórico billing */}
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

        {/* Ações */}
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
            <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4">Ações</h2>
            <div className="space-y-2">
              {canActivate && (
                <button
                  disabled={!!action}
                  onClick={() => changeStatus('ACTIVE')}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-60"
                >
                  <Play size={14} />
                  {action === 'ACTIVE' ? 'Ativando...' : 'Ativar tenant'}
                </button>
              )}
              {canSuspend && (
                <button
                  disabled={!!action}
                  onClick={() => changeStatus('SUSPENDED')}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg bg-yellow-500 text-white text-sm font-medium hover:bg-yellow-600 transition-colors disabled:opacity-60"
                >
                  <Pause size={14} />
                  {action === 'SUSPENDED' ? 'Suspendendo...' : 'Suspender'}
                </button>
              )}
              {canCancel && (
                <button
                  disabled={!!action}
                  onClick={() => {
                    if (confirm(`Cancelar ${tenant.name}? Esta ação não pode ser desfeita.`))
                      changeStatus('CANCELLED')
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-60"
                >
                  <XCircle size={14} />
                  {action === 'CANCELLED' ? 'Cancelando...' : 'Cancelar tenant'}
                </button>
              )}
            </div>
          </div>

          {/* Plano */}
          {tenant.plan && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
              <h2 className="text-sm font-semibold text-[var(--color-text)] mb-3">Plano Atual</h2>
              <p className="text-lg font-bold text-[var(--color-primary)] capitalize">{tenant.plan.name}</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                {fmtBRL(tenant.plan.priceMonthly)}/mês
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
