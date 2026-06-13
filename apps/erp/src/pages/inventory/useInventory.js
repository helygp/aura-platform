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
 *   attrFacets  : { atributo: [valores distintos ordenados] }
 *   stats       : { total, ok, low, zero }
 *   refetch     : fn
 *   addMovement : (skuId, { type, qty, reason }) => Promise
 *   getMovements: (skuId) => array
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../auth/AuthContext.jsx'
import { stockStatus } from './inventoryTypes.js'
import { compareSize, compareColor } from './sortPresets.js'

const PAGE_SIZE = 15

/* Ordem preferida das facetas (Cor antes de Tamanho, depois alfabético). */
const FACET_PREF_ORDER = ['cor', 'color', 'estampa', 'tamanho', 'size', 'tam']

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
  const [filters,    setFiltersRaw] = useState({ search: '', status: 'all', category: '', attrs: {} })
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

  /* ─── Facetas de atributo (Cor, Tamanho, …) derivadas dos SKUs ─── */
  const attrFacets = useMemo(() => {
    const map = {} // key -> Set de valores
    for (const s of allSkus) {
      const a = s.attributes ?? {}
      for (const k of Object.keys(a)) {
        const v = a[k]
        if (v == null || String(v).trim() === '') continue
        ;(map[k] ??= new Set()).add(String(v))
      }
    }
    const orderedKeys = Object.keys(map).sort((a, b) => {
      const ia = FACET_PREF_ORDER.indexOf(a.toLowerCase())
      const ib = FACET_PREF_ORDER.indexOf(b.toLowerCase())
      if (ia !== -1 && ib !== -1) return ia - ib
      if (ia !== -1) return -1
      if (ib !== -1) return 1
      return a.localeCompare(b, 'pt-BR')
    })
    const out = {}
    for (const k of orderedKeys) {
      const vals = [...map[k]]
      const isSize = /tamanho|size|tam/i.test(k)
      vals.sort(isSize ? compareSize : compareColor)
      out[k] = vals
    }
    return out
  }, [allSkus])

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
    // Facetas: AND entre atributos, OR dentro do mesmo atributo
    const attrKeys = Object.keys(filters.attrs ?? {})
    if (attrKeys.length) list = list.filter(s => {
      const a = s.attributes ?? {}
      return attrKeys.every(k => {
        const sel = filters.attrs[k]
        if (!sel || !sel.length) return true
        return sel.includes(String(a[k]))
      })
    })
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
    attrFacets,
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
