/**
 * pages/users/components/InviteModal.jsx
 *
 * Modal de criação E edição de usuário (mesmo componente, alterna por prop `user`).
 *
 * Modo CRIAÇÃO (user=null):
 *   - Nome, login (opcional — backend deriva), e-mail, papéis [], senha (gerar/definir),
 *     WhatsApp, vínculo com clientes específicos.
 *
 * Modo EDIÇÃO (user={...}):
 *   - Mesma estrutura, com dados pré-preenchidos.
 *   - Senha em branco = não troca. Preencher = troca.
 *   - Login editável (se já não estiver em uso por outro user no tenant).
 *
 * NOTA TÉCNICA: `Field` e `inputCls` são definidos FORA do componente.
 * Antes estavam dentro, o que fazia o React desmontar o <input> a cada
 * tecla (nova identidade de tipo a cada render) → cursor saía do campo.
 */

import React, { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle2, Eye, EyeOff, UserPlus, Save } from 'lucide-react'
import { Modal, Button } from '@aura/ui'
import { ROLE_LIST, validateInvite, normalizeRoles, userRoles } from '../usersTypes.js'

/* ─── Helpers de UI (fora do componente — não recriam a cada render) ─── */

function Field({ label, error, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{hint}</p>}
      {error && <p className="text-[11px] text-red-500 mt-0.5">{error}</p>}
    </div>
  )
}

const inputCls = (err) =>
  `w-full h-9 px-3 rounded-lg text-sm border bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 ${err ? 'border-red-400' : 'border-[var(--color-border)]'}`

/* ─── Estado inicial ─── */
const EMPTY = {
  name: '', login: '', email: '', password: '',
  roles: [], whatsapp: '', customerIds: [],
}

function buildInitial(user) {
  if (!user) return EMPTY
  return {
    name:        user.name ?? '',
    login:       user.login ?? '',
    email:       user.email ?? '',
    password:    '',
    roles:       userRoles(user),
    whatsapp:    user.whatsapp ?? '',
    customerIds: user.customerIds ?? [],
  }
}

/* ─── Componente principal ─── */
export function InviteModal({
  open,
  onClose,
  onSave,        // (payload, isEdit) => Promise
  user = null,   // se passado → modo edição
  customers = [],
}) {
  const isEdit = Boolean(user?.id)

  const [form,     setForm]     = useState(EMPTY)
  const [errors,   setErrors]   = useState({})
  const [sending,  setSending]  = useState(false)
  const [done,     setDone]     = useState(null)
  const [showPass, setShowPass] = useState(false)
  const [genPass,  setGenPass]  = useState(!isEdit)

  useEffect(() => {
    if (open) {
      setForm(buildInitial(user))
      setErrors({})
      setDone(null)
      setShowPass(false)
      setGenPass(!isEdit) // edição NÃO gera senha automática
    }
  }, [open, user, isEdit])

  /* setter genérico — recebe e suporta value direto também */
  const set = field => e => setForm(prev => ({ ...prev, [field]: e?.target?.value ?? e }))

  function toggleRole(roleKey) {
    setForm(prev => ({
      ...prev,
      roles: prev.roles.includes(roleKey)
        ? prev.roles.filter(r => r !== roleKey)
        : [...prev.roles, roleKey],
    }))
  }

  function toggleCustomer(id) {
    setForm(prev => ({
      ...prev,
      customerIds: prev.customerIds.includes(id)
        ? prev.customerIds.filter(c => c !== id)
        : [...prev.customerIds, id],
    }))
  }

  const handleSubmit = async () => {
    const errs = validateInvite(form, { isEdit })
    if (!isEdit && !genPass && !form.password.trim()) {
      errs.password = 'Digite uma senha ou use geração automática.'
    }
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSending(true)
    try {
      const payload = {
        name:        form.name.trim(),
        login:       form.login?.trim() || undefined,
        email:       form.email.trim(),
        roles:       normalizeRoles(form.roles).map(r => r.toUpperCase()),
        whatsapp:    form.whatsapp?.trim() || null,
        customerIds: form.customerIds,
      }
      if (isEdit) {
        if (form.password?.trim()) payload.password = form.password.trim()
      } else {
        payload.password = genPass ? null : (form.password?.trim() || null)
      }

      const data = await onSave(payload, isEdit)

      if (isEdit) {
        onClose()
      } else {
        setDone({ name: form.name, email: form.email, tempPassword: data?.tempPassword })
      }
    } catch (e) {
      setErrors({ submit: e.message || 'Erro inesperado.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal open={open} onOpenChange={v => !v && onClose()}>
      <Modal.Content title={isEdit ? `Editar — ${user.name}` : 'Criar usuário'} size="md">

        {done ? (
          /* ── Confirmação criação ── */
          <div className="py-4 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-950 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-green-500" />
            </div>
            <div>
              <p className="font-semibold text-[var(--color-text)]">Usuário criado!</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                <strong>{done.name}</strong> — {done.email}
              </p>
              {done.tempPassword && (
                <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-1">Senha temporária gerada:</p>
                  <code className="text-sm font-bold text-amber-800 dark:text-amber-300 select-all">{done.tempPassword}</code>
                  <p className="text-[11px] text-amber-600 dark:text-amber-500 mt-1">Copie e envie ao usuário. Ele poderá trocar após o login.</p>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose}>Fechar</Button>
              <Button onClick={() => setDone(null)}>Criar outro</Button>
            </div>
          </div>
        ) : (
          /* ── Formulário ── */
          <div className="flex flex-col gap-4 py-1">
            {errors.submit && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                {errors.submit}
              </div>
            )}

            {/* Nome + E-mail */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome completo *" error={errors.name}>
                <input value={form.name} onChange={set('name')} placeholder="João Silva"
                  className={inputCls(errors.name)} autoComplete="off" />
              </Field>
              <Field label="E-mail *" error={errors.email}>
                <input type="email" value={form.email} onChange={set('email')} placeholder="joao@empresa.com"
                  className={inputCls(errors.email)} autoComplete="off" />
              </Field>
            </div>

            {/* Login + WhatsApp */}
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={isEdit ? 'Login' : 'Login (opcional)'}
                error={errors.login}
                hint={!isEdit ? 'Se vazio, derivado do e-mail' : '3-20 chars: letras, números, . _ -'}
              >
                <input value={form.login} onChange={set('login')} placeholder="joao.silva"
                  className={inputCls(errors.login)} autoComplete="off"
                  onBlur={e => setForm(prev => ({ ...prev, login: e.target.value.toLowerCase().trim() }))} />
              </Field>
              <Field label="WhatsApp" error={errors.whatsapp}>
                <input value={form.whatsapp} onChange={set('whatsapp')} placeholder="(11) 99999-9999"
                  className={inputCls(errors.whatsapp)} autoComplete="off" />
              </Field>
            </div>

            {/* Perfis (multi) */}
            <Field
              label="Perfis * (múltipla escolha)"
              error={errors.roles}
              hint="O usuário acumula permissões dos perfis selecionados. Admin tem acesso total."
            >
              <div className="flex flex-wrap gap-2">
                {ROLE_LIST.map(r => {
                  const checked = form.roles.includes(r.key)
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => toggleRole(r.key)}
                      className={`
                        h-8 px-3 rounded-full text-xs font-medium border transition-colors
                        ${checked
                          ? `${r.bg} ${r.color} ${r.border}`
                          : 'bg-[var(--color-bg)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-border-strong)]'}
                      `}
                    >
                      {checked && '✓ '}{r.label}
                    </button>
                  )
                })}
              </div>
            </Field>

            {/* Senha */}
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">
                Senha {isEdit && <span className="normal-case font-normal">(opcional — preencha só para trocar)</span>}
              </label>
              {!isEdit && (
                <div className="flex gap-2 mb-2">
                  <button type="button" onClick={() => setGenPass(true)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${genPass ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]'}`}>
                    Gerar automaticamente
                  </button>
                  <button type="button" onClick={() => setGenPass(false)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${!genPass ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]'}`}>
                    Definir agora
                  </button>
                </div>
              )}
              {(isEdit || !genPass) && (
                <Field label="" error={errors.password}>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={form.password}
                      onChange={set('password')}
                      placeholder={isEdit ? 'Deixe vazio para manter' : 'Mínimo 8 caracteres'}
                      className={inputCls(errors.password) + ' pr-10'}
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowPass(s => !s)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                      {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </Field>
              )}
              {!isEdit && genPass && (
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Uma senha temporária será gerada e exibida após a criação.
                </p>
              )}
            </div>

            {/* Vínculo com clientes */}
            {customers.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1">
                  Restringir a clientes <span className="normal-case font-normal text-[var(--color-text-muted)]">(opcional)</span>
                </label>
                <p className="text-[11px] text-[var(--color-text-muted)] mb-2">
                  Se vazio, o usuário acessa todos os clientes. Se selecionado, só vê e cria pedidos para estes clientes.
                </p>
                <div className="max-h-36 overflow-y-auto border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
                  {customers.map(c => (
                    <label key={c.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[var(--color-surface)] transition-colors">
                      <input type="checkbox" checked={form.customerIds.includes(c.id)} onChange={() => toggleCustomer(c.id)}
                        className="rounded text-[var(--color-primary)]" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[var(--color-text)] truncate">{c.name}</p>
                        {c.email && <p className="text-[10px] text-[var(--color-text-muted)] truncate">{c.email}</p>}
                      </div>
                    </label>
                  ))}
                </div>
                {form.customerIds.length > 0 && (
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">
                    {form.customerIds.length} cliente{form.customerIds.length !== 1 ? 's' : ''} vinculado{form.customerIds.length !== 1 ? 's' : ''}.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {!done && (
          <Modal.Footer>
            <Button variant="secondary" onClick={onClose} disabled={sending}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={sending}>
              {sending
                ? <><RefreshCw size={14} className="animate-spin" /> {isEdit ? 'Salvando…' : 'Criando…'}</>
                : isEdit
                  ? <><Save size={14} /> Salvar</>
                  : <><UserPlus size={14} /> Criar usuário</>
              }
            </Button>
          </Modal.Footer>
        )}
      </Modal.Content>
    </Modal>
  )
}
