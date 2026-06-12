/**
 * pages/LoginPage.jsx
 * Tela de login mobile-first.
 *
 * Aceita login (username) OU e-mail no mesmo campo identificador.
 *
 * Features:
 *   - Logo do tenant (via CSS var --tenant-logo ou fallback Aura)
 *   - Validação client-side + server-side errors mapeados por campo
 *   - Redirect para `?from=` após login, ou /dashboard como fallback
 *   - Animação de entrada via Framer Motion
 *   - Suporte completo a dark/light via CSS vars
 */

import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth }    from '../auth/AuthContext.jsx'
import { Button }     from '@aura/ui'
import { Input, PasswordInput } from '@aura/ui'
import { useTranslation } from '@aura/i18n'

/* ─── Animação do card ─── */
const cardVariants = {
  hidden:  { opacity: 0, y: 24, scale: 0.98 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
}

export function LoginPage() {
  const { t }                    = useTranslation()
  const { login, isLoading: authLoading } = useAuth()
  const navigate                 = useNavigate()
  const [searchParams]           = useSearchParams()

  const [identifier, setIdentifier] = useState('')
  const [password,   setPassword]   = useState('')
  const [errors,     setErrors]     = useState({})
  const [loading,    setLoading]    = useState(false)

  const redirectTo = searchParams.get('from') ?? '/dashboard'

  /* ─── Validação client-side ─── */
  function validate() {
    const e = {}
    if (!identifier.trim()) e.identifier = t('errors.required', 'Campo obrigatório')
    if (!password)          e.password   = t('errors.required', 'Campo obrigatório')
    return e
  }

  /* ─── Submit ─── */
  async function handleSubmit(e) {
    e.preventDefault()
    setErrors({})

    const clientErrors = validate()
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors)
      return
    }

    setLoading(true)
    try {
      await login(identifier.trim(), password)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      if (err.fields) {
        // Backend pode mandar fields.identifier ou fields.email — unifica
        const f = { ...err.fields }
        if (f.email && !f.identifier) f.identifier = f.email
        setErrors(f)
      } else {
        setErrors({ general: err.message ?? t('errors.generic', 'Erro ao entrar.') })
      }
    } finally {
      setLoading(false)
    }
  }

  const isSubmitting = loading || authLoading

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-[var(--color-bg-subtle)]">

      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-sm"
      >
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-md)] overflow-hidden">
          <div className="h-1 bg-[var(--color-primary)]" />

          <div className="px-8 pt-8 pb-10 flex flex-col gap-6">

            <TenantBrand />

            <div className="text-center">
              <h1 className="text-xl font-semibold text-[var(--color-text)]">
                {t('auth.welcomeBack')}
              </h1>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                {t('auth.enterCredentials')}
              </p>
            </div>

            {errors.general && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[var(--radius-md)] border border-[var(--color-error)] bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error-fg)]"
                role="alert"
              >
                {errors.general}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              <Input
                label={t('auth.loginOrEmail', 'Login ou e-mail')}
                type="text"
                inputMode="email"
                autoComplete="username"
                autoFocus
                placeholder={t('auth.loginOrEmailPlaceholder', 'seu login ou e-mail')}
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                error={errors.identifier}
                disabled={isSubmitting}
              />

              <PasswordInput
                label={t('auth.password')}
                autoComplete="current-password"
                placeholder={t('auth.passwordPlaceholder')}
                value={password}
                onChange={e => setPassword(e.target.value)}
                error={errors.password}
                disabled={isSubmitting}
              />

              <div className="flex justify-end -mt-1">
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-xs text-[var(--color-primary)] hover:underline focus:outline-none focus-visible:underline"
                >
                  {t('auth.forgotPassword')}
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full mt-1"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? <><Spinner /> {t('common.loading')}</>
                  : t('auth.signIn')
                }
              </Button>
            </form>

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

/* ─── Logo / nome do tenant ─── */
function TenantBrand() {
  const logoUrl = getComputedStyle(document.documentElement)
    .getPropertyValue('--tenant-logo-url')
    .trim()
    .replace(/^["']|["']$/g, '')

  if (logoUrl) {
    return (
      <div className="flex justify-center">
        <img
          src={logoUrl}
          alt="Logo"
          className="h-12 w-auto object-contain"
        />
      </div>
    )
  }

  return (
    <div className="flex justify-center">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-[var(--radius-md)] bg-[var(--color-primary)] flex items-center justify-center">
          <span className="text-[var(--color-primary-fg)] text-sm font-bold">A</span>
        </div>
        <span
          className="text-lg font-semibold text-[var(--color-text)]"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
        >
          Aura
        </span>
      </div>
    </div>
  )
}

/* ─── Spinner inline ─── */
function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin"
    />
  )
}
