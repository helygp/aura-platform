/**
 * pages/users/useUsers.js
 *
 * Hook de dados do módulo de usuários do tenant.
 * Usa authFetch central com refresh automático em 401.
 */

import { useState, useEffect, useCallback } from 'react'
import { authFetch, authFetchJson } from '../../auth/authFetch.js'
import { useAuth } from '../../auth/AuthContext.jsx'

export function useUsers() {
  const { user: authUser } = useAuth()
  const [users,     setUsers]     = useState([])
  const [customers, setCustomers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState(null)

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [res, resC] = await Promise.all([
        authFetch('/api/users'),
        authFetch('/api/customers'),
      ])
      if (!res.ok) throw new Error('Erro ao carregar usuários')
      const data = await res.json()
      setUsers(data.users ?? [])
      if (resC.ok) {
        const dc = await resC.json()
        setCustomers(dc.customers ?? [])
      }
    } catch (e) {
      console.error('[useUsers]', e.message)
      setError(e.message)
      setUsers([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  /* Guard: só busca quando user está disponível (token pronto) */
  useEffect(() => {
    if (authUser) fetchAll()
  }, [authUser, fetchAll])

  /* ─── Criar (convidar) ─── */
  const inviteUser = useCallback(async (payload) => {
    const data = await authFetchJson('/api/users/invite', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    await fetchAll()
    return data
  }, [fetchAll])

  /* ─── Atualizar (modo edição) ─── */
  const updateUser = useCallback(async (userId, payload) => {
    const data = await authFetchJson(`/api/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    await fetchAll()
    return data
  }, [fetchAll])

  /* ─── Atualizar roles (multi) ─── */
  const updateRoles = useCallback(async (userId, roles) => {
    await authFetchJson(`/api/users/${userId}/roles`, {
      method: 'PUT',
      body: JSON.stringify({ roles }),
    })
    await fetchAll()
  }, [fetchAll])

  /* ─── Legacy: alterar papel único ─── */
  const updateRole = useCallback(async (userId, newRole) => {
    await authFetchJson(`/api/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role: newRole }),
    })
    await fetchAll()
  }, [fetchAll])

  /* ─── Revogar ─── */
  const revokeUser = useCallback(async (userId) => {
    await authFetchJson(`/api/users/${userId}/revoke`, { method: 'PUT' })
    await fetchAll()
  }, [fetchAll])

  /* ─── Reativar ─── */
  const reactivate = useCallback(async (userId) => {
    await authFetchJson(`/api/users/${userId}/reactivate`, { method: 'PUT' })
    await fetchAll()
  }, [fetchAll])

  /* ─── Reenviar convite (stub) ─── */
  const resendInvite = useCallback(async (userId) => {
    try {
      await authFetch(`/api/users/${userId}/resend-invite`, { method: 'POST' })
    } catch {}
  }, [])

  const stats = {
    total:    users.length,
    active:   users.filter(u => u.status === 'ativo').length,
    invited:  users.filter(u => u.status === 'convidado').length,
    revoked:  users.filter(u => u.status === 'revogado').length,
  }

  return {
    users,
    customers,
    isLoading,
    error,
    refetch: fetchAll,
    inviteUser,
    updateUser,
    updateRoles,
    updateRole,        // legacy
    revokeUser,
    reactivate,
    resendInvite,
    stats,
  }
}
