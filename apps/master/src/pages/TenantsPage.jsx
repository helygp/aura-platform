/**
 * Lista de Tenants com filtros, paginação e ações rápidas
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, RefreshCw, ExternalLink } from 'lucide-react'
import { StatusBadge }  from '../components/StatusBadge.jsx'
import { PageSpinner }  from '../components/Spinner.jsx'
import { ErrorState }   from '../components/ErrorState.jsx'
import { fmtDate, fmtBRL } from '../lib/fmt.js'
import { useTenants }   from '../hooks/useTenants.js'

const STATUS_OPTS = [
  { value: '', label: 'Todos' },
  { value: 'TRIAL',     label: 'Trial' },
  { value: 'ACTIVE',    label: 'Ativo' },
  { value: 'SUSPENDED', label: 'Suspenso' },
  { value: 'CANCELLED', label: 'Cancelado' },
]

export function TenantsPage() {
  const navigate = useNavigate()
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState('')
  const [page,   setPage]     = useState(1)

  const params = {}
  if (search) params.search = search
  if (status) params.status = status
  params.page  = page
  params.limit = 20

  const { data, loading, error, refetch } = useTenants(params)

  if (error) return <ErrorState message={error} onRetry={refetch} />

  const tenants = data?.data ?? []
  const meta    = data?.meta ?? {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Tenants</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {meta.total !== undefined ? `${meta.total} tenants cadastrados` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refetch}
            className="p-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface)] text-[var(--color-text-muted)] transition-colors"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => navigate('/tenants/new')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            <Plus size={16} />
            Novo Tenant
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Buscar por nome ou slug..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
          />
        </div>
        <div className="flex gap-2">
          {STATUS_OPTS.map(o => (
            <button
              key={o.value}
              onClick={() => { setStatus(o.value); setPage(1) }}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                ${status === o.value
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]'
                }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      {loading ? <PageSpinner /> : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                <tr>
                  {['Tenant', 'Status', 'Plano', 'Usuários', 'Último Billing', 'Criado em', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {tenants.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-[var(--color-text-muted)] text-sm">
                      Nenhum tenant encontrado.
                    </td>
                  </tr>
                ) : tenants.map(t => (
                  <tr
                    key={t.id}
                    className="hover:bg-[var(--color-bg-subtle)] transition-colors cursor-pointer"
                    onClick={() => navigate(`/tenants/${t.slug}`)}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-[var(--color-text)]">{t.name}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">{t.slug}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{t.plan?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)] text-center">{t.users}</td>
                    <td className="px-4 py-3">
                      {t.lastBilling ? (
                        <div>
                          <span className="text-[var(--color-text)]">{fmtBRL(t.lastBilling.amount)}</span>
                          <span className="ml-2"><StatusBadge status={t.lastBilling.status} /></span>
                        </div>
                      ) : <span className="text-[var(--color-text-muted)]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap">{fmtDate(t.createdAt)}</td>
                    <td className="px-4 py-3">
                      <ExternalLink size={14} className="text-[var(--color-text-muted)]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {meta.pages > 1 && (
            <div className="px-4 py-3 border-t border-[var(--color-border)] flex items-center justify-between text-sm text-[var(--color-text-muted)]">
              <span>Página {meta.page} de {meta.pages}</span>
              <div className="flex gap-2">
                <button
                  disabled={meta.page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-surface)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <button
                  disabled={meta.page >= meta.pages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-surface)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
