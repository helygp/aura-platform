/**
 * auth/AuthContext.jsx
 *
 * Provê:
 *   user            — { tokenId, email, name, role, tenantSlug } | null
 *   isAuthenticated — boolean
 *   isLoading       — true enquanto verifica sessão no boot
 *   login(email, password) → Promise<void>  (lança em caso de erro)
 *   logout()               → Promise<void>
 *   hasRole(...roles)      → boolean
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

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null)
  const [isLoading, setIsLoading] = useState(true) // true até boot terminar

  /* ─── Boot: restaura sessão via cookie ─── */
  useEffect(() => {
    async function bootstrap() {
      try {
        // Tenta com access token atual
        const data = await apiMe()
        setUser(data.auth)
      } catch (err) {
        if (err.status === 401) {
          // Se for mismatch de tenant, não tenta refresh — vai para login
          if (isTenantMismatch(err)) {
            setUser(null)
          } else {
            // Access token expirado — tenta refresh
            try {
              const refreshed = await apiRefresh()
              // Refresh retornou mas pode ser de outro tenant — verificar
              if (isTenantMismatch(refreshed)) {
                setUser(null)
              } else {
                setUser(refreshed.user)
              }
            } catch (refreshErr) {
              setUser(null)  // sem sessão válida
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

  /* ─── login() ─── */
  const login = useCallback(async (email, password) => {
    const data = await apiLogin({ email, password }) // lança se erro
    setUser(data.user)
    if (data.accessToken) setMemToken(data.accessToken)
  }, [])

  /* ─── logout() ─── */
  const logout = useCallback(async () => {
    try { await apiLogout() } catch { /* silencioso */ }
    setUser(null)
  }, [])

  /* ─── hasRole() ─── */
  const hasRole = useCallback((...roles) => {
    if (!user) return false
    return roles.flat().map(r => r.toLowerCase()).includes(user.role.toLowerCase())
  }, [user])

  const value = useMemo(() => ({
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    logout,
    hasRole,
  }), [user, isLoading, login, logout, hasRole])

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
