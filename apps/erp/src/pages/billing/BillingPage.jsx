/**
 * pages/billing/BillingPage.jsx
 *
 * Portal de billing self-service — visível apenas para ADMIN.
 *
 * Seções:
 *   1. Status da assinatura (plano, status, próxima cobrança, trial)
 *   2. Histórico de faturas (últimas 12)
 *   3. Upgrade / Downgrade de plano
 *   4. Cancelamento de assinatura
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  CreditCard, Calendar, AlertTriangle, CheckCircle,
  Clock, TrendingUp, TrendingDown, XCircle, RefreshCw,
  ExternalLink, ChevronRight, Info, Zap,
} from 'lucide-react'
import { useAuth }        from '../../auth/AuthContext.jsx'
import {
  apiBillingInfo, apiChangePlan,
  apiCancelSubscription, apiListPlans,
} from '../../auth/api.js'

/* ── Helpers ──────────────────────────────────────────────── */

function fmtBRL(v) {
  if (v == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
}

function fmtDate(v) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtPeriod(v) {
  if (!v) return '—'
  const [y, m] = v.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/* ── Status badge ─────────────────────────────────────────── */

function StatusBadge({ status, billingStatus }) {
  const map = {
    ACTIVE:    { label: 'Ativo',       color: 'bg-green-500/15 text-green-400 border-green-500/30' },
    TRIAL:     { label: 'Trial',       color: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
    SUSPENDED: { label: 'Suspenso',    color: 'bg-red-500/15 text-red-400 border-red-500/30' },
    CANCELLED: { label: 'Cancelado',   color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
    OVERDUE:   { label: 'Inadimplente',color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  }
  const cfg = map[status] ?? map.SUSPENDED
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.color}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {cfg.label}
    </span>
  )
}

/* ── Billing status badge ─────────────────────────────────── */

function BillingStatusBadge({ status }) {
  const map = {
    PAID:    { label: 'Pago',      icon: CheckCircle, color: 'text-green-400' },
    PENDING: { label: 'Pendente',  icon: Clock,       color: 'text-yellow-400' },
    OVERDUE: { label: 'Vencido',   icon: AlertTriangle, color: 'text-red-400' },
    FAILED:  { label: 'Falhou',    icon: XCircle,     color: 'text-red-400' },
  }
  const cfg = map[status] ?? { label: status, icon: Info, color: 'text-zinc-400' }
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  )
}

/* ── Main ─────────────────────────────────────────────────── */

export function BillingPage() {
  const { user } = useAuth()

  const [billing, setBilling]     = useState(null)
  const [plans, setPlans]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [cancelOpen, setCancelOpen]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [billingData, plansData] = await Promise.all([
        apiBillingInfo(),
        apiListPlans(),
      ])
      setBilling(billingData)
      setPlans(plansData.plans ?? [])
    } catch (err) {
      setError(err.message ?? 'Erro ao carregar dados de billing.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingSkeleton />

  if (error) return (
    <div className="p-6">
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={load} className="mt-3 text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 mx-auto">
          <RefreshCw className="w-3 h-3" /> Tentar novamente
        </button>
      </div>
    </div>
  )

  const { plan, subscription, history } = billing
  const trialDays = daysUntil(subscription.trialEndsAt)
  const isTrial   = subscription.status === 'TRIAL'
  const isActive  = subscription.status === 'ACTIVE'
  const currentPlanId = plan?.id

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">Assinatura & Billing</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            Gerencie seu plano, faturas e forma de pagamento
          </p>
        </div>
        <button onClick={load}
                className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── Banner trial ── */}
      {isTrial && trialDays !== null && (
        <div className={`rounded-xl border p-4 flex items-start gap-3 ${
          trialDays <= 3
            ? 'bg-orange-500/10 border-orange-500/30'
            : 'bg-sky-500/10 border-sky-500/30'
        }`}>
          <Zap className={`w-5 h-5 mt-0.5 shrink-0 ${trialDays <= 3 ? 'text-orange-400' : 'text-sky-400'}`} />
          <div>
            <p className={`font-semibold text-sm ${trialDays <= 3 ? 'text-orange-300' : 'text-sky-300'}`}>
              {trialDays > 0
                ? `Trial gratuito — ${trialDays} dia${trialDays !== 1 ? 's' : ''} restante${trialDays !== 1 ? 's' : ''}`
                : 'Trial encerrado'}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Expira em {fmtDate(subscription.trialEndsAt)}.{' '}
              {trialDays <= 3 && (
                <button onClick={() => setUpgradeOpen(true)} className="text-sky-400 hover:underline">
                  Assine agora para não perder o acesso.
                </button>
              )}
            </p>
          </div>
        </div>
      )}

      {/* ── Cartão de status ── */}
      <div className="grid sm:grid-cols-2 gap-4">

        {/* Plano atual */}
        <Card className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)]/15 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-[var(--color-primary)]" />
              </div>
              <span className="text-sm font-medium text-[var(--color-text-muted)]">Plano atual</span>
            </div>
            <StatusBadge status={subscription.status} />
          </div>
          <p className="text-2xl font-bold text-[var(--color-text)] capitalize">{plan?.name ?? '—'}</p>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            {fmtBRL(plan?.priceMonthly)}<span className="text-xs">/mês</span>
          </p>
          <div className="mt-4 pt-4 border-t border-[var(--color-border)] grid grid-cols-2 gap-3 text-xs text-[var(--color-text-muted)]">
            <div>
              <p className="font-medium text-[var(--color-text)]">
                {plan?.maxUsers === -1 ? 'Ilimitado' : plan?.maxUsers ?? '—'}
              </p>
              <p>usuários</p>
            </div>
            <div>
              <p className="font-medium text-[var(--color-text)]">
                {plan?.maxProducts === -1 ? 'Ilimitado' : plan?.maxProducts?.toLocaleString('pt-BR') ?? '—'}
              </p>
              <p>produtos</p>
            </div>
          </div>
        </Card>

        {/* Próxima cobrança */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-lg bg-purple-500/15 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-purple-400" />
            </div>
            <span className="text-sm font-medium text-[var(--color-text-muted)]">Próxima cobrança</span>
          </div>

          {subscription.nextBillingDate ? (
            <>
              <p className="text-2xl font-bold text-[var(--color-text)]">
                {fmtDate(subscription.nextBillingDate)}
              </p>
              <p className="text-[var(--color-text-muted)] text-sm mt-1">{fmtBRL(plan?.priceMonthly)}</p>
            </>
          ) : isTrial ? (
            <>
              <p className="text-lg font-bold text-sky-400">Em trial</p>
              <p className="text-[var(--color-text-muted)] text-sm mt-1">
                Primeira cobrança em {fmtDate(subscription.trialEndsAt)}
              </p>
            </>
          ) : (
            <p className="text-[var(--color-text-muted)] text-sm">Sem cobrança agendada</p>
          )}

          {subscription.pagarmeSubscriptionId && (
            <a href={subscription.pagarmePortalUrl ?? '#'}
               target="_blank" rel="noopener noreferrer"
               className="mt-4 flex items-center gap-1.5 text-xs text-[var(--color-primary)] hover:underline">
              <ExternalLink className="w-3.5 h-3.5" />
              Atualizar dados de pagamento
            </a>
          )}
        </Card>
      </div>

      {/* ── Ações ── */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4">Ações</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setUpgradeOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-all">
            <TrendingUp className="w-4 h-4" />
            Mudar plano
          </button>
          <button
            onClick={() => setCancelOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] text-sm font-medium hover:border-red-500/40 hover:text-red-400 transition-all">
            <XCircle className="w-4 h-4" />
            Cancelar assinatura
          </button>
        </div>
      </Card>

      {/* ── Histórico de faturas ── */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Histórico de faturas</h2>
        </div>
        {history.length === 0 ? (
          <div className="px-5 py-10 text-center text-[var(--color-text-muted)] text-sm">
            Nenhuma fatura ainda — o histórico aparecerá após o trial.
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {history.map(item => (
              <div key={item.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-[var(--color-surface-hover)] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex w-8 h-8 rounded-lg bg-[var(--color-surface)] items-center justify-center">
                    <CreditCard className="w-4 h-4 text-[var(--color-text-muted)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)] capitalize">{fmtPeriod(item.period)}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {item.type === 'SETUP' ? 'Taxa de setup' : 'Mensalidade'}
                      {item.paidAt && ` · Pago em ${fmtDate(item.paidAt)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <BillingStatusBadge status={item.status} />
                  <span className="text-sm font-semibold text-[var(--color-text)] tabular-nums">
                    {fmtBRL(item.amount)}
                  </span>
                  {item.invoiceRef && (
                    <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Modal upgrade/downgrade ── */}
      {upgradeOpen && (
        <ChangePlanModal
          currentPlanId={currentPlanId}
          plans={plans}
          onClose={() => setUpgradeOpen(false)}
          onSuccess={() => { setUpgradeOpen(false); load() }}
        />
      )}

      {/* ── Modal cancelamento ── */}
      {cancelOpen && (
        <CancelModal
          planName={plan?.name}
          onClose={() => setCancelOpen(false)}
          onSuccess={() => { setCancelOpen(false); load() }}
        />
      )}
    </div>
  )
}

/* ── Modal: mudar plano ────────────────���──────────────────── */

function ChangePlanModal({ currentPlanId, plans, onClose, onSuccess }) {
  const [selected, setSelected]   = useState(currentPlanId)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)

  const current = plans.find(p => p.id === currentPlanId)
  const target  = plans.find(p => p.id === selected)
  const direction = target && current
    ? parseFloat(target.priceMonthly) > parseFloat(current.priceMonthly)
      ? 'upgrade' : parseFloat(target.priceMonthly) < parseFloat(current.priceMonthly)
      ? 'downgrade' : 'same'
    : 'same'

  async function handleConfirm() {
    if (selected === currentPlanId) return onClose()
    setLoading(true)
    setError(null)
    try {
      await apiChangePlan(selected)
      onSuccess()
    } catch (err) {
      setError(err.message ?? 'Erro ao mudar plano.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal onClose={onClose} title="Mudar de plano">
      <p className="text-sm text-[var(--color-text-muted)] mb-5">
        Escolha o novo plano. A mudança é aplicada imediatamente.
      </p>

      <div className="space-y-3 mb-6">
        {plans.map(plan => {
          const isCurrent = plan.id === currentPlanId
          const isSelected = plan.id === selected
          return (
            <button
              key={plan.id}
              onClick={() => setSelected(plan.id)}
              className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                isSelected
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                  : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]'
              }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]'
                      : 'border-[var(--color-border)]'
                  }`}>
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <span className="font-semibold text-sm text-[var(--color-text)] capitalize">{plan.name}</span>
                    {isCurrent && (
                      <span className="ml-2 text-xs bg-[var(--color-surface)] text-[var(--color-text-muted)] px-2 py-0.5 rounded-full">
                        atual
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-sm font-bold text-[var(--color-text)]">
                  {fmtBRL(plan.priceMonthly)}<span className="text-xs font-normal text-[var(--color-text-muted)]">/mês</span>
                </span>
              </div>
              <div className="ml-7 mt-1.5 text-xs text-[var(--color-text-muted)]">
                {plan.maxUsers === -1 ? 'Usuários ilimitados' : `${plan.maxUsers} usuários`}
                {' · '}
                {plan.maxProducts === -1 ? 'Produtos ilimitados' : `${Number(plan.maxProducts).toLocaleString('pt-BR')} produtos`}
              </div>
            </button>
          )
        })}
      </div>

      {direction !== 'same' && selected !== currentPlanId && (
        <div className={`rounded-lg p-3 mb-4 flex items-start gap-2 text-sm ${
          direction === 'upgrade'
            ? 'bg-green-500/10 border border-green-500/20 text-green-400'
            : 'bg-orange-500/10 border border-orange-500/20 text-orange-400'
        }`}>
          {direction === 'upgrade' ? <TrendingUp className="w-4 h-4 shrink-0 mt-0.5" /> : <TrendingDown className="w-4 h-4 shrink-0 mt-0.5" />}
          <span>
            {direction === 'upgrade'
              ? `Upgrade para ${target?.name} — mais usuários, mais produtos e mais automações.`
              : `Downgrade para ${target?.name} — os limites do novo plano serão aplicados imediatamente.`}
          </span>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onClose} disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] text-sm font-medium hover:bg-[var(--color-surface-hover)] transition-all disabled:opacity-50">
          Cancelar
        </button>
        <button onClick={handleConfirm} disabled={loading || selected === currentPlanId}
                className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Salvando…</> : 'Confirmar mudança'}
        </button>
      </div>
    </Modal>
  )
}

/* ── Modal: cancelar ──────────────────────────────────────── */

function CancelModal({ planName, onClose, onSuccess }) {
  const [step, setStep]     = useState(1) // 1=aviso, 2=confirmação
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)
  const [confirm, setConfirm] = useState('')

  async function handleCancel() {
    setLoading(true)
    setError(null)
    try {
      await apiCancelSubscription()
      onSuccess()
    } catch (err) {
      setError(err.message ?? 'Erro ao cancelar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal onClose={onClose} title="Cancelar assinatura">
      {step === 1 ? (
        <>
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="font-semibold text-red-400 text-sm">Antes de cancelar</span>
            </div>
            <ul className="space-y-2 text-sm text-[var(--color-text-muted)]">
              {[
                'Seu ERP e loja B2B ficarão inacessíveis imediatamente.',
                'Seus dados ficam disponíveis para exportação por 30 dias.',
                'A assinatura não será mais cobrada após o cancelamento.',
                'Você pode reativar criando uma nova conta.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-all">
              Manter assinatura
            </button>
            <button onClick={() => setStep(2)}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-red-500/40 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-all">
              Continuar cancelamento
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-[var(--color-text-muted)] mb-4">
            Digite <strong className="text-[var(--color-text)]">CANCELAR</strong> para confirmar o encerramento
            do plano <span className="capitalize font-medium text-[var(--color-text)]">{planName}</span>.
          </p>
          <input
            type="text"
            placeholder="Digite CANCELAR"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3.5 py-2.5 text-sm text-[var(--color-text)] mb-4 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
          />
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-sm text-red-400">
              {error}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} disabled={loading}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] text-sm font-medium hover:bg-[var(--color-surface-hover)] transition-all disabled:opacity-50">
              Voltar
            </button>
            <button
              onClick={handleCancel}
              disabled={confirm !== 'CANCELAR' || loading}
              className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Cancelando…</> : 'Cancelar definitivamente'}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

/* ── Modal base ───────────────────────────────────────────── */

function Modal({ children, title, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[var(--color-bg-subtle)] border border-[var(--color-border)] rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h3 className="font-semibold text-[var(--color-text)]">{title}</h3>
          <button onClick={onClose}
                  className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  )
}

/* ── Loading skeleton ─────────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 animate-pulse">
      <div className="h-7 w-48 bg-[var(--color-surface)] rounded-lg" />
      <div className="grid sm:grid-cols-2 gap-4">
        {[0,1].map(i => (
          <div key={i} className="bg-[var(--color-surface)] rounded-xl h-40 border border-[var(--color-border)]" />
        ))}
      </div>
      <div className="bg-[var(--color-surface)] rounded-xl h-20 border border-[var(--color-border)]" />
      <div className="bg-[var(--color-surface)] rounded-xl h-48 border border-[var(--color-border)]" />
    </div>
  )
}
