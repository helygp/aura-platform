/**
 * middleware/authenticateBuyer.js
 * Valida o cookie store_access e injeta req.buyer a partir de customers.
 */

import { jwtVerify } from 'jose'
import { query }     from '../lib/tenantDb.js'
import { ENV }       from '../lib/env.js'

const secret = () => new TextEncoder().encode(
  ENV.BUYER_JWT_SECRET ?? ENV.JWT_SECRET + '_buyer'
)

export async function authenticateBuyer(req, res, next) {
  const token = req.cookies?.store_access
  if (!token) return res.status(401).json({ error: 'Autenticação necessária.' })

  const tenantSlug = req.headers['x-tenant-slug'] ?? req.tenantSlug
  if (!tenantSlug) return res.status(400).json({ error: 'Tenant não identificado.' })

  try {
    const { payload } = await jwtVerify(token, secret())
    if (payload.type !== 'buyer') throw new Error('Token inválido.')

    const { rows: [customer] } = await query(`
      SELECT id, token_id, name, email, document,
             credit_limit, credit_balance
      FROM customers
      WHERE token_id = $1 AND portal_active = true
    `, [payload.sub], tenantSlug)

    if (!customer) return res.status(401).json({ error: 'Sessão inválida.' })

    req.buyer = {
      id:              customer.id,
      tokenId:         customer.token_id,
      name:            customer.name,
      email:           customer.email,
      document:        customer.document ?? null,
      creditLimit:     Math.round(parseFloat(customer.credit_limit)  * 100),
      creditBalance:   Math.round(parseFloat(customer.credit_balance) * 100),
      creditAvailable: Math.round((parseFloat(customer.credit_limit) - parseFloat(customer.credit_balance)) * 100),
    }

    next()
  } catch {
    res.status(401).json({ error: 'Sessão expirada.' })
  }
}

export async function optionalBuyerAuth(req, res, next) {
  const token = req.cookies?.store_access
  if (!token) return next()

  const tenantSlug = req.headers['x-tenant-slug'] ?? req.tenantSlug
  if (!tenantSlug) return next()

  try {
    const { payload } = await jwtVerify(token, secret())
    if (payload.type !== 'buyer') return next()

    const { rows: [customer] } = await query(`
      SELECT id, token_id, name, email, document,
             credit_limit, credit_balance
      FROM customers
      WHERE token_id = $1 AND portal_active = true
    `, [payload.sub], tenantSlug)

    if (customer) {
      req.buyer = {
        id:              customer.id,
        tokenId:         customer.token_id,
        name:            customer.name,
        email:           customer.email,
        document:        customer.document ?? null,
        creditLimit:     Math.round(parseFloat(customer.credit_limit)  * 100),
        creditBalance:   Math.round(parseFloat(customer.credit_balance) * 100),
        creditAvailable: Math.round((parseFloat(customer.credit_limit) - parseFloat(customer.credit_balance)) * 100),
      }
    }
  } catch { /* token inválido — continua como anônimo */ }

  next()
}
