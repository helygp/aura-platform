/**
 * pages/customers/useCustomers.js
 *
 * Hook de dados do módulo de clientes.
 *
 * Retorna:
 *   customers     — página atual (filtrado + paginado)
 *   total / totalPages
 *   isLoading
 *   filters / setFilters   — { search, status }
 *   page / setPage
 *   refetch
 *   saveCustomer  (data) => Promise   — create / update
 *   deleteCustomer (id) => Promise
 *   getCustomerOrders (customerId) => array
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { CUSTOMER_STATUS, PERSON_TYPE } from './customersTypes.js'

const PAGE_SIZE = 15

/* ─── Mock ─── */
function buildMock() {
  const names = [
    ['Distribuidora São Paulo Ltda',     'pj', '11.222.333/0001-44', '11999990001', 'SP'],
    ['Atacado Norte EIRELI',             'pj', '22.333.444/0001-55', '92999990002', 'RS'],
    ['Comércio Estrela ME',              'pj', '33.444.555/0001-66', '21999990003', 'RJ'],
    ['Moda Rápida Ltda',                 'pj', '44.555.666/0001-77', '31999990004', 'MG'],
    ['João Carlos Ferreira',             'pf', '123.456.789-00',     '11988880001', 'SP'],
    ['Boutique Central Eireli',          'pj', '55.666.777/0001-88', '85999990005', 'CE'],
    ['Ana Paula Santos',                 'pf', '987.654.321-00',     '41977770002', 'PR'],
    ['Multimarcas Oeste Ltda',           'pj', '66.777.888/0001-99', '67999990006', 'MS'],
    ['Têxtil Nordeste SA',               'pj', '77.888.999/0001-00', '81999990007', 'PE'],
    ['Fashion Line Eireli',              'pj', '88.999.000/0001-11', '62999990008', 'PI'],
    ['Carlos Eduardo Lima',              'pf', '111.222.333-44',     '11966660003', 'SP'],
    ['Empório do Calçado Ltda',          'pj', '99.000.111/0001-22', '54999990009', 'RS'],
    ['Pronto Moda ME',                   'pj', '00.111.222/0001-33', '91999990010', 'PA'],
    ['Maria Fernanda Rocha',             'pf', '444.555.666-77',     '51955550004', 'RS'],
    ['Distribuidora Centro-Oeste Ltda',  'pj', '11.333.555/0001-77', '61999990011', 'GO'],
  ]

  const statuses = [CUSTOMER_STATUS.ACTIVE, CUSTOMER_STATUS.ACTIVE, CUSTOMER_STATUS.ACTIVE, CUSTOMER_STATUS.INACTIVE, CUSTOMER_STATUS.BLOCKED]

  return names.map(([name, type, doc, wpp, uf], i) => ({
    id:           `cust-${i + 1}`,
    name,
    personType:   type,
    document:     doc,
    whatsapp:     wpp,
    email:        `contato${i + 1}@empresa.com.br`,
    status:       statuses[i % statuses.length],
    creditLimit:  (i + 1) * 500,
    address: {
      street:  `Rua das Flores, ${100 + i * 10}`,
      city:    'São Paulo',
      state:   uf,
      zip:     `0${1000 + i * 111}-000`,
    },
    createdAt: new Date(Date.now() - i * 86400000 * 3).toISOString(),
    orders: Array.from({ length: Math.floor(Math.random() * 8) + 1 }, (_, j) => ({
      id:        `ord-cust${i}-${j}`,
      total:     (j + 1) * 150 + i * 30,
      status:    ['entregue', 'confirmado', 'pendente'][j % 3],
      createdAt: new Date(Date.now() - j * 86400000 * 5).toISOString(),
    })),
  }))
}

let MOCK_DB = buildMock()

export function useCustomers() {
  const [allCustomers, setAllCustomers] = useState([])
  const [isLoading,    setIsLoading]    = useState(true)
  const [filters,      setFiltersRaw]   = useState({ search: '', status: '' })
  const [page,         setPage]         = useState(1)

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/customers', { credentials: 'include' })
      if (!res.ok) throw new Error()
      const json = await res.json()
      setAllCustomers(json.customers ?? [])
    } catch {
      await new Promise(r => setTimeout(r, 400))
      setAllCustomers([...MOCK_DB])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const filtered = useMemo(() => {
    let list = allCustomers
    const q = filters.search.trim().toLowerCase()
    if (q) list = list.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.document.replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
      c.whatsapp.replace(/\D/g, '').includes(q.replace(/\D/g, ''))
    )
    if (filters.status) list = list.filter(c => c.status === filters.status)
    return list
  }, [allCustomers, filters])

  const paginated  = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page])
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

  /* ─── Save ─── */
  const saveCustomer = useCallback(async (data) => {
    try {
      const method = data.id ? 'PUT' : 'POST'
      const url    = data.id ? `/api/customers/${data.id}` : '/api/customers'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      await fetchAll()
    } catch {
      if (data.id) {
        MOCK_DB = MOCK_DB.map(c => c.id === data.id ? { ...c, ...data } : c)
      } else {
        MOCK_DB = [{
          ...data,
          id:        `cust-${Date.now()}`,
          orders:    [],
          createdAt: new Date().toISOString(),
        }, ...MOCK_DB]
      }
      setAllCustomers([...MOCK_DB])
    }
  }, [fetchAll])

  /* ─── Delete ─── */
  const deleteCustomer = useCallback(async (id) => {
    try {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      await fetchAll()
    } catch {
      MOCK_DB = MOCK_DB.filter(c => c.id !== id)
      setAllCustomers([...MOCK_DB])
    }
  }, [fetchAll])

  const getCustomerOrders = useCallback((customerId) =>
    allCustomers.find(c => c.id === customerId)?.orders ?? [],
  [allCustomers])

  return {
    customers: paginated,
    total: filtered.length,
    totalPages,
    isLoading,
    filters,
    setFilters,
    page,
    setPage,
    refetch: fetchAll,
    saveCustomer,
    deleteCustomer,
    getCustomerOrders,
    stats,
    PAGE_SIZE,
  }
}
