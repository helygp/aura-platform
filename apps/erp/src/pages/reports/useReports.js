import { useState, useCallback } from 'react'

const today = () => new Date().toISOString().slice(0, 10)
const firstOfMonth = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export function useReport(endpoint) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const fetch_ = useCallback(async (params = {}) => {
    setLoading(true); setError(null)
    try {
      const qs  = new URLSearchParams(params).toString()
      const url = `/api/reports/${endpoint}${qs ? '?' + qs : ''}`
      const tok = window.__aura_mem_token__ || ''
      const res = await fetch(url, {
        credentials: 'include',
        headers: tok ? { Authorization: 'Bearer ' + tok } : {},
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro')
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  return { data, loading, error, fetch: fetch_ }
}

export { today, firstOfMonth }
