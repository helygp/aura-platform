import { useState, useCallback } from 'react'

// today/firstOfMonth em TZ local (en-CA produz YYYY-MM-DD).
// Antes era toISOString().slice(0,10) que retorna em UTC — em SP isso
// vira "ontem" entre 00:00–02:59 e "amanhã" entre 21:00–23:59. (ticket #48)
const today = () => new Date().toLocaleDateString('en-CA')
const firstOfMonth = () => today().slice(0, 8) + '01'

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
