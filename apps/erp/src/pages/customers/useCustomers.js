/**
 * pages/customers/useCustomers.js — sem dados mockados
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../auth/AuthContext.jsx'
import { CUSTOMER_STATUS } from './customersTypes.js'

const PAGE_SIZE = 15

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

export function useCustomers() {
  const { user } = useAuth()
  const [allCustomers, setAllCustomers] = useState([])
  const [isLoading,    setIsLoading]    = useState(true)
  const [error,        setError]        = useState(null)
  const [filters,      setFiltersRaw]   = useState({ search: '', status: '' })
  const [page,         setPage]         = useState(1)

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/customers')
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const json = await res.json()
      setAllCustomers(json.customers ?? [])
    } catch (e) {
      setError(e.message)
      setAllCustomers([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { if (user) fetchAll() }, [fetchAll, user])

  const filtered = useMemo(() => {
    let list = allCustomers
    const q = filters.search.trim().toLowerCase()
    if (q) {
      const qNum = q.replace(/\D/g, '')
      list = list.filter(c =>
        (c.name ?? '').toLowerCase().includes(q) ||
        (qNum && (c.document ?? '').replace(/\D/g, '').includes(qNum)) ||
        (qNum && (c.whatsapp ?? '').replace(/\D/g, '').includes(qNum))
      )
    }
    if (filters.status) list = list.filter(c => c.status === filters.status)
    return list
  }, [allCustomers, filters])

  const paginated  = useMemo(() =>
    filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
  [filtered, page])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const setFilters = useCallback((updates) => {
    setFiltersRaw(prev => ({ ...prev, ...updates }))
    setPage(1)
  }, [])

  const stats = useMemo(() => ({
    total:    allCustomers.length,
    active:   allCustomers.filter(c => c.status === CUSTOMER_STATUS.ACTIVE).length,
    inactive: allCustomers.filter(c => c.status === CUSTOMER_STATUS.INACTIVE).length,
    blocked:  allCustomers.filter(c => c.status === CUSTOMER_STATUS.BLOCKED).length,
  }), [allCustomers])

  const saveCustomer = useCallback(async (data) => {
    const method = data.id ? 'PUT' : 'POST'
    const url    = data.id ? `/api/customers/${data.id}` : '/api/customers'
    const res    = await authFetch(url, { method, body: JSON.stringify(data) })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      throw new Error(d.error || 'Erro ao salvar cliente')
    }
    await fetchAll()
  }, [fetchAll])

  const deleteCustomer = useCallback(async (id) => {
    const res = await authFetch(`/api/customers/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      throw new Error(d.error || 'Erro ao excluir cliente')
    }
    await fetchAll()
  }, [fetchAll])

  const getCustomerOrders = useCallback((customerId) =>
    allCustomers.find(c => c.id === customerId)?.orders ?? [],
  [allCustomers])

  return {
    customers: paginated,
    total: filtered.length,
    totalPages,
    isLoading,
    error,
    filters,
    setFilters,
    page,
    setPage,
    refetch:         fetchAll,
    saveCustomer,
    deleteCustomer,
    getCustomerOrders,
    stats,
    PAGE_SIZE,
  }
}
