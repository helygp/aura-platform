/**
 * lib/cookies.js
 * Helpers para gerenciar cookies httpOnly de autenticação.
 * Nunca expõe tokens via JSON response.
 */

import { ENV, IS_PROD } from './env.js'
import { ACCESS_TTL_MS, REFRESH_TTL_MS } from './tokens.js'

const BASE_OPTS = {
  httpOnly: true,
  secure:   IS_PROD,         // https apenas em produção
  sameSite: 'lax',
  domain:   IS_PROD ? ENV.COOKIE_DOMAIN : undefined,
  path:     '/',
}

export function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie('aura_access', accessToken, {
    ...BASE_OPTS,
    maxAge: ACCESS_TTL_MS,
  })
  res.cookie('aura_refresh', refreshToken, {
    ...BASE_OPTS,
    maxAge:   REFRESH_TTL_MS,
    path:     '/auth/refresh',  // refresh token só vai em /auth/refresh
  })
}

export function clearAuthCookies(res) {
  res.clearCookie('aura_access',  { ...BASE_OPTS })
  res.clearCookie('aura_refresh', { ...BASE_OPTS, path: '/auth/refresh' })
}
