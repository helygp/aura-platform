/**
 * BackupsPage.jsx — Fase 1
 * Painel de backups por tenant.
 */
import React, { useMemo, useState } from 'react'
import {
  Database, ShieldCheck, ShieldAlert, Clock, Play, RefreshCw, Activity,
  CheckCircle2, XCircle, AlertTriangle, Calendar, History, Settings as Cog,
  PauseCircle, PlayCircle, ChevronDown, ChevronUp,
} from 'lucide-react'
import { PageSpinner } from '../components/Spinner.jsx'
import { ErrorState }  from '../components/ErrorState.jsx'
import { KpiCard }     from '../components/KpiCard.jsx'
import { api }         from '../lib/api.js'
import { fmtDate }     from '../lib/fmt.js'
import {
  useBackupsSummary,
  useBackupPolicies,
  useBackupJobs,
  useBackupHeatmap,
  useBackupSettings,
} from '../hooks/useBackups.js'

/* ─── utils ─────────────────────────────────────────────────────── */
function fmtBytes(n) {
  if (n == null) return '—'
  const u = ['B', 'KB', 'MB', 'GB']
  let v = Number(n), i = 0
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`
}

function fmtDuration(ms) {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m${Math.floor((ms % 60000) / 1000)}s`
}

function ageHours(iso) {
  if (!iso) return null
  return (Date.now() - new Date(iso).getTime()) / 3600000
}

function ageLabel(iso, alertHours = 36) {
  const h = ageHours(iso)
  if (h == null) return { text: 'nunca', tone: 'danger' }
  if (h < 1)   return { text: `${Math.round(h * 60)}min`,  tone: 'ok' }
  if (h < 24)  return { text: `${h.toFixed(1)}h`,           tone: 'ok' }
  if (h < alertHours) return { text: `${Math.floor(h)}h`,    tone: 'warn' }
  return { text: `${Math.floor(h / 24)}d`,                   tone: 'danger' }
}

const TONE = {
  ok:     'text-emerald-600 bg-emerald-50 border-emerald-200',
  warn:   'text-amber-600 bg-amber-50 border-amber-200',
  danger: 'text-rose-600 bg-rose-50 border-rose-200',
  muted:  'text-[var(--color-text-muted)] bg-[var(--color-surface)] border-[var(--color-border)]',
}

function Pill({ tone = 'muted', children }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${TONE[tone]}`}>
      {children}
    </span>
  )
}

function JobStatusBadge({ status }) {
  const map = {
    success:  { tone: 'ok',     icon: CheckCircle2, label: 'success' },
    failed:   { tone: 'danger', icon: XCircle,      label: 'failed' },
    running:  { tone: 'warn',   icon: Activity,     label: 'running' },
    queued:   { tone: 'muted',  icon: Clock,        label: 'queued' },
    expired:  { tone: 'muted',  icon: AlertTriangle, label: 'expired' },
  }
  const m = map[status] || { tone: 'muted', icon: AlertTriangle, label: status }
  const Icon = m.icon
  return (
    <Pill tone={m.tone}>
      <Icon size={11} className="mr-1" /> {m.label}
    </Pill>
  )
}

/* ─── Heatmap 30 dias ───────────────────────────────────────────── */
function Heatmap({ data }) {
  const grid = useMemo(() => {
    if (!data?.items) return { tenants: [], days: [], cells: {} }
    const days = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      days.push(d.toISOString().slice(0, 10))
    }
    const tenantsSet = new Set()
    const cells = {}
    for (const row of data.items) {
      const day = String(row.day).slice(0, 10)
      tenantsSet.add(row.slug)
      const k = `${row.slug}|${day}`
      const prev = cells[k] || { success: 0, failed: 0, running: 0 }
      prev[row.status] = (prev[row.status] || 0) + Number(row.n)
      cells[k] = prev
    }
    return { tenants: Array.from(tenantsSet).sort(), days, cells }
  }, [data])

  if (!grid.tenants.length) {
    return <div className="text-sm text-[var(--color-text-muted)] py-8 text-center">Sem dados nos últimos 30 dias.</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs">
        <thead>
          <tr>
            <th className="text-left pr-3 py-1 sticky left-0 bg-[var(--color-bg)] z-10"></th>
            {grid.days.map((d) => (
              <th key={d} className="px-0.5 py-1 text-[10px] text-[var(--color-text-muted)] font-normal" title={d}>
                {d.slice(8, 10)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.tenants.map((slug) => (
            <tr key={slug}>
              <td className="pr-3 py-0.5 text-[var(--color-text)] font-medium sticky left-0 bg-[var(--color-bg)] z-10 whitespace-nowrap">
                {slug}
              </td>
              {grid.days.map((d) => {
                const c = grid.cells[`${slug}|${d}`]
                let bg = 'bg-[var(--color-surface)]'
                let title = `${slug} · ${d} · sem job`
                if (c) {
                  if (c.failed)   { bg = 'bg-rose-500';     title = `${slug} · ${d} · ${c.failed} falha(s)` }
                  else if (c.running) { bg = 'bg-amber-400'; title = `${slug} · ${d} · em execução` }
                  else if (c.success) { bg = 'bg-emerald-500'; title = `${slug} · ${d} · ${c.success} sucesso(s)` }
                }
                return (
                  <td key={d} className="px-0.5 py-0.5">
                    <div className={`w-3.5 h-3.5 rounded-sm ${bg}`} title={title} />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ─── Page ──────────────────────────────────────────────────────── */
export function BackupsPage() {
  const summary    = useBackupsSummary()
  const policies   = useBackupPolicies()
  const jobs       = useBackupJobs(100)
  const heatmap    = useBackupHeatmap()
  const settings   = useBackupSettings()
  const [runningSlug, setRunningSlug] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory,  setShowHistory]  = useState(true)

  const refetchAll = () => {
    summary.refetch(); policies.refetch(); jobs.refetch(); heatmap.refetch()
  }

  async function handleRunNow(slug) {
    setRunningSlug(slug)
    try {
      await api.backups.runNow(slug, `manual-from-master-${Date.now()}`)
      setTimeout(refetchAll, 1200)
    } catch (e) {
      alert(`Erro ao disparar backup: ${e.message}`)
    } finally {
      setTimeout(() => setRunningSlug(null), 1500)
    }
  }

  async function handleToggleEnabled(slug, current) {
    try {
      await api.backups.updatePolicy(slug, { enabled: !current })
      policies.refetch()
    } catch (e) {
      alert(`Erro ao atualizar policy: ${e.message}`)
    }
  }

  async function handleSnapshotAll() {
    if (!confirm('Disparar snapshot de todos os tenants com pre_deploy_snapshot ativo?')) return
    try {
      const r = await api.backups.snapshotAll(`manual-snapshot-${Date.now()}`)
      alert(`Disparado para ${r.count} tenant(s).`)
      setTimeout(refetchAll, 2000)
    } catch (e) {
      alert(`Erro: ${e.message}`)
    }
  }

  async function handleTogglePaused() {
    if (!settings.data) return
    try {
      await api.backups.settings.update({ paused: !settings.data.paused })
      settings.refetch(); summary.refetch()
    } catch (e) {
      alert(`Erro: ${e.message}`)
    }
  }

  if (summary.error)  return <ErrorState message={summary.error}  onRetry={refetchAll} />

  const s = summary.data
  const workerHealthy = s?.workerHealthy === true
  const paused        = settings.data?.paused === true
  const alertHours    = settings.data?.alert_after_hours ?? 36

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Backups</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            Catálogo, agendamento e saúde dos backups por tenant.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={refetchAll}
            className="p-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface)] text-[var(--color-text-muted)]"
            title="Atualizar"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={handleTogglePaused}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors
              ${paused
                ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                : 'border-[var(--color-border)] hover:bg-[var(--color-surface)] text-[var(--color-text-muted)]'
              }`}
          >
            {paused ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
            {paused ? 'Retomar scheduler' : 'Pausar scheduler'}
          </button>
          <button
            onClick={handleSnapshotAll}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-[var(--color-border)] hover:bg-[var(--color-surface)] text-[var(--color-text)]"
          >
            <Database size={16} />
            Snapshot agora
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]"
          >
            <Cog size={16} />
            Configurações
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Worker"
          value={workerHealthy ? 'Saudável' : 'Indisponível'}
          icon={workerHealthy ? ShieldCheck : ShieldAlert}
          color={workerHealthy ? 'green' : 'red'}
        />
        <KpiCard
          label="Policies ativas"
          value={s ? `${s.policies.enabled}/${s.policies.total}` : '—'}
          sub={s?.policies.dormant ? `${s.policies.dormant} dormente(s)` : null}
          icon={Database}
        />
        <KpiCard
          label="Jobs 24h"
          value={s ? `${s.last24h.success}✓ ${s.last24h.failed}✗` : '—'}
          sub={s ? `${s.last24h.total} no total` : null}
          icon={Activity}
          color={s?.last24h.failed > 0 ? 'yellow' : 'green'}
        />
        <KpiCard
          label="Alertas"
          value={s?.policies.stale ?? '—'}
          sub={`tenants sem backup >${alertHours}h`}
          icon={AlertTriangle}
          color={(s?.policies.stale ?? 0) > 0 ? 'red' : 'green'}
        />
      </div>

      {paused && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
          <PauseCircle size={16} /> Scheduler global pausado. Backups agendados não rodam até retomar.
        </div>
      )}

      {/* Tenants & Policies */}
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] overflow-hidden">
        <header className="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
          <Database size={16} className="text-[var(--color-text-muted)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Tenants & Policies</h2>
        </header>
        {policies.loading ? <PageSpinner /> : policies.error ? (
          <ErrorState message={policies.error} onRetry={policies.refetch} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                <tr>
                  {['Tenant', 'Status', 'Backup ativo', 'Último sucesso', 'Idade', 'Pre-deploy', 'Ações'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {(policies.data?.items ?? []).map((p) => {
                  const age = ageLabel(p.last_success, alertHours)
                  return (
                    <tr key={p.tenant_id} className="hover:bg-[var(--color-bg-subtle)]">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-[var(--color-text)]">{p.slug}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Pill tone={p.status === 'ACTIVE' ? 'ok' : 'muted'}>{p.status}</Pill>
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => handleToggleEnabled(p.slug, p.enabled)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                            ${p.enabled ? 'bg-emerald-500' : 'bg-[var(--color-border)]'}`}
                          title={p.enabled ? 'Desativar' : 'Ativar'}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                            ${p.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-[var(--color-text-muted)] whitespace-nowrap">
                        {p.last_success ? fmtDate(p.last_success) : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <Pill tone={age.tone}>{age.text}</Pill>
                      </td>
                      <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                        {p.pre_deploy_snapshot ? 'sim' : 'não'}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => handleRunNow(p.slug)}
                          disabled={runningSlug === p.slug}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-[var(--color-border)] hover:bg-[var(--color-surface)] text-[var(--color-text)] disabled:opacity-50"
                        >
                          {runningSlug === p.slug
                            ? <RefreshCw size={12} className="animate-spin" />
                            : <Play size={12} />
                          }
                          Run now
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {(policies.data?.items ?? []).length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-[var(--color-text-muted)] text-sm">Nenhuma policy cadastrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Heatmap */}
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] overflow-hidden">
        <header className="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
          <Calendar size={16} className="text-[var(--color-text-muted)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Saúde (30 dias)</h2>
          <span className="ml-auto flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> sucesso</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> running</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" /> falha</span>
          </span>
        </header>
        <div className="p-4">
          {heatmap.loading ? <PageSpinner /> : <Heatmap data={heatmap.data} />}
        </div>
      </section>

      {/* Histórico */}
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] overflow-hidden">
        <header className="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
          <History size={16} className="text-[var(--color-text-muted)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Histórico (últimos 100)</h2>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="ml-auto p-1 rounded hover:bg-[var(--color-surface)] text-[var(--color-text-muted)]"
          >
            {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </header>
        {showHistory && (
          jobs.loading ? <PageSpinner /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                  <tr>
                    {['Tenant', 'Trigger', 'Status', 'Início', 'Duração', 'Tamanho', 'SHA256', 'Label'].map((h) => (
                      <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {(jobs.data?.items ?? []).map((j) => (
                    <tr key={j.id} className="hover:bg-[var(--color-bg-subtle)]">
                      <td className="px-4 py-2 font-medium text-[var(--color-text)]">{j.slug}</td>
                      <td className="px-4 py-2 text-[var(--color-text-muted)]">{j.trigger}</td>
                      <td className="px-4 py-2"><JobStatusBadge status={j.status} /></td>
                      <td className="px-4 py-2 text-[var(--color-text-muted)] whitespace-nowrap">{fmtDate(j.started_at)}</td>
                      <td className="px-4 py-2 text-[var(--color-text-muted)]">{fmtDuration(j.duration_ms)}</td>
                      <td className="px-4 py-2 text-[var(--color-text-muted)]">{fmtBytes(j.size_bytes_compressed)}</td>
                      <td className="px-4 py-2 font-mono text-[10px] text-[var(--color-text-muted)]">
                        {j.sha256 ? j.sha256.slice(0, 12) : '—'}
                      </td>
                      <td className="px-4 py-2 text-[var(--color-text-muted)] text-xs">{j.label || '—'}</td>
                    </tr>
                  ))}
                  {(jobs.data?.items ?? []).length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-[var(--color-text-muted)] text-sm">Sem jobs ainda.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )
        )}
      </section>

      {/* Settings drawer */}
      {showSettings && settings.data && (
        <SettingsModal
          settings={settings.data}
          onClose={() => setShowSettings(false)}
          onSaved={() => { settings.refetch(); summary.refetch() }}
        />
      )}
    </div>
  )
}

/* ─── Modal de Configurações ────────────────────────────────────── */
function SettingsModal({ settings, onClose, onSaved }) {
  const [form, setForm] = useState({
    default_cron:              settings.default_cron,
    default_window_start:      settings.default_window_start,
    default_window_end:        settings.default_window_end,
    default_retention_daily:   settings.default_retention_daily,
    default_retention_weekly:  settings.default_retention_weekly,
    default_retention_monthly: settings.default_retention_monthly,
    default_retention_yearly:  settings.default_retention_yearly,
    max_parallel_jobs:         settings.max_parallel_jobs,
    alert_after_hours:         settings.alert_after_hours,
  })
  const [saving, setSaving] = useState(false)

  function update(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  async function save() {
    setSaving(true)
    try {
      const numericKeys = [
        'default_retention_daily', 'default_retention_weekly',
        'default_retention_monthly', 'default_retention_yearly',
        'max_parallel_jobs', 'alert_after_hours',
      ]
      const body = { ...form }
      numericKeys.forEach((k) => { body[k] = parseInt(body[k], 10) })
      await api.backups.settings.update(body)
      onSaved()
      onClose()
    } catch (e) {
      alert(`Erro ao salvar: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[var(--color-bg)] rounded-xl border border-[var(--color-border)] shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-[var(--color-border)] flex items-center gap-2">
          <Cog size={16} />
          <h3 className="font-semibold text-[var(--color-text)]">Configurações globais</h3>
        </header>
        <div className="p-5 space-y-4">
          <Field label="Expressão cron padrão" hint="Aplicada a todos tenants sem cron próprio">
            <input
              type="text"
              value={form.default_cron}
              onChange={(e) => update('default_cron', e.target.value)}
              className="input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Janela início">
              <input type="time" value={form.default_window_start?.slice(0,5) || ''} onChange={(e) => update('default_window_start', e.target.value)} className="input" />
            </Field>
            <Field label="Janela fim">
              <input type="time" value={form.default_window_end?.slice(0,5) || ''} onChange={(e) => update('default_window_end', e.target.value)} className="input" />
            </Field>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Field label="Daily"><input type="number" min="0" value={form.default_retention_daily}   onChange={(e) => update('default_retention_daily',   e.target.value)} className="input" /></Field>
            <Field label="Weekly"><input type="number" min="0" value={form.default_retention_weekly}  onChange={(e) => update('default_retention_weekly',  e.target.value)} className="input" /></Field>
            <Field label="Monthly"><input type="number" min="0" value={form.default_retention_monthly} onChange={(e) => update('default_retention_monthly', e.target.value)} className="input" /></Field>
            <Field label="Yearly"><input type="number" min="0" value={form.default_retention_yearly}  onChange={(e) => update('default_retention_yearly',  e.target.value)} className="input" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Paralelismo máximo" hint="Quantos backups em paralelo">
              <input type="number" min="1" max="8" value={form.max_parallel_jobs} onChange={(e) => update('max_parallel_jobs', e.target.value)} className="input" />
            </Field>
            <Field label="Alerta após (horas)" hint="Considera 'stale' se backup mais velho que isso">
              <input type="number" min="1" value={form.alert_after_hours} onChange={(e) => update('alert_after_hours', e.target.value)} className="input" />
            </Field>
          </div>
        </div>
        <footer className="px-5 py-3 border-t border-[var(--color-border)] flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm border border-[var(--color-border)] hover:bg-[var(--color-surface)] text-[var(--color-text)]">Cancelar</button>
          <button onClick={save} disabled={saving} className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60">
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </footer>
      </div>
      <style>{`
        .input {
          width: 100%;
          padding: .5rem .75rem;
          border-radius: .5rem;
          border: 1px solid var(--color-border);
          background: var(--color-bg);
          color: var(--color-text);
          font-size: .875rem;
        }
        .input:focus {
          outline: none;
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-primary) 30%, transparent);
        }
      `}</style>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <label className="block text-sm">
      <span className="text-[var(--color-text)] font-medium">{label}</span>
      {hint && <span className="block text-xs text-[var(--color-text-muted)] mt-0.5">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  )
}
