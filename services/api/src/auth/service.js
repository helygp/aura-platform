/**
 * auth/service.js
 * Lógica de autenticação desacoplada do transporte HTTP.
 *
 * Usa tabela `users` do banco master com campos:
 *   id, tokenId, login, email, passwordHash, role, roles[],
 *   tenantId, tenantSlug, active, refreshFamily
 *
 * Login aceita `login` OU `email` no campo identificador (busca em ambos).
 *
 * tokenId — gerado no cadastro, nunca muda. É o `sub` dos JWTs.
 * refreshFamily — uuid rotacionado a cada refresh.
 *                 Se um refresh roubado for reutilizado,
 *                 a família invalida todos os tokens da sessão.
 */

import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { prismaMaster as prisma } from '../lib/prisma-master.js'
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../lib/tokens.js'

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
    role:       user.role,    // singular legacy
    roles:      dbRoles,      // novo array
    tenantSlug: user.tenant?.slug ?? user.tenantSlug,
  }
}

/* ─── LOGIN ─── */
export async function loginService({ identifier, email, password }) {
  // Aceita { identifier, password } (novo) ou { email, password } (legacy)
  const ident = (identifier ?? email ?? '').toLowerCase().trim()
  if (!ident || !password) {
    throw new AuthError('Login e senha são obrigatórios.', 400)
  }

  const CONTAINER_TENANT = process.env.TENANT_SLUG ?? null
  const user = await prisma.user.findFirst({
    where: {
      AND: [
        { active: true },
        { OR: [ { login: ident }, { email: ident } ] },
        ...(CONTAINER_TENANT ? [{ tenant: { slug: CONTAINER_TENANT } }] : []),
      ],
    },
    include: { tenant: { select: { slug: true } } },
  })

  if (!user || !user.active) {
    // Tempo constante mesmo quando usuário não existe (evita timing attack)
    await bcrypt.compare(password, '$2b$10$invalidhashpadding00000000000000000000000000')
    throw new AuthError('Credenciais inválidas.')
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) throw new AuthError('Credenciais inválidas.')

  // Nova família de refresh a cada login
  const family = randomUUID()
  await prisma.user.update({
    where: { id: user.id },
    data:  { refreshFamily: family },
  })

  const tenantSlug = user.tenant?.slug ?? user.tenantSlug
  const dbRoles = Array.isArray(user.roles) && user.roles.length > 0
    ? user.roles
    : (user.role ? [user.role] : [])

  const accessToken  = await signAccessToken({
    tokenId:    user.tokenId,
    tenantSlug,
    role:       user.role,
    roles:      dbRoles,
  })
  const refreshToken = await signRefreshToken({
    tokenId: user.tokenId,
    family,
  })

  return { accessToken, refreshToken, user: publicUser(user) }
}

/* ─── REFRESH ─── */
export async function refreshService(refreshToken) {
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
    // Possível roubo: invalidar toda a sessão
    await prisma.user.update({
      where: { id: user.id },
      data:  { refreshFamily: null },
    })
    throw new AuthError('Sessão inválida. Faça login novamente.')
  }

  // Rotacionar família
  const newFamily = randomUUID()
  await prisma.user.update({
    where: { id: user.id },
    data:  { refreshFamily: newFamily },
  })

  const tenantSlug = user.tenant?.slug ?? user.tenantSlug
  const dbRoles = Array.isArray(user.roles) && user.roles.length > 0
    ? user.roles
    : (user.role ? [user.role] : [])

  const accessToken     = await signAccessToken({
    tokenId: user.tokenId,
    tenantSlug,
    role:    user.role,
    roles:   dbRoles,
  })
  const newRefreshToken = await signRefreshToken({
    tokenId: user.tokenId,
    family:  newFamily,
  })

  return { accessToken, refreshToken: newRefreshToken, user: publicUser(user) }
}

/* ─── LOGOUT ─── */
export async function logoutService(tokenId) {
  if (!tokenId) return
  // Invalida a família → qualquer refresh token em circulação fica inútil
  await prisma.user.updateMany({
    where: { tokenId },
    data:  { refreshFamily: null },
  })
}
