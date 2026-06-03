import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api.js'

export function useTenants(params = {}) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const key = JSON.stringify(params)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try   { setData(await api.tenants.list(params)) }
    catch (e) { setError(e.message) }
    finally   { setLoading(false) }
  }, [key]) // eslint-disable-line

  useEffect(() => { load() }, [load])
  return { data, loading, error, refetch: load }
}

export function useTenant(slug) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    if (!slug) return
    setLoading(true); setError(null)
    try   { setData(await api.tenants.get(slug)) }
    catch (e) { setError(e.message) }
    finally   { setLoading(false) }
  }, [slug])

  useEffect(() => { load() }, [load])
  return { data, loading, error, refetch: load }
}
