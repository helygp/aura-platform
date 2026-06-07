/**
 * middleware.ts
 *
 * 1. Extrai slug do tenant do Host header → injeta em x-tenant-slug + cookie
 * 2. Protege rotas autenticadas da loja:
 *    /pedido/novo, /conta/pedidos, /conta/perfil → requer cookie store_access
 *    Sem cookie → redirect /conta/login?redirect=<URL>
 *
 * Edge Runtime: verificação JWT completa ocorre na rota/server component.
 * Aqui apenas checamos presença do cookie como gate rápido.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/** Rotas que exigem login do comprador */
const AUTH_REQUIRED = [
  '/pedido/novo',
  '/conta/pedidos',
  '/conta/perfil',
]

function extractSlug(hostname: string): string {
  const host = hostname.split(':')[0]
  const prod = host.match(/^loja\.([^.]+)\.aurabr\.app$/)
  if (prod) return prod[1]
  const dev = host.match(/^loja\.([^.]+)\.localhost$/)
  if (dev) return dev[1]
  return process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? 'demo'
}

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? ''
  const slug = extractSlug(hostname)
  const { pathname, search } = request.nextUrl

  // ── Auth gate ──────────────────────────────────────────────────────────────
  const needsAuth = AUTH_REQUIRED.some(p => pathname.startsWith(p))
  if (needsAuth) {
    const token = request.cookies.get('store_access')?.value
    if (!token) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/conta/login'
      loginUrl.search   = '?redirect=' + encodeURIComponent(pathname + search)
      return NextResponse.redirect(loginUrl)
    }
  }

  // ── Tenant injection ───────────────────────────────────────────────────────
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-tenant-slug', slug)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('x-tenant-slug', slug)

  const existing = request.cookies.get('tenant-slug')?.value
  if (existing !== slug) {
    response.cookies.set('tenant-slug', slug, {
      path:     '/',
      httpOnly: false,
      sameSite: 'lax',
    })
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
