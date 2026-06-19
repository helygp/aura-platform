import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api.js'

function makeHook(fetcher) {
  return function useData(...args) {
    const [data,    setData]    = useState(null)
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState(null)

    const load = useCallback(async () => {
      setLoading(true); setError(null)
      try   { setData(await fetcher(...args)) }
      catch (e) { setError(e.message) }
      finally   { setLoading(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [args.join('|')])

    useEffect(() => { load() }, [load])
    return { data, loading, error, refetch: load }
  }
}

export function useAnalyticsUsers(slug) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const load = useCallback(async () => {
    if (!slug) return
    setLoading(true); setError(null)
    try   { setData(await api.analytics.users(slug)) }
    catch (e) { setError(e.message) }
    finally   { setLoading(false) }
  }, [slug])
  useEffect(() => { load() }, [load])
  return { data, loading, error, refetch: load }
}

export function useAnalyticsHealth(slug) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const load = useCallback(async () => {
    if (!slug) return
    setLoading(true); setError(null)
    try   { setData(await api.analytics.health(slug)) }
    catch (e) { setError(e.message) }
    finally   { setLoading(false) }
  }, [slug])
  useEffect(() => { load() }, [load])
  return { data, loading, error, refetch: load }
}

export function useAnalyticsLogs(slug, container) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)
  const load = useCallback(async (tail = 200) => {
    if (!slug || !container) return
    setLoading(true); setError(null)
    try   { setData(await api.analytics.logs(slug, container, tail)) }
    catch (e) { setError(e.message) }
    finally   { setLoading(false) }
  }, [slug, container])
  return { data, loading, error, fetch: load }
}

export function useAnalyticsHeatmap(slug) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const load = useCallback(async () => {
    if (!slug) return
    setLoading(true); setError(null)
    try   { setData(await api.analytics.heatmap(slug)) }
    catch (e) { setError(e.message) }
    finally   { setLoading(false) }
  }, [slug])
  useEffect(() => { load() }, [load])
  return { data, loading, error, refetch: load }
}

export function useAnalyticsSuspicious(slug) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const load = useCallback(async () => {
    if (!slug) return
    setLoading(true); setError(null)
    try   { setData(await api.analytics.suspicious(slug)) }
    catch (e) { setError(e.message) }
    finally   { setLoading(false) }
  }, [slug])
  useEffect(() => { load() }, [load])
  return { data, loading, error, refetch: load }
}
