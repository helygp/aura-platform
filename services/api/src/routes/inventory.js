/**
 * routes/inventory.js
 *
 * GET  /api/inventory           — SKUs com estoque
 * POST /api/inventory/:skuId/movement — entrada/saída/ajuste
 * GET  /api/inventory/:skuId/movements — histórico
 */

import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize }    from '../middleware/authorize.js'
import { query, getClient } from '../lib/tenantDb.js'
import { dispatch } from '../lib/webhookDispatcher.js'

export const inventoryRouter = Router()
inventoryRouter.use(authenticate)
inventoryRouter.use(authorize('admin', 'estoque'))

/* ── GET /api/inventory ── */
inventoryRouter.get('/', async (req, res) => {
  try {
    const { search = '', status = '' } = req.query

    let where = []
    const params = []

    if (search) {
      params.push(`%${search}%`)
      where.push(`(s.code ILIKE $${params.length} OR p.name ILIKE $${params.length})`)
    }
    if (status === 'zerado') { where.push('s.stock = 0') }
    else if (status === 'baixo') { where.push('s.stock > 0 AND s.stock <= s.stock_min') }
    else if (status === 'ok') { where.push('s.stock > s.stock_min') }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : ''

    const { rows } = await query(`
      SELECT s.id, s.code, s.attributes, s.stock, s.stock_min,
             s.price_wholesale, p.id AS product_id, p.name AS product_name,
             p.category, p.type,
             CASE
               WHEN s.stock = 0 THEN 'zerado'
               WHEN s.stock <= s.stock_min THEN 'baixo'
               ELSE 'ok'
             END AS stock_status
      FROM skus s
      JOIN products p ON p.id = s.product_id
      ${whereClause}
      ORDER BY stock_status, s.code
    `, params)

    const summary = {
      total:   rows.length,
      ok:      rows.filter(r => r.stock_status === 'ok').length,
      baixo:   rows.filter(r => r.stock_status === 'baixo').length,
      zerado:  rows.filter(r => r.stock_status === 'zerado').length,
    }

    res.json({
      skus: rows.map(normalizeSku),
      summary,
    })
  } catch (err) {
    console.error('[inventory/list]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── POST /api/inventory/:skuId/movement ── */
inventoryRouter.post('/:skuId/movement', async (req, res) => {
  const client = await getClient()
  try {
    await client.query('BEGIN')

    const { type, qty, reason } = req.body
    const skuId    = req.params.skuId
    const userName = req.user?.name ?? req.user?.email ?? 'sistema'

    const { rows: [sku] } = await client.query(
      'SELECT id, code, stock, stock_min FROM skus WHERE id=$1 FOR UPDATE', [skuId]
    )
    if (!sku) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'SKU não encontrado.' }) }

    let newStock = sku.stock
    if (type === 'entrada') newStock += Math.abs(qty)
    else if (type === 'saida') newStock -= Math.abs(qty)
    else if (type === 'ajuste') newStock = qty   // valor absoluto
    if (newStock < 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Estoque insuficiente.' }) }

    await client.query('UPDATE skus SET stock=$1, updated_at=now() WHERE id=$2', [newStock, skuId])
    const { rows: [movement] } = await client.query(`
      INSERT INTO stock_movements (sku_id, type, qty, qty_before, qty_after, reason, user_name)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [skuId, type, qty, sku.stock, newStock, reason ?? '', userName])

    await client.query('COMMIT')
    res.status(201).json({ movement, newStock })
    // Webhook: inventory.low se estoque atingiu mínimo
    if (newStock <= (sku.stock_min ?? 0) && newStock >= 0) {
      dispatch(req.tenantSlug ?? process.env.TENANT_SLUG, 'inventory.low', {
        sku_id: skuId, sku_code: sku.code ?? skuId,
        stock: newStock, stock_min: sku.stock_min ?? 0,
      })
    }
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[inventory/movement]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  } finally {
    client.release()
  }
})

/* ── GET /api/inventory/:skuId/movements ── */
inventoryRouter.get('/:skuId/movements', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT * FROM stock_movements WHERE sku_id=$1 ORDER BY created_at DESC LIMIT 50
    `, [req.params.skuId])
    res.json({ movements: rows })
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' })
  }
})

function normalizeSku(s) {
  return {
    id:             s.id,
    code:           s.code,
    attributes:     s.attributes ?? {},
    stock:          s.stock,
    stockMin:       s.stock_min,
    stockStatus:    s.stock_status,
    priceWholesale: parseFloat(s.price_wholesale ?? 0),
    productId:      s.product_id,
    productName:    s.product_name,
    category:       s.category,
    type:           s.type,
  }
}
