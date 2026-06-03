/**
 * OnboardingPage — formulário público de cadastro
 *
 * Rota pública: /cadastro (sem autenticação master)
 * Chama POST /master/tenants com VITE_MASTER_SECRET (build-time)
 *
 * Campos:
 *   Empresa: nome, segmento, slug (auto)
 *   Responsável: nome, e-mail, telefone, senha
 *   Plano: starter / pro / full
 */
import React, { useState } from 'react'
import { Check, AlertCircle, ChevronRight, Zap } from 'lucide-react'
import { api } from '../lib/api.js'

const PLANOS = [
  {
    id:    'plan_starter',
    nome:  'Starter',
    preco: 'R$297/mês',
    desc:  'Até 5 usuários · 500 produtos · 500 MCP/mês',
    color: 'border-blue-200 hover:border-blue-400',
    badge: '',
  },
  {
    id:    'plan_pro',
    nome:  'Pro',
    preco: 'R$597/mês',
    desc:  'Até 15 usuários · 5.000 produtos · 2.000 MCP/mês',
    color: 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20',
    badge: 'Mais popular',
  },
  {
    id:    'plan_full',
    nome:  'Full',
    preco: 'R$1.497/mês',
    desc:  'Usuários ilimitados · produtos ilimitados · 10.000 MCP/mês',
    color: 'border-purple-300 hover:border-purple-500',
    badge: '',
  },
]

const SEGMENTOS = [
  'Distribuição', 'Atacado', 'Indústria', 'Importação',
  'Alimentos e Bebidas', 'Moda e Vestuário', 'Tecnologia',
  'Construção Civil', 'Saúde e Beleza', 'Outro',
]

function Field({ label, error, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{label}</label>
      {children}
      {hint  && !error && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

const inputCls = `
  w-full px-3 py-2.5 text-sm rounded-lg border border-[var(--color-border)]
  bg-[var(--color-bg)] text-[var(--color-text)]
  focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40
  placeholder:text-[var(--color-text-disabled)]
`

function autoSlug(name) {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

export function OnboardingPage() {
  const [step, setStep]     = useState(1) // 1=empresa 2=responsável 3=plano
  const [form, setForm]     = useState({
    // empresa
    name:     '',
    segmento: '',
    slug:     '',
    // responsável
    adminName:     '',
    adminEmail:    '',
    phone:         '',
    adminPassword: '',
    // plano
    planId: 'plan_pro',
  })
  const [errors,   setErrors]   = useState({})
  const [loading,  setLoading]  = useState(false)
  const [success,  setSuccess]  = useState(null)
  const [apiError, setApiError] = useState(null)

  function set(k, v) {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => ({ ...e, [k]: undefined }))
    setApiError(null)
  }

  /* ── Validações por step ── */
  function validateStep(s) {
    const errs = {}
    if (s === 1) {
      if (!form.name.trim())     errs.name     = 'Obrigatório.'
      if (!form.segmento)        errs.segmento = 'Selecione um segmento.'
      if (form.slug.length < 2)  errs.slug     = 'Mínimo 2 caracteres.'
    }
    if (s === 2) {
      if (!form.adminName.trim())   errs.adminName     = 'Obrigatório.'
      if (!form.adminEmail.trim())  errs.adminEmail    = 'Obrigatório.'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail)) errs.adminEmail = 'E-mail inválido.'
      if (form.adminPassword.length < 8) errs.adminPassword = 'Mínimo 8 caracteres.'
    }
    return errs
  }

  function nextStep() {
    const errs = validateStep(step)
    if (Object.keys(errs).length) { setErrors(errs); return }
    setStep(s => s + 1)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setApiError(null)
    setLoading(true)

    try {
      const payload = {
        slug:          form.slug,
        name:          form.name,
        planId:        form.planId,
        adminName:     form.adminName,
        adminEmail:    form.adminEmail,
        adminPassword: form.adminPassword,
        phone:         form.phone || undefined,
      }
      const res = await api.tenants.create(payload)
      setSuccess(res)
    } catch (err) {
      if (err.fields) setErrors(err.fields)
      else            setApiError(err.message)
      if (err.fields?.slug || err.fields?.name) setStep(1)
      else if (err.fields?.adminEmail || err.fields?.adminPassword) setStep(2)
    } finally {
      setLoading(false)
    }
  }

  /* ── Sucesso ── */
  if (success) {
    const slug = success.tenant.slug
    const domain = import.meta.env.VITE_DOMAIN ?? 'aurabr.app'
    return (
      <div className="min-h-screen bg-[var(--color-bg-subtle)] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
            <Check size={36} className="text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">Conta criada com sucesso!</h1>
            <p className="text-[var(--color-text-muted)] mt-2 text-sm">
              Estamos provisionando seu ambiente. Em alguns minutos você receberá
              um e-mail com seus acessos.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 text-left space-y-3">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Seus links</p>
            {[
              { label: 'ERP',       url: `https://${slug}.${domain}` },
              { label: 'Loja B2B',  url: `https://loja.${slug}.${domain}` },
            ].map(({ label, url }) => (
              <div key={label}>
                <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
                <a href={url} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-[var(--color-primary)] hover:underline font-medium"
                >{url}</a>
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            O ambiente estará disponível em até 2 minutos.<br />
            Verifique também sua caixa de spam.
          </p>
        </div>
      </div>
    )
  }

  /* ── Steps de progresso ── */
  const STEPS = ['Empresa', 'Responsável', 'Plano']

  return (
    <div className="min-h-screen bg-[var(--color-bg-subtle)] flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
          <Zap size={16} className="text-white" />
        </div>
        <span className="font-bold text-lg text-[var(--color-text)]">
          Aura <span className="text-[var(--color-primary)]">Platform</span>
        </span>
      </div>

      <div className="w-full max-w-lg">
        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((label, i) => {
            const n = i + 1
            const done    = step > n
            const current = step === n
            return (
              <React.Fragment key={label}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                    ${done    ? 'bg-green-500 text-white'
                    : current ? 'bg-[var(--color-primary)] text-white'
                              : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)]'}`}
                  >
                    {done ? <Check size={14} /> : n}
                  </div>
                  <span className={`text-sm hidden sm:block ${current ? 'font-medium text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}`}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px max-w-12 ${step > n ? 'bg-green-400' : 'bg-[var(--color-border)]'}`} />
                )}
              </React.Fragment>
            )
          })}
        </div>

        {/* Card do form */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-sm">
          {apiError && (
            <div className="flex items-center gap-2 px-4 py-3 mb-5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-600 text-sm">
              <AlertCircle size={16} />
              {apiError}
            </div>
          )}

          <form onSubmit={step < 3 ? (e) => { e.preventDefault(); nextStep() } : handleSubmit}>

            {/* Step 1 — Empresa */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-text)]">Dados da empresa</h2>
                  <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Trial de 14 dias, sem cartão.</p>
                </div>

                <Field label="Nome da empresa *" error={errors.name}>
                  <input
                    autoFocus
                    className={inputCls}
                    placeholder="Ex: Acme Distribuidora Ltda"
                    value={form.name}
                    onChange={e => {
                      set('name', e.target.value)
                      if (!form.slug || form.slug === autoSlug(form.name))
                        set('slug', autoSlug(e.target.value))
                    }}
                  />
                </Field>

                <Field label="Segmento *" error={errors.segmento}>
                  <select className={inputCls} value={form.segmento} onChange={e => set('segmento', e.target.value)}>
                    <option value="">Selecione...</option>
                    {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>

                <Field
                  label="Subdomínio *"
                  error={errors.slug}
                  hint="Será seu endereço: slug.aurabr.app. Apenas letras, números e hífens."
                >
                  <div className="flex rounded-lg overflow-hidden border border-[var(--color-border)] focus-within:ring-2 focus-within:ring-[var(--color-primary)]/40">
                    <input
                      className="flex-1 px-3 py-2.5 text-sm bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none"
                      placeholder="acme"
                      value={form.slug}
                      onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32))}
                    />
                    <span className="px-3 py-2.5 text-sm text-[var(--color-text-muted)] bg-[var(--color-surface)] border-l border-[var(--color-border)] whitespace-nowrap">
                      .aurabr.app
                    </span>
                  </div>
                </Field>
              </div>
            )}

            {/* Step 2 — Responsável */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-text)]">Responsável pela conta</h2>
                  <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Será o administrador do ERP.</p>
                </div>

                <Field label="Nome completo *" error={errors.adminName}>
                  <input
                    autoFocus
                    className={inputCls}
                    placeholder="João Silva"
                    value={form.adminName}
                    onChange={e => set('adminName', e.target.value)}
                  />
                </Field>

                <Field label="E-mail *" error={errors.adminEmail}>
                  <input
                    type="email"
                    className={inputCls}
                    placeholder="joao@acme.com.br"
                    value={form.adminEmail}
                    onChange={e => set('adminEmail', e.target.value)}
                  />
                </Field>

                <Field label="WhatsApp" error={errors.phone} hint="Opcional — para notificações de pedidos e billing.">
                  <input
                    type="tel"
                    className={inputCls}
                    placeholder="5541999990000"
                    value={form.phone}
                    onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 15))}
                  />
                </Field>

                <Field label="Senha inicial *" error={errors.adminPassword} hint="Mínimo 8 caracteres. Você poderá alterar depois.">
                  <input
                    type="password"
                    className={inputCls}
                    placeholder="••••••••"
                    value={form.adminPassword}
                    onChange={e => set('adminPassword', e.target.value)}
                  />
                </Field>
              </div>
            )}

            {/* Step 3 — Plano */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-text)]">Escolha seu plano</h2>
                  <p className="text-sm text-[var(--color-text-muted)] mt-0.5">14 dias grátis em qualquer plano. Setup: R$1.500.</p>
                </div>

                <div className="space-y-3">
                  {PLANOS.map(p => (
                    <label
                      key={p.id}
                      className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                        ${form.planId === p.id ? p.color : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]'}`}
                    >
                      <input
                        type="radio"
                        name="plan"
                        value={p.id}
                        checked={form.planId === p.id}
                        onChange={() => set('planId', p.id)}
                        className="mt-0.5 accent-[var(--color-primary)]"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[var(--color-text)]">{p.nome}</span>
                          {p.badge && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-primary)] text-white">
                              {p.badge}
                            </span>
                          )}
                          <span className="ml-auto text-sm font-bold text-[var(--color-text)]">{p.preco}</span>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{p.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                <p className="text-xs text-[var(--color-text-muted)] text-center pt-2">
                  Ao criar a conta você concorda com os Termos de Uso da Aura Platform.
                </p>
              </div>
            )}

            {/* Navegação */}
            <div className="flex items-center gap-3 mt-8">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(s => s - 1)}
                  className="px-4 py-2.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors"
                >
                  Voltar
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[var(--color-primary)] text-white font-medium hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-60"
              >
                {loading ? 'Criando sua conta...' : step < 3 ? (
                  <><span>Continuar</span><ChevronRight size={16} /></>
                ) : (
                  <><Zap size={16} /><span>Criar conta grátis</span></>
                )}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-[var(--color-text-muted)] mt-4">
          Já tem uma conta?{' '}
          <a href="#" className="text-[var(--color-primary)] hover:underline">Fazer login</a>
        </p>
      </div>
    </div>
  )
}
