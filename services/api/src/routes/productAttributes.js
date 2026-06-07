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
import { query }        from '../lib/tenantDb.js'

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
