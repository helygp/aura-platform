/**
 * app/api/proxy/[...path]/route.ts
 *
 * Proxy genérico para todas as chamadas da store ao API.
 *
 * POR QUÊ: o cookie store_access está em loja.*.aurabr.app.
 * Chamadas diretas ao api.*.aurabr.app (cross-subdomain) não enviam o cookie.
 * O proxy roda server-side no mesmo processo da loja — sem CORS, sem cross-domain.
 *
 * FLUXO:
 *   Browser → POST /api/proxy/store/orders  (mesmo domínio, cookie incluído)
 *   Proxy   → POST http://api-fastmalhas:3001/store/orders  (rede interna)
 *   API     ← { ... }
 *   Proxy   → Browser
 */

import { NextRequest, NextResponse } from 'next/server'

const API_INTERNAL = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? ''

async function proxy(
  request: NextRequest,
  { params }: { params: { path: string[] } },
): Promise<NextResponse> {
  const path     = params.path.join('/')
  const search   = request.nextUrl.search     // query string preservada
  const upstream = `${API_INTERNAL}/${path}${search}`

  // Montar headers para o upstream
  const headers: Record<string, string> = {}

  // Propagar headers relevantes do cliente
  for (const key of ['content-type', 'x-tenant-slug', 'accept', 'x-forwarded-for']) {
    const v = request.headers.get(key)
    if (v) headers[key] = v
  }

  // Propagar cookies (onde está o store_access)
  const cookie = request.headers.get('cookie')
  if (cookie) headers['cookie'] = cookie

  const init: RequestInit = { method: request.method, headers }

  if (!['GET', 'HEAD'].includes(request.method)) {
    const body = await request.text()
    if (body) init.body = body
  }

  let apiRes: Response
  try {
    apiRes = await fetch(upstream, init)
  } catch (err) {
    console.error('[store-proxy] upstream error:', err)
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const body        = await apiRes.arrayBuffer()
  const contentType = apiRes.headers.get('content-type') ?? 'application/json'

  const res = new NextResponse(body, {
    status:  apiRes.status,
    headers: { 'content-type': contentType },
  })

  return res
}

export const GET     = proxy
export const POST    = proxy
export const PATCH   = proxy
export const PUT     = proxy
export const DELETE  = proxy
