/**
 * routes/orders.js
 *
 * GET  /api/orders              — lista com filtros
 * POST /api/orders              — cria pedido manual
 * PUT  /api/orders/:id/status   — muda status
 */

import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize }    from '../middleware/authorize.js'
import { query, getClient } from '../lib/tenantDb.js'
import { dispatch } from '../lib/webhookDispatcher.js'

export const ordersRouter = Router()
ordersRouter.use(authenticate)

/* ── GET /api/orders ── */
ordersRouter.get('/', async (req, res) => {
  try {
    const { search='', status='', channel='', dateFrom='', dateTo='' } = req.query
    const params = []
    const where  = []

    if (search) {
      params.push(`%${search}%`)
      where.push(`(o.id ILIKE $${params.length} OR o.customer_name ILIKE $${params.length})`)
    }
    if (status)  { params.push(status);  where.push(`o.status=$${params.length}`) }
    if (channel) { params.push(channel); where.push(`o.channel=$${params.length}`) }
    if (dateFrom){ params.push(dateFrom); where.push(`o.created_at >= $${params.length}`) }
    if (dateTo)  { params.push(dateTo);   where.push(`o.created_at <= ($${params.length}::date + interval '1 day')`) }

    const wClause = where.length ? 'WHERE ' + where.join(' AND ') : ''

    const { rows: orders } = await query(`
      SELECT o.*,
        json_agg(
          json_build_object(
            'id', oi.id, 'skuId', oi.sku_id, 'skuCode', oi.sku_code,
            'productName', oi.product_name, 'attributes', oi.attributes,
            'qty', oi.qty, 'priceUnit', oi.price_unit
          )
        ) FILTER (WHERE oi.id IS NOT NULL) AS items,
        (SELECT json_agg(json_build_object(
            'status', oh.status, 'note', oh.note,
            'user', oh.user_name, 'at', oh.created_at
          ) ORDER BY oh.created_at)
         FROM order_history oh WHERE oh.order_id = o.id
        ) AS history
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      ${wClause}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT 200
    `, params)

    res.json({ orders: orders.map(normalizeOrder) })
  } catch (err) {
    console.error('[orders/list]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── POST /api/orders ── */
ordersRouter.post('/', authorize('admin','operador'), async (req, res) => {
  const client = await getClient()
  try {
    await client.query('BEGIN')

    const { customerId, customerName, customerWhatsapp, channel='manual', items=[], notes='' } = req.body
    const total = items.reduce((s, i) => s + parseFloat(i.priceUnit)*parseInt(i.qty), 0)
    const userName = req.user?.name ?? req.user?.email ?? 'operador'

    const { rows:[order] } = await client.query(`
      INSERT INTO orders (customer_id, customer_name, customer_whatsapp, channel, total, notes)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [customerId||null, customerName, customerWhatsapp||null, channel, total, notes])

    for (const item of items) {
      await client.query(`
        INSERT INTO order_items (order_id, sku_id, sku_code, product_name, attributes, qty, price_unit)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)
      `, [order.id, item.skuId||null, item.skuCode, item.productName,
          JSON.stringify(item.attributes??{}), parseInt(item.qty), parseFloat(item.priceUnit)])
    }

    await client.query(`
      INSERT INTO order_history (order_id, status, note, user_name)
      VALUES ($1,'pendente','Pedido criado.',$2)
    `, [order.id, userName])

    await client.query('COMMIT')
    res.status(201).json({ id: order.id, message: 'Pedido criado.' })
    // Webhook: order.created (fire & forget)
    dispatch(req.tenantSlug ?? process.env.TENANT_SLUG, 'order.created', {
      id: order.id, customer_name: order.customer_name,
      total: parseFloat(order.total), status: 'pendente', channel: order.channel,
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[orders/create]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  } finally { client.release() }
})

/* ── PUT /api/orders/:id/status ── */
ordersRouter.put('/:id/status', async (req, res) => {
  const client = await getClient()
  try {
    await client.query('BEGIN')
    const { status, note='' } = req.body
    const userName = req.user?.name ?? req.user?.email ?? 'sistema'

    const { rows:[order] } = await client.query(
      'UPDATE orders SET status=$1, updated_at=now() WHERE id=$2 RETURNING id',
      [status, req.params.id]
    )
    if (!order) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pedido não encontrado.' }) }

    await client.query(`
      INSERT INTO order_history (order_id, status, note, user_name) VALUES ($1,$2,$3,$4)
    `, [req.params.id, status, note, userName])

    await client.query('COMMIT')
    res.json({ ok: true })
    // Webhook: order.status_changed (fire & forget)
    dispatch(req.tenantSlug ?? process.env.TENANT_SLUG, 'order.status_changed', {
      id: req.params.id, new_status: status, note,
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[orders/status]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  } finally { client.release() }
})

function normalizeOrder(o) {
  return {
    id:               o.id,
    customerId:       o.customer_id,
    customerName:     o.customer_name,
    customerWhatsapp: o.customer_whatsapp,
    channel:          o.channel,
    status:           o.status,
    total:            parseFloat(o.total ?? 0),
    notes:            o.notes,
    items:            o.items  ?? [],
    history:          o.history ?? [],
    createdAt:        o.created_at,
    updatedAt:        o.updated_at,
  }
}
