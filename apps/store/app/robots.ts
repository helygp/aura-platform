/**
 * app/robots.ts
 * Tarefa 8 — robots.txt dinâmico por tenant.
 *
 * Permite indexação das páginas públicas da loja.
 * Bloqueia rotas privadas (carrinho, pedidos, conta/pedidos).
 *
 * Uso: GET /robots.txt — resolvido automaticamente pelo Next.js 14.
 */

import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'

export default function robots(): MetadataRoute.Robots {
  const headersList = headers()
  const host   = headersList.get('x-forwarded-host') ?? headersList.get('host') ?? 'loja.acme.aurabr.app'
  const origin = `https://${host}`

  return {
    rules: [
      {
        userAgent: '*',
        allow:     ['/', '/catalogo', '/produto/'],
        disallow:  [
          '/carrinho',
          '/pedido/',
          '/conta/pedidos',
          '/api/',
        ],
      },
      {
        // Bloquear bots agressivos
        userAgent: ['AhrefsBot', 'SemrushBot', 'DotBot'],
        disallow:  ['/'],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host:    origin,
  }
}
