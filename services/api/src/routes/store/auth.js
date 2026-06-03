/**
 * routes/store/auth.js
 * Autenticação do comprador B2B — completamente separada do ERP.
 *
 * Tabela no banco do tenant: buyer_accounts
 * Cookies httpOnly separados: store_access / store_refresh
 * JWT secret próprio: BUYER_JWT_SECRET (env)
 *
 * POST /store/auth/register  — cadastro do comprador
 * POST /store/auth/login     — login → seta cookies
 * POST /store/auth/logout    — limpa cookies
 * GET  /store/auth/me        — dados da sessão
 */

import { Router }   from 'express'
import bcrypt       from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { query, getClient }   from '../../lib/tenantDb.js'
import { ENV }      from '../../lib/env.js'

export const storeAuthRouter = Router()

// ─── Constantes ───────────────────────────────────────────────────────────────

const ACCESS_TTL  = 60 * 60 * 2          // 2h em segundos
const REFRESH_TTL = 60 * 60 * 24 * 30    // 30d

const secret = () => new TextEncoder().encode(
  ENV.BUYER_JWT_SECRET ?? ENV.JWT_SECRET + '_buyer'
)

const IS_PROD = process.env.NODE_ENV === 'production'

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   IS_PROD,
  sameSite: IS_PROD ? 'strict' : 'lax',
  path:     '/',
}

// ─── Helpers JWT ──────────────────────────────────────────────────────────────

async function signBuyerToken(buyerTokenId, tenantSlug, ttl) {
  return new SignJWT({ tenantSlug, type: 'buyer' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(buyerTokenId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttl)
    .sign(secret())
}

async function verifyBuyerToken(token) {
  const { payload } = await jwtVerify(token, secret())
  if (payload.type !== 'buyer') throw new Error('Token inválido.')
  return payload
}

function setBuyerCookies(res, { accessToken, refreshToken }) {
  res.cookie('store_access', accessToken, { ...COOKIE_OPTS, maxAge: ACCESS_TTL * 1000 })
  res.cookie('store_refresh', refreshToken, { ...COOKIE_OPTS, maxAge: REFRESH_TTL * 1000 })
}

function clearBuyerCookies(res) {
  res.clearCookie('store_access',  { ...COOKIE_OPTS })
  res.clearCookie('store_refresh', { ...COOKIE_OPTS })
}


// ─── POST /store/auth/register ────────────────────────────────────────────────

storeAuthRouter.post('/register', async (req, res) => {
  const { name, email, password, companyName, phone } = req.body ?? {}

  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'A senha deve ter no mínimo 8 caracteres.' })
  }

  try {
    // Verifica duplicidade
    const { rows: [existing] } = await query(
      'SELECT id FROM buyer_accounts WHERE email = $1',
      [email.toLowerCase().trim()],
      req.tenantSlug
    )
    if (existing) {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado.' })
    }

    const hash      = await bcrypt.hash(password, 12)
    const tokenId   = `buy_${Buffer.from(crypto.getRandomValues(new Uint8Array(12))).toString('hex')}`

    const { rows: [buyer] } = await query(`
      INSERT INTO buyer_accounts (token_id, name, email, password_hash, company_name, phone, active, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
      RETURNING token_id, name, email, company_name
    `, [tokenId, name.trim(), email.toLowerCase().trim(), hash, companyName?.trim() ?? null, phone?.trim() ?? null],
    req.tenantSlug)

    const [accessToken, refreshToken] = await Promise.all([
      signBuyerToken(buyer.token_id, req.tenantSlug, ACCESS_TTL),
      signBuyerToken(buyer.token_id, req.tenantSlug, REFRESH_TTL),
    ])

    setBuyerCookies(res, { accessToken, refreshToken })

    res.status(201).json({
      name:        buyer.name,
      email:       buyer.email,
      companyName: buyer.company_name,
    })
  } catch (err) {
    console.error('[store/auth/register]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// ─── POST /store/auth/login ───────────────────────────────────────────────────

storeAuthRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {}

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' })
  }

  try {
    const { rows: [buyer] } = await query(`
      SELECT token_id, name, email, password_hash, company_name, active
      FROM buyer_accounts
      WHERE email = $1
    `, [email.toLowerCase().trim()], req.tenantSlug)

    // Resposta genérica — não vaza se o email existe
    if (!buyer || !buyer.active) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' })
    }

    const valid = await bcrypt.compare(password, buyer.password_hash)
    if (!valid) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' })
    }

    const [accessToken, refreshToken] = await Promise.all([
      signBuyerToken(buyer.token_id, req.tenantSlug, ACCESS_TTL),
      signBuyerToken(buyer.token_id, req.tenantSlug, REFRESH_TTL),
    ])

    setBuyerCookies(res, { accessToken, refreshToken })

    res.json({
      name:        buyer.name,
      email:       buyer.email,
      companyName: buyer.company_name ?? null,
    })
  } catch (err) {
    console.error('[store/auth/login]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// ─── POST /store/auth/logout ──────────────────────────────────────────────────

storeAuthRouter.post('/logout', (req, res) => {
  clearBuyerCookies(res)
  res.status(204).end()
})

// ─── GET /store/auth/me ───────────────────────────────────────────────────────

storeAuthRouter.get('/me', async (req, res) => {
  const token = req.cookies?.store_access
  if (!token) return res.status(401).json({ error: 'Não autenticado.' })

  try {
    const payload = await verifyBuyerToken(token)

    const { rows: [buyer] } = await query(`
      SELECT name, email, company_name FROM buyer_accounts
      WHERE token_id = $1 AND active = true
    `, [payload.sub], req.tenantSlug)

    if (!buyer) return res.status(401).json({ error: 'Sessão inválida.' })

    res.json({ name: buyer.name, email: buyer.email, companyName: buyer.company_name ?? null })
  } catch {
    clearBuyerCookies(res)
    res.status(401).json({ error: 'Sessão expirada.' })
  }
})

// ─── POST /store/auth/refresh ─────────────────────────────────────────────────

storeAuthRouter.post('/refresh', async (req, res) => {
  const token = req.cookies?.store_refresh
  if (!token) return res.status(401).json({ error: 'Não autenticado.' })

  try {
    const payload   = await verifyBuyerToken(token)
    const accessToken = await signBuyerToken(payload.sub, req.tenantSlug, ACCESS_TTL)
    res.cookie('store_access', accessToken, { ...COOKIE_OPTS, maxAge: ACCESS_TTL * 1000 })
    res.status(204).end()
  } catch {
    clearBuyerCookies(res)
    res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' })
  }
})
