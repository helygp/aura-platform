/**
 * middleware/authenticate.js
 *
 * Valida o access token (httpOnly cookie aura_access ou Bearer header).
 * Injeta req.user = { id, tokenId, tenantId, tenantSlug, role, roles, email, name, login, customerIds }
 *
 * Garante que o token pertence ao tenant deste container (TENANT_SLUG).
 * Impede que tokens de outros tenants sejam usados cruzados.
 *
 * Multi-role: req.user.roles é array. req.user.role mantém o primeiro role
 * por compatibilidade com código legado.
 *
 * customerIds: lista de clientes vinculados ao usuário (vazia para admin/sem vínculo).
 * Frontend usa para filtrar combobox de cliente em Novo Pedido (ticket #115).
 */

import { verifyAccessToken } from '../lib/tokens.js'
import { prismaMaster as prisma } from '../lib/prisma-master.js'

const CONTAINER_TENANT = process.env.TENANT_SLUG ?? null

// ─── Heartbeat de sessão (debounce in-memory) ───
// Atualiza user_sessions.last_activity_at no máximo 1x a cada 5min por sessão.
// Fire-and-forget: nunca bloqueia o request.
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000
const heartbeatCache = new Map()  // sessionId -> lastUpdateMs

function fireSessionHeartbeat(sessionId) {
  if (!sessionId) return
  const now = Date.now()
  const last = heartbeatCache.get(sessionId) || 0
  if (now - last < HEARTBEAT_INTERVAL_MS) return
  heartbeatCache.set(sessionId, now)

  // Limite simples de memória — limpa entradas antigas a cada 1000 sessões
  if (heartbeatCache.size > 1000) {
    const cutoff = now - HEARTBEAT_INTERVAL_MS * 2
    for (const [k, v] of heartbeatCache) {
      if (v < cutoff) heartbeatCache.delete(k)
    }
  }

  prisma.userSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data:  { lastActivityAt: new Date() },
  }).catch(err => console.error('[heartbeat]', err.message))
}

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
      select: {
        id:true, tokenId:true, tenantId:true, email:true, name:true,
        role:true, roles:true, login:true, active:true, mustChangePassword:true,
        customerIds:true,
        tenant: { select: { slug:true } },
      },
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

    // Normaliza roles: prefere DB (verdade), mas mantém token como fallback
    const dbRoles = Array.isArray(user.roles) && user.roles.length > 0
      ? user.roles
      : (user.role ? [user.role] : [])
    const primary = user.role || dbRoles[0] || null

    req.user = req.auth = {
      id:         user.id,
      tokenId:    user.tokenId,
      tenantId:   user.tenantId,
      tenantSlug: userTenantSlug,
      role:       primary,          // legacy compat (singular)
      roles:      dbRoles,          // novo (array)
      email:      user.email,
      login:      user.login,
      name:       user.name,
      sessionId:  payload.sid ?? null,
      mustChangePassword: user.mustChangePassword ?? false,
      customerIds: Array.isArray(user.customerIds) ? user.customerIds : [],
    }

    // Heartbeat fire-and-forget (não bloqueia request)
    fireSessionHeartbeat(payload.sid)

    next()
  } catch (err) {
    return res.status(401).json({
      error: 'Sessão expirada.',
      code:  'TOKEN_EXPIRED',
    })
  }
}
