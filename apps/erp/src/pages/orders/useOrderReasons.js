/**
 * pages/orders/useOrderReasons.js
 *
 * Hook simples para listar motivos cadastrados de cancelamento e devolução.
 * Usado pelos modais em OrderDetail e pela seção de Settings.
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../auth/AuthContext.jsx'
import { authFetch } from '../../auth/authFetch.js'

export function useOrderReasons() {
  const { user } = useAuth()
  const [cancellation, setCancellation] = useState([])
  const [ret,          setReturn]       = useState([])
  const [isLoading,    setIsLoading]    = useState(false)

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await authFetch('/api/order-reasons')
      if (res.ok) {
        const { reasons = [] } = await res.json()
        setCancellation(reasons.filter(r => r.kind === 'cancellation'))
        setReturn(reasons.filter(r => r.kind === 'return'))
      }
    } catch (_) { /* silently */ }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => { if (user) fetchAll() }, [user, fetchAll])

  return { cancellation, return: ret, isLoading, refetch: fetchAll }
}
