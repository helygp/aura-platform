/**
 * pages/users/components/InviteModal.jsx
 *
 * T9 — Criação completa de usuário:
 *   Nome, e-mail, papel, senha (ou gera temp), WhatsApp,
 *   vínculo com clientes específicos (restrição de pedidos).
 */

import React, { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle2, Eye, EyeOff, UserPlus } from 'lucide-react'
import { Modal, Button } from '@aura/ui'
import { ROLE_LIST, validateInvite } from '../usersTypes.js'

function authFetch(url, opts = {}) {
  const tok = window.__aura_mem_token__ || ''
  return fetch(url, {
    ...opts,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(tok ? { Authorization: 'Bearer ' + tok } : {}),
      ...(opts.headers ?? {}),
    },
  })
}

const EMPTY = { name: '', email: '', role: '', password: '', whatsapp: '', customerIds: [] }

export function InviteModal({ open, onClose, onInvite, customers = [] }) {
  const [form,       setForm]       = useState(EMPTY)
  const [errors,     setErrors]     = useState({})
  const [sending,    setSending]    = useState(false)
  const [done,       setDone]       = useState(null)   // { name, email, tempPassword? }
  const [showPass,   setShowPass]   = useState(false)
  const [genPass,    setGenPass]    = useState(true)   // true = gera automático

  useEffect(() => {
    if (open) { setForm(EMPTY); setErrors({}); setDone(null); setShowPass(false); setGenPass(true) }
  }, [open])

  const set = field => e => setForm(prev => ({ ...prev, [field]: e.target?.value ?? e }))

  function toggleCustomer(id) {
    setForm(prev => ({
      ...prev,
      customerIds: prev.customerIds.includes(id)
        ? prev.customerIds.filter(c => c !== id)
        : [...prev.customerIds, id],
    }))
  }

  const handleSubmit = async () => {
    const errs = validateInvite(form)
    if (!genPass && !form.password.trim()) errs.password = 'Digite uma senha ou use geração automática.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSending(true)
    try {
      const payload = {
        name:        form.name.trim(),
        email:       form.email.trim(),
        role:        form.role,
        whatsapp:    form.whatsapp.trim() || null,
        customerIds: form.customerIds,
        password:    genPass ? null : form.password.trim(),
      }
      const res = await authFetch('/api/users/invite', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      const d = await res.json()
      if (!res.ok) { setErrors({ submit: d.error }); return }
      setDone({ name: form.name, email: form.email, tempPassword: d.tempPassword })
      if (onInvite) onInvite()
    } catch (e) {
      setErrors({ submit: e.message })
    } finally {
      setSending(false)
    }
  }

  const Field = ({ label, error, children }) => (
    <div>
      <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1">{label}</label>
      {children}
      {error && <p className="text-[11px] text-red-500 mt-0.5">{error}</p>}
    </div>
  )

  const inputCls = (err) =>
    `w-full h-9 px-3 rounded-lg text-sm border bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 ${err ? 'border-red-400' : 'border-[var(--color-border)]'}`

  return (
    <Modal open={open} onOpenChange={v => !v && onClose()}>
      <Modal.Content title="Criar usuário" size="md">

        {done ? (
          /* ── Confirmação ── */
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

            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome completo *" error={errors.name}>
                <input value={form.name} onChange={set('name')} placeholder="João Silva"
                  className={inputCls(errors.name)} />
              </Field>
              <Field label="E-mail *" error={errors.email}>
                <input type="email" value={form.email} onChange={set('email')} placeholder="joao@empresa.com"
                  className={inputCls(errors.email)} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Papel *" error={errors.role}>
                <select value={form.role} onChange={set('role')} className={inputCls(errors.role)}>
                  <option value="">Selecionar…</option>
                  {ROLE_LIST.map(r => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="WhatsApp" error={errors.whatsapp}>
                <input value={form.whatsapp} onChange={set('whatsapp')} placeholder="(11) 99999-9999"
                  className={inputCls(errors.whatsapp)} />
              </Field>
            </div>

            {/* Senha */}
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">Senha</label>
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
              {!genPass && (
                <Field label="" error={errors.password}>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')}
                      placeholder="Mínimo 8 caracteres" className={inputCls(errors.password) + ' pr-10'} />
                    <button type="button" onClick={() => setShowPass(s => !s)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                      {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </Field>
              )}
              {genPass && (
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
                    {form.customerIds.length === 1 && ' O cliente será pré-selecionado ao criar pedidos.'}
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
                ? <><RefreshCw size={14} className="animate-spin" /> Criando…</>
                : <><UserPlus size={14} /> Criar usuário</>}
            </Button>
          </Modal.Footer>
        )}
      </Modal.Content>
    </Modal>
  )
}
