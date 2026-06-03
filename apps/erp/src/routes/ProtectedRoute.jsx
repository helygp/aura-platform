/**
 * routes/ProtectedRoute.jsx
 *
 * Uso:
 *   <ProtectedRoute />                    — qualquer usuário autenticado
 *   <ProtectedRoute roles={['admin']} />  — apenas admin
 *
 * Comportamento:
 *   isLoading    → spinner central (evita flash de redirect)
 *   não autenticado → redireciona para /login, preserva `?from=` para voltar
 *   sem papel correto → redireciona para /403
 */

import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'

export function ProtectedRoute({ roles }) {
  const { isAuthenticated, isLoading, hasRole } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-bg)]">
        <Spinner />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={`/login?from=${encodeURIComponent(location.pathname)}`}
        replace
      />
    )
  }

  if (roles?.length && !hasRole(...roles)) {
    return <Navigate to="/403" replace />
  }

  return <Outlet />
}

function Spinner() {
  return (
    <div
      aria-label="Carregando..."
      className="h-9 w-9 rounded-full border-4 border-[var(--color-border)] border-t-[var(--color-primary)] animate-spin"
    />
  )
}
