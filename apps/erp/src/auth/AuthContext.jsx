/**
 * auth/AuthContext.jsx
 *
 * Provê:
 *   user            — { tokenId, login, email, name, role, roles[], tenantSlug } | null
 *   isAuthenticated — boolean
 *   isLoading       — true enquanto verifica sessão no boot
 *   login(identifier, password) → Promise<void>  (lança em caso de erro)
 *   logout()                    → Promise<void>
 *   hasRole(...roles)           → boolean (multi-role: passa se QUALQUER role do user bater; admin sempre passa)
 *
 * Persistência de sessão:
 *   No boot chama /auth/me. Se o cookie aura_access ainda for válido
 *   o usuário é restaurado sem nova tela de login.
 *   Se expirado, tenta /auth/refresh automaticamente (cookie aura_refresh).
 *   Se ambos falharem OU se o token for de outro tenant (TENANT_MISMATCH)
 *   → usuário null → ProtectedRoute redireciona para login.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react'
import { apiLogin, apiLogout, apiMe, apiRefresh, setMemToken } from './api.js'

const AuthContext = createContext(null)

/** Erros que indicam sessão de outro tenant — não tentar refresh, ir direto para login */
function isTenantMismatch(err) {
  return err?.code === 'TENANT_MISMATCH'
}

/** Normaliza user payload: garante .roles[] mesmo em payloads antigos */
function normalizeUser(u) {
  if (!u) return null
  const roles = Array.isArray(u.roles) && u.roles.length > 0
    ? u.roles.map(r => String(r).toLowerCase())
    : (u.role ? [String(u.role).toLowerCase()] : [])
  return {
    ...u,
    role:  u.role ? String(u.role).toLowerCase() : (roles[0] ?? null),
    roles,
  }
}

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null)
  const [isLoading, setIsLoading] = useState(true) // true até boot terminar

  /* ─── Boot: restaura sessão via cookie ─── */
  useEffect(() => {
    async function bootstrap() {
      try {
        const data = await apiMe()
        setUser(normalizeUser(data.auth))
      } catch (err) {
        if (err.status === 401) {
          if (isTenantMismatch(err)) {
            setUser(null)
          } else {
            try {
              const refreshed = await apiRefresh()
              if (isTenantMismatch(refreshed)) {
                setUser(null)
              } else {
                setUser(normalizeUser(refreshed.user))
              }
            } catch (refreshErr) {
              setUser(null)
            }
          }
        } else {
          setUser(null)
        }
      } finally {
        setIsLoading(false)
      }
    }
    bootstrap()
  }, [])

  /* ─── login() ───
   * Aceita identifier (login OU email) ou ainda o legacy "email".
   */
  const login = useCallback(async (identifierOrEmail, password) => {
    const data = await apiLogin({ identifier: identifierOrEmail, password })
    setUser(normalizeUser(data.user))
    if (data.accessToken) setMemToken(data.accessToken)
  }, [])

  /* ─── logout() ─── */
  const logout = useCallback(async () => {
    try { await apiLogout() } catch { /* silencioso */ }
    setUser(null)
  }, [])

  /* ─── hasRole() ─── multi-role + admin always passes */
  const hasRole = useCallback((...roles) => {
    if (!user) return false
    const userRoles = user.roles ?? (user.role ? [user.role] : [])
    if (userRoles.includes('admin')) return true
    const want = roles.flat().map(r => String(r).toLowerCase())
    return userRoles.some(r => want.includes(r))
  }, [user])

  /* ─── refreshAuth() ─── recarrega o user via /auth/me (DB fresco) */
  const refreshAuth = useCallback(async () => {
    try {
      const data = await apiMe()
      setUser(normalizeUser(data.auth))
    } catch { /* mantém estado atual */ }
  }, [])

  const value = useMemo(() => ({
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    logout,
    hasRole,
    refreshAuth,
  }), [user, isLoading, login, logout, hasRole, refreshAuth])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
