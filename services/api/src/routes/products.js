/**
 * routes/products.js
 *
 * GET    /api/products           — lista com filtros
 * POST   /api/products           — cria produto + SKUs
 * PUT    /api/products/:id       — atualiza
 * DELETE /api/products/:id       — remove
 */

import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize }    from '../middleware/authorize.js'
import { query, getClient } from '../lib/tenantDb.js'

export const productsRouter = Router()
productsRouter.use(authenticate)

/* ── GET /api/products ── */
productsRouter.get('/', async (req, res) => {
  try {
    const { search = '', type = '', category = '' } = req.query
    const params = []
    const where  = []

    if (search) {
      params.push(`%${search}%`)
      where.push(`(p.name ILIKE $${params.length} OR p.code ILIKE $${params.length})`)
    }
    if (type)     { params.push(type);     where.push(`p.type = $${params.length}`) }
    if (category) { params.push(category); where.push(`p.category = $${params.length}`) }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : ''

    const { rows: products } = await query(`
      SELECT p.*, json_agg(
        json_build_object(
          'id', s.id, 'code', s.code, 'attributes', s.attributes,
          'priceWholesale', s.price_wholesale,
          'stock', s.stock, 'stockMin', s.stock_min
        ) ORDER BY s.code
      ) FILTER (WHERE s.id IS NOT NULL) AS skus
      FROM products p
      LEFT JOIN skus s ON s.product_id = p.id
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `, params)

    res.json({ products: products.map(normalizeProduct) })
  } catch (err) {
    console.error('[products/list]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── POST /api/products ── */
productsRouter.post('/', authorize('admin', 'estoque'), async (req, res) => {
  const client = await getClient()
  try {
    await client.query('BEGIN')
    const { name, code, category, type, imageUrl, attributes, skus = [] } = req.body

    const { rows: [product] } = await client.query(`
      INSERT INTO products (name, code, category, type, image_url, attributes)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      RETURNING *
    `, [name, code, category, type, imageUrl, JSON.stringify(attributes ?? [])])

    const insertedSkus = []
    for (const sku of skus) {
      const { rows: [s] } = await client.query(`
        INSERT INTO skus (product_id, code, attributes, price_wholesale, stock_min)
        VALUES ($1, $2, $3::jsonb, $4, $5)
        RETURNING *
      `, [product.id, sku.code, JSON.stringify(sku.attributes ?? {}),
          parseFloat(sku.priceWholesale) || 0, parseInt(sku.stockMin) || 0])
      insertedSkus.push(s)
    }

    await client.query('COMMIT')
    res.status(201).json(normalizeProduct({ ...product, skus: insertedSkus }))
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23505') return res.status(409).json({ error: 'Código já existe.' })
    console.error('[products/create]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  } finally {
    client.release()
  }
})

/* ── PUT /api/products/:id ── */
productsRouter.put('/:id', authorize('admin', 'estoque'), async (req, res) => {
  try {
    const { name, code, category, imageUrl, attributes } = req.body
    const { rows: [product] } = await query(`
      UPDATE products SET name=$1, code=$2, category=$3, image_url=$4,
             attributes=$5::jsonb, updated_at=now()
      WHERE id=$6 RETURNING *
    `, [name, code, category, imageUrl, JSON.stringify(attributes ?? []), req.params.id])
    if (!product) return res.status(404).json({ error: 'Produto não encontrado.' })
    res.json(normalizeProduct(product))
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Código já existe.' })
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── DELETE /api/products/:id ── */
productsRouter.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await query('DELETE FROM products WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    console.error('[products/delete]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── Normaliza snake_case → camelCase ── */
function normalizeProduct(p) {
  return {
    id:        p.id,
    name:      p.name,
    code:      p.code,
    category:  p.category,
    type:      p.type,
    imageUrl:  p.image_url,
    attributes: p.attributes ?? [],
    skus: (p.skus ?? []).map(s => ({
      id:             s.id,
      code:           s.code,
      attributes:     s.attributes ?? {},
      priceWholesale: parseFloat(s.price_wholesale ?? s.priceWholesale ?? 0),
      stock:          s.stock ?? 0,
      stockMin:       s.stock_min ?? s.stockMin ?? 0,
    })),
    createdAt: p.created_at,
  }
}
