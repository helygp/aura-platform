/**
 * hooks/useDashboard.js
 *
 * Busca KPIs e dados de gráfico do dashboard via API.
 *
 * Retorna:
 *   kpis        : { revenue, pendingOrders, criticalSkus, activeCustomers }
 *   chartData   : [{ date, total }]  — últimos 7 dias
 *   isLoading   : boolean
 *   isError     : boolean
 *   refetch     : () => void
 *
 * Se a API /api/dashboard/summary não existir ainda (Sprint 2),
 * usa dados mockados para não travar o desenvolvimento do front.
 */

import { useState, useEffect, useCallback } from 'react'

/* ─── Mock enquanto a API não existe ─── */
function generateMock() {
  const today = new Date()
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    return {
      date:  d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' }),
      total: Math.floor(Math.random() * 8000) + 2000,
    }
  })

  return {
    kpis: {
      revenue:         { value: 14720.50, trend: +8.3 },
      pendingOrders:   { value: 7,        trend: -2   },
      criticalSkus:    { value: 3,        trend: +1   },
      activeCustomers: { value: 42,       trend: +5.1 },
    },
    chartData,
  }
}

export function useDashboard() {
  const [data,      setData]      = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isError,   setIsError]   = useState(false)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setIsError(false)
    try {
      const res = await fetch('/api/dashboard/summary', { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch {
      // API ainda não existe → usa mock
      await new Promise(r => setTimeout(r, 600)) // simula latência
      setData(generateMock())
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return {
    kpis:      data?.kpis      ?? null,
    chartData: data?.chartData ?? [],
    isLoading,
    isError,
    refetch: fetchData,
  }
}
