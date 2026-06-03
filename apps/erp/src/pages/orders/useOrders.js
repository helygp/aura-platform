/**
 * pages/orders/useOrders.js
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ORDER_STATUS, ORDER_CHANNEL, calcOrderTotals } from './ordersTypes.js'

const PAGE_SIZE = 12

/* ─── Fallback para pedidos mockados (quando /api/orders falha) ─── */
const CUSTOMERS_MOCK = [
  { id: 'c1', name: 'Distribuidora São Paulo Ltda',  whatsapp: '11999990001' },
  { id: 'c2', name: 'Atacado Norte EIRELI',           whatsapp: '11999990002' },
  { id: 'c3', name: 'Comércio Estrela ME',            whatsapp: '11999990003' },
  { id: 'c4', name: 'Moda Rápida Ltda',               whatsapp: '11999990004' },
]

const SKUS_MOCK = [
  { id: 'sku-1', code: 'PROD-001-P-PRE', productName: 'Tênis Runner Pro',     attributes: { Tamanho: 'P', Cor: 'Preto'  }, priceWholesale: 89.90 },
  { id: 'sku-2', code: 'PROD-001-M-PRE', productName: 'Tênis Runner Pro',     attributes: { Tamanho: 'M', Cor: 'Preto'  }, priceWholesale: 89.90 },
  { id: 'sku-3', code: 'PROD-002-UN',    productName: 'Camiseta Básica',      attributes: {},                              priceWholesale: 39.90 },
  { id: 'sku-4', code: 'PROD-003-M-AZU', productName: 'Bolsa Couro Clássica', attributes: { Tamanho: 'M', Cor: 'Azul'   }, priceWholesale: 149.90 },
  { id: 'sku-5', code: 'PROD-004-G-BRA', productName: 'Calça Jeans Slim',    attributes: { Tamanho: 'G', Cor: 'Branco' }, priceWholesale: 79.90 },
]

const STATUSES = Object.values(ORDER_STATUS)
const CHANNELS = Object.values(ORDER_CHANNEL)
const NOTE_TEMPLATES = {
  [ORDER_STATUS.CONFIRMED]: 'Pedido confirmado pelo operador.',
  [ORDER_STATUS.PICKING]:   'Iniciada separação dos itens.',
  [ORDER_STATUS.SHIPPED]:   'Pedido enviado ao cliente.',
  [ORDER_STATUS.DELIVERED]: 'Entrega confirmada.',
  [ORDER_STATUS.CANCELLED]: 'Pedido cancelado.',
}

function buildMockOrders() {
  return Array.from({ length: 28 }, (_, i) => {
    const customer = CUSTOMERS_MOCK[i % CUSTOMERS_MOCK.length]
    const numItems = (i % 3) + 1
    const items = Array.from({ length: numItems }, (_, j) => {
      const sku = SKUS_MOCK[(i + j) % SKUS_MOCK.length]
      const qty = (j + 1) * 2
      return {
        id:          `item-${i}-${j}`,
        skuId:       sku.id,
        skuCode:     sku.code,
        productName: sku.productName,
        attributes:  sku.attributes,
        qty,
        priceUnit:   sku.priceWholesale,
      }
    })
    const { total } = calcOrderTotals(items)
    const status = STATUSES[i % STATUSES.length]
    const createdAt = new Date(Date.now() - i * 3600000 * 8).toISOString()

    const history = [
      { status: ORDER_STATUS.PENDING, note: 'Pedido criado.', user: 'sistema', at: createdAt },
    ]
    if (status !== ORDER_STATUS.PENDING && status !== ORDER_STATUS.CANCELLED) {
      history.push({ status: ORDER_STATUS.CONFIRMED, note: NOTE_TEMPLATES[ORDER_STATUS.CONFIRMED], user: 'admin', at: new Date(Date.parse(createdAt) + 3600000).toISOString() })
    }

    return {
      id:         `ord-${String(i + 1).padStart(6, '0')}`,
      customerId: customer.id,
      customerName: customer.name,
      customerWhatsapp: customer.whatsapp,
      channel:    CHANNELS[i % CHANNELS.length],
      status,
      items,
      total,
      notes:      i % 4 === 0 ? 'Entregar na portaria.' : '',
      history,
      createdAt,
      updatedAt:  createdAt,
    }
  })
}

let MOCK_DB = buildMockOrders()

export function useOrders() {
  const [allOrders, setAllOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters,   setFiltersRaw] = useState({
    search: '', status: '', channel: '', dateFrom: '', dateTo: '',
  })
  const [page,      setPage]      = useState(1)
  const [customers, setCustomers] = useState([])
  const [skus,      setSkus]      = useState([])

  /* ─── Busca clientes e produtos reais ─── */
  const fetchCatalog = useCallback(async () => {
    try {
      const [custRes, prodRes] = await Promise.all([
        fetch('/api/customers', { credentials: 'include' }),
        fetch('/api/products',  { credentials: 'include' }),
      ])
      if (custRes.ok) {
        const { customers: list } = await custRes.json()
        setCustomers(list ?? [])
      }
      if (prodRes.ok) {
        const { products } = await prodRes.json()
        const skuList = (products ?? []).flatMap(p =>
          (p.skus ?? []).map(sku => ({
            id:             sku.id,
            code:           sku.code,
            productName:    p.name,
            attributes:     sku.attributes ?? {},
            priceWholesale: sku.priceWholesale ?? 0,
          }))
        )
        setSkus(skuList)
      }
    } catch {
      // silently fail — formulário mostra listas vazias
    }
  }, [])

  useEffect(() => { fetchCatalog() }, [fetchCatalog])

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/orders', { credentials: 'include' })
      if (!res.ok) throw new Error()
      const json = await res.json()
      setAllOrders(json.orders ?? [])
    } catch {
      await new Promise(r => setTimeout(r, 450))
      setAllOrders([...MOCK_DB])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  /* ─── Filtro client-side ─── */
  const filtered = useMemo(() => {
    let list = allOrders
    const q = filters.search.trim().toLowerCase()
    if (q) list = list.filter(o =>
      o.id.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q)
    )
    if (filters.status)  list = list.filter(o => o.status  === filters.status)
    if (filters.channel) list = list.filter(o => o.channel === filters.channel)
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom)
      list = list.filter(o => new Date(o.createdAt) >= from)
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo)
      to.setHours(23, 59, 59)
      list = list.filter(o => new Date(o.createdAt) <= to)
    }
    return list
  }, [allOrders, filters])

  const paginated  = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page])
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const setFilters = useCallback((updates) => {
    setFiltersRaw(prev => ({ ...prev, ...updates }))
    setPage(1)
  }, [])

  const stats = useMemo(() => ({
    total:    allOrders.length,
    pending:  allOrders.filter(o => o.status === ORDER_STATUS.PENDING).length,
    today:    allOrders.filter(o => new Date(o.createdAt).toDateString() === new Date().toDateString()).length,
  }), [allOrders])

  /* ─── Criar pedido ─── */
  const createOrder = useCallback(async (payload) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      await fetchAll()
    } catch {
      const { total } = calcOrderTotals(payload.items)
      const newOrder = {
        ...payload,
        id:        `ord-${String(Date.now()).slice(-6)}`,
        status:    ORDER_STATUS.PENDING,
        total,
        history:   [{ status: ORDER_STATUS.PENDING, note: 'Pedido criado.', user: 'admin', at: new Date().toISOString() }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      MOCK_DB = [newOrder, ...MOCK_DB]
      setAllOrders([...MOCK_DB])
    }
  }, [fetchAll])

  /* ─── Atualizar status ─── */
  const updateStatus = useCallback(async (orderId, newStatus, note = '') => {
    const autoNote = note || NOTE_TEMPLATES[newStatus] || ''
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus, note: autoNote }),
      })
      if (!res.ok) throw new Error()
      await fetchAll()
    } catch {
      MOCK_DB = MOCK_DB.map(o => {
        if (o.id !== orderId) return o
        return {
          ...o,
          status: newStatus,
          updatedAt: new Date().toISOString(),
          history: [
            ...o.history,
            { status: newStatus, note: autoNote, user: 'admin', at: new Date().toISOString() },
          ],
        }
      })
      setAllOrders([...MOCK_DB])
    }
  }, [fetchAll])

  const getOrder = useCallback((orderId) =>
    allOrders.find(o => o.id === orderId) ?? null,
  [allOrders])

  return {
    orders: paginated,
    total:  filtered.length,
    totalPages,
    isLoading,
    filters,
    setFilters,
    page,
    setPage,
    refetch: fetchAll,
    createOrder,
    updateStatus,
    getOrder,
    stats,
    PAGE_SIZE,
    customers,
    skus,
  }
}
