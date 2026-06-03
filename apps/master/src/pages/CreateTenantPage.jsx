/**
 * Criar Tenant manualmente — formulário completo
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, AlertCircle } from 'lucide-react'
import { api } from '../lib/api.js'

const PLANS_FALLBACK = [
  { id: 'plan_starter', name: 'Starter — R$297/mês' },
  { id: 'plan_pro',     name: 'Pro — R$597/mês' },
  { id: 'plan_full',    name: 'Full — R$1.497/mês' },
]

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{label}</label>
      {children}
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

export function CreateTenantPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    slug:          '',
    name:          '',
    planId:        'plan_pro',
    adminName:     '',
    adminEmail:    '',
    adminPassword: '',
    seedDemo:      false,
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

  function autoSlug(name) {
    return name.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrors({})
    setApiError(null)

    const errs = {}
    if (!form.slug)          errs.slug          = 'Obrigatório.'
    if (!form.name)          errs.name          = 'Obrigatório.'
    if (!form.planId)        errs.planId        = 'Obrigatório.'
    if (!form.adminName)     errs.adminName     = 'Obrigatório.'
    if (!form.adminEmail)    errs.adminEmail    = 'Obrigatório.'
    if (form.adminPassword.length < 8) errs.adminPassword = 'Mínimo 8 caracteres.'

    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    try {
      const res = await api.tenants.create(form)
      setSuccess(res)
    } catch (err) {
      if (err.fields) setErrors(err.fields)
      else            setApiError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto mt-12 text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
          <Check size={28} className="text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-[var(--color-text)]">Tenant criado com sucesso!</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          O provisionamento está sendo executado em background.<br />
          Slug: <strong>{success.tenant.slug}</strong>
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate(`/tenants/${success.tenant.slug}`)}
            className="px-5 py-2.5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)]"
          >
            Ver tenant
          </button>
          <button
            onClick={() => navigate('/tenants')}
            className="px-5 py-2.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]"
          >
            Ver lista
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate('/tenants')} className="p-2 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-muted)]">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Novo Tenant</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Provisiona ERP + Loja B2B automaticamente</p>
        </div>
      </div>

      {apiError && (
        <div className="flex items-center gap-2 px-4 py-3 mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 text-sm">
          <AlertCircle size={16} />
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 space-y-5">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Dados da Empresa</h2>

          <Field label="Nome da empresa *" error={errors.name}>
            <input
              className={inputCls}
              placeholder="Ex: Acme Distribuidora"
              value={form.name}
              onChange={e => {
                set('name', e.target.value)
                if (!form.slug) set('slug', autoSlug(e.target.value))
              }}
            />
          </Field>

          <Field label="Slug (subdomínio) *" error={errors.slug}>
            <div className="flex rounded-lg overflow-hidden border border-[var(--color-border)] focus-within:ring-2 focus-within:ring-[var(--color-primary)]/40">
              <input
                className="flex-1 px-3 py-2.5 text-sm bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none"
                placeholder="acme"
                value={form.slug}
                onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32))}
              />
              <span className="px-3 py-2.5 text-sm text-[var(--color-text-muted)] bg-[var(--color-surface)] border-l border-[var(--color-border)]">
                .aurabr.app
              </span>
            </div>
          </Field>

          <Field label="Plano *" error={errors.planId}>
            <select
              className={inputCls}
              value={form.planId}
              onChange={e => set('planId', e.target.value)}
            >
              {PLANS_FALLBACK.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 space-y-5">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Administrador Inicial</h2>

          <Field label="Nome *" error={errors.adminName}>
            <input
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
              placeholder="admin@acme.com.br"
              value={form.adminEmail}
              onChange={e => set('adminEmail', e.target.value)}
            />
          </Field>

          <Field label="Senha inicial *" error={errors.adminPassword}>
            <input
              type="password"
              className={inputCls}
              placeholder="Mínimo 8 caracteres"
              value={form.adminPassword}
              onChange={e => set('adminPassword', e.target.value)}
            />
          </Field>
        </div>

        {/* ── Dados de demonstração ── */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
          <div>
            <p className="text-sm font-medium text-[var(--color-text)]">Inserir dados de demonstração</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Produtos, estoque, pedidos e clientes fictícios para apresentação
            </p>
          </div>
          <button
            type="button"
            onClick={() => set('seedDemo', !form.seedDemo)}
            className={"relative inline-flex h-6 w-11 items-center rounded-full transition-colors " + (form.seedDemo ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]")}
          >
            <span className={"inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform " + (form.seedDemo ? "translate-x-6" : "translate-x-1")} />
          </button>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 rounded-lg bg-[var(--color-primary)] text-white font-medium hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Provisionando...' : 'Criar e Provisionar Tenant'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/tenants')}
            className="px-5 py-3 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] text-sm hover:bg-[var(--color-surface)]"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
