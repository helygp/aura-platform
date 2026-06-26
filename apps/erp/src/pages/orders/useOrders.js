/**
 * pages/orders/useOrders.js
 * Sem dados mockados — usa apenas a API real.
 *
 * Ticket #49: trocado helper local por auth/authFetch.js (com auto-refresh em 401).
 * Tickets #83/#117: updateStatus aceita `reason`; nova `returnOrderItems` para devolução.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../auth/AuthContext.jsx'
import { authFetch } from '../../auth/authFetch.js'
import { ORDER_STATUS, calcOrderTotals } from './ordersTypes.js'

const PAGE_SIZE = 12

const NOTE_TEMPLATES = {
  [ORDER_STATUS.CONFIRMED]: 'Pedido confirmado.',
  [ORDER_STATUS.PICKING]:   'Iniciada separação dos itens.',
  [ORDER_STATUS.SHIPPED]:   'Pedido enviado ao cliente.',
  [ORDER_STATUS.DELIVERED]: 'Entrega confirmada.',
  [ORDER_STATUS.CANCELLED]: 'Pedido cancelado.',
}

export function useOrders() {
  const { user } = useAuth()
  const [allOrders, setAllOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState(null)
  const [filters,   setFiltersRaw] = useState({
    search: '', status: '', channel: '', dateFrom: '', dateTo: '', customerId: '',
  })
  const [page,      setPage]      = useState(1)
  const [customers, setCustomers] = useState([])
  const [skus,      setSkus]      = useState([])
  const [products,  setProducts]  = useState([])

  /* ─── Busca clientes e SKUs para o formulário ─── */
  const fetchCatalog = useCallback(async () => {
    try {
      const [custRes, prodRes] = await Promise.all([
        authFetch('/api/customers'),
        authFetch('/api/products'),
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
            stock:          sku.stock ?? 0,
          }))
        )
        setSkus(skuList)
        setProducts(products ?? [])
      }
    } catch (_e) {
      // silently fail — formulário mostra listas vazias
    }
  }, [])

  useEffect(() => { if (user) fetchCatalog() }, [fetchCatalog, user])

  /* ─── Busca pedidos reais ─── */
  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/orders')
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const json = await res.json()
      setAllOrders(json.orders ?? [])
    } catch (e) {
      setError(e.message)
      setAllOrders([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { if (user) fetchAll() }, [fetchAll, user])

  /* ─── Filtro client-side ─── */
  const filtered = useMemo(() => {
    let list = allOrders
    const q = filters.search.trim().toLowerCase()
    if (q) list = list.filter(o =>
      o.id.toLowerCase().includes(q) ||
      String(o.number ?? '').includes(q) ||
      (o.customerName ?? '').toLowerCase().includes(q)
    )
    if (filters.status)  list = list.filter(o => o.status  === filters.status)
    if (filters.channel) list = list.filter(o => o.channel === filters.channel)
    if (filters.customerId) list = list.filter(o => o.customerId === filters.customerId)
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

  const paginated  = useMemo(() =>
    filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
  [filtered, page])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const setFilters = useCallback((updates) => {
    setFiltersRaw(prev => ({ ...prev, ...updates }))
    setPage(1)
  }, [])

  const stats = useMemo(() => ({
    total:   allOrders.length,
    pending: allOrders.filter(o => o.status === ORDER_STATUS.PENDING).length,
    today:   allOrders.filter(o =>
      new Date(o.createdAt).toDateString() === new Date().toDateString()
    ).length,
  }), [allOrders])

  /* ─── Criar pedido ─── */
  const createOrder = useCallback(async (payload) => {
    const res = await authFetch('/api/orders', {
      method: 'POST',
      body:   JSON.stringify(payload),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      throw new Error(d.error || 'Erro ao criar pedido')
    }
    await fetchAll()
  }, [fetchAll])

  /* ─── Atualizar status (#83: aceita reasonId+note p/ cancelamento) ─── */
  const updateStatus = useCallback(async (orderId, newStatus, opts = {}) => {
    const { reasonId, note } = (opts && typeof opts === 'object') ? opts : { note: opts }
    const res = await authFetch(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      body:   JSON.stringify({
        status: newStatus,
        note:     note || NOTE_TEMPLATES[newStatus] || '',
        reasonId: reasonId || undefined,
      }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      throw new Error(d.error || 'Erro ao atualizar status')
    }
    await fetchAll()
  }, [fetchAll])

  /* ─── Devolução (#117): parcial ou total ───
   * items: [{itemId, qty}] (vazio/omitido => devolução total)
   * opts: { reasonId (obrigatório), note? } */
  const returnOrderItems = useCallback(async (orderId, items, opts) => {
    const { reasonId, note } = opts || {}
    const res = await authFetch(`/api/orders/${orderId}/return`, {
      method: 'POST',
      body:   JSON.stringify({ items, reasonId, note }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      throw new Error(d.error || 'Erro ao processar devolução')
    }
    await fetchAll()
  }, [fetchAll])

  /* ─── Edição: adicionar item ao pedido (#117) ─── */
  const addItemToOrder = useCallback(async (orderId, skuId, qty) => {
    const res = await authFetch(`/api/orders/${orderId}/items`, {
      method: 'POST',
      body:   JSON.stringify({ skuId, qty }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      throw new Error(d.error || 'Erro ao adicionar item')
    }
    await fetchAll()
  }, [fetchAll])

  /* ─── Edição: atualizar quantidade de item (#117) ─── */
  const updateItemQty = useCallback(async (orderId, itemId, qty) => {
    const res = await authFetch(`/api/orders/${orderId}/items/${itemId}`, {
      method: 'PUT',
      body:   JSON.stringify({ qty }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      throw new Error(d.error || 'Erro ao atualizar item')
    }
    await fetchAll()
  }, [fetchAll])

  const getOrder = useCallback((orderId) =>
    allOrders.find(o => o.id === orderId) ?? null,
  [allOrders])

  /* ─── Cancelar item parcial ─── */
  const cancelItem = useCallback(async (orderId, itemId, cancelQty) => {
    const res = await authFetch(`/api/orders/${orderId}/items/${itemId}/cancel`, {
      method: 'PATCH',
      body: cancelQty ? JSON.stringify({ cancelQty }) : undefined,
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      throw new Error(d.error || 'Erro ao cancelar item')
    }
    await fetchAll()
  }, [fetchAll])

  return {
    orders: paginated,
    total:  filtered.length,
    totalPages,
    isLoading,
    error,
    filters,
    setFilters,
    page,
    setPage,
    refetch: fetchAll,
    createOrder,
    updateStatus,
    cancelItem,
    returnOrderItems,
    addItemToOrder,
    updateItemQty,
    getOrder,
    stats,
    PAGE_SIZE,
    customers,
    skus,
    products,
  }
}
