/**
 * lib/api.ts
 * Cliente HTTP para o serviço services/api (ERP backend).
 * Todos os endpoints /store/* são públicos ou autenticados via cookie.
 */

const API_URL =
  typeof window === 'undefined'
    ? (process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '')
    : (process.env.NEXT_PUBLIC_API_URL ?? '')

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface FetchOptions extends RequestInit {
  tenantSlug?: string
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { tenantSlug, ...init } = options

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(tenantSlug ? { 'X-Tenant-Slug': tenantSlug } : {}),
    ...init.headers,
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include', // envia cookies httpOnly (auth do comprador)
  })

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = await res.json()
      message = body.message ?? body.error ?? message
    } catch {}
    throw new ApiError(res.status, message)
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

// ─── Catálogo ─────────────────────────────────────────────────────────────────

export interface CatalogProduct {
  slug: string
  name: string
  description: string | null
  coverImageUrl: string | null
  images: string[]
  category: string | null
  minPrice: number
  maxPrice: number
  inStock: boolean
  attributes: Record<string, string[]> // { tamanho: ['P','M','G'], cor: ['Preto','Branco'] }
}

export interface CatalogListResponse {
  items: CatalogProduct[]
  nextCursor: string | null
  total: number
}

export interface ProductDetail extends CatalogProduct {
  skus: Sku[]
  seoTitle: string | null
  seoDescription: string | null
}

export interface Sku {
  id: string // token opaco, não ID interno
  code: string
  attributes: Record<string, string>
  price: number
  stock: number
  active: boolean
}

export const catalogApi = {
  list(
    tenantSlug: string,
    params: {
      cursor?: string
      category?: string
      search?: string
      limit?: number
      sort?: string
      attributes?: Record<string, string[] | undefined>
    } = {},
  ): Promise<CatalogListResponse> {
    const qs = new URLSearchParams()
    if (params.cursor)   qs.set('cursor', params.cursor)
    if (params.category) qs.set('category', params.category)
    if (params.search)   qs.set('search', params.search)
    if (params.limit)    qs.set('limit', String(params.limit))
    if (params.sort && params.sort !== 'relevance') qs.set('sort', params.sort)
    const attrEntries = Object.entries(params.attributes ?? {}).filter(([, v]) => v?.length)
    if (attrEntries.length) qs.set('attributes', JSON.stringify(Object.fromEntries(attrEntries)))
    return apiFetch(`/store/catalog?${qs}`, { tenantSlug })
  },

  get(tenantSlug: string, slug: string): Promise<ProductDetail> {
    return apiFetch(`/store/catalog/${slug}`, { tenantSlug })
  },

  featured(tenantSlug: string): Promise<CatalogProduct[]> {
    return apiFetch('/store/catalog/featured', { tenantSlug })
  },

  categories(tenantSlug: string): Promise<string[]> {
    return apiFetch('/store/catalog/categories', { tenantSlug })
  },
}

// ─── Pedidos ──────────────────────────────────────────────────────────────────

export interface OrderItem {
  skuToken: string
  quantity: number
}

export interface CreateOrderPayload {
  items: OrderItem[]
  deliveryAddress?: string
  notes?: string
  paymentMethod: 'pix' | 'boleto' | 'a_combinar' | 'credito'
}

export interface OrderStatus {
  ref: string // token opaco ex: ord_k3x9p2mq
  status: 'pendente' | 'confirmado' | 'separando' | 'enviado' | 'entregue' | 'cancelado'
  createdAt: string
  items: Array<{ name: string; variant: string; quantity: number; price: number; skuId?: string; skuCode?: string; productSlug?: string; attributes?: Record<string,string> }>
  total: number
  timeline: Array<{ status: string; at: string }>
}

export const ordersApi = {
  create(tenantSlug: string, payload: CreateOrderPayload): Promise<{ ref: string }> {
    return apiFetch('/store/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
      tenantSlug,
    })
  },

  get(tenantSlug: string, ref: string): Promise<OrderStatus> {
    return apiFetch(`/store/orders/${ref}`, { tenantSlug })
  },

  list(tenantSlug: string): Promise<OrderStatus[]> {
    return apiFetch('/store/orders', { tenantSlug })
  },

  cancel(tenantSlug: string, ref: string): Promise<{ ref: string; status: string }> {
    return apiFetch(`/store/orders/${ref}/cancel`, { method: 'PATCH', tenantSlug })
  },
}

// ─── Auth do comprador ────────────────────────────────────────────────────────

export interface BuyerSession {
  id:              string
  name:            string
  email:           string
  document:        string | null
  companyName:     string | null
  creditLimit:     number  // centavos
  creditBalance:   number  // centavos
  creditAvailable: number  // centavos
}

/**
 * authApi — usa proxy local /api/auth/* (mesmo domínio da loja).
 *
 * POR QUÊ: o cookie de sessão precisa ser scopado para loja.*.aurabr.app
 * para que o middleware Next.js o leia. O proxy app/api/auth/[...path]/route.ts
 * encaminha para a API interna e remove o Domain do Set-Cookie.
 */
async function authFetch<T = unknown>(
  path: string,
  options: RequestInit & { tenantSlug?: string } = {},
): Promise<T> {
  const { tenantSlug, ...init } = options
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(tenantSlug ? { 'x-tenant-slug': tenantSlug } : {}),
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try { const b = await res.json(); message = b.error ?? b.message ?? message } catch {}
    throw new ApiError(res.status, message)
  }
  return res.json() as Promise<T>
}

export const authApi = {
  login(tenantSlug: string, email: string, password: string): Promise<BuyerSession> {
    return authFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      tenantSlug,
    })
  },

  logout(tenantSlug: string): Promise<void> {
    return authFetch('/api/auth/logout', { method: 'POST', tenantSlug })
  },

  me(tenantSlug: string): Promise<BuyerSession | null> {
    return authFetch<{ buyer: BuyerSession | null }>('/api/auth/me', { tenantSlug })
      .then(r => r.buyer ?? null)
      .catch((): null => null)
  },

  register(
    tenantSlug: string,
    data: { name: string; email: string; password: string; companyName?: string; document?: string; phone?: string },
  ): Promise<BuyerSession> {
    return authFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
      tenantSlug,
    })
  },
}

// ─── Extensões do catalogApi (adicionadas na Tarefa 3) ────────────────────────
// Monkey-patch para não reescrever o objeto já exportado acima.
// Na Tarefa 4 unificaremos num único objeto.

export function fetchFeaturedProducts(tenantSlug: string): Promise<CatalogProduct[]> {
  return apiFetch('/store/catalog/featured', { tenantSlug })
}

export function fetchCategories(tenantSlug: string): Promise<string[]> {
  return apiFetch('/store/catalog/categories', { tenantSlug })
}
