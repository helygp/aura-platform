/**
 * hooks/useSortable.js
 * Hook para ordenação de tabelas por coluna.
 */
import { useState, useMemo } from 'react'

export function useSortable(data, defaultKey = null, defaultDir = 'asc') {
  const [sortKey, setSortKey] = useState(defaultKey)
  const [sortDir, setSortDir] = useState(defaultDir)

  const handleSort = (col) => {
    if (!col.sortable) return
    const key = col.sortKey ?? col.key
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortKey(null); setSortDir('asc') }
    } else {
      setSortKey(key); setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey || !data?.length) return data ?? []
    return [...data].sort((a, b) => {
      const va = a[sortKey] ?? ''
      const vb = b[sortKey] ?? ''
      const na = parseFloat(String(va).replace(',', '.').replace(/[R$\s]/g, ''))
      const nb = parseFloat(String(vb).replace(',', '.').replace(/[R$\s]/g, ''))
      const cmp = (!isNaN(na) && !isNaN(nb))
        ? na - nb
        : String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])

  return { sorted, sortKey, sortDir, handleSort }
}
