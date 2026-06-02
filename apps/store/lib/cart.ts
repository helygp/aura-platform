/**
 * lib/cart.ts
 * Lógica centralizada do carrinho B2B.
 *
 * Persiste em localStorage para compradores anônimos.
 * Para compradores logados, a Tarefa 7/9 sincroniza com o servidor.
 *
 * Todas as funções são puras (recebem/retornam CartItem[]) ou
 * operam diretamente no localStorage.
 *
 * NUNCA armazena JWT nem dados sensíveis — só itens do pedido.
 */

export interface CartItem {
  skuId:        string               // token opaco — nunca ID interno
  skuCode:      string               // referência interna para exibição
  productSlug:  string               // para link de volta ao produto
  productName:  string
  attributes:   Record<string, string> // { tamanho: 'M', cor: 'Preto' }
  price:        number               // centavos
  coverImageUrl: string | null
  quantity:     number
}

const CART_KEY = 'cart'
const CART_EVENT = 'cart-updated'

// ─── Leitura ──────────────────────────────────────────────────────────────────

export function readCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) ?? '[]') as CartItem[]
  } catch {
    return []
  }
}

// ─── Escrita ──────────────────────────────────────────────────────────────────

function writeCart(items: CartItem[]): void {
  localStorage.setItem(CART_KEY, JSON.stringify(items))
  window.dispatchEvent(new Event(CART_EVENT))
}

// ─── Operações ────────────────────────────────────────────────────────────────

/** Adiciona ou incrementa um item. Respeita limite de estoque (maxStock). */
export function addToCart(item: Omit<CartItem, 'quantity'> & { quantity: number; maxStock: number }): CartItem[] {
  const { maxStock, ...incoming } = item
  const cart = readCart()
  const existing = cart.find((i) => i.skuId === incoming.skuId)

  if (existing) {
    existing.quantity = Math.min(existing.quantity + incoming.quantity, maxStock)
  } else {
    cart.push({ ...incoming, quantity: Math.min(incoming.quantity, maxStock) })
  }

  writeCart(cart)
  return cart
}

/** Atualiza a quantidade de um item. Remove se quantity <= 0. */
export function updateQuantity(skuId: string, quantity: number): CartItem[] {
  const cart = readCart()
  if (quantity <= 0) {
    const next = cart.filter((i) => i.skuId !== skuId)
    writeCart(next)
    return next
  }
  const item = cart.find((i) => i.skuId === skuId)
  if (item) item.quantity = quantity
  writeCart(cart)
  return cart
}

/** Remove um item pelo skuId. */
export function removeFromCart(skuId: string): CartItem[] {
  const next = readCart().filter((i) => i.skuId !== skuId)
  writeCart(next)
  return next
}

/** Esvazia o carrinho. */
export function clearCart(): void {
  writeCart([])
}

// ─── Cálculos ─────────────────────────────────────────────────────────────────

export function cartTotal(items: CartItem[]): number {
  return items.reduce((acc, i) => acc + i.price * i.quantity, 0)
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((acc, i) => acc + i.quantity, 0)
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
// Importado apenas em Client Components.
// Exportado separado para não poluir o bundle do servidor.
export const CART_UPDATED_EVENT = CART_EVENT
