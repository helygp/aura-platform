/**
 * pages/ForgotPasswordPage.jsx
 *
 * Tela "Esqueci minha senha" — solicita login/e-mail e dispara email com link.
 * Resposta sempre 200 (não revela se a conta existe).
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button, Input } from '@aura/ui'
import { ArrowLeft, MailCheck } from 'lucide-react'

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [sent,       setSent]       = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!identifier.trim()) { setError('Informe seu login ou e-mail.'); return }
    setLoading(true)
    try {
      const res = await fetch('/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Erro ao processar. Tente novamente.')
      } else {
        setSent(true)
      }
    } catch (err) {
      setError('Erro de conexão. Tente novamente.')
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

            {!sent ? (
              <>
                <div>
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] mb-3"
                  >
                    <ArrowLeft size={14} /> Voltar ao login
                  </button>
                  <h1 className="text-xl font-semibold text-[var(--color-text)]">Esqueci minha senha</h1>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    Informe seu login ou e-mail e enviaremos um link para criar uma nova senha.
                  </p>
                </div>

                {error && (
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-error)] bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error-fg)]" role="alert">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <Input
                    label="Login ou e-mail"
                    type="text"
                    autoFocus
                    placeholder="seu login ou e-mail"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    disabled={loading}
                  />
                  <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
                    {loading ? 'Enviando…' : 'Enviar link de redefinição'}
                  </Button>
                </form>
              </>
            ) : (
              <div className="flex flex-col items-center text-center gap-3 py-4">
                <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-950 flex items-center justify-center">
                  <MailCheck size={28} className="text-green-500" />
                </div>
                <h1 className="text-lg font-semibold text-[var(--color-text)]">Verifique seu e-mail</h1>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Se houver uma conta com este login ou e-mail, enviamos um link de redefinição.
                  O link expira em <strong>60 minutos</strong> e só pode ser usado uma vez.
                </p>
                <Button onClick={() => navigate('/login')} variant="secondary" className="mt-3 w-full">
                  Voltar ao login
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
