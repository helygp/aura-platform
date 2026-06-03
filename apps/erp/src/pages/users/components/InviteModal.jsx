/**
 * pages/users/components/InviteModal.jsx
 *
 * Modal para convidar novo usuário ao tenant.
 * Campos: nome, e-mail, papel.
 * Após envio, mostra confirmação com e-mail enviado.
 *
 * Props:
 *   open    : boolean
 *   onClose : fn
 *   onInvite: ({ name, email, role }) => Promise
 */

import React, { useState, useEffect } from 'react'
import { Mail, RefreshCw, CheckCircle2 } from 'lucide-react'
import { Modal, Button, Input } from '@aura/ui'
import { ROLE_LIST, validateInvite } from '../usersTypes.js'

export function InviteModal({ open, onClose, onInvite }) {
  const [form,    setForm]    = useState({ name: '', email: '', role: '' })
  const [errors,  setErrors]  = useState({})
  const [sending, setSending] = useState(false)
  const [done,    setDone]    = useState(false)

  useEffect(() => {
    if (open) { setForm({ name: '', email: '', role: '' }); setErrors({}); setDone(false) }
  }, [open])

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target?.value ?? e }))

  const handleSubmit = async () => {
    const errs = validateInvite(form)
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSending(true)
    try {
      await onInvite(form)
      setDone(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal open={open} onOpenChange={v => !v && onClose()}>
      <Modal.Content title="Convidar usuário" description="O convite será enviado por e-mail" size="sm">
        {done ? (
          /* ── Confirmação ── */
          <div className="py-6 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-950 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-green-500" />
            </div>
            <div>
              <p className="font-semibold text-[var(--color-text)]">Convite enviado!</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                Um e-mail foi enviado para <strong>{form.email}</strong> com as instruções de acesso.
              </p>
            </div>
            <Button onClick={onClose}>Fechar</Button>
          </div>
        ) : (
          /* ── Formulário ── */
          <div className="space-y-4 py-1">
            <Input
              label="Nome completo *"
              placeholder="Ex: João Silva"
              value={form.name}
              onChange={set('name')}
              error={errors.name}
            />
            <Input
              label="E-mail *"
              placeholder="joao@empresa.com.br"
              type="email"
              value={form.email}
              onChange={set('email')}
              error={errors.email}
            />
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                Papel *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_LIST.map(role => (
                  <button
                    key={role.key}
                    type="button"
                    onClick={() => { setForm(p => ({ ...p, role: role.key })); setErrors(p => ({ ...p, role: undefined })) }}
                    className={`
                      flex flex-col items-start p-3 rounded-xl border-2 text-left
                      transition-all duration-150
                      ${form.role === role.key
                        ? `${role.border} ${role.bg}`
                        : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]'
                      }
                    `}
                  >
                    <span className={`text-xs font-bold ${form.role === role.key ? role.color : 'text-[var(--color-text)]'}`}>
                      {role.label}
                    </span>
                  </button>
                ))}
              </div>
              {errors.role && <p className="text-xs text-[var(--color-error)] mt-1">{errors.role}</p>}
            </div>
          </div>
        )}

        {!done && (
          <Modal.Footer>
            <Button variant="secondary" onClick={onClose} disabled={sending}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={sending}>
              {sending
                ? <><RefreshCw size={14} className="animate-spin" /> Enviando…</>
                : <><Mail size={14} /> Enviar convite</>
              }
            </Button>
          </Modal.Footer>
        )}
      </Modal.Content>
    </Modal>
  )
}
