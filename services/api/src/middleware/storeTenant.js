/**
 * middleware/storeTenant.js
 * Middleware de tenant para todas as rotas /store/*.
 *
 * Responsabilidades:
 * 1. Lê X-Tenant-Slug do header (injetado pelo middleware Next.js)
 * 2. Valida que o tenant existe e está ativo no banco master
 * 3. Injeta req.tenantSlug + req.tenantId para uso nas rotas
 * 4. Cache em memória de 60s para não bater no Postgres a cada request
 *
 * Garante tenant isolation: comprador só vê dados do próprio tenant.
 */

import { prismaMaster as prisma } from '../lib/prisma-master.js'

// Cache simples em memória: slug → { tenantId, expiresAt }
const tenantCache = new Map()
const CACHE_TTL   = 60_000 // 60s

export async function storeTenantMiddleware(req, res, next) {
  const slug = req.headers['x-tenant-slug']

  if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]{2,64}$/.test(slug)) {
    return res.status(400).json({ error: 'Tenant inválido ou não identificado.' })
  }

  // Verifica cache
  const cached = tenantCache.get(slug)
  if (cached && cached.expiresAt > Date.now()) {
    req.tenantSlug = slug
    req.tenantId   = cached.tenantId
    return next()
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where:  { slug },
      select: { id: true, status: true },
    })

    if (!tenant) {
      return res.status(404).json({ error: 'Loja não encontrada.' })
    }
    if (tenant.status !== 'active') {
      return res.status(403).json({ error: 'Esta loja está temporariamente indisponível.' })
    }

    // Atualiza cache
    tenantCache.set(slug, { tenantId: tenant.id, expiresAt: Date.now() + CACHE_TTL })

    req.tenantSlug = slug
    req.tenantId   = tenant.id
    next()
  } catch (err) {
    console.error('[storeTenant]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
}

/** Invalida o cache de um tenant (usar ao mudar status no ERP). */
export function invalidateTenantCache(slug) {
  tenantCache.delete(slug)
}
