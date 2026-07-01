/**
 * pages/products/useProducts.js
 *
 * Hook de dados do módulo de produtos.
 *
 * Fix 6.1: guard de autenticação + retry sem flash de estado vazio
 * Fix 6.2: usa authFetch central com refresh automático em 401
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../auth/AuthContext.jsx'
import { authFetch } from '../../auth/authFetch.js'
import { PRODUCT_TYPES } from './productsTypes.js'

const PAGE_SIZE = 12

export function useProducts() {
  const { user } = useAuth()
  const [allProducts, setAllProducts] = useState([])
  const [isLoading,   setIsLoading]   = useState(true)
  const [filters,     setFilters]     = useState({ search: '', type: '', category: '' })
  const [page,        setPage]        = useState(1)

  const fetchAll = useCallback(async (attempt = 0) => {
    // Controla loading: seta true apenas na primeira tentativa
    if (attempt === 0) setIsLoading(true)

    let willRetry = false
    try {
      const res = await authFetch('/api/products')

      // Cache 304 — re-fetch forçado sem cache
      if (res.status === 304) {
        const res2 = await authFetch('/api/products', { cache: 'no-store' })
        const json2 = await res2.json()
        setAllProducts(json2.products ?? [])
        return
      }

      if (!res.ok) {
        // Retry única em erro 5xx
        if (res.status >= 500 && attempt === 0) {
          willRetry = true
          await new Promise(r => setTimeout(r, 800))
          return fetchAll(1)
        }
        throw new Error(`Erro ${res.status}`)
      }

      const json = await res.json()
      setAllProducts(json.products ?? [])
    } catch (e) {
      console.error('[useProducts] fetchAll:', e.message)
      if (attempt === 0) {
        willRetry = true
        await new Promise(r => setTimeout(r, 600))
        return fetchAll(1)
      }
      // Na segunda tentativa: mantém dados existentes se houver
      setAllProducts(prev => prev)
    } finally {
      // Só limpa o loading se não formos fazer retry (para evitar flash de estado vazio)
      if (!willRetry) setIsLoading(false)
    }
  }, [])

  // Guard de autenticação: só busca quando user está disponível
  useEffect(() => {
    if (user) fetchAll()
  }, [fetchAll, user])

  /* ─── Filtro client-side ─── */
  const filtered = useMemo(() => {
    let list = allProducts
    const q = filters.search.trim().toLowerCase()
    if (q)              list = list.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
    if (filters.type)   list = list.filter(p => p.type === filters.type)
    if (filters.category) list = list.filter(p => p.category === filters.category)
    return list
  }, [allProducts, filters])

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const updateFilters = useCallback((updates) => {
    setFilters(prev => ({ ...prev, ...updates }))
    setPage(1)
  }, [])

  const saveProduct = useCallback(async (data) => {
    try {
      const method = data.id ? 'PUT' : 'POST'
      const url    = data.id ? `/api/products/${data.id}` : '/api/products'
      const res    = await authFetch(url, { method, body: JSON.stringify(data) })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `Erro ${res.status}`)
      }
      await fetchAll()
    } catch (e) {
      console.error('[useProducts/save]', e.message)
      throw e
    }
  }, [fetchAll])

  const deleteProduct = useCallback(async (id) => {
    try {
      const res = await authFetch(`/api/products/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      await fetchAll()
    } catch (e) {
      console.error('[useProducts/delete]', e.message)
      throw e
    }
  }, [fetchAll])

  // Publica/despublica na vitrine (#183)
  const publishProduct = useCallback(async (id, publico) => {
    try {
      const res = await authFetch(`/api/products/${id}/publish`, {
        method: 'PATCH', body: JSON.stringify({ publico }),
      })
      if (!res.ok) throw new Error()
      await fetchAll()
    } catch (e) {
      console.error('[useProducts/publish]', e.message)
      throw e
    }
  }, [fetchAll])

  return {
    products:   paginated,
    total:      filtered.length,
    totalPages: Math.ceil(filtered.length / PAGE_SIZE),
    isLoading,
    filters,
    setFilters: updateFilters,
    page,
    setPage,
    refetch:    fetchAll,
    saveProduct,
    deleteProduct,
    publishProduct,
    PAGE_SIZE,
  }
}
