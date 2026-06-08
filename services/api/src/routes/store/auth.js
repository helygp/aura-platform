/**
 * routes/store/auth.js
 * Auth do portal B2B — usa a tabela customers (email é a chave de vínculo).
 *
 * POST /store/auth/register  — auto-cadastro → cria customer + ativa portal
 * POST /store/auth/login     — autentica → seta cookies
 * POST /store/auth/logout    — limpa cookies
 * GET  /store/auth/me        — dados da sessão + crédito
 * POST /store/auth/change-password
 */

import { Router }            from 'express'
import bcrypt                from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { query, getClient }  from '../../lib/tenantDb.js'
import { ENV }               from '../../lib/env.js'

export const storeAuthRouter = Router()

const ACCESS_TTL  = 60 * 60 * 2
const REFRESH_TTL = 60 * 60 * 24 * 30
const IS_PROD     = process.env.NODE_ENV === 'production'

const secret = () => new TextEncoder().encode(
  ENV.BUYER_JWT_SECRET ?? ENV.JWT_SECRET + '_buyer'
)

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   IS_PROD,
  sameSite: IS_PROD ? 'lax' : 'lax',   // strict bloqueia cookie entre subdomínios
  domain:   IS_PROD ? '.aurabr.app' : undefined, // compartilha loja.* e api.* em prod
  path:     '/',
}

async function signToken(tokenId, tenantSlug, ttl) {
  return new SignJWT({ tenantSlug, type: 'buyer' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(tokenId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttl)
    .sign(secret())
}

function setCookies(res, { accessToken, refreshToken }) {
  // Limpar cookies legados sem domain explícito (escopo = api.*.aurabr.app)
  // para evitar conflito com os novos cookies de domain .aurabr.app
  const legacyOpts = { httpOnly: true, secure: IS_PROD, sameSite: IS_PROD ? 'lax' : 'lax', path: '/' }
  res.clearCookie('store_access',  legacyOpts)
  res.clearCookie('store_refresh', legacyOpts)
  // Setar novos com domain .aurabr.app
  res.cookie('store_access',   accessToken,  { ...COOKIE_OPTS, maxAge: ACCESS_TTL  * 1000 })
  res.cookie('store_refresh',  refreshToken, { ...COOKIE_OPTS, maxAge: REFRESH_TTL * 1000 })
}

function clearCookies(res) {
  res.clearCookie('store_access',  { ...COOKIE_OPTS, maxAge: 0 })
  res.clearCookie('store_refresh', { ...COOKIE_OPTS, maxAge: 0 })
}

/* ── POST /store/auth/register ───────────────────────────────────────────────── */
storeAuthRouter.post('/register', async (req, res) => {
  const { name, email, password, companyName, document, phone } = req.body ?? {}

  if (!name?.trim() || !email?.trim() || !password)
    return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' })
  if (password.length < 8)
    return res.status(400).json({ error: 'A senha deve ter no mínimo 8 caracteres.' })

  const emailNorm = email.toLowerCase().trim()

  try {
    const { rows: [existing] } = await query(
      'SELECT id, portal_active FROM customers WHERE email = $1', [emailNorm]
    )

    if (existing) {
      if (existing.portal_active)
        return res.status(409).json({ error: 'Este e-mail já possui cadastro. Faça login.' })
      // Pré-cadastrado pelo lojista mas sem acesso: ativa portal
      const hash    = await bcrypt.hash(password, 12)
      const tokenId = `cst_${Buffer.from(crypto.getRandomValues(new Uint8Array(12))).toString('hex')}`
      await query(
        `UPDATE customers SET password_hash=$1, token_id=$2, portal_active=true, updated_at=NOW() WHERE id=$3`,
        [hash, tokenId, existing.id]
      )
      const [at, rt] = await Promise.all([
        signToken(tokenId, req.tenantSlug, ACCESS_TTL),
        signToken(tokenId, req.tenantSlug, REFRESH_TTL),
      ])
      setCookies(res, { accessToken: at, refreshToken: rt })
      return res.status(201).json({ name: name.trim(), email: emailNorm })
    }

    // Novo cliente: cria em customers
    const hash    = await bcrypt.hash(password, 12)
    const tokenId = `cst_${Buffer.from(crypto.getRandomValues(new Uint8Array(12))).toString('hex')}`

    const { rows: [customer] } = await query(`
      INSERT INTO customers
        (name, email, password_hash, token_id, portal_active, whatsapp, document, created_at, updated_at)
      VALUES ($1,$2,$3,$4,true,$5,$6,NOW(),NOW())
      RETURNING id, name, email
    `, [
      name.trim(), emailNorm, hash, tokenId,
      phone?.trim() ?? null,
      document?.trim() ?? null,
    ])

    const [at, rt] = await Promise.all([
      signToken(tokenId, req.tenantSlug, ACCESS_TTL),
      signToken(tokenId, req.tenantSlug, REFRESH_TTL),
    ])
    setCookies(res, { accessToken: at, refreshToken: rt })

    res.status(201).json({
      name:  customer.name,
      email: customer.email,
    })
  } catch (err) {
    console.error('[store/auth/register]', err.message)
    res.status(500).json({ error: 'Erro ao criar conta.' })
  }
})

/* ── POST /store/auth/login ──────────────────────────────────────────────────── */
storeAuthRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {}
  if (!email || !password)
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' })

  try {
    const { rows: [customer] } = await query(
      `SELECT id, token_id, name, email, password_hash, portal_active,
              credit_limit, credit_balance, document
       FROM customers WHERE email = $1`,
      [email.toLowerCase().trim()]
    )

    if (!customer || !customer.portal_active || !customer.password_hash)
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' })

    const ok = await bcrypt.compare(password, customer.password_hash)
    if (!ok)
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' })

    // Regenera token_id a cada login para invalidar sessões antigas
    const tokenId = `cst_${Buffer.from(crypto.getRandomValues(new Uint8Array(12))).toString('hex')}`
    await query(
      'UPDATE customers SET token_id=$1, updated_at=NOW() WHERE id=$2',
      [tokenId, customer.id]
    )

    const [at, rt] = await Promise.all([
      signToken(tokenId, req.tenantSlug, ACCESS_TTL),
      signToken(tokenId, req.tenantSlug, REFRESH_TTL),
    ])
    setCookies(res, { accessToken: at, refreshToken: rt })

    const limitCents   = Math.round(parseFloat(customer.credit_limit)   * 100)
    const balanceCents = Math.round(parseFloat(customer.credit_balance)  * 100)

    res.json({
      name:            customer.name,
      email:           customer.email,
      document:        customer.document ?? null,
      creditLimit:     limitCents,
      creditBalance:   balanceCents,
      creditAvailable: limitCents - balanceCents,
    })
  } catch (err) {
    console.error('[store/auth/login]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── POST /store/auth/logout ─────────────────────────────────────────────────── */
storeAuthRouter.post('/logout', (req, res) => {
  clearCookies(res)
  res.json({ ok: true })
})

/* ── GET /store/auth/me ──────────────────────────────────────────────────────── */
storeAuthRouter.get('/me', async (req, res) => {
  const token = req.cookies?.store_access
  if (!token) return res.json({ buyer: null })

  try {
    const { payload } = await jwtVerify(token, secret())
    if (payload.type !== 'buyer') throw new Error('Token inválido.')

    const { rows: [customer] } = await query(
      `SELECT id, name, email, document, whatsapp,
              credit_limit, credit_balance, portal_active
       FROM customers WHERE token_id = $1 AND portal_active = true`,
      [payload.sub]
    )
    if (!customer) return res.status(401).json({ error: 'Sessão inválida.' })

    const limitCents   = Math.round(parseFloat(customer.credit_limit)   * 100)
    const balanceCents = Math.round(parseFloat(customer.credit_balance)  * 100)

    res.json({ buyer: {
      id:              customer.id,
      name:            customer.name,
      email:           customer.email,
      document:        customer.document ?? null,
      whatsapp:        customer.whatsapp ?? null,
      creditLimit:     limitCents,
      creditBalance:   balanceCents,
      creditAvailable: limitCents - balanceCents,
    }})
  } catch {
    clearCookies(res)
    res.json({ buyer: null })
  }
})

/* ── POST /store/auth/change-password ───────────────────────────────────────── */
storeAuthRouter.post('/change-password', async (req, res) => {
  const token = req.cookies?.store_access
  if (!token) return res.status(401).json({ error: 'Não autenticado.' })

  const { currentPassword, newPassword } = req.body ?? {}
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'Preencha todos os campos.' })
  if (newPassword.length < 8)
    return res.status(400).json({ error: 'Nova senha deve ter no mínimo 8 caracteres.' })

  try {
    const { payload } = await jwtVerify(token, secret())
    const { rows: [customer] } = await query(
      'SELECT id, password_hash FROM customers WHERE token_id = $1 AND portal_active = true',
      [payload.sub]
    )
    if (!customer) return res.status(401).json({ error: 'Sessão inválida.' })

    const ok = await bcrypt.compare(currentPassword, customer.password_hash)
    if (!ok) return res.status(401).json({ error: 'Senha atual incorreta.' })

    const hash = await bcrypt.hash(newPassword, 12)
    await query('UPDATE customers SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, customer.id])

    res.json({ ok: true })
  } catch (err) {
    console.error('[store/auth/change-password]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})
