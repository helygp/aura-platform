/**
 * routes/customers.js
 *
 * GET    /api/customers
 * POST   /api/customers
 * PUT    /api/customers/:id
 * DELETE /api/customers/:id
 */

import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize }    from '../middleware/authorize.js'
import { query }        from '../lib/tenantDb.js'

export const customersRouter = Router()
customersRouter.use(authenticate)

/* ── GET /api/customers ── */
customersRouter.get('/', async (req, res) => {
  try {
    const { search='', status='' } = req.query
    const params = []
    const where  = []

    if (search) {
      params.push(`%${search.replace(/\D/g,'')}%`, `%${search}%`)
      where.push(`(regexp_replace(c.document,'\\D','','g') ILIKE $${params.length-1} OR c.name ILIKE $${params.length} OR regexp_replace(c.whatsapp,'\\D','','g') ILIKE $${params.length-1})`)
    }
    if (status) { params.push(status); where.push(`c.status=$${params.length}`) }

    const wClause = where.length ? 'WHERE ' + where.join(' AND ') : ''

    const { rows } = await query(`
      SELECT c.*,
        (SELECT json_agg(json_build_object(
            'id',o.id,'total',o.total,'status',o.status,'createdAt',o.created_at
          ) ORDER BY o.created_at DESC)
         FROM orders o WHERE o.customer_id = c.id
        ) AS orders
      FROM customers c
      ${wClause}
      ORDER BY c.created_at DESC
    `, params)

    res.json({ customers: rows.map(normalizeCust) })
  } catch (err) {
    console.error('[customers/list]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── POST /api/customers ── */
customersRouter.post('/', async (req, res) => {
  try {
    const { name, personType='pj', document, whatsapp, email, status='ativo', creditLimit=0, address={} } = req.body
    const { rows:[c] } = await query(`
      INSERT INTO customers (name, person_type, document, whatsapp, email, status, credit_limit, address)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING *
    `, [name, personType, document, whatsapp, email, status, parseFloat(creditLimit)||0, JSON.stringify(address)])
    res.status(201).json(normalizeCust(c))
  } catch (err) {
    console.error('[customers/create]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── PUT /api/customers/:id ── */
customersRouter.put('/:id', async (req, res) => {
  try {
    const { name, personType, document, whatsapp, email, status, creditLimit, address={} } = req.body
    const { rows:[c] } = await query(`
      UPDATE customers SET
        name=$1, person_type=$2, document=$3, whatsapp=$4, email=$5,
        status=$6, credit_limit=$7, address=$8::jsonb, updated_at=now()
      WHERE id=$9 RETURNING *
    `, [name, personType, document, whatsapp, email, status, parseFloat(creditLimit)||0, JSON.stringify(address), req.params.id])
    if (!c) return res.status(404).json({ error: 'Cliente não encontrado.' })
    res.json(normalizeCust(c))
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── DELETE /api/customers/:id ── */
customersRouter.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await query('DELETE FROM customers WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' })
  }
})

function normalizeCust(c) {
  return {
    id:          c.id,
    name:        c.name,
    personType:  c.person_type,
    document:    c.document,
    whatsapp:    c.whatsapp,
    email:       c.email,
    status:      c.status,
    creditLimit: parseFloat(c.credit_limit ?? 0),
    address:     c.address ?? {},
    orders:      c.orders  ?? [],
    createdAt:   c.created_at,
  }
}
