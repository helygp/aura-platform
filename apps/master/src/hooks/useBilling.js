import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api.js'

export function useBilling(months = 12) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try   { setData(await api.billing.overview(months)) }
    catch (e) { setError(e.message) }
    finally   { setLoading(false) }
  }, [months])

  useEffect(() => { load() }, [load])
  return { data, loading, error, refetch: load }
}
