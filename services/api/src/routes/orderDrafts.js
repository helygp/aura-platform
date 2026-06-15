/**
 * routes/orderDrafts.js
 *
 * Rascunho de pedido persistido em banco — 1 por usuário.
 * Ticket #49: sessão expira e perde pedido em construção.
 *
 * GET    /api/orders/drafts/mine   — retorna o rascunho do usuário logado (ou null)
 * PUT    /api/orders/drafts/mine   — upsert (autosave)
 * DELETE /api/orders/drafts/mine   — descarta
 */

import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { query } from '../lib/tenantDb.js'

export const orderDraftsRouter = Router()
orderDraftsRouter.use(authenticate)

/* ── GET /mine ── */
orderDraftsRouter.get('/mine', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, user_id, customer_id, customer_name, customer_whatsapp,
              channel, notes, items, updated_at
       FROM order_drafts WHERE user_id = $1 LIMIT 1`,
      [req.user.id]
    )
    const draft = rows[0] ?? null
    if (draft) {
      // camelCase pro front
      res.json({
        draft: {
          id:                draft.id,
          userId:            draft.user_id,
          customerId:        draft.customer_id,
          customerName:      draft.customer_name,
          customerWhatsapp:  draft.customer_whatsapp,
          channel:           draft.channel,
          notes:             draft.notes,
          items:             draft.items,
          updatedAt:         draft.updated_at,
        },
      })
    } else {
      res.json({ draft: null })
    }
  } catch (err) {
    console.error('[orderDrafts] GET /mine error:', err.message)
    res.status(500).json({ error: 'Erro ao buscar rascunho.' })
  }
})

/* ── PUT /mine — upsert ── */
orderDraftsRouter.put('/mine', async (req, res) => {
  try {
    const { customerId, customerName, customerWhatsapp, channel, notes, items } = req.body
    const userId = req.user.id

    const { rows } = await query(
      `INSERT INTO order_drafts (user_id, customer_id, customer_name, customer_whatsapp, channel, notes, items, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
       ON CONFLICT (user_id) DO UPDATE SET
         customer_id       = EXCLUDED.customer_id,
         customer_name     = EXCLUDED.customer_name,
         customer_whatsapp = EXCLUDED.customer_whatsapp,
         channel           = EXCLUDED.channel,
         notes             = EXCLUDED.notes,
         items             = EXCLUDED.items,
         updated_at        = now()
       RETURNING id, updated_at`,
      [
        userId,
        customerId || null,
        customerName || null,
        customerWhatsapp || null,
        channel || 'manual',
        notes || '',
        JSON.stringify(items ?? []),
      ]
    )

    res.json({ ok: true, id: rows[0].id, updatedAt: rows[0].updated_at })
  } catch (err) {
    console.error('[orderDrafts] PUT /mine error:', err.message)
    res.status(500).json({ error: 'Erro ao salvar rascunho.' })
  }
})

/* ── DELETE /mine ── */
orderDraftsRouter.delete('/mine', async (req, res) => {
  try {
    await query(`DELETE FROM order_drafts WHERE user_id = $1`, [req.user.id])
    res.json({ ok: true })
  } catch (err) {
    console.error('[orderDrafts] DELETE /mine error:', err.message)
    res.status(500).json({ error: 'Erro ao descartar rascunho.' })
  }
})
