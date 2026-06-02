/**
 * auth/service.js
 * Lógica de autenticação desacoplada do transporte HTTP.
 *
 * Usa tabela `users` do banco master com campos:
 *   id, tokenId (uuid opaco), email, passwordHash,
 *   role, tenantId, tenantSlug, active, refreshFamily
 *
 * tokenId — gerado no cadastro, nunca muda.
 *           É o `sub` dos JWTs → nunca expõe id interno.
 *
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
  return {
    tokenId:    user.tokenId,
    email:      user.email,
    name:       user.name,
    role:       user.role,
    tenantSlug: user.tenant?.slug ?? user.tenantSlug,
  }
}

/* ─── LOGIN ─── */
export async function loginService({ email, password }) {
  if (!email || !password) {
    throw new AuthError('E-mail e senha são obrigatórios.', 400)
  }

  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim(), active: true },
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

  const accessToken  = await signAccessToken({
    tokenId:    user.tokenId,
    tenantSlug: user.tenant?.slug ?? user.tenantSlug,
    role:       user.role,
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

  const accessToken     = await signAccessToken({
    tokenId:    user.tokenId,
    tenantSlug: user.tenant?.slug ?? user.tenantSlug,
    role:       user.role,
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
