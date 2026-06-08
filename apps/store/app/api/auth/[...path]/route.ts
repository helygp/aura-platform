/**
 * app/api/auth/[...path]/route.ts
 *
 * Proxy de autenticação da loja.
 *
 * POR QUÊ EXISTE:
 * O cookie de sessão (store_access) precisa ser scopado para o domínio da
 * loja (loja.*.aurabr.app) para que o middleware Next.js consiga lê-lo.
 * Chamadas diretas ao api.*.aurabr.app não permitem isso de forma confiável
 * em todos os browsers (cross-subdomain cookies).
 *
 * COMO FUNCIONA:
 * 1. Browser chama POST /api/auth/login (mesmo domínio da loja) — sem CORS
 * 2. Este handler proxia para http://api-fastmalhas:3001/store/auth/login
 * 3. Remove o atributo Domain do Set-Cookie da resposta
 * 4. Browser recebe o cookie scopado para loja.*.aurabr.app ✅
 * 5. Middleware lê o cookie normalmente em todas as rotas protegidas ✅
 */

import { NextRequest, NextResponse } from 'next/server'

const API_INTERNAL = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? ''

function getTenantSlug(req: NextRequest): string {
  // Preferência: cookie injetado pelo middleware (tenant-slug) ou header
  return (
    req.cookies.get('tenant-slug')?.value ??
    req.headers.get('x-tenant-slug') ??
    process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ??
    ''
  )
}

async function proxyAuth(
  request: NextRequest,
  params: { path: string[] },
): Promise<NextResponse> {
  const slug     = getTenantSlug(request)
  const path     = params.path.join('/')
  const upstream = `${API_INTERNAL}/store/auth/${path}`

  // Monta os headers para o upstream — inclui cookies do browser para /me e /logout
  const upstreamHeaders: Record<string, string> = {
    'content-type':  'application/json',
    'x-tenant-slug': slug,
  }
  const cookieHeader = request.headers.get('cookie')
  if (cookieHeader) upstreamHeaders['cookie'] = cookieHeader

  const init: RequestInit = {
    method:  request.method,
    headers: upstreamHeaders,
  }

  if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
    init.body = await request.text()
  }

  let apiRes: Response
  try {
    apiRes = await fetch(upstream, init)
  } catch (err) {
    console.error('[auth-proxy] upstream error:', err)
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const body = await apiRes.text()

  const res = new NextResponse(body, {
    status:  apiRes.status,
    headers: { 'content-type': 'application/json' },
  })

  // Forward Set-Cookie removendo o Domain — cookie fica no domínio da loja
  const setCookies: string[] = (apiRes.headers as any).getSetCookie?.() ?? []
  if (setCookies.length === 0) {
    // Fallback para ambientes sem getSetCookie
    const single = apiRes.headers.get('set-cookie')
    if (single) setCookies.push(single)
  }

  setCookies.forEach(raw => {
    // Remove Domain=... do cookie para ficar scopado no domínio corrente
    const stripped = raw.replace(/;\s*domain=[^;,]*/gi, '')
    res.headers.append('set-cookie', stripped)
  })

  return res
}

export function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyAuth(request, params)
}

export function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyAuth(request, params)
}
