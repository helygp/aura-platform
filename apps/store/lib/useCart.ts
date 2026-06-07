'use client'

/**
 * lib/useCart.ts
 * Hook que mantém o estado do carrinho sincronizado com o localStorage.
 * Ouve o evento 'cart-updated' para re-renderizar quando outro componente muda o carrinho.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  readCart,
  updateQuantity,
  removeFromCart,
  clearCart,
  cartTotal,
  cartCount,
  type CartItem,
  CART_UPDATED_EVENT,
} from './cart'

export interface UseCartReturn {
  items:    CartItem[]
  total:    number      // centavos
  count:    number      // total de unidades
  updateQty: (skuId: string, qty: number) => void
  remove:    (skuId: string) => void
  clear:     () => void
  isEmpty:   boolean
  isLoaded:  boolean
}

export function useCart(): UseCartReturn {
  const [items, setItems]   = useState<CartItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Lê do localStorage apenas no cliente (evita mismatch SSR)
  useEffect(() => {
    setItems(readCart())
    setIsLoaded(true)

    function sync() { setItems(readCart()) }
    window.addEventListener(CART_UPDATED_EVENT, sync)
    return () => window.removeEventListener(CART_UPDATED_EVENT, sync)
  }, [])

  const updateQty = useCallback((skuId: string, qty: number) => {
    setItems(updateQuantity(skuId, qty))
  }, [])

  const remove = useCallback((skuId: string) => {
    setItems(removeFromCart(skuId))
  }, [])

  const clear = useCallback(() => {
    clearCart()
    setItems([])
  }, [])

  return {
    items,
    total:   cartTotal(items),
    count:   cartCount(items),
    updateQty,
    remove,
    clear,
    isEmpty:  items.length === 0,
    isLoaded,
  }
}
