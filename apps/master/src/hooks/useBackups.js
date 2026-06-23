import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api.js'

/** Resumo agregado (KPIs do header) */
export function useBackupsSummary(intervalMs = 30000) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    try   { setData(await api.backups.summary()); setError(null) }
    catch (e) { setError(e.message) }
    finally   { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    if (!intervalMs) return
    const t = setInterval(load, intervalMs)
    return () => clearInterval(t)
  }, [load, intervalMs])

  return { data, loading, error, refetch: load }
}

/** Lista de policies + last_success por tenant */
export function useBackupPolicies(intervalMs = 30000) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    try   { setData(await api.backups.policies()); setError(null) }
    catch (e) { setError(e.message) }
    finally   { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    if (!intervalMs) return
    const t = setInterval(load, intervalMs)
    return () => clearInterval(t)
  }, [load, intervalMs])

  return { data, loading, error, refetch: load }
}

/** Jobs recentes */
export function useBackupJobs(limit = 100, intervalMs = 15000) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    try   { setData(await api.backups.jobs(limit)); setError(null) }
    catch (e) { setError(e.message) }
    finally   { setLoading(false) }
  }, [limit])

  useEffect(() => {
    load()
    if (!intervalMs) return
    const t = setInterval(load, intervalMs)
    return () => clearInterval(t)
  }, [load, intervalMs])

  return { data, loading, error, refetch: load }
}

/** Heatmap 30d × tenant */
export function useBackupHeatmap() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    try   { setData(await api.backups.heatmap()); setError(null) }
    catch (e) { setError(e.message) }
    finally   { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  return { data, loading, error, refetch: load }
}

/** Settings globais */
export function useBackupSettings() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    try   { setData(await api.backups.settings.get()); setError(null) }
    catch (e) { setError(e.message) }
    finally   { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  return { data, loading, error, refetch: load }
}
