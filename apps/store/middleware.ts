/**
 * middleware.ts
 * Tarefa 2 — Middleware de tenant + tema
 *
 * Responsabilidades:
 * 1. Lê o Host header e extrai o slug do tenant
 * 2. Injeta o slug em dois lugares:
 *    - Header `x-tenant-slug`  → lido pelos RSC (layout, pages)
 *    - Cookie `tenant-slug`    → lido por Client Components sem round-trip
 * 3. NÃO busca o tema aqui — busca cabe ao layout RSC (tem cache do Next.js)
 *    O middleware é Edge Runtime: sem Node.js APIs, sem I/O pesado.
 *
 * Fluxo completo sem flash de estilo:
 *   Request → middleware (slug) → layout RSC (tema via API) → CSS vars no <head> → HTML
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Extrai o slug do tenant do hostname.
 * Duplicado aqui (sem import) porque o Edge Runtime não garante
 * tree-shaking de módulos com process.env condicionais.
 *
 * loja.acme.aurabr.app  → "acme"
 * loja.acme.localhost   → "acme"  (dev)
 * localhost / outros    → NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? "demo"
 */
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

  // Clona os headers de request para passar o slug adiante para RSC
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-tenant-slug', slug)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  // Injeta também na response (response headers ficam disponíveis via headers() no RSC)
  response.headers.set('x-tenant-slug', slug)

  // Cookie para Client Components — não httpOnly para poder ser lido no browser
  const existing = request.cookies.get('tenant-slug')?.value
  if (existing !== slug) {
    response.cookies.set('tenant-slug', slug, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      // Expira junto com a sessão do browser (sem maxAge fixo)
      // Será reescrito a cada request se o subdomínio mudar
    })
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Executa em todas as rotas exceto:
     * - _next/static  (arquivos estáticos buildados)
     * - _next/image   (image optimization)
     * - favicon.ico
     * - arquivos de imagem na raiz
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
