'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

/* ── Types ──────────────────────────────────────────── */
type Plan = {
  id: string
  name: string
  priceSetup: number
  priceMonthly: number
  maxUsers: number | null
  maxProducts: number | null
  features: string[]
}

type FormData = {
  companyName:     string
  segment:         string
  responsibleName: string
  email:           string
  phone:           string
  planId:          string
  termsAccepted:   boolean
}

type FormErrors = Partial<Record<keyof FormData, string>>

const API_URL = 'https://api.acme.aurabr.app'

const SEGMENTS = [
  'Confecção / Moda',
  'Varejo',
  'Atacado',
  'Distribuidora',
  'Industria',
  'Serviços',
  'Outro',
]

const PLAN_LABELS: Record<string, { badge?: string; color: string }> = {
  plan_starter: { color: 'border-[var(--color-border)]' },
  plan_pro:     { badge: 'Mais popular', color: 'border-[var(--color-primary)]' },
  plan_full:    { color: 'border-purple-600/60' },
  // nomes alternativos (banco retorna lowercase)
  starter: { color: 'border-[var(--color-border)]' },
  pro:     { badge: 'Mais popular', color: 'border-[var(--color-primary)]' },
  full:    { color: 'border-purple-600/60' },
}

/* ── Component ──────────────────────────────────────── */
export default function CadastroPage() {
  const [plans, setPlans]         = useState<Plan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [step, setStep]           = useState<1 | 2 | 3>(1)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult]       = useState<{ erpUrl: string; storeUrl: string; trialDays: number } | null>(null)
  const [apiError, setApiError]   = useState<string | null>(null)
  const [errors, setErrors]       = useState<FormErrors>({})

  const [form, setForm] = useState<FormData>({
    companyName:     '',
    segment:         '',
    responsibleName: '',
    email:           '',
    phone:           '',
    planId:          '',
    termsAccepted:   false,
  })

  /* Carrega planos da API */
  useEffect(() => {
    fetch(`${API_URL}/onboarding/plans`)
      .then(r => r.json())
      .then(d => {
        setPlans(d.plans ?? [])
        // Pré-selecionar plano da query string
        const params = new URLSearchParams(window.location.search)
        const plano  = params.get('plano')
        const found  = d.plans?.find((p: Plan) =>
          p.name.toLowerCase() === plano?.toLowerCase() ||
          p.id === plano
        )
        if (found) setForm(f => ({ ...f, planId: found.id }))
      })
      .catch(() => setPlans([]))
      .finally(() => setLoadingPlans(false))
  }, [])

  function set(field: keyof FormData, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: undefined }))
    setApiError(null)
  }

  /* ── Validação por step ── */
  function validateStep1(): boolean {
    const errs: FormErrors = {}
    if (!form.companyName.trim() || form.companyName.length < 2)
      errs.companyName = 'Nome da empresa é obrigatório (mínimo 2 caracteres).'
    if (!form.responsibleName.trim() || form.responsibleName.length < 2)
      errs.responsibleName = 'Nome do responsável é obrigatório.'
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'E-mail inválido.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function validateStep2(): boolean {
    const errs: FormErrors = {}
    if (!form.planId) errs.planId = 'Selecione um plano para continuar.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function validateStep3(): boolean {
    const errs: FormErrors = {}
    if (!form.termsAccepted) errs.termsAccepted = 'Você precisa aceitar os termos para continuar.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function nextStep() {
    if (step === 1 && validateStep1()) setStep(2)
    if (step === 2 && validateStep2()) setStep(3)
  }

  async function handleSubmit() {
    if (!validateStep3()) return
    setSubmitting(true)
    setApiError(null)

    try {
      const res = await fetch(`${API_URL}/onboarding/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName:     form.companyName.trim(),
          segment:         form.segment || undefined,
          responsibleName: form.responsibleName.trim(),
          email:           form.email.trim().toLowerCase(),
          phone:           form.phone || undefined,
          planId:          form.planId,
          termsAccepted:   form.termsAccepted,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setApiError(data.error ?? 'Erro ao processar o cadastro. Tente novamente.')
        return
      }

      setResult({ erpUrl: data.erpUrl, storeUrl: data.storeUrl, trialDays: data.trialDays })
    } catch {
      setApiError('Falha na conexão. Verifique sua internet e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Tela de sucesso ── */
  if (result) {
    return <SuccessScreen result={result} email={form.email} companyName={form.companyName} />
  }

  /* ── Layout principal ── */
  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col">
      {/* Nav */}
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md gradient-brand flex items-center justify-center">
              <span className="text-white font-bold text-xs">A</span>
            </div>
            <span className="font-heading font-bold text-sm text-[var(--color-text)]">
              Aura <span className="text-[var(--color-primary)]">Platform</span>
            </span>
          </Link>
          <span className="text-xs text-[var(--color-text-muted)]">
            🔒 Cadastro seguro — 14 dias grátis
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center py-10 px-4">
        <div className="w-full max-w-2xl">
          {/* Stepper */}
          <StepIndicator current={step} />

          {/* Card */}
          <div className="glass rounded-2xl border border-[var(--color-border)] p-8 mt-6">
            {apiError && (
              <div className="mb-6 bg-[var(--color-error-bg)] border border-[var(--color-error)]/40 rounded-lg px-4 py-3 text-sm text-[var(--color-error)]">
                {apiError}
              </div>
            )}

            {step === 1 && (
              <Step1
                form={form}
                errors={errors}
                onChange={set}
                onNext={nextStep}
              />
            )}

            {step === 2 && (
              <Step2
                form={form}
                plans={plans}
                loadingPlans={loadingPlans}
                errors={errors}
                onChange={set}
                onBack={() => setStep(1)}
                onNext={nextStep}
              />
            )}

            {step === 3 && (
              <Step3
                form={form}
                plans={plans}
                errors={errors}
                submitting={submitting}
                onChange={set}
                onBack={() => setStep(2)}
                onSubmit={handleSubmit}
              />
            )}
          </div>

          <p className="text-center text-xs text-[var(--color-text-muted)] mt-4">
            Já tem conta?{' '}
            <a href="https://acme.aurabr.app" className="text-[var(--color-primary)] hover:underline">
              Fazer login
            </a>
          </p>
        </div>
      </main>
    </div>
  )
}

/* ── Step Indicator ─────────────────────────────────── */
function StepIndicator({ current }: { current: number }) {
  const steps = ['Seus dados', 'Escolha o plano', 'Confirmação']
  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((label, i) => {
        const n     = i + 1
        const done  = n < current
        const active = n === current
        return (
          <div key={n} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                done   ? 'bg-[var(--color-success)] text-[var(--color-success-fg)]' :
                active ? 'gradient-cta text-white' :
                         'bg-[var(--color-surface)] text-[var(--color-text-muted)]'
              }`}>
                {done ? '✓' : n}
              </div>
              <span className={`text-xs mt-1 ${active ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-px w-16 sm:w-24 mx-2 mb-4 transition-all ${
                done ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border)]'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Step 1 — Dados pessoais ────────────────────────── */
function Step1({ form, errors, onChange, onNext }: {
  form: FormData
  errors: FormErrors
  onChange: (k: keyof FormData, v: string | boolean) => void
  onNext: () => void
}) {
  return (
    <div>
      <h2 className="font-heading font-bold text-xl text-[var(--color-text)] mb-1">Conta a gente sobre você</h2>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">Vamos configurar sua conta. Leva menos de 2 minutos.</p>

      <div className="space-y-4">
        <Field label="Nome da empresa *" error={errors.companyName}>
          <input
            type="text" placeholder="Ex: Confecções Silva"
            value={form.companyName}
            onChange={e => onChange('companyName', e.target.value)}
            className={inputCls(!!errors.companyName)}
          />
        </Field>

        <Field label="Segmento" error={errors.segment}>
          <select
            value={form.segment}
            onChange={e => onChange('segment', e.target.value)}
            className={inputCls(false)}>
            <option value="">Selecione (opcional)</option>
            {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>

        <Field label="Seu nome *" error={errors.responsibleName}>
          <input
            type="text" placeholder="Nome completo"
            value={form.responsibleName}
            onChange={e => onChange('responsibleName', e.target.value)}
            className={inputCls(!!errors.responsibleName)}
          />
        </Field>

        <Field label="E-mail profissional *" error={errors.email}>
          <input
            type="email" placeholder="voce@suaempresa.com.br"
            value={form.email}
            onChange={e => onChange('email', e.target.value)}
            className={inputCls(!!errors.email)}
          />
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Será o login de admin da sua conta.
          </p>
        </Field>

        <Field label="WhatsApp" error={errors.phone}>
          <input
            type="tel" placeholder="+55 11 99999-9999"
            value={form.phone}
            onChange={e => onChange('phone', e.target.value.replace(/[^\d+]/g, ''))}
            className={inputCls(false)}
          />
        </Field>
      </div>

      <button onClick={onNext}
              className="mt-8 w-full gradient-cta text-white font-bold py-3.5 rounded-lg hover:opacity-90 transition-all">
        Continuar →
      </button>
    </div>
  )
}

/* ── Step 2 — Plano ─────────────────────────────────── */
function Step2({ form, plans, loadingPlans, errors, onChange, onBack, onNext }: {
  form: FormData
  plans: Plan[]
  loadingPlans: boolean
  errors: FormErrors
  onChange: (k: keyof FormData, v: string | boolean) => void
  onBack: () => void
  onNext: () => void
}) {
  const fmtPrice = (v: number) => `R$ ${Number(v).toFixed(0)}`

  return (
    <div>
      <h2 className="font-heading font-bold text-xl text-[var(--color-text)] mb-1">Escolha seu plano</h2>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">
        Todos com trial de 14 dias grátis. Cancele quando quiser.
      </p>

      {errors.planId && (
        <p className="text-sm text-[var(--color-error)] mb-4">{errors.planId}</p>
      )}

      {loadingPlans ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-24 rounded-xl bg-[var(--color-surface)] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => {
            const meta    = PLAN_LABELS[plan.id] ?? { color: 'border-[var(--color-border)]' }
            const selected = form.planId === plan.id
            return (
              <button
                key={plan.id}
                onClick={() => onChange('planId', plan.id)}
                className={`w-full text-left rounded-xl border-2 p-4 transition-all relative ${
                  selected
                    ? `${meta.color} bg-[var(--color-primary)]/10`
                    : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]'
                }`}>
                {meta.badge && (
                  <span className="absolute top-3 right-3 gradient-cta text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {meta.badge}
                  </span>
                )}
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    selected ? 'border-[var(--color-primary)] bg-[var(--color-primary)]' : 'border-[var(--color-border)]'
                  }`}>
                    {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between">
                      <span className="font-bold text-[var(--color-text)]">{plan.name}</span>
                      <span className="text-[var(--color-text-muted)] text-sm">
                        {fmtPrice(plan.priceMonthly)}<span className="text-xs">/mês</span>
                      </span>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      Setup {fmtPrice(plan.priceSetup)} •{' '}
                      {plan.maxUsers ? `${plan.maxUsers} usuários` : 'Usuários ilimitados'} •{' '}
                      {plan.maxProducts ? `${plan.maxProducts} produtos` : 'Produtos ilimitados'}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex gap-3 mt-8">
        <button onClick={onBack}
                className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] font-semibold py-3 rounded-lg hover:bg-[var(--color-surface-hover)] transition-all">
          ← Voltar
        </button>
        <button onClick={onNext}
                className="flex-2 flex-grow gradient-cta text-white font-bold py-3 rounded-lg hover:opacity-90 transition-all">
          Continuar →
        </button>
      </div>
    </div>
  )
}

/* ── Step 3 — Confirmação ───────────────────────────── */
function Step3({ form, plans, errors, submitting, onChange, onBack, onSubmit }: {
  form: FormData
  plans: Plan[]
  errors: FormErrors
  submitting: boolean
  onChange: (k: keyof FormData, v: string | boolean) => void
  onBack: () => void
  onSubmit: () => void
}) {
  const plan = plans.find(p => p.id === form.planId)

  return (
    <div>
      <h2 className="font-heading font-bold text-xl text-[var(--color-text)] mb-1">Confirme seu cadastro</h2>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">Revise os dados antes de criar sua conta.</p>

      {/* Resumo */}
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)] mb-6">
        {[
          { label: 'Empresa',     value: form.companyName },
          { label: 'Responsável', value: form.responsibleName },
          { label: 'E-mail',      value: form.email },
          { label: 'Segmento',    value: form.segment || '—' },
          { label: 'Plano',       value: plan ? `${plan.name} — R$ ${Number(plan.priceMonthly).toFixed(0)}/mês` : '—' },
          { label: 'Trial',       value: '14 dias grátis, sem cartão' },
        ].map(row => (
          <div key={row.label} className="flex justify-between px-4 py-2.5 text-sm">
            <span className="text-[var(--color-text-muted)]">{row.label}</span>
            <span className="text-[var(--color-text)] font-medium text-right max-w-[60%]">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Aceite de termos */}
      <label className={`flex items-start gap-3 cursor-pointer rounded-lg p-3 border transition-all ${
        errors.termsAccepted
          ? 'border-[var(--color-error)] bg-[var(--color-error-bg)]/30'
          : 'border-[var(--color-border)]'
      }`}>
        <input
          type="checkbox"
          checked={form.termsAccepted}
          onChange={e => onChange('termsAccepted', e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-[var(--color-primary)] shrink-0"
        />
        <span className="text-sm text-[var(--color-text-muted)] leading-relaxed">
          Li e concordo com os{' '}
          <a href="/termos" target="_blank" className="text-[var(--color-primary)] hover:underline">
            Termos de Uso
          </a>{' '}
          e a{' '}
          <a href="/privacidade" target="_blank" className="text-[var(--color-primary)] hover:underline">
            Política de Privacidade
          </a>{' '}
          da Aura Platform. Entendo que terei 14 dias de trial gratuito sem cobrança.
        </span>
      </label>
      {errors.termsAccepted && (
        <p className="text-xs text-[var(--color-error)] mt-1 ml-1">{errors.termsAccepted}</p>
      )}

      <div className="flex gap-3 mt-6">
        <button onClick={onBack} disabled={submitting}
                className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] font-semibold py-3 rounded-lg hover:bg-[var(--color-surface-hover)] transition-all disabled:opacity-50">
          ← Voltar
        </button>
        <button onClick={onSubmit} disabled={submitting}
                className="flex-grow gradient-cta text-white font-bold py-3 rounded-lg hover:opacity-90 transition-all disabled:opacity-70 flex items-center justify-center gap-2">
          {submitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Criando sua conta…
            </>
          ) : '🚀 Criar minha conta grátis'}
        </button>
      </div>
    </div>
  )
}

/* ── Success Screen ─────────────────────────────────── */
function SuccessScreen({ result, email, companyName }: {
  result: { erpUrl: string; storeUrl: string; trialDays: number }
  email: string
  companyName: string
}) {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-[var(--color-success-bg)] flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="font-heading text-3xl font-bold text-[var(--color-text)] mb-3">
          🎉 Conta criada!
        </h1>
        <p className="text-[var(--color-text-muted)] mb-8">
          Estamos provisionando seu ambiente. Você receberá um e-mail em{' '}
          <strong className="text-[var(--color-text)]">{email}</strong>{' '}
          com suas credenciais de acesso em instantes.
        </p>

        {/* Links */}
        <div className="glass rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)] mb-8 text-left">
          <div className="px-5 py-4">
            <div className="text-xs text-[var(--color-text-muted)] mb-1">🖥️ ERP — Gestão interna</div>
            <a href={result.erpUrl} target="_blank" rel="noopener noreferrer"
               className="text-sm text-[var(--color-primary)] hover:underline font-medium break-all">
              {result.erpUrl}
            </a>
          </div>
          <div className="px-5 py-4">
            <div className="text-xs text-[var(--color-text-muted)] mb-1">🛒 Loja B2B — Seus clientes</div>
            <a href={result.storeUrl} target="_blank" rel="noopener noreferrer"
               className="text-sm text-[var(--color-primary)] hover:underline font-medium break-all">
              {result.storeUrl}
            </a>
          </div>
        </div>

        <div className="bg-[var(--color-warning-bg)]/30 border border-[var(--color-warning)]/30 rounded-lg px-4 py-3 text-sm text-[var(--color-warning)] mb-8">
          ⚠️ O ambiente pode levar até 5 minutos para ficar totalmente disponível.
          Se ainda não abrir, aguarde e tente novamente.
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href={result.erpUrl} target="_blank" rel="noopener noreferrer"
             className="gradient-cta text-white font-bold px-6 py-3 rounded-lg hover:opacity-90 transition-all">
            Acessar o ERP →
          </a>
          <Link href="/"
                className="bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] font-semibold px-6 py-3 rounded-lg hover:bg-[var(--color-surface-hover)] transition-all">
            Voltar ao site
          </Link>
        </div>
      </div>
    </div>
  )
}

/* ── Helpers UI ─────────────────────────────────────── */
function inputCls(hasError: boolean) {
  return `w-full bg-[var(--color-surface)] border rounded-lg px-3.5 py-2.5 text-sm text-[var(--color-text)] outline-none transition-all
    placeholder:text-[var(--color-text-muted)]
    focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]
    ${hasError ? 'border-[var(--color-error)]' : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]'}`
}

function Field({ label, error, children }: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-[var(--color-error)] mt-1">{error}</p>}
    </div>
  )
}
