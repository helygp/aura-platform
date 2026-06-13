/**
 * pages/ForcePasswordChangePage.jsx
 *
 * Tela full-screen exibida quando o usuário precisa trocar a senha no
 * primeiro acesso (user.mustChangePassword === true).
 *
 * Bloqueia o restante do app (via ProtectedRoute) até a troca ser concluída.
 * Pede: senha temporária (recebida por e-mail) + nova senha + confirmação.
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../auth/AuthContext.jsx'
import { Button, PasswordInput } from '@aura/ui'
import { apiChangeMyPassword } from '../auth/api.js'

const cardVariants = {
  hidden:  { opacity: 0, y: 24, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
}

export function ForcePasswordChangePage() {
  const { user, refreshAuth, logout } = useAuth()
  const navigate = useNavigate()

  const [form,    setForm]    = useState({ current: '', next: '', confirm: '' })
  const [errors,  setErrors]  = useState({})
  const [loading, setLoading] = useState(false)

  function patch(field, value) {
    setForm(p => ({ ...p, [field]: value }))
    setErrors(p => ({ ...p, [field]: undefined, general: undefined }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = {}
    if (!form.current.trim())              errs.current = 'Informe a senha temporária recebida por e-mail.'
    if (form.next.length < 8)              errs.next    = 'Mínimo 8 caracteres.'
    if (form.next && form.next === form.current) errs.next = 'A nova senha deve ser diferente da temporária.'
    if (form.next !== form.confirm)        errs.confirm = 'As senhas não coincidem.'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    try {
      await apiChangeMyPassword({ currentPassword: form.current, newPassword: form.next })
      await refreshAuth()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const msg = err?.message === 'Senha atual incorreta.'
        ? 'Senha temporária incorreta.'
        : (err?.message ?? 'Erro ao trocar a senha.')
      setErrors({ current: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-[var(--color-bg-subtle)]">
      <motion.div variants={cardVariants} initial="hidden" animate="visible" className="w-full max-w-sm">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-md)] overflow-hidden">
          <div className="h-1 bg-[var(--color-primary)]" />

          <div className="px-8 pt-8 pb-10 flex flex-col gap-6">
            <div className="text-center">
              <h1 className="text-xl font-semibold text-[var(--color-text)]">
                Defina sua senha
              </h1>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                {user?.name ? `Olá, ${user.name}. ` : ''}Por segurança, troque a senha temporária antes de continuar.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              <PasswordInput
                label="Senha temporária"
                autoComplete="current-password"
                placeholder="recebida por e-mail"
                value={form.current}
                onChange={e => patch('current', e.target.value)}
                error={errors.current}
                disabled={loading}
                autoFocus
              />
              <PasswordInput
                label="Nova senha (mín. 8 caracteres)"
                autoComplete="new-password"
                placeholder="••••••••"
                value={form.next}
                onChange={e => patch('next', e.target.value)}
                error={errors.next}
                disabled={loading}
              />
              <PasswordInput
                label="Confirmar nova senha"
                autoComplete="new-password"
                placeholder="••••••••"
                value={form.confirm}
                onChange={e => patch('confirm', e.target.value)}
                error={errors.confirm}
                disabled={loading}
              />

              <Button type="submit" variant="primary" size="lg" className="w-full mt-1" disabled={loading}>
                {loading
                  ? <><span aria-hidden className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Salvando…</>
                  : 'Salvar e continuar'
                }
              </Button>

              <button
                type="button"
                onClick={() => logout()}
                className="text-xs text-[var(--color-text-muted)] hover:underline focus:outline-none mt-1"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
