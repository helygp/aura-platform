/**
 * lib/tokens.js
 * Emissão e verificação de JWT (access + refresh) via jose.
 *
 * Access token  — 15min, contém: sub (token opaco), tenantSlug, role
 * Refresh token — 7d,   contém: sub (token opaco), family (rotação)
 *
 * IDs internos nunca são expostos nos tokens.
 * `sub` usa um tokenId opaco gerado no login.
 */

import { SignJWT, jwtVerify } from 'jose'
import { ENV } from './env.js'

const accessSecret  = new TextEncoder().encode(ENV.JWT_SECRET)
const refreshSecret = new TextEncoder().encode(ENV.JWT_REFRESH_SECRET)

/* ─── TTL helper: '15m' | '7d' → segundos ─── */
function parseTTL(ttl) {
  const n = parseInt(ttl, 10)
  if (ttl.endsWith('m')) return n * 60
  if (ttl.endsWith('h')) return n * 3600
  if (ttl.endsWith('d')) return n * 86400
  return n
}

/* ─── Access Token ─── */
export async function signAccessToken({ tokenId, tenantSlug, role }) {
  return new SignJWT({ tenantSlug, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(tokenId)           // opaco — não é userId
    .setIssuedAt()
    .setExpirationTime(`${parseTTL(ENV.JWT_ACCESS_TTL)}s`)
    .sign(accessSecret)
}

export async function verifyAccessToken(token) {
  const { payload } = await jwtVerify(token, accessSecret)
  return payload  // { sub: tokenId, tenantSlug, role, iat, exp }
}

/* ─── Refresh Token ─── */
export async function signRefreshToken({ tokenId, family }) {
  return new SignJWT({ family })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(tokenId)
    .setIssuedAt()
    .setExpirationTime(`${parseTTL(ENV.JWT_REFRESH_TTL)}s`)
    .sign(refreshSecret)
}

export async function verifyRefreshToken(token) {
  const { payload } = await jwtVerify(token, refreshSecret)
  return payload  // { sub: tokenId, family, iat, exp }
}

/* ─── TTL em ms (para maxAge do cookie) ─── */
export const ACCESS_TTL_MS  = parseTTL(ENV.JWT_ACCESS_TTL)  * 1000
export const REFRESH_TTL_MS = parseTTL(ENV.JWT_REFRESH_TTL) * 1000
