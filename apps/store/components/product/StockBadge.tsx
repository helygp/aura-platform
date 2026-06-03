'use client'

/**
 * components/product/StockBadge.tsx
 * Indicador de disponibilidade em tempo real.
 * Polling leve a cada 30s para atualizar o estoque sem SSE.
 */

import { useState, useEffect } from 'react'

type Status = 'loading' | 'in_stock' | 'low_stock' | 'out_of_stock'

interface Props {
  tenantSlug: string
  skuId: string          // token opaco do SKU selecionado
  initialStock: number   // estoque do SSR — evita loading no primeiro render
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''
const POLL_INTERVAL = 30_000

export default function StockBadge({ tenantSlug, skuId, initialStock }: Props) {
  const [stock, setStock] = useState(initialStock)
  const [status, setStatus] = useState<Status>(stockToStatus(initialStock))

  useEffect(() => {
    if (!skuId) return

    // Primeira busca imediata (SSR já deu o inicial, mas pode estar desatualizado)
    fetchStock()
    const timer = setInterval(fetchStock, POLL_INTERVAL)
    return () => clearInterval(timer)

    async function fetchStock() {
      try {
        const res = await fetch(`${API_URL}/store/catalog/sku-stock/${skuId}`, {
          headers: { 'X-Tenant-Slug': tenantSlug },
        })
        if (!res.ok) return
        const { stock: s } = await res.json()
        setStock(s)
        setStatus(stockToStatus(s))
      } catch {
        // Silencioso — mostra último valor conhecido
      }
    }
  }, [skuId, tenantSlug])

  const config: Record<Status, { label: string; className: string }> = {
    loading:       { label: 'Verificando…',     className: 'text-muted-foreground' },
    in_stock:      { label: 'Em estoque',        className: 'text-green-600 dark:text-green-400' },
    low_stock:     { label: `Últimas ${stock} unidades`, className: 'text-amber-600 dark:text-amber-400' },
    out_of_stock:  { label: 'Fora de estoque',   className: 'text-red-500' },
  }

  const { label, className } = config[status]

  return (
    <span className={`flex items-center gap-1.5 text-sm font-medium ${className}`}>
      <span
        className={[
          'inline-block h-2 w-2 rounded-full',
          status === 'in_stock'  && 'bg-green-500',
          status === 'low_stock' && 'bg-amber-500',
          status === 'out_of_stock' && 'bg-red-500',
          status === 'loading'   && 'bg-muted animate-pulse',
        ].filter(Boolean).join(' ')}
      />
      {label}
    </span>
  )
}

function stockToStatus(stock: number): Status {
  if (stock <= 0)  return 'out_of_stock'
  if (stock <= 5)  return 'low_stock'
  return 'in_stock'
}
