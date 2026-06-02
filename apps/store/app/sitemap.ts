/**
 * app/sitemap.ts
 * Tarefa 8 — Sitemap dinâmico por tenant.
 *
 * Gera URLs de:
 *   - Home da loja
 *   - Catálogo
 *   - Cada produto (slug)
 *   - Login / conta
 *
 * Identificação do tenant: header x-tenant-slug injetado pelo middleware.
 * Revalidação: 1 hora.
 */

import type { MetadataRoute } from 'next'
import { headers }            from 'next/headers'
import { catalogApi }         from '@/lib/api'

export const revalidate = 3600 // 1 hora

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = headers()
  const slug   = headersList.get('x-tenant-slug') ?? 'demo'
  const host   = headersList.get('host')           ?? `loja.${slug}.aurabr.app`
  const origin = `https://${host}`
  const now    = new Date()

  /* ── Páginas estáticas ── */
  const staticUrls: MetadataRoute.Sitemap = [
    {
      url:             `${origin}/`,
      lastModified:    now,
      changeFrequency: 'daily',
      priority:        1.0,
    },
    {
      url:             `${origin}/catalogo`,
      lastModified:    now,
      changeFrequency: 'daily',
      priority:        0.9,
    },
    {
      url:             `${origin}/conta/login`,
      lastModified:    now,
      changeFrequency: 'monthly',
      priority:        0.3,
    },
  ]

  /* ── Produtos dinâmicos ── */
  let productUrls: MetadataRoute.Sitemap = []

  try {
    const data = await catalogApi.list(slug, { limit: 200 })

    productUrls = (data.items ?? [])
      .filter((p) => !!p.slug)
      .map((p) => ({
        url:             `${origin}/produto/${p.slug}`,
        lastModified:    now,
        changeFrequency: 'weekly' as const,
        priority:        0.7,
      }))
  } catch {
    // Falha silenciosa — sitemap retorna só as estáticas
  }

  return [...staticUrls, ...productUrls]
}
