/**
 * routes/agent.js
 *
 * Endpoints públicos que o Dify Agent chama como tools.
 *
 * Autenticação: API Key fixa por tenant
 *   - Key gerada na config do tenant (aura_master.whatsapp_config.internal_api_key)
 *   - Passada no header X-Aura-Key
 *
 * Endpoints expostos:
 *   GET  /api/agent/catalog          — produtos + SKUs + estoque
 *   GET  /api/agent/catalog/search   — busca por texto livre
 *   GET  /api/agent/customer         — identifica cliente por WhatsApp
 *   POST /api/agent/bot-order        — cria pedido em bot_orders (pending_approval)
 *   POST /api/agent/bot-order/:id/message — append mensagem ao histórico
 *
 * Tenant é implícito pelo container (process.env.TENANT_SLUG).
 */

import { Router }         from 'express'
import { query }          from '../lib/tenantDb.js'
import { getWahaConfig, invalidateWahaCache } from '../lib/wahaClient.js'

export const agentRouter = Router()

const TENANT_SLUG = process.env.TENANT_SLUG

// Re-exportado para outros módulos invalidarem cache se necessário
export const invalidateAgentKeyCache = invalidateWahaCache

async function getInternalKey() {
  const cfg = await getWahaConfig()
  return cfg.internal_api_key ?? null
}

/* ── Middleware: valida X-Aura-Key ── */
agentRouter.use(async (req, res, next) => {
  const provided = req.headers['x-aura-key']
  if (!provided) return res.status(401).json({ error: 'X-Aura-Key obrigatório' })

  const expected = await getInternalKey()
  if (!expected) return res.status(503).json({ error: 'WhatsApp Agent não configurado para este tenant' })

  if (provided !== expected) return res.status(403).json({ error: 'X-Aura-Key inválido' })

  req.tenantSlug = TENANT_SLUG
  next()
})

/* ── GET /api/agent/catalog ─────────────────────────────────────────── */
/* Lista produtos com SKUs e estoque. Filtra apenas SKUs com estoque > 0 por padrão. */
agentRouter.get('/catalog', async (req, res) => {
  try {
    const limit       = Math.min(parseInt(req.query.limit ?? '200', 10), 500)
    const onlyInStock = req.query.in_stock !== 'false' // default true

    const { rows: products } = await query(`
      SELECT
        p.id,
        p.name,
        p.code,
        p.category,
        p.type,
        p.cover_image_url,
        p.attributes,
        coalesce(
          json_agg(
            json_build_object(
              'id',         s.id,
              'code',       s.code,
              'price',      s.price_wholesale,
              'stock',      s.stock,
              'attributes', s.attributes
            ) ORDER BY s.code
          ) FILTER (WHERE s.id IS NOT NULL${onlyInStock ? ' AND s.stock > 0' : ''}),
          '[]'
        ) AS skus
      FROM products p
      LEFT JOIN skus s ON s.product_id = p.id
      WHERE coalesce(p.publico, true) = true
      GROUP BY p.id
      HAVING ${onlyInStock ? 'count(s.id) FILTER (WHERE s.stock > 0) > 0' : 'true'}
      ORDER BY p.name
      LIMIT $1
    `, [limit])

    res.json({ products, count: products.length, in_stock_only: onlyInStock })
  } catch (err) {
    console.error('[agent/catalog]', err.message)
    res.status(500).json({ error: 'Erro ao buscar catálogo' })
  }
})

/* ── GET /api/agent/catalog/search?q=... ────────────────────────────── */
agentRouter.get('/catalog/search', async (req, res) => {
  try {
    const q = String(req.query.q ?? '').trim()
    if (!q) return res.json({ products: [], count: 0 })

    const pattern = `%${q.replace(/[%_]/g, '\\$&')}%`
    const { rows: products } = await query(`
      SELECT
        p.id, p.name, p.code, p.category, p.type, p.cover_image_url, p.attributes,
        coalesce(
          (SELECT json_agg(json_build_object(
            'id', s.id, 'code', s.code,
            'price', s.price_wholesale, 'stock', s.stock,
            'attributes', s.attributes
          ) ORDER BY s.code)
           FROM skus s WHERE s.product_id = p.id),
          '[]'
        ) AS skus
      FROM products p
      LEFT JOIN skus s2 ON s2.product_id = p.id
      WHERE coalesce(p.publico, true) = true
        AND (
          p.name ILIKE $1
          OR p.code ILIKE $1
          OR p.category ILIKE $1
          OR s2.code ILIKE $1
        )
      GROUP BY p.id
      ORDER BY p.name
      LIMIT 30
    `, [pattern])

    res.json({ products, count: products.length, query: q })
  } catch (err) {
    console.error('[agent/catalog/search]', err.message)
    res.status(500).json({ error: 'Erro na busca' })
  }
})

/* ── GET /api/agent/customer?phone=... ──────────────────────────────── */
/* Match por sufixo do WhatsApp (ignora código de país). */
agentRouter.get('/customer', async (req, res) => {
  try {
    const phone = String(req.query.phone ?? '').replace(/\D/g, '')
    if (phone.length < 8) return res.status(400).json({ error: 'phone inválido' })

    const last10 = phone.slice(-10)
    const { rows } = await query(`
      SELECT id, name, person_type, document, whatsapp, email, status, credit_limit, credit_balance
      FROM customers
      WHERE regexp_replace(coalesce(whatsapp, ''), '\\D', '', 'g') ILIKE $1
      LIMIT 1
    `, [`%${last10}`])

    if (!rows[0]) return res.json({ customer: null })
    res.json({ customer: rows[0] })
  } catch (err) {
    console.error('[agent/customer]', err.message)
    res.status(500).json({ error: 'Erro ao identificar cliente' })
  }
})

/* ── POST /api/agent/bot-order ──────────────────────────────────────── */
/* body: { customer_name, customer_phone, items: [...], total, conversation, dify_conversation_id, agent_metadata } */
agentRouter.post('/bot-order', async (req, res) => {
  try {
    const {
      customer_name,
      customer_phone,
      items,
      total,
      conversation = [],
      dify_conversation_id = null,
      agent_metadata = {},
    } = req.body ?? {}

    if (!customer_name?.trim())                 return res.status(400).json({ error: 'customer_name obrigatório' })
    if (!customer_phone?.trim())                return res.status(400).json({ error: 'customer_phone obrigatório' })
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items obrigatório' })
    if (typeof total !== 'number')              return res.status(400).json({ error: 'total obrigatório (number)' })

    const phoneClean = String(customer_phone).replace(/\D/g, '')

    const { rows: [order] } = await query(`
      INSERT INTO bot_orders (
        customer_name, customer_phone, items, total,
        conversation, dify_conversation_id, agent_metadata
      ) VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6, $7::jsonb)
      RETURNING id, bot_order_id, customer_name, customer_phone,
                items, total, status, received_at
    `, [
      String(customer_name).trim(),
      phoneClean,
      JSON.stringify(items),
      total,
      JSON.stringify(conversation),
      dify_conversation_id,
      JSON.stringify(agent_metadata),
    ])

    res.status(201).json({ ok: true, order })
  } catch (err) {
    console.error('[agent/bot-order]', err.message)
    res.status(500).json({ error: 'Erro ao criar pedido' })
  }
})

/* ── POST /api/agent/bot-order/:id/message ──────────────────────────── */
/* body: { role: 'user'|'assistant', content: string, at?: ISO } */
agentRouter.post('/bot-order/:id/message', async (req, res) => {
  try {
    const { role, content, at } = req.body ?? {}
    if (!['user', 'assistant'].includes(role)) return res.status(400).json({ error: 'role: user ou assistant' })
    if (!content?.trim())                      return res.status(400).json({ error: 'content obrigatório' })

    const msg = { role, content: String(content), at: at ?? new Date().toISOString() }

    const { rowCount } = await query(`
      UPDATE bot_orders
      SET conversation = conversation || $1::jsonb
      WHERE id = $2 OR bot_order_id = $2
    `, [JSON.stringify([msg]), req.params.id])

    if (!rowCount) return res.status(404).json({ error: 'bot_order não encontrado' })
    res.json({ ok: true })
  } catch (err) {
    console.error('[agent/bot-order/message]', err.message)
    res.status(500).json({ error: 'Erro ao registrar mensagem' })
  }
})
