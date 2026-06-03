/**
 * middleware/authenticate.js
 *
 * Valida o access token (httpOnly cookie aura_access).
 * Injeta req.user = { tokenId, tenantId, tenantSlug, role, email, name }
 *
 * Uso:
 *   router.get('/me', authenticate, handler)
 */

import { verifyAccessToken } from '../lib/tokens.js'
import { prismaMaster as prisma }            from '../lib/prisma-master.js'

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

    /* Busca dados completos do usuário (para tenantId, name, email) */
    const user = await prisma.user.findUnique({
      where:  { tokenId: payload.sub },
      select: { id:true, tokenId:true, tenantId:true, email:true, name:true, role:true, active:true,
                tenant: { select: { slug:true } } },
    })

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Sessão inválida.' })
    }

    req.user = req.auth = {
      id:         user.id,
      tokenId:    user.tokenId,
      tenantId:   user.tenantId,
      tenantSlug: user.tenant?.slug ?? payload.tenantSlug,
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
