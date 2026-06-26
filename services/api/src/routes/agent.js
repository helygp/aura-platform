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
import { linkBotOrder } from '../lib/interactionManager.js'

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
  const provided = req.headers['x-aura-key'] || req.query['X-Aura-Key'] || req.query['x-aura-key']
  if (!provided) return res.status(401).json({ error: 'X-Aura-Key obrigatório (header ou query)' })
  // Remove X-Aura-Key dos query params para não vazar para a aplicação
  delete req.query['X-Aura-Key']; delete req.query['x-aura-key']

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
    console.log('[agent/bot-order] body:', JSON.stringify(req.body))
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

    const phoneClean = String(customer_phone).replace(/\D/g, '')

    // Enriquece items: se o agente mandou só { code, qty }, busca nome/preço/produto do banco
    const enrichedItems = []
    let computedTotal = 0
    for (const it of items) {
      const skuCode = (it.sku_code ?? it.code ?? it.sku ?? '').toString().trim()
      const qty     = Number(it.qty ?? it.quantity ?? 1)
      let name      = it.name ?? it.product_name ?? null
      let price     = Number(it.price ?? it.price_unit ?? 0)
      let attributes = it.attributes ?? {}

      if (skuCode && (!name || !price)) {
        try {
          const { rows } = await query(`
            SELECT s.code, s.price_wholesale, s.attributes, p.name AS product_name
            FROM skus s JOIN products p ON p.id = s.product_id
            WHERE s.code = $1 LIMIT 1
          `, [skuCode])
          if (rows[0]) {
            name = name ?? rows[0].product_name
            price = price || Number(rows[0].price_wholesale)
            if (!Object.keys(attributes).length && rows[0].attributes) attributes = rows[0].attributes
          }
        } catch (err) {
          console.warn('[agent/bot-order enrich]', skuCode, err.message)
        }
      }

      const item = {
        sku_code: skuCode,
        name: name || skuCode || 'Item',
        quantity: qty,
        price,
        attributes,
      }
      enrichedItems.push(item)
      computedTotal += qty * price
    }

    // Usa total enviado se for number, senão usa o calculado
    const finalTotal = typeof total === 'number' && total > 0 ? total : Math.round(computedTotal * 100) / 100

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
      JSON.stringify(enrichedItems),
      finalTotal,
      JSON.stringify(conversation),
      dify_conversation_id,
      JSON.stringify(agent_metadata),
    ])

    linkBotOrder(phoneClean, order.bot_order_id).catch(() => {})

    // Notifica aprovador via WhatsApp (sem bloquear)
    try {
      const { getWahaConfig, sendText } = await import('../lib/wahaClient.js')
      const cfg = await getWahaConfig()
      if (cfg.approver_phone) {
        const lines = enrichedItems.map(i => `• ${i.quantity}x ${i.name}${Object.keys(i.attributes ?? {}).length ? ' (' + Object.values(i.attributes).join('/') + ')' : ''} — R$ ${Number(i.price).toFixed(2)}`).join('\n')
        const refShort = order.bot_order_id.replace(/^BOT-?/i, '')
        const msg = `🆕 *Novo pedido pendente*\n\n*${order.bot_order_id}* — ${order.customer_name}\n📞 ${order.customer_phone}\n\n${lines}\n\n💰 Total: R$ ${Number(finalTotal).toFixed(2)}\n\nResponda:\n• *APROVAR ${refShort}*\n• *REJEITAR ${refShort}*`
        sendText(cfg.approver_phone, msg).catch(err =>
          console.error('[agent/bot-order notify]', err.message))
      }
    } catch (err) {
      console.error('[agent/bot-order notify]', err.message)
    }

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
