/**
 * routes/store/catalog.js  v2
 * GET /store/catalog/featured    — destaques (home)
 * GET /store/catalog/categories  — categorias disponíveis
 * GET /store/catalog             — listagem com filtros, sort e paginação cursor
 * GET /store/catalog/sku-stock/:skuId — estoque em tempo real
 * GET /store/catalog/:id         — detalhe do produto
 *
 * FIXES v2:
 *  - minPrice/maxPrice agora em centavos (price_wholesale * 100)
 *  - SKU detail: aliases corretos (price, stock, active, code)
 *  - Atributos do produto agregados dos SKUs
 */

import { Router } from 'express'
import { query }  from '../../lib/tenantDb.js'

export const storeCatalogRouter = Router()

/* ── GET /store/catalog/featured ── */
storeCatalogRouter.get('/featured', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        p.id   AS slug,
        p.name,
        p.code,
        p.category,
        p.cover_image_url                                 AS "coverImageUrl",
        p.images,
        ROUND(MIN(s.price_wholesale) * 100)::int          AS "minPrice",
        ROUND(MAX(s.price_wholesale) * 100)::int          AS "maxPrice",
        BOOL_OR(s.stock > 0)                              AS "inStock",
        COALESCE(
          json_agg(DISTINCT s.attributes)
          FILTER (WHERE s.attributes IS NOT NULL AND s.attributes != '{}'),
          '[]'
        )                                                 AS "rawAttributes"
      FROM products p
      LEFT JOIN skus s ON s.product_id = p.id
      WHERE p.publico = true AND p.destaque = true
      GROUP BY p.id
      ORDER BY p.destaque_ordem ASC NULLS LAST, p.name ASC
      LIMIT 10
    `)
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
    res.json(rows.map(normalizeProduct))
  } catch (err) {
    console.error('[store/catalog/featured]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── GET /store/catalog/categories ── */
storeCatalogRouter.get('/categories', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT DISTINCT p.category
      FROM products p
      WHERE p.publico = true AND p.category IS NOT NULL AND p.category != ''
      ORDER BY p.category
    `)
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120')
    res.json(rows.map(r => r.category))
  } catch (err) {
    console.error('[store/catalog/categories]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── GET /store/catalog ── */
storeCatalogRouter.get('/', async (req, res) => {
  try {
    const {
      q,
      category,
      sort    = 'name_asc',
      cursor,
      limit   = '20',
    } = req.query

    const limitN = Math.min(100, Math.max(1, parseInt(limit, 10)))

    const conditions = ['p.publico = true']
    const params = []

    if (q) {
      params.push(`%${q}%`)
      conditions.push(`(p.name ILIKE $${params.length} OR p.code ILIKE $${params.length})`)
    }

    if (category) {
      params.push(category)
      conditions.push(`p.category = $${params.length}`)
    }

    if (cursor) {
      params.push(cursor)
      conditions.push(`p.id > $${params.length}`)
    }

    const sortMap = {
      name_asc:   'p.name ASC',
      name_desc:  'p.name DESC',
      price_asc:  'MIN(s.price_wholesale) ASC NULLS LAST',
      price_desc: 'MAX(s.price_wholesale) DESC NULLS LAST',
    }
    const orderBy = sortMap[sort] ?? 'p.name ASC'

    params.push(limitN + 1)
    const { rows } = await query(`
      SELECT
        p.id   AS slug,
        p.name,
        p.code,
        p.category,
        p.cover_image_url                         AS "coverImageUrl",
        p.images,
        ROUND(MIN(s.price_wholesale) * 100)::int  AS "minPrice",
        ROUND(MAX(s.price_wholesale) * 100)::int  AS "maxPrice",
        BOOL_OR(s.stock > 0)                      AS "inStock",
        COALESCE(
          json_agg(DISTINCT s.attributes)
          FILTER (WHERE s.attributes IS NOT NULL AND s.attributes != '{}'),
          '[]'
        )                                         AS "rawAttributes"
      FROM products p
      LEFT JOIN skus s ON s.product_id = p.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY p.id, p.name, p.code, p.category, p.cover_image_url, p.images
      ORDER BY ${orderBy}
      LIMIT $${params.length}
    `, params)

    const hasMore    = rows.length > limitN
    const data       = hasMore ? rows.slice(0, limitN) : rows
    const nextCursor = hasMore ? data[data.length - 1].slug : null

    res.json({
      items:      data.map(normalizeProduct),
      nextCursor,
      hasMore,
      total:      data.length,
    })
  } catch (err) {
    console.error('[store/catalog]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── GET /store/catalog/sku-stock/:skuId ── */
storeCatalogRouter.get('/sku-stock/:skuId', async (req, res) => {
  try {
    const { rows: [sku] } = await query(
      'SELECT id, stock FROM skus WHERE id = $1',
      [req.params.skuId]
    )
    if (!sku) return res.status(404).json({ error: 'SKU não encontrado.' })
    res.json({ skuId: sku.id, stock: sku.stock })
  } catch (err) {
    console.error('[store/catalog/sku-stock]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── GET /store/catalog/:id ── */
storeCatalogRouter.get('/:id', async (req, res) => {
  try {
    const { rows: [product] } = await query(`
      SELECT
        p.id, p.name, p.code, p.category,
        p.cover_image_url AS "coverImageUrl",
        p.images, p.publico, p.attributes,
        p.seo_title       AS "seoTitle",
        p.seo_description AS "seoDescription"
      FROM products p
      WHERE p.id = $1 AND p.publico = true
    `, [req.params.id])

    if (!product) return res.status(404).json({ error: 'Produto não encontrado.' })

    /* SKUs com aliases corretos — price em centavos, active sempre true */
    const { rows: skus } = await query(`
      SELECT
        id,
        code                                       AS code,
        attributes,
        ROUND(price_wholesale * 100)::int          AS price,
        stock,
        stock_min                                  AS "stockMin",
        true                                       AS active
      FROM skus
      WHERE product_id = $1
      ORDER BY price_wholesale ASC, code ASC
    `, [product.id])

    /* Agrega atributos dos SKUs no produto (ex: Cor → ['Preto','Branco'], Tamanho → ['P','M']) */
    const attrMap = {}
    for (const sku of skus) {
      for (const [key, val] of Object.entries(sku.attributes ?? {})) {
        if (!attrMap[key]) attrMap[key] = new Set()
        attrMap[key].add(String(val))
      }
    }
    const aggregatedAttrs = Object.fromEntries(
      Object.entries(attrMap).map(([k, set]) => [k, [...set]])
    )

    /* minPrice / maxPrice em centavos para o ProductDetail */
    const prices = skus.map(s => s.price).filter(p => p > 0)
    const minPrice = prices.length ? Math.min(...prices) : 0
    const maxPrice = prices.length ? Math.max(...prices) : 0

    res.json({
      ...normalizeProduct({ ...product, slug: product.id, minPrice, maxPrice, inStock: skus.some(s => s.stock > 0) }),
      attributes:     aggregatedAttrs,
      seoTitle:       product.seoTitle       ?? null,
      seoDescription: product.seoDescription ?? null,
      skus,
    })
  } catch (err) {
    console.error('[store/catalog/:id]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── Helper ── */
function normalizeProduct(row) {
  let parsedImages = []
  try {
    if (Array.isArray(row.images)) parsedImages = row.images
    else if (typeof row.images === 'string') parsedImages = JSON.parse(row.images)
  } catch {}

  /* Agrega rawAttributes (array de objetos SKU) em mapa de atributo → valores */
  let attributes = {}
  if (row.rawAttributes) {
    const raw = Array.isArray(row.rawAttributes) ? row.rawAttributes : []
    const map = {}
    for (const attrObj of raw) {
      for (const [k, v] of Object.entries(attrObj ?? {})) {
        if (!map[k]) map[k] = new Set()
        map[k].add(String(v))
      }
    }
    attributes = Object.fromEntries(Object.entries(map).map(([k, s]) => [k, [...s]]))
  }

  return {
    slug:          row.slug ?? row.id,
    name:          row.name,
    description:   null,
    code:          row.code   ?? null,
    category:      row.category ?? null,
    coverImageUrl: row.coverImageUrl ?? null,
    images:        parsedImages,
    minPrice:      row.minPrice != null ? parseInt(row.minPrice, 10) : 0,
    maxPrice:      row.maxPrice != null ? parseInt(row.maxPrice, 10) : 0,
    inStock:       row.inStock ?? false,
    attributes,
  }
}
