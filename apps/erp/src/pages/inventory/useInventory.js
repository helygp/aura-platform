/**
 * pages/inventory/useInventory.js
 *
 * Hook de dados do módulo de estoque.
 * Usa a API real — sem fallback mock.
 *
 * Retorna:
 *   skus        : SKUs filtrados e paginados
 *   total / totalPages / isLoading / error
 *   filters / setFilters / page / setPage
 *   stats       : { total, ok, low, zero }
 *   refetch     : fn
 *   addMovement : (skuId, { type, qty, reason }) => Promise
 *   getMovements: (skuId) => array
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../auth/AuthContext.jsx'
import { stockStatus } from './inventoryTypes.js'

const PAGE_SIZE = 15

/* ─── authFetch com Bearer token (mesmo padrão dos outros hooks) ─── */
function authFetch(url, opts = {}) {
  const token = window.__aura_mem_token__ || ''
  return fetch(url, {
    ...opts,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
      ...(opts.headers ?? {}),
    },
  })
}

export function useInventory() {
  const { user } = useAuth()

  const [allSkus,    setAllSkus]    = useState([])
  const [movBySkuId, setMovBySkuId] = useState({})
  const [isLoading,  setIsLoading]  = useState(true)
  const [error,      setError]      = useState(null)
  const [filters,    setFiltersRaw] = useState({ search: '', status: 'all', category: '' })
  const [page,       setPage]       = useState(1)

  /* ─── Busca lista de SKUs da API ─── */
  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/inventory')
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const json = await res.json()
      setAllSkus(json.skus ?? [])
    } catch (e) {
      setError(e.message)
      setAllSkus([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { if (user) fetchAll() }, [fetchAll, user])

  /* ─── Filtros client-side ─── */
  const filtered = useMemo(() => {
    let list = allSkus
    const q = filters.search.trim().toLowerCase()
    if (q) list = list.filter(s =>
      s.code.toLowerCase().includes(q) ||
      s.productName.toLowerCase().includes(q) ||
      Object.values(s.attributes ?? {}).some(v =>
        String(v).toLowerCase().includes(q)
      )
    )
    if (filters.category) list = list.filter(s =>
      (s.category ?? s.productCategory ?? '').toLowerCase() === filters.category.toLowerCase()
    )
    if (filters.status === 'critico') {
      list = list.filter(s => {
        const st = s.stockStatus ?? stockStatus(s)
        return st === 'baixo' || st === 'zerado'
      })
    } else if (filters.status !== 'all') {
      list = list.filter(s => (s.stockStatus ?? stockStatus(s)) === filters.status)
    }
    return list
  }, [allSkus, filters])

  const paginated  = useMemo(() =>
    filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
  [filtered, page])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const setFilters = useCallback((updates) => {
    setFiltersRaw(prev => ({ ...prev, ...updates }))
    setPage(1)
  }, [])

  const stats = useMemo(() => ({
    total: allSkus.length,
    ok:    allSkus.filter(s => (s.stockStatus ?? stockStatus(s)) === 'ok').length,
    low:   allSkus.filter(s => (s.stockStatus ?? stockStatus(s)) === 'baixo').length,
    zero:  allSkus.filter(s => (s.stockStatus ?? stockStatus(s)) === 'zerado').length,
  }), [allSkus])

  /* ─── Registrar movimentação ─── */
  const addMovement = useCallback(async (skuId, { type, qty, reason }) => {
    const qtyNum = Number(qty)
    if (!qtyNum || qtyNum <= 0) throw new Error('Quantidade inválida')

    // POST /api/inventory/:skuId/movement  (singular — conforme a rota no backend)
    const res = await authFetch(`/api/inventory/${skuId}/movement`, {
      method: 'POST',
      body: JSON.stringify({ type, qty: qtyNum, reason }),
    })

    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      throw new Error(d.error || 'Erro ao registrar movimentação')
    }

    await fetchAll()
  }, [fetchAll])

  /* ─── Normaliza campos snake_case → camelCase vindos da API ─── */
  function normMov(m) {
    return {
      id:        m.id,
      type:      m.type,
      qty:       m.qty,
      qtyBefore: m.qty_before  ?? m.qtyBefore  ?? 0,
      qtyAfter:  m.qty_after   ?? m.qtyAfter   ?? 0,
      reason:    m.reason      ?? "",
      user:      m.user_name   ?? m.user        ?? "sistema",
      createdAt: m.created_at  ?? m.createdAt   ?? new Date().toISOString(),
    }
  }

  /* ─── Histórico de movimentos do SKU ─── */
  const fetchMovements = useCallback(async (skuId) => {
    try {
      const res = await authFetch(`/api/inventory/${skuId}/movements`)
      if (!res.ok) return
      const json = await res.json()
      setMovBySkuId(prev => ({ ...prev, [skuId]: (json.movements ?? []).map(normMov) }))
    } catch { /* silencioso */ }
  }, [])

  const getMovements = useCallback((skuId) => movBySkuId[skuId] ?? [], [movBySkuId])

  return {
    skus: paginated,
    total: filtered.length,
    totalPages,
    isLoading,
    error,
    filters,
    setFilters,
    page,
    setPage,
    refetch: fetchAll,
    addMovement,
    getMovements,
    fetchMovements,
    stats,
    PAGE_SIZE,
  }
}
