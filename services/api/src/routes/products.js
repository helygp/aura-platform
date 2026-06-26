/**
 * routes/products.js
 *
 * GET    /api/products              — lista com filtros
 * GET    /api/products/next-code    — sugestão de próximo código por categoria
 * POST   /api/products              — cria produto + SKUs
 * GET    /api/products/:id          — detalhe
 * PUT    /api/products/:id          — atualiza
 * DELETE /api/products/:id          — remove
 */

import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize }    from '../middleware/authorize.js'
import { query, getClient } from '../lib/tenantDb.js'


/* Normaliza valor BRL: aceita "32,90" e "32.90" → 32.9 */
function parseBRL(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  let s = String(v).trim();
  const hasComma = s.includes(',');
  const hasDot   = s.includes('.');
  if (hasComma && hasDot) s = s.replace(/\./g, '').replace(',', '.'); // "1.234,56"
  else if (hasComma)      s = s.replace(',', '.');                    // "11,50"
  // só ponto ou nada → já é decimal válido → "11.5"
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

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

/* ── GET /api/products/next-code?category={nome} ──
 * Retorna sugestão de próximo código baseado em prefix de categoria.
 *   prefix     = 1ª letra ASCII upper do nome da categoria (acentos removidos)
 *   sequential = MAX(numero) + 1, onde products.code ~ '^{prefix}[0-9]+$'
 *                  e products.category = $1
 * Categorias diferentes que começam com a mesma letra coexistem (filtro por categoria).
 * IMPORTANTE: esta rota precisa vir ANTES de '/:id' para não ser capturada pelo wildcard.
 */
productsRouter.get('/next-code', async (req, res) => {
  const categoryName = (req.query.category || '').toString().trim()
  if (!categoryName) {
    return res.status(400).json({ error: 'category é obrigatório' })
  }

  // 1ª letra ASCII upper, com normalização de acentos
  const normalized = categoryName.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const first = normalized.charAt(0).toUpperCase()
  const prefix = /[A-Z]/.test(first) ? first : 'X'

  try {
    const { rows } = await query(
      `SELECT code FROM products
        WHERE category = $1
          AND code ~ ('^' || $2 || '[0-9]+$')`,
      [categoryName, prefix]
    )
    let max = 0
    for (const r of rows) {
      const m = /^[A-Z]([0-9]+)$/i.exec(r.code || '')
      if (m) {
        const n = parseInt(m[1], 10)
        if (n > max) max = n
      }
    }
    const sequential = max + 1
    const next = prefix + String(sequential).padStart(3, '0')
    res.json({ prefix, sequential, next })
  } catch (err) {
    console.error('[products/next-code]', err.message)
    res.status(500).json({ error: 'Erro ao calcular próximo código' })
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
          parseBRL(sku.priceWholesale) || 0, parseInt(sku.stockMin) || 0])
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

/* ── GET /api/products/:id ── */
productsRouter.get('/:id', async (req, res) => {
  try {
    const { rows: [product] } = await query(
      'SELECT * FROM products WHERE id=$1', [req.params.id]
    )
    if (!product) return res.status(404).json({ error: 'Produto não encontrado.' })

    const { rows: skus } = await query(
      'SELECT * FROM skus WHERE product_id=$1 ORDER BY code', [req.params.id]
    )
    res.json(normalizeProduct({ ...product, skus }))
  } catch (err) {
    console.error('[products/get-by-id]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── PUT /api/products/:id ── */
productsRouter.put('/:id', authorize('admin', 'estoque'), async (req, res) => {
  const client = await getClient()
  try {
    await client.query('BEGIN')
    const { name, code, category, imageUrl, attributes, skus = [] } = req.body

    const { rows: [product] } = await client.query(`
      UPDATE products SET name=$1, code=$2, category=$3, image_url=$4,
             attributes=$5::jsonb, updated_at=now()
      WHERE id=$6 RETURNING *
    `, [name, code, category, imageUrl, JSON.stringify(attributes ?? []), req.params.id])
    if (!product) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Produto não encontrado.' }) }

    /* Atualiza SKUs existentes; insere novos (sem id) */
    for (const sku of skus) {
      if (sku.id) {
        await client.query(`
          UPDATE skus SET price_wholesale=$1, stock_min=$2, updated_at=now()
          WHERE id=$3 AND product_id=$4
        `, [parseBRL(sku.priceWholesale) || 0, parseInt(sku.stockMin) || 0, sku.id, req.params.id])
      } else {
        await client.query(`
          INSERT INTO skus (product_id, code, attributes, price_wholesale, stock_min)
          VALUES ($1, $2, $3::jsonb, $4, $5)
        `, [req.params.id, sku.code, JSON.stringify(sku.attributes ?? {}),
            parseBRL(sku.priceWholesale) || 0, parseInt(sku.stockMin) || 0])
      }
    }

    /* Diff: SKUs que existiam no banco mas sumiram do payload são candidatos a exclusão.
     * Só removemos os que NÃO têm vínculo com stock_movements nem order_items.
     * Se algum bloqueado, abortamos a transação inteira e listamos os impedimentos. */
    const payloadIds = new Set(
      (skus || []).filter(s => s.id != null).map(s => String(s.id))
    )
    const { rows: existingSkus } = await client.query(
      'SELECT id, code FROM skus WHERE product_id=$1', [req.params.id]
    )
    const orphans = existingSkus.filter(s => !payloadIds.has(String(s.id)))

    if (orphans.length > 0) {
      const blocked = []
      for (const orph of orphans) {
        const { rows: mov } = await client.query(
          'SELECT 1 FROM stock_movements WHERE sku_id=$1 LIMIT 1', [orph.id]
        )
        const { rows: ord } = await client.query(
          'SELECT 1 FROM order_items WHERE sku_id=$1 LIMIT 1', [orph.id]
        )
        if (mov.length > 0 || ord.length > 0) {
          const reasons = []
          if (mov.length > 0) reasons.push('movimentações de estoque')
          if (ord.length > 0) reasons.push('pedidos')
          blocked.push({ id: orph.id, code: orph.code, reason: reasons.join(' e ') })
        }
      }
      if (blocked.length > 0) {
        await client.query('ROLLBACK')
        return res.status(409).json({
          error: 'Alguns SKUs não podem ser removidos porque possuem histórico.',
          blockedSkus: blocked,
        })
      }
      /* Deleta órfãos sem vínculo */
      const orphanIds = orphans.map(o => o.id)
      await client.query(
        'DELETE FROM skus WHERE id = ANY($1::text[]) AND product_id=$2',
        [orphanIds, req.params.id]
      )
    }

    await client.query('COMMIT')

    /* Retorna produto com SKUs atualizados */
    const { rows: updatedSkus } = await client.query(
      'SELECT * FROM skus WHERE product_id=$1 ORDER BY code', [req.params.id]
    )
    res.json(normalizeProduct({ ...product, skus: updatedSkus }))
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23505') return res.status(409).json({ error: 'Código já existe.' })
    console.error('[products/update]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  } finally {
    client.release()
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
