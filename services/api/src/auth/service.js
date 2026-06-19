/**
 * auth/service.js
 * Lógica de autenticação desacoplada do transporte HTTP.
 *
 * Usa tabela `users` do banco master.
 * Login aceita `login` OU `email` no campo identificador (busca em ambos).
 *
 * tokenId       — gerado no cadastro, nunca muda. É o `sub` dos JWTs.
 * refreshFamily — uuid rotacionado a cada refresh.
 *                 Se um refresh roubado for reutilizado,
 *                 a família invalida todos os tokens da sessão.
 * sid           — id de UserSession, vai no claim `sid` do JWT.
 *                 Permite heartbeat (last_activity_at) e revogação por sessão.
 *
 * Camada 2 (analytics master): registra login_events e gerencia user_sessions.
 *   meta = { ip, userAgent } passado pelos controllers.
 */

import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { prismaMaster as prisma } from '../lib/prisma-master.js'
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../lib/tokens.js'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000  // 30d (>= refresh TTL)

/* ─── Erros tipados ─── */
export class AuthError extends Error {
  constructor(message, status = 401) {
    super(message)
    this.name   = 'AuthError'
    this.status = status
  }
}

/* ─── Payload público do usuário (sem IDs internos) ─── */
function publicUser(user) {
  const dbRoles = Array.isArray(user.roles) && user.roles.length > 0
    ? user.roles
    : (user.role ? [user.role] : [])
  return {
    tokenId:    user.tokenId,
    login:      user.login ?? null,
    email:      user.email,
    name:       user.name,
    role:       user.role,
    roles:      dbRoles,
    tenantSlug: user.tenant?.slug ?? user.tenantSlug,
    mustChangePassword: user.mustChangePassword ?? false,
  }
}

/* ─── Helper: registra evento de login (fire-and-forget seguro) ─── */
async function logLoginEvent(data) {
  try {
    await prisma.loginEvent.create({ data })
  } catch (err) {
    console.error('[loginEvent]', err.message)
  }
}

/* ─── LOGIN ─── */
export async function loginService({ identifier, email, password }, meta = {}) {
  const ident = (identifier ?? email ?? '').toLowerCase().trim()
  const ip = meta.ip ?? null
  const userAgent = meta.userAgent ?? null

  if (!ident || !password) {
    throw new AuthError('Login e senha são obrigatórios.', 400)
  }

  const CONTAINER_TENANT = process.env.TENANT_SLUG ?? null

  // Busca sem filtro de active para distinguir inactive de inexistente
  const user = await prisma.user.findFirst({
    where: {
      AND: [
        { OR: [ { login: ident }, { email: ident } ] },
        ...(CONTAINER_TENANT ? [{ tenant: { slug: CONTAINER_TENANT } }] : []),
      ],
    },
    include: { tenant: { select: { slug: true } } },
  })

  if (!user) {
    // Tempo constante (evita timing attack)
    await bcrypt.compare(password, '$2b$10$invalidhashpadding00000000000000000000000000')
    await logLoginEvent({
      identifier: ident, success: false, failureReason: 'invalid_user',
      ip, userAgent,
      tenantSlug: CONTAINER_TENANT,
    })
    throw new AuthError('Credenciais inválidas.')
  }

  if (!user.active) {
    await logLoginEvent({
      userId: user.id, tenantId: user.tenantId,
      tenantSlug: user.tenant?.slug ?? null,
      identifier: ident, success: false, failureReason: 'inactive_user',
      ip, userAgent,
    })
    throw new AuthError('Credenciais inválidas.')
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    await logLoginEvent({
      userId: user.id, tenantId: user.tenantId,
      tenantSlug: user.tenant?.slug ?? null,
      identifier: ident, success: false, failureReason: 'invalid_password',
      ip, userAgent,
    })
    throw new AuthError('Credenciais inválidas.')
  }

  const tenantSlug = user.tenant?.slug ?? user.tenantSlug

  // Cria sessão (precisa do id antes de assinar o JWT)
  const session = await prisma.userSession.create({
    data: {
      userId:    user.id,
      tenantId:  user.tenantId,
      tenantSlug,
      ip, userAgent,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  })

  // Rotaciona refresh family + atualiza last_login_at
  const family = randomUUID()
  await prisma.user.update({
    where: { id: user.id },
    data:  { refreshFamily: family, lastLoginAt: new Date() },
  })

  // Loga evento de sucesso (não bloqueia se falhar)
  logLoginEvent({
    userId: user.id, tenantId: user.tenantId, tenantSlug,
    identifier: ident, success: true,
    ip, userAgent,
  })

  const dbRoles = Array.isArray(user.roles) && user.roles.length > 0
    ? user.roles
    : (user.role ? [user.role] : [])

  const accessToken = await signAccessToken({
    tokenId:    user.tokenId,
    tenantSlug,
    role:       user.role,
    roles:      dbRoles,
    sid:        session.id,
  })
  const refreshToken = await signRefreshToken({
    tokenId: user.tokenId,
    family,
    sid:     session.id,
  })

  return { accessToken, refreshToken, user: publicUser(user) }
}

/* ─── REFRESH ─── */
export async function refreshService(refreshToken, meta = {}) {
  if (!refreshToken) throw new AuthError('Refresh token ausente.')

  let payload
  try {
    payload = await verifyRefreshToken(refreshToken)
  } catch {
    throw new AuthError('Refresh token inválido ou expirado.')
  }

  const user = await prisma.user.findUnique({
    where: { tokenId: payload.sub },
    include: { tenant: { select: { slug: true } } },
  })

  if (!user || !user.active) {
    throw new AuthError('Usuário não encontrado ou inativo.')
  }

  // Detecção de reutilização — refresh token rotation
  if (user.refreshFamily !== payload.family) {
    await prisma.user.update({
      where: { id: user.id },
      data:  { refreshFamily: null },
    })
    // Revoga sessão também (defesa em profundidade)
    if (payload.sid) {
      prisma.userSession.updateMany({
        where: { id: payload.sid, revokedAt: null },
        data:  { revokedAt: new Date() },
      }).catch(() => {})
    }
    throw new AuthError('Sessão inválida. Faça login novamente.')
  }

  // Rotaciona família
  const newFamily = randomUUID()
  await prisma.user.update({
    where: { id: user.id },
    data:  { refreshFamily: newFamily },
  })

  // Atualiza last_activity_at e estende expiração da sessão
  if (payload.sid) {
    prisma.userSession.updateMany({
      where: { id: payload.sid, revokedAt: null },
      data:  {
        lastActivityAt: new Date(),
        expiresAt:      new Date(Date.now() + SESSION_TTL_MS),
      },
    }).catch(err => console.error('[refresh session update]', err.message))
  }

  const tenantSlug = user.tenant?.slug ?? user.tenantSlug
  const dbRoles = Array.isArray(user.roles) && user.roles.length > 0
    ? user.roles
    : (user.role ? [user.role] : [])

  const accessToken = await signAccessToken({
    tokenId: user.tokenId,
    tenantSlug,
    role:    user.role,
    roles:   dbRoles,
    sid:     payload.sid,
  })
  const newRefreshToken = await signRefreshToken({
    tokenId: user.tokenId,
    family:  newFamily,
    sid:     payload.sid,
  })

  return { accessToken, refreshToken: newRefreshToken, user: publicUser(user) }
}

/* ─── LOGOUT ─── */
export async function logoutService(tokenId, sessionId) {
  if (!tokenId) return
  // Invalida a família (refresh tokens em circulação ficam inúteis)
  await prisma.user.updateMany({
    where: { tokenId },
    data:  { refreshFamily: null },
  })
  // Revoga a sessão específica
  if (sessionId) {
    await prisma.userSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data:  { revokedAt: new Date() },
    }).catch(err => console.error('[logout session]', err.message))
  }
}
