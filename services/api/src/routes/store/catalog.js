/**
 * routes/store/catalog.js
 * Endpoints públicos do catálogo B2B.
 *
 * GET /store/catalog/featured    — destaques (home)
 * GET /store/catalog/categories  — categorias disponíveis
 * GET /store/catalog             — listagem com filtros, sort e paginação cursor
 * GET /store/catalog/:slug       — detalhe do produto
 *
 * Identificação de tenant: via req.tenantSlug (injetado pelo storeTenantMiddleware).
 * Sem autenticação — dados públicos.
 */

import { Router } from 'express'
import { query }  from '../../lib/tenantDb.js'

export const storeCatalogRouter = Router()

/* ── GET /store/catalog/featured ── */
storeCatalogRouter.get('/featured', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        p.slug, p.name, p.description, p.category,
        p.cover_image_url AS "coverImageUrl",
        MIN(s.preco_atacado) AS "minPrice",
        MAX(s.preco_atacado) AS "maxPrice",
        BOOL_OR(s.estoque > 0 AND s.ativo) AS "inStock",
        COALESCE(json_agg(DISTINCT s.atributos) FILTER (WHERE s.atributos IS NOT NULL), '[]') AS "rawAttributes"
      FROM products p
      LEFT JOIN skus s ON s.product_id = p.id AND s.ativo = true
      WHERE p.ativo = true AND p.publico = true AND p.destaque = true
      GROUP BY p.id
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
      WHERE p.ativo = true AND p.publico = true AND p.category IS NOT NULL
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

    const conditions = ['p.ativo = true', 'p.publico = true']
    const params = []

    if (q) {
      params.push(`%${q}%`)
      conditions.push(`(p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`)
    }

    if (category) {
      params.push(category)
      conditions.push(`p.category = $${params.length}`)
    }

    if (cursor) {
      params.push(cursor)
      conditions.push(`p.slug > $${params.length}`)
    }

    const sortMap = {
      name_asc:    'p.name ASC',
      name_desc:   'p.name DESC',
      price_asc:   'MIN(s.preco_atacado) ASC NULLS LAST',
      price_desc:  'MAX(s.preco_atacado) DESC NULLS LAST',
    }
    const orderBy = sortMap[sort] ?? 'p.name ASC'

    params.push(limitN + 1)
    const { rows } = await query(`
      SELECT
        p.slug, p.name, p.description, p.category,
        p.cover_image_url AS "coverImageUrl",
        MIN(s.preco_atacado) AS "minPrice",
        MAX(s.preco_atacado) AS "maxPrice",
        BOOL_OR(s.estoque > 0 AND s.ativo) AS "inStock"
      FROM products p
      LEFT JOIN skus s ON s.product_id = p.id AND s.ativo = true
      WHERE ${conditions.join(' AND ')}
      GROUP BY p.id, p.slug, p.name, p.description, p.category, p.cover_image_url
      ORDER BY ${orderBy}
      LIMIT $${params.length}
    `, params)

    const hasMore    = rows.length > limitN
    const data       = hasMore ? rows.slice(0, limitN) : rows
    const nextCursor = hasMore ? data[data.length - 1].slug : null

    res.json({
      data:       data.map(normalizeProduct),
      nextCursor,
      hasMore,
    })
  } catch (err) {
    console.error('[store/catalog]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── GET /store/catalog/:slug ── */
storeCatalogRouter.get('/:slug', async (req, res) => {
  try {
    const { rows: [product] } = await query(`
      SELECT
        p.id, p.slug, p.name, p.description, p.category,
        p.cover_image_url AS "coverImageUrl",
        p.images,
        p.publico,
        p.ativo
      FROM products p
      WHERE p.slug = $1 AND p.ativo = true AND p.publico = true
    `, [req.params.slug])

    if (!product) return res.status(404).json({ error: 'Produto não encontrado.' })

    /* Busca SKUs */
    const { rows: skus } = await query(`
      SELECT
        id, sku_code AS "skuCode", atributos,
        preco_atacado AS "precoAtacado",
        preco_varejo  AS "precoVarejo",
        estoque, estoque_min AS "estoqueMin",
        ativo
      FROM skus
      WHERE product_id = $1 AND ativo = true
      ORDER BY preco_atacado ASC
    `, [product.id])

    res.json({ ...normalizeProduct(product), skus })
  } catch (err) {
    console.error('[store/catalog/:slug]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── Helper ── */
function normalizeProduct(row) {
  return {
    slug:         row.slug,
    name:         row.name,
    description:  row.description ?? null,
    category:     row.category    ?? null,
    coverImageUrl: row.coverImageUrl ?? null,
    minPrice:     row.minPrice ? parseFloat(row.minPrice) : null,
    maxPrice:     row.maxPrice ? parseFloat(row.maxPrice) : null,
    inStock:      row.inStock  ?? false,
  }
}
