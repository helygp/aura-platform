import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api.js'

export function useMetrics() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try   { setData(await api.metrics.get()) }
    catch (e) { setError(e.message) }
    finally   { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  return { data, loading, error, refetch: load }
}
