/**
 * pages/products/useProducts.js
 *
 * Hook de dados do módulo de produtos.
 *
 * Retorna:
 *   products    : array filtrado e paginado
 *   total       : total sem filtros
 *   isLoading   : boolean
 *   filters     : { search, type, category }
 *   setFilters  : fn
 *   page        : number
 *   setPage     : fn
 *   refetch     : fn
 *   saveProduct : (data) => Promise  — cria ou atualiza
 *   deleteProduct: (id) => Promise
 *
 * Usa mock enquanto a API não existe.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { PRODUCT_TYPES, STOCK_STATUS } from './productsTypes.js'

const PAGE_SIZE = 12

/* ─── Dados mock ─── */
function buildMock() {
  const cats   = ['Calçados', 'Roupas', 'Acessórios', 'Bolsas']
  const names  = [
    'Tênis Runner Pro', 'Camiseta Básica', 'Bolsa Couro Clássica',
    'Calça Jeans Slim', 'Sandália Conforto', 'Boné Aba Reta',
    'Mochila Executiva', 'Vestido Floral', 'Jaqueta Corta-Vento',
    'Short Esportivo', 'Sapato Social', 'Blusa Manga Longa',
  ]

  return names.map((name, i) => {
    const isVariant = i % 3 !== 0
    const code = `PROD-${String(i + 1).padStart(3, '0')}`
    return {
      id:       `prod-${i + 1}`,
      name,
      code,
      category: cats[i % cats.length],
      type:     isVariant ? PRODUCT_TYPES.VARIANT : PRODUCT_TYPES.SIMPLE,
      imageUrl: null,
      skus: isVariant
        ? [
            { id: `${code}-PM`, code: `${code}-P-PRE`, attributes: { Tamanho: 'P', Cor: 'Preto' }, priceWholesale: 89.9 + i * 10, stock: Math.floor(Math.random() * 40), stockMin: 5 },
            { id: `${code}-MM`, code: `${code}-M-PRE`, attributes: { Tamanho: 'M', Cor: 'Preto' }, priceWholesale: 89.9 + i * 10, stock: Math.floor(Math.random() * 40), stockMin: 5 },
            { id: `${code}-GG`, code: `${code}-G-BRA`, attributes: { Tamanho: 'G', Cor: 'Branco' }, priceWholesale: 94.9 + i * 10, stock: 0, stockMin: 5 },
          ]
        : [
            { id: `${code}-UN`, code, attributes: {}, priceWholesale: 129.9 + i * 15, stock: Math.floor(Math.random() * 60) + 1, stockMin: 10 },
          ],
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
    }
  })
}

let MOCK_DB = buildMock()

export function useProducts() {
  const [allProducts, setAllProducts] = useState([])
  const [isLoading,   setIsLoading]   = useState(true)
  const [filters,     setFilters]     = useState({ search: '', type: '', category: '' })
  const [page,        setPage]        = useState(1)

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/products', { credentials: 'include' })
      if (!res.ok) throw new Error()
      const json = await res.json()
      setAllProducts(json.products ?? [])
    } catch {
      await new Promise(r => setTimeout(r, 400))
      setAllProducts([...MOCK_DB])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  /* ─── Filtro client-side (prod: filtrar no servidor) ─── */
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

  /* ─── Reset page ao filtrar ─── */
  const updateFilters = useCallback((updates) => {
    setFilters(prev => ({ ...prev, ...updates }))
    setPage(1)
  }, [])

  /* ─── Salvar (create/update) ─── */
  const saveProduct = useCallback(async (data) => {
    try {
      const method = data.id ? 'PUT' : 'POST'
      const url    = data.id ? `/api/products/${data.id}` : '/api/products'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      await fetchAll()
    } catch {
      // mock local
      if (data.id) {
        MOCK_DB = MOCK_DB.map(p => p.id === data.id ? { ...p, ...data } : p)
      } else {
        const newProd = {
          ...data,
          id: `prod-${Date.now()}`,
          createdAt: new Date().toISOString(),
        }
        MOCK_DB = [newProd, ...MOCK_DB]
      }
      setAllProducts([...MOCK_DB])
    }
  }, [fetchAll])

  /* ─── Deletar ─── */
  const deleteProduct = useCallback(async (id) => {
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE', credentials: 'include',
      })
      if (!res.ok) throw new Error()
      await fetchAll()
    } catch {
      MOCK_DB = MOCK_DB.filter(p => p.id !== id)
      setAllProducts([...MOCK_DB])
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
    PAGE_SIZE,
  }
}
