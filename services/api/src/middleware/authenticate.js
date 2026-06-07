/**
 * middleware/authenticate.js
 *
 * Valida o access token (httpOnly cookie aura_access ou Bearer header).
 * Injeta req.user = { id, tokenId, tenantId, tenantSlug, role, email, name }
 *
 * Garante que o token pertence ao tenant deste container (TENANT_SLUG).
 * Impede que tokens de outros tenants sejam usados cruzados.
 */

import { verifyAccessToken } from '../lib/tokens.js'
import { prismaMaster as prisma } from '../lib/prisma-master.js'

const CONTAINER_TENANT = process.env.TENANT_SLUG ?? null

export async function authenticate(req, res, next) {
  // Aceita cookie httpOnly OU header Authorization: Bearer
  const cookieToken = req.cookies?.aura_access
  const bearerToken = req.headers?.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null
  const token = cookieToken ?? bearerToken

  if (!token) {
    return res.status(401).json({ error: 'Não autenticado.' })
  }

  try {
    const payload = await verifyAccessToken(token)

    // ── Validação de tenant: bloqueia tokens de outros tenants ──
    if (CONTAINER_TENANT && payload.tenantSlug !== CONTAINER_TENANT) {
      return res.status(401).json({
        error:  'Sessão inválida para este tenant.',
        code:   'TENANT_MISMATCH',
      })
    }

    const user = await prisma.user.findUnique({
      where:  { tokenId: payload.sub },
      select: { id:true, tokenId:true, tenantId:true, email:true, name:true, role:true, active:true,
                tenant: { select: { slug:true } } },
    })

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Sessão inválida.' })
    }

    // Dupla verificação: slug do usuário no DB também tem que bater
    const userTenantSlug = user.tenant?.slug ?? payload.tenantSlug
    if (CONTAINER_TENANT && userTenantSlug !== CONTAINER_TENANT) {
      return res.status(401).json({
        error: 'Sessão inválida para este tenant.',
        code:  'TENANT_MISMATCH',
      })
    }

    req.user = req.auth = {
      id:         user.id,
      tokenId:    user.tokenId,
      tenantId:   user.tenantId,
      tenantSlug: userTenantSlug,
      role:       user.role,
      email:      user.email,
      name:       user.name,
    }

    next()
  } catch (err) {
    return res.status(401).json({
      error: 'Sessão expirada.',
      code:  'TOKEN_EXPIRED',
    })
  }
}
