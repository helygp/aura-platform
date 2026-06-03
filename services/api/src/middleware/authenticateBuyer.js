/**
 * middleware/authenticateBuyer.js
 * Valida o cookie store_access e injeta req.buyer.
 *
 * Separado do authenticate.js (ERP) — nunca se misturam.
 *
 * req.buyer = { id, tokenId, name, email, companyName }
 */

import { jwtVerify }  from 'jose'
import { query }      from '../lib/tenantDb.js'
import { ENV }        from '../lib/env.js'

const secret = () => new TextEncoder().encode(
  ENV.BUYER_JWT_SECRET ?? ENV.JWT_SECRET + '_buyer'
)

export async function authenticateBuyer(req, res, next) {
  const token = req.cookies?.store_access
  if (!token) {
    return res.status(401).json({ error: 'Autenticação necessária.' })
  }

  const tenantSlug = req.headers['x-tenant-slug'] ?? req.tenantSlug
  if (!tenantSlug) {
    return res.status(400).json({ error: 'Tenant não identificado.' })
  }

  try {
    const { payload } = await jwtVerify(token, secret())
    if (payload.type !== 'buyer') throw new Error('Token inválido.')

    const { rows: [buyer] } = await query(`
      SELECT id, token_id, name, email, company_name
      FROM buyer_accounts
      WHERE token_id = $1 AND active = true
    `, [payload.sub], tenantSlug)

    if (!buyer) return res.status(401).json({ error: 'Sessão inválida.' })

    req.buyer = {
      id:          buyer.id,
      tokenId:     buyer.token_id,
      name:        buyer.name,
      email:       buyer.email,
      companyName: buyer.company_name ?? null,
    }

    next()
  } catch {
    res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' })
  }
}

/** Versão opcional — injeta req.buyer se logado, mas não bloqueia. */
export async function optionalBuyerAuth(req, res, next) {
  const token = req.cookies?.store_access
  if (!token) return next()

  const tenantSlug = req.headers['x-tenant-slug'] ?? req.tenantSlug
  if (!tenantSlug) return next()

  try {
    const { payload } = await jwtVerify(token, secret())
    if (payload.type !== 'buyer') return next()

    const { rows: [buyer] } = await query(`
      SELECT id, token_id, name, email, company_name
      FROM buyer_accounts WHERE token_id = $1 AND active = true
    `, [payload.sub], tenantSlug)

    if (buyer) {
      req.buyer = {
        id:          buyer.id,
        tokenId:     buyer.token_id,
        name:        buyer.name,
        email:       buyer.email,
        companyName: buyer.company_name ?? null,
      }
    }
  } catch { /* silencioso */ }

  next()
}
