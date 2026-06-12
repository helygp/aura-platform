/**
 * routes/productAttributes.js
 *
 * Domínio de atributos da grade por tenant.
 *
 * GET    /api/product-attributes         — lista todos
 * POST   /api/product-attributes         — cria novo atributo
 * PUT    /api/product-attributes/:id     — atualiza nome/valores
 * DELETE /api/product-attributes/:id     — remove
 */

import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize }    from '../middleware/authorize.js'
import { query, getClient } from '../lib/tenantDb.js'

export const productAttributesRouter = Router()
productAttributesRouter.use(authenticate)

/* ── Helper: gera sigla automática ── */
export function autoSlug(label) {
  const normalized = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const words = normalized.trim().split(/\s+/)
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase()
  return words.map(w => w[0] || '').join('').toUpperCase().slice(0, 3)
}

/* ── GET /api/product-attributes ── */
productAttributesRouter.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM product_attribute_defs ORDER BY sort_order, name'
    )
    res.json({ attributes: rows })
  } catch (err) {
    console.error('[product-attributes/list]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── POST /api/product-attributes ── */
productAttributesRouter.post('/', authorize('admin'), async (req, res) => {
  try {
    const { name, values = [], sort_order = 0 } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Nome obrigatório.' })

    // Garante que cada valor tem slug
    const normalized = values.map(v =>
      typeof v === 'string'
        ? { label: v, slug: autoSlug(v) }
        : { label: v.label, slug: v.slug || autoSlug(v.label) }
    )

    const { rows: [attr] } = await query(`
      INSERT INTO product_attribute_defs (name, values, sort_order)
      VALUES ($1, $2::jsonb, $3)
      RETURNING *
    `, [name.trim(), JSON.stringify(normalized), sort_order])

    res.status(201).json(attr)
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Atributo já existe.' })
    console.error('[product-attributes/create]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── PUT /api/product-attributes/:id ── */
productAttributesRouter.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const { name, values, sort_order } = req.body

    // Garante slugs em todos os valores
    const normalized = (values ?? []).map(v =>
      typeof v === 'string'
        ? { label: v, slug: autoSlug(v) }
        : { label: v.label, slug: v.slug || autoSlug(v.label) }
    )

    const { rows: [attr] } = await query(`
      UPDATE product_attribute_defs
      SET name=$1, values=$2::jsonb, sort_order=$3, updated_at=now()
      WHERE id=$4 RETURNING *
    `, [name?.trim(), JSON.stringify(normalized), sort_order ?? 0, req.params.id])

    if (!attr) return res.status(404).json({ error: 'Atributo não encontrado.' })
    res.json(attr)
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Nome já existe.' })
    console.error('[product-attributes/update]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── DELETE /api/product-attributes/:id ── */
productAttributesRouter.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await query('DELETE FROM product_attribute_defs WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    console.error('[product-attributes/delete]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ════════════════════════════════════════════════════════════════
   PROPAGAÇÃO DE NOVOS VALORES → SUGESTÃO DE SKUs
   ════════════════════════════════════════════════════════════════ */

/* mapa label -> slug a partir dos valores da def */
function buildSlugMap(values = []) {
  const m = {}
  for (const v of values) if (v && v.label) m[String(v.label)] = (v.slug || autoSlug(v.label))
  return m
}

/* reescreve o código de um SKU irmão trocando o token do valor antigo pelo novo */
function rewriteSiblingCode(sibCode, oldToken, newToken) {
  if (!sibCode || !oldToken || !newToken) return null
  const parts = String(sibCode).split('-')
  const idx = parts.findIndex(p => p.toUpperCase() === String(oldToken).toUpperCase())
  if (idx === -1) return null
  parts[idx] = newToken
  return parts.join('-')
}

/* preço mais frequente (>0) entre os SKUs do produto */
function modalPrice(skus) {
  const counts = {}
  for (const s of skus) {
    const p = parseFloat(s.price_wholesale)
    if (p > 0) counts[p] = (counts[p] || 0) + 1
  }
  let best = 0, bestN = 0
  for (const [p, n] of Object.entries(counts)) if (n > bestN) { bestN = n; best = parseFloat(p) }
  return best
}

/* produto cartesiano */
function xprod(arrays) {
  if (!arrays.length) return [[]]
  return arrays.reduce((acc, arr) => acc.flatMap(a => arr.map(b => [...a, b])), [[]])
}

/* assinatura ordenada de um conjunto de atributos (para dedupe) */
function attrSig(attrs) {
  return JSON.stringify(
    Object.keys(attrs).sort().reduce((o, k) => (o[k] = String(attrs[k]), o), {})
  )
}

/* ── POST /api/product-attributes/:id/impact ──
   Para cada produto que JÁ usa este atributo, calcula os SKUs que passariam a
   existir com o(s) novo(s) valor(es). Não grava nada. */
productAttributesRouter.post('/:id/impact', authorize('admin', 'estoque'), async (req, res) => {
  try {
    const { newValues = [] } = req.body
    const labels = [...new Set((newValues || []).map(v => String(v).trim()).filter(Boolean))]
    if (!labels.length) return res.json({ products: [], totalSkus: 0 })

    const { rows: [def] } = await query('SELECT * FROM product_attribute_defs WHERE id=$1', [req.params.id])
    if (!def) return res.status(404).json({ error: 'Atributo não encontrado.' })
    const attrName = def.name
    const slugMap  = buildSlugMap(def.values)

    const { rows: prods } = await query(`
      SELECT DISTINCT p.id, p.code, p.name
      FROM products p JOIN skus s ON s.product_id = p.id
      WHERE (s.attributes -> $1) IS NOT NULL
      ORDER BY p.code
    `, [attrName])

    const products = []
    let totalSkus = 0

    for (const p of prods) {
      const { rows: skus } = await query(
        'SELECT code, attributes, price_wholesale, stock_min FROM skus WHERE product_id=$1', [p.id]
      )
      if (!skus.length) continue

      const otherKeys = [...new Set(skus.flatMap(s => Object.keys(s.attributes || {})))]
        .filter(k => k !== attrName)

      const otherValues = otherKeys.map(k => {
        const seen = []
        for (const s of skus) {
          const v = s.attributes?.[k]
          if (v != null && !seen.includes(String(v))) seen.push(String(v))
        }
        return seen
      })

      const existing = new Set(skus.map(s => attrSig(s.attributes || {})))
      const pModal   = modalPrice(skus)
      const proposed = []

      for (const label of labels) {
        const newToken = slugMap[label] || autoSlug(label)
        for (const combo of xprod(otherValues)) {
          const attrs = { [attrName]: label }
          otherKeys.forEach((k, i) => { attrs[k] = combo[i] })
          if (existing.has(attrSig(attrs))) continue

          const sib = skus.find(s => otherKeys.every((k, i) => String(s.attributes?.[k]) === String(combo[i])))
          let price = sib ? (parseFloat(sib.price_wholesale) || 0) : 0
          if (!price) price = pModal
          const stockMin = sib ? (parseInt(sib.stock_min) || 0) : 0

          let code = null
          if (sib) {
            const sibVal   = String(sib.attributes?.[attrName] ?? '')
            const oldToken = slugMap[sibVal] || autoSlug(sibVal)
            code = rewriteSiblingCode(sib.code, oldToken, newToken)
          }
          if (!code) code = `${p.code}-${newToken}`

          proposed.push({ attributes: attrs, code, priceWholesale: price, stockMin })
        }
      }

      if (proposed.length) {
        products.push({ productId: p.id, code: p.code, name: p.name, otherKeys, skus: proposed })
        totalSkus += proposed.length
      }
    }

    res.json({ attribute: { id: def.id, name: attrName }, products, totalSkus })
  } catch (err) {
    console.error('[product-attributes/impact]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── POST /api/product-attributes/:id/propagate ──
   Cria os SKUs confirmados. Pula códigos globais e combinações já existentes. */
productAttributesRouter.post('/:id/propagate', authorize('admin', 'estoque'), async (req, res) => {
  const client = await getClient()
  try {
    const { items = [] } = req.body
    await client.query('BEGIN')
    let created = 0
    const skipped = []
    for (const it of items) {
      if (!it.productId || !it.code || !it.attributes) { skipped.push(it.code || '?'); continue }
      const { rows: dup } = await client.query('SELECT 1 FROM skus WHERE code=$1', [it.code])
      if (dup.length) { skipped.push(it.code); continue }
      await client.query(`
        INSERT INTO skus (product_id, code, attributes, price_wholesale, stock_min)
        VALUES ($1, $2, $3::jsonb, $4, $5)
      `, [it.productId, it.code, JSON.stringify(it.attributes),
          parseFloat(it.priceWholesale) || 0, parseInt(it.stockMin) || 0])
      created++
    }
    await client.query('COMMIT')
    res.json({ created, skipped })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[product-attributes/propagate]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  } finally {
    client.release()
  }
})
