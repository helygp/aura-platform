/**
 * pages/ResetPasswordPage.jsx
 *
 * Tela "Redefinir senha" — chega via link do email com ?token=xxx.
 * Pede nova senha + confirmação, chama POST /auth/reset-password.
 */

import React, { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button, PasswordInput } from '@aura/ui'
import { CheckCircle2 } from 'lucide-react'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = useMemo(() => params.get('token') ?? '', [params])

  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [errors,    setErrors]    = useState({})
  const [loading,   setLoading]   = useState(false)
  const [done,      setDone]      = useState(false)

  function validate() {
    const e = {}
    if (!password)            e.password = 'Informe uma senha.'
    else if (password.length < 8) e.password = 'Mínimo 8 caracteres.'
    if (!confirm)             e.confirm = 'Confirme a senha.'
    else if (password !== confirm) e.confirm = 'As senhas não conferem.'
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrors({})

    if (!token || token.length !== 64) {
      setErrors({ general: 'Link inválido ou incompleto. Solicite um novo.' })
      return
    }

    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    try {
      const res = await fetch('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrors({ general: data.error || 'Não foi possível redefinir a senha.' })
      } else {
        setDone(true)
      }
    } catch {
      setErrors({ general: 'Erro de conexão. Tente novamente.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-[var(--color-bg-subtle)]">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-md)] overflow-hidden">
          <div className="h-1 bg-[var(--color-primary)]" />
          <div className="px-8 pt-8 pb-10 flex flex-col gap-6">

            {!done ? (
              <>
                <div>
                  <h1 className="text-xl font-semibold text-[var(--color-text)]">Nova senha</h1>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    Crie uma nova senha para sua conta.
                  </p>
                </div>

                {errors.general && (
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-error)] bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error-fg)]" role="alert">
                    {errors.general}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <PasswordInput
                    label="Nova senha"
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    error={errors.password}
                    disabled={loading}
                    autoFocus
                  />
                  <PasswordInput
                    label="Confirmar nova senha"
                    autoComplete="new-password"
                    placeholder="Repita a senha"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    error={errors.confirm}
                    disabled={loading}
                  />
                  <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
                    {loading ? 'Redefinindo…' : 'Redefinir senha'}
                  </Button>
                </form>
              </>
            ) : (
              <div className="flex flex-col items-center text-center gap-3 py-4">
                <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-950 flex items-center justify-center">
                  <CheckCircle2 size={28} className="text-green-500" />
                </div>
                <h1 className="text-lg font-semibold text-[var(--color-text)]">Senha redefinida!</h1>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Sua senha foi atualizada com sucesso. Faça login com a nova senha.
                </p>
                <Button onClick={() => navigate('/login')} variant="primary" className="mt-3 w-full">
                  Ir para o login
                </Button>
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--color-text-disabled)]">
          Aura Platform · Powered by{' '}
          <span className="text-[var(--color-primary)]">Aura Cloud</span>
        </p>
      </motion.div>
    </div>
  )
}
