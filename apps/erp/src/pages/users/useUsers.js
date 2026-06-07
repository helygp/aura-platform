/**
 * pages/users/useUsers.js
 *
 * Hook de dados do módulo de usuários do tenant.
 *
 * Retorna:
 *   users         — array de usuários do tenant
 *   isLoading
 *   refetch
 *   inviteUser    ({ name, email, role }) => Promise
 *   updateRole    (userId, newRole)       => Promise
 *   revokeUser    (userId)                => Promise
 *   reactivate    (userId)                => Promise
 *   resendInvite  (userId)                => Promise
 */

import { useState, useEffect, useCallback } from 'react'

function authFetch(url, opts = {}) {
  const token = window.__aura_mem_token__ || ''
  return fetch(url, {
    ...opts,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(opts.headers ?? {}),
    },
  })
}
import { USER_STATUS } from './usersTypes.js'

/* ─── Mock ─── */
function buildMock() {
  return [
    {
      id:        'usr-1',
      name:      'Admin Aura',
      email:     'admin@acme.aurabr.app',
      role:      'admin',
      status:    USER_STATUS.ACTIVE,
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      lastLogin: new Date(Date.now() - 3600000).toISOString(),
      isSelf:    true,
    },
    {
      id:        'usr-2',
      name:      'Carla Financeiro',
      email:     'carla@acme.com.br',
      role:      'financeiro',
      status:    USER_STATUS.ACTIVE,
      createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
      lastLogin: new Date(Date.now() - 2 * 86400000).toISOString(),
      isSelf:    false,
    },
    {
      id:        'usr-3',
      name:      'Pedro Estoque',
      email:     'pedro@acme.com.br',
      role:      'estoque',
      status:    USER_STATUS.ACTIVE,
      createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
      lastLogin: new Date(Date.now() - 86400000).toISOString(),
      isSelf:    false,
    },
    {
      id:        'usr-4',
      name:      'Ana Operações',
      email:     'ana@acme.com.br',
      role:      'operador',
      status:    USER_STATUS.ACTIVE,
      createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      lastLogin: new Date(Date.now() - 4 * 3600000).toISOString(),
      isSelf:    false,
    },
    {
      id:        'usr-5',
      name:      'Lucas Novo',
      email:     'lucas@acme.com.br',
      role:      'operador',
      status:    USER_STATUS.INVITED,
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      lastLogin: null,
      isSelf:    false,
    },
    {
      id:        'usr-6',
      name:      'Marina Antiga',
      email:     'marina@acme.com.br',
      role:      'financeiro',
      status:    USER_STATUS.REVOKED,
      createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
      lastLogin: new Date(Date.now() - 30 * 86400000).toISOString(),
      isSelf:    false,
    },
  ]
}

let MOCK_DB = buildMock()

export function useUsers() {
  const [users,     setUsers]     = useState([])
  const [customers, setCustomers] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    try {
      const [res, resC] = await Promise.all([
        authFetch('/api/users'),
        authFetch('/api/customers'),
      ])
      if (!res.ok) throw new Error()
      const json = await res.json()
      setUsers(json.users ?? [])
      if (resC.ok) { const dc = await resC.json(); setCustomers(dc.customers ?? []) }
    } catch (e) {
      console.error('[useUsers]', e.message)
      setUsers([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  /* ─── Convidar ─── */
  const updateUser = useCallback(async (userId, data) => {
    const res = await authFetch(`/api/users/${userId}`, { method: 'PUT', body: JSON.stringify(data) })
    if (!res.ok) { const d = await res.json().catch(()=>({})); throw new Error(d.error || 'Erro ao atualizar') }
    await fetchAll()
  }, [fetchAll])

  const inviteUser = useCallback(async (payload) => {
    const res = await authFetch('/api/users/invite', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(d.error || 'Erro ao criar usuário')
    await fetchAll()
    return d
  }, [fetchAll])

  /* ─── Alterar papel ─── */
  const updateRole = useCallback(async (userId, newRole) => {
    try {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) throw new Error()
      await fetchAll()
    } catch {
      MOCK_DB = MOCK_DB.map(u => u.id === userId ? { ...u, role: newRole } : u)
      setUsers([...MOCK_DB])
    }
  }, [fetchAll])

  /* ─── Revogar ─── */
  const revokeUser = useCallback(async (userId) => {
    try {
      const res = await fetch(`/api/users/${userId}/revoke`, {
        method: 'PUT', credentials: 'include',
      })
      if (!res.ok) throw new Error()
      await fetchAll()
    } catch {
      MOCK_DB = MOCK_DB.map(u => u.id === userId ? { ...u, status: USER_STATUS.REVOKED } : u)
      setUsers([...MOCK_DB])
    }
  }, [fetchAll])

  /* ─── Reativar ─── */
  const reactivate = useCallback(async (userId) => {
    try {
      const res = await fetch(`/api/users/${userId}/reactivate`, {
        method: 'PUT', credentials: 'include',
      })
      if (!res.ok) throw new Error()
      await fetchAll()
    } catch {
      MOCK_DB = MOCK_DB.map(u => u.id === userId ? { ...u, status: USER_STATUS.ACTIVE } : u)
      setUsers([...MOCK_DB])
    }
  }, [fetchAll])

  /* ─── Reenviar convite ─── */
  const resendInvite = useCallback(async (userId) => {
    try {
      await fetch(`/api/users/${userId}/resend-invite`, {
        method: 'POST', credentials: 'include',
      })
    } catch {}
    // Apenas feedback local — nada muda no estado
  }, [])

  const stats = {
    total:    users.length,
    active:   users.filter(u => u.status === USER_STATUS.ACTIVE).length,
    invited:  users.filter(u => u.status === USER_STATUS.INVITED).length,
    revoked:  users.filter(u => u.status === USER_STATUS.REVOKED).length,
  }

  return {
    users,
    isLoading,
    refetch: fetchAll,
    customers,
    inviteUser,
    updateUser,
    updateRole,
    revokeUser,
    reactivate,
    resendInvite,
    stats,
  }
}
