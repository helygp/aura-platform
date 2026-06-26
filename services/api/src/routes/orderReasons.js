/**
 * routes/orderReasons.js
 *
 * Tickets #83/#117: CRUD de motivos cadastráveis para cancelamento e devolução
 * de pedidos. Padrão alinhado a productAttributes.
 *
 * GET    /api/order-reasons[?kind=cancellation|return]  — lista (todos ou filtro)
 * POST   /api/order-reasons                              — cria (admin)
 * PUT    /api/order-reasons/:id                          — atualiza (admin)
 * DELETE /api/order-reasons/:id                          — soft-delete via active=false (admin)
 */

import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize }    from '../middleware/authorize.js'
import { query } from '../lib/tenantDb.js'

export const orderReasonsRouter = Router()
orderReasonsRouter.use(authenticate)

const VALID_KINDS = ['cancellation', 'return']

/* ── GET /api/order-reasons ── */
orderReasonsRouter.get('/', async (req, res) => {
  try {
    const { kind } = req.query
    const params = []
    const where  = ['active = true']
    if (kind) {
      if (!VALID_KINDS.includes(kind)) {
        return res.status(400).json({ error: 'kind inválido. Use cancellation ou return.' })
      }
      params.push(kind); where.push(`kind = $${params.length}`)
    }
    const { rows } = await query(`
      SELECT id, kind, label, active, sort_order AS "sortOrder", created_at AS "createdAt"
      FROM order_reasons
      WHERE ${where.join(' AND ')}
      ORDER BY kind, sort_order, label
    `, params)
    res.json({ reasons: rows })
  } catch (err) {
    console.error('[order-reasons/list]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── GET /api/order-reasons/all — inclui inativos (para Settings) ── */
orderReasonsRouter.get('/all', authorize('admin'), async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT id, kind, label, active, sort_order AS "sortOrder", created_at AS "createdAt"
      FROM order_reasons
      ORDER BY kind, sort_order, label
    `)
    res.json({ reasons: rows })
  } catch (err) {
    console.error('[order-reasons/all]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── POST /api/order-reasons ── */
orderReasonsRouter.post('/', authorize('admin'), async (req, res) => {
  try {
    const { kind, label, sortOrder = 0, active = true } = req.body
    if (!VALID_KINDS.includes(kind)) {
      return res.status(400).json({ error: 'kind inválido.' })
    }
    if (!label?.trim()) {
      return res.status(400).json({ error: 'Label obrigatório.' })
    }
    const { rows: [row] } = await query(`
      INSERT INTO order_reasons (kind, label, sort_order, active)
      VALUES ($1, $2, $3, $4)
      RETURNING id, kind, label, active, sort_order AS "sortOrder", created_at AS "createdAt"
    `, [kind, label.trim(), parseInt(sortOrder) || 0, !!active])
    res.status(201).json({ reason: row })
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Já existe um motivo com esse nome.' })
    }
    console.error('[order-reasons/create]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── PUT /api/order-reasons/:id ── */
orderReasonsRouter.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const { label, sortOrder, active } = req.body
    const sets = []
    const params = []
    if (label !== undefined) {
      if (!label.trim()) return res.status(400).json({ error: 'Label não pode ser vazio.' })
      params.push(label.trim()); sets.push(`label = $${params.length}`)
    }
    if (sortOrder !== undefined) { params.push(parseInt(sortOrder) || 0); sets.push(`sort_order = $${params.length}`) }
    if (active    !== undefined) { params.push(!!active);                  sets.push(`active = $${params.length}`) }
    if (!sets.length) return res.status(400).json({ error: 'Nada a atualizar.' })

    params.push(req.params.id)
    const { rows: [row] } = await query(`
      UPDATE order_reasons SET ${sets.join(', ')}, updated_at = NOW()
      WHERE id = $${params.length}
      RETURNING id, kind, label, active, sort_order AS "sortOrder"
    `, params)
    if (!row) return res.status(404).json({ error: 'Motivo não encontrado.' })
    res.json({ reason: row })
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Já existe um motivo com esse nome.' })
    }
    console.error('[order-reasons/update]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── DELETE /api/order-reasons/:id — soft-delete ── */
orderReasonsRouter.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const { rowCount } = await query(
      'UPDATE order_reasons SET active = false, updated_at = NOW() WHERE id = $1',
      [req.params.id]
    )
    if (!rowCount) return res.status(404).json({ error: 'Motivo não encontrado.' })
    res.json({ ok: true })
  } catch (err) {
    console.error('[order-reasons/delete]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})
