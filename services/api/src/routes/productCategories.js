/**
 * routes/productCategories.js
 * GET/POST/PUT/DELETE /api/product-categories
 */
import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize }    from '../middleware/authorize.js'
import { query }        from '../lib/tenantDb.js'

export const productCategoriesRouter = Router()
productCategoriesRouter.use(authenticate)

productCategoriesRouter.get('/', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM product_category_defs ORDER BY sort_order, name')
    res.json({ categories: rows })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

productCategoriesRouter.post('/', authorize('admin'), async (req, res) => {
  try {
    const { name, sort_order = 0 } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Nome obrigatório.' })
    const { rows: [cat] } = await query(
      'INSERT INTO product_category_defs (name, sort_order) VALUES ($1,$2) RETURNING *',
      [name.trim(), sort_order]
    )
    res.status(201).json(cat)
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Categoria já existe.' })
    res.status(500).json({ error: e.message })
  }
})

productCategoriesRouter.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const { name, sort_order } = req.body
    const { rows: [cat] } = await query(
      'UPDATE product_category_defs SET name=$1, sort_order=$2, updated_at=now() WHERE id=$3 RETURNING *',
      [name?.trim(), sort_order ?? 0, req.params.id]
    )
    if (!cat) return res.status(404).json({ error: 'Não encontrada.' })
    res.json(cat)
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Nome já existe.' })
    res.status(500).json({ error: e.message })
  }
})

productCategoriesRouter.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await query('DELETE FROM product_category_defs WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})
