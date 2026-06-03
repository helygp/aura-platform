/**
 * pages/inventory/useInventory.js
 *
 * Hook de dados do módulo de estoque.
 *
 * Retorna:
 *   skus          : SKUs filtrados e paginados (com info do produto pai)
 *   total         : total sem paginação
 *   totalPages    : número de páginas
 *   isLoading     : boolean
 *   filters       : { search, status }
 *   setFilters    : fn
 *   page / setPage
 *   refetch       : fn
 *   addMovement   : (skuId, { type, qty, reason }) => Promise
 *   movements     : (skuId) => array de movimentos do SKU
 *
 * Usa mock local enquanto /api/inventory não existe.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { stockStatus, MOVEMENT_TYPES } from './inventoryTypes.js'

const PAGE_SIZE = 15

/* ─── Mock ─── */
function buildMockSkus() {
  const products = [
    { name: 'Tênis Runner Pro',    code: 'PROD-001' },
    { name: 'Camiseta Básica',     code: 'PROD-002' },
    { name: 'Bolsa Couro Clássica',code: 'PROD-003' },
    { name: 'Calça Jeans Slim',    code: 'PROD-004' },
    { name: 'Sandália Conforto',   code: 'PROD-005' },
    { name: 'Boné Aba Reta',       code: 'PROD-006' },
    { name: 'Mochila Executiva',   code: 'PROD-007' },
    { name: 'Vestido Floral',      code: 'PROD-008' },
  ]
  const sizes  = ['P', 'M', 'G', 'GG']
  const colors = ['Preto', 'Branco', 'Azul']

  const skus = []
  products.forEach((prod, pi) => {
    sizes.slice(0, pi % 2 === 0 ? 4 : 2).forEach((size, si) => {
      colors.slice(0, pi % 3 === 0 ? 3 : 1).forEach((color, ci) => {
        const stock    = Math.floor(Math.random() * 50)
        const stockMin = 5 + (pi % 3) * 3
        skus.push({
          id:         `sku-${pi}-${si}-${ci}`,
          productId:  `prod-${pi + 1}`,
          productName: prod.name,
          productCode: prod.code,
          code:       `${prod.code}-${size.replace(/\s/g,'')}-${color.slice(0,3).toUpperCase()}`,
          attributes: { Tamanho: size, Cor: color },
          stock,
          stockMin,
          priceWholesale: 79.9 + pi * 12 + si * 5,
        })
      })
    })
  })
  return skus
}

function buildMockMovements(skuIds) {
  const types   = [MOVEMENT_TYPES.IN, MOVEMENT_TYPES.OUT, MOVEMENT_TYPES.ADJ]
  const reasons = ['Compra fornecedor', 'Venda atacado', 'Devolução', 'Ajuste inventário', 'Perda']
  const movs    = {}
  skuIds.forEach(id => {
    movs[id] = Array.from({ length: Math.floor(Math.random() * 6) + 2 }, (_, i) => ({
      id:        `mov-${id}-${i}`,
      type:      types[i % types.length],
      qty:       Math.floor(Math.random() * 20) + 1,
      reason:    reasons[i % reasons.length],
      user:      'admin',
      createdAt: new Date(Date.now() - i * 3600000 * (i + 1)).toISOString(),
    }))
  })
  return movs
}

let MOCK_SKUS = buildMockSkus()
let MOCK_MOVS = buildMockMovements(MOCK_SKUS.map(s => s.id))

export function useInventory() {
  const [allSkus,   setAllSkus]   = useState([])
  const [movBySkuId, setMovBySkuId] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [filters,   setFiltersRaw] = useState({ search: '', status: 'all' })
  const [page,      setPage]       = useState(1)

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/inventory', { credentials: 'include' })
      if (!res.ok) throw new Error()
      const json = await res.json()
      setAllSkus(json.skus ?? [])
      setMovBySkuId(json.movements ?? {})
    } catch {
      await new Promise(r => setTimeout(r, 500))
      setAllSkus([...MOCK_SKUS])
      setMovBySkuId({ ...MOCK_MOVS })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  /* ─── Filtros ─── */
  const filtered = useMemo(() => {
    let list = allSkus
    const q = filters.search.trim().toLowerCase()
    if (q) list = list.filter(s =>
      s.code.toLowerCase().includes(q) ||
      s.productName.toLowerCase().includes(q)
    )
    if (filters.status !== 'all') {
      list = list.filter(s => stockStatus(s) === filters.status)
    }
    return list
  }, [allSkus, filters])

  const paginated   = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page])
  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE)

  const setFilters = useCallback((updates) => {
    setFiltersRaw(prev => ({ ...prev, ...updates }))
    setPage(1)
  }, [])

  /* ─── Estatísticas para o summary bar ─── */
  const stats = useMemo(() => ({
    total:  allSkus.length,
    ok:     allSkus.filter(s => stockStatus(s) === 'ok').length,
    low:    allSkus.filter(s => stockStatus(s) === 'baixo').length,
    zero:   allSkus.filter(s => stockStatus(s) === 'zerado').length,
  }), [allSkus])

  /* ─── Adicionar movimentação ─── */
  const addMovement = useCallback(async (skuId, { type, qty, reason }) => {
    const qtyNum = Number(qty)
    if (!qtyNum || qtyNum <= 0) throw new Error('Quantidade inválida')

    try {
      const res = await fetch(`/api/inventory/${skuId}/movements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type, qty: qtyNum, reason }),
      })
      if (!res.ok) throw new Error()
      await fetchAll()
    } catch {
      // mock local
      const delta = type === MOVEMENT_TYPES.IN  ?  qtyNum
                  : type === MOVEMENT_TYPES.OUT ? -qtyNum
                  : qtyNum - (MOCK_SKUS.find(s => s.id === skuId)?.stock ?? 0)

      MOCK_SKUS = MOCK_SKUS.map(s =>
        s.id === skuId
          ? { ...s, stock: Math.max(0, s.stock + delta) }
          : s
      )
      const newMov = {
        id: `mov-${Date.now()}`,
        type, qty: qtyNum, reason,
        user: 'admin',
        createdAt: new Date().toISOString(),
      }
      MOCK_MOVS = {
        ...MOCK_MOVS,
        [skuId]: [newMov, ...(MOCK_MOVS[skuId] ?? [])],
      }
      setAllSkus([...MOCK_SKUS])
      setMovBySkuId({ ...MOCK_MOVS })
    }
  }, [fetchAll])

  const getMovements = useCallback((skuId) => movBySkuId[skuId] ?? [], [movBySkuId])

  return {
    skus: paginated,
    total: filtered.length,
    totalPages,
    isLoading,
    filters,
    setFilters,
    page,
    setPage,
    refetch: fetchAll,
    addMovement,
    getMovements,
    stats,
    PAGE_SIZE,
  }
}
