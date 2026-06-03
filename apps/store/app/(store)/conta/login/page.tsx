'use client'

/**
 * app/(store)/conta/login/page.tsx
 * Login e cadastro do comprador B2B.
 * Tab: Entrar | Criar conta
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { authApi } from '@/lib/api'
import { useTenant } from '@/components/layout/TenantProvider'

type Tab = 'login' | 'register'

export default function LoginPage() {
  const router        = useRouter()
  const { buyer, login, refresh } = useAuth()
  const { slug }      = useTenant()
  const [tab, setTab] = useState<Tab>('login')

  // Já logado → redireciona
  useEffect(() => {
    if (buyer) router.replace('/conta/pedidos')
  }, [buyer, router])

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">

        {/* Tabs */}
        <div className="mb-6 flex rounded-[var(--radius)] border border-border bg-muted p-1">
          {(['login', 'register'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'flex-1 rounded py-2 text-sm font-medium transition',
                tab === t
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {t === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          ))}
        </div>

        {tab === 'login'
          ? <LoginForm onSuccess={() => { refresh(); router.push('/conta/pedidos') }} login={login} />
          : <RegisterForm tenantSlug={slug} onSuccess={() => { refresh(); router.push('/conta/pedidos') }} />
        }
      </div>
    </div>
  )
}

// ─── Formulário de login ──────────────────────────────────────────────────────

function LoginForm({ onSuccess, login }: { onSuccess: () => void; login: (e: string, p: string) => Promise<void> }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit() {
    if (!email || !password) { setError('Preencha todos os campos.'); return }
    setLoading(true); setError('')
    try {
      await login(email, password)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar.')
    } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="E-mail" type="email" value={email} onChange={setEmail} placeholder="seu@email.com" />
      <Field label="Senha"  type="password" value={password} onChange={setPassword} placeholder="••••••••" onEnter={handleSubmit} />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <SubmitButton loading={loading} label="Entrar" onClick={handleSubmit} />
    </div>
  )
}

// ─── Formulário de cadastro ───────────────────────────────────────────────────

function RegisterForm({ tenantSlug, onSuccess }: { tenantSlug: string; onSuccess: () => void }) {
  const [name,        setName]        = useState('')
  const [email,       setEmail]       = useState('')
  const [companyName, setCompanyName] = useState('')
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [error,       setError]       = useState('')
  const [loading,     setLoading]     = useState(false)

  async function handleSubmit() {
    if (!name || !email || !password) { setError('Nome, e-mail e senha são obrigatórios.'); return }
    if (password.length < 8)          { setError('A senha deve ter no mínimo 8 caracteres.'); return }
    if (password !== confirm)          { setError('As senhas não coincidem.'); return }
    setLoading(true); setError('')
    try {
      await authApi.register(tenantSlug, { name, email, password, companyName: companyName || undefined })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta.')
    } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Nome completo"   value={name}        onChange={setName}        placeholder="João Silva" />
      <Field label="E-mail"          type="email" value={email}       onChange={setEmail}       placeholder="seu@email.com" />
      <Field label="Empresa (opcional)" value={companyName} onChange={setCompanyName} placeholder="Loja do João" />
      <Field label="Senha"           type="password" value={password}    onChange={setPassword}    placeholder="Mínimo 8 caracteres" />
      <Field label="Confirmar senha" type="password" value={confirm}     onChange={setConfirm}     placeholder="••••••••" onEnter={handleSubmit} />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <SubmitButton loading={loading} label="Criar conta" onClick={handleSubmit} />
    </div>
  )
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function Field({ label, type = 'text', value, onChange, placeholder, onEnter }: {
  label: string; type?: string; value: string
  onChange: (v: string) => void; placeholder?: string; onEnter?: () => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        placeholder={placeholder}
        className="h-10 rounded-[var(--radius)] border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </div>
  )
}

function SubmitButton({ loading, label, onClick }: { loading: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
    >
      {loading ? <SpinnerIcon /> : null}
      {loading ? 'Aguarde…' : label}
    </button>
  )
}

function SpinnerIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
}
