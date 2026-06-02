'use client'

/**
 * lib/useAuth.ts
 * Estado de autenticação do comprador — lê /store/auth/me uma vez por sessão.
 * Disponível globalmente via AuthProvider.
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { BuyerSession } from './api'
import { authApi } from './api'
import { useTenant } from '@/components/layout/TenantProvider'

interface AuthContextValue {
  buyer:   BuyerSession | null
  loading: boolean
  login:   (email: string, password: string) => Promise<void>
  logout:  () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { slug } = useTenant()
  const [buyer,   setBuyer]   = useState<BuyerSession | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const session = await authApi.me(slug)
      setBuyer(session)
    } catch {
      setBuyer(null)
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { refresh() }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    const session = await authApi.login(slug, email, password)
    setBuyer(session)
  }, [slug])

  const logout = useCallback(async () => {
    await authApi.logout(slug)
    setBuyer(null)
  }, [slug])

  return (
    <AuthContext.Provider value={{ buyer, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}
