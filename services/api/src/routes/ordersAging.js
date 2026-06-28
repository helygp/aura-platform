/**
 * routes/ordersAging.js
 *
 * Ticket #120 (issue #94) — Tracking de tempo entre status de pedidos (Fase 1).
 *
 * GET /api/orders/aging
 *
 * Query params:
 *   status      ?= ex.: confirmado | separando | enviado (opcional — sem filtro = todos)
 *   over_hours  ?= número (opcional — só retorna pedidos parados >= esse limiar)
 *   limit       ?= número (default 50, máx 500)
 *
 * Calcula tempo de permanência no status atual a partir da última transição
 * registrada em order_status_log. Pedidos sem registro caem no fallback de
 * orders.created_at (cenário raro pós-backfill da migração 20260627).
 *
 * Pedidos em status terminal (cancelado, entregue) são excluídos — aging só
 * faz sentido em fluxo aberto.
 *
 * SLA inicial (hardcoded — Fase 1):
 *   confirmado : 4h
 *   separando  : 8h
 *
 * Configuração por tenant fica para fase posterior (ticket futuro).
 *
 * Resposta:
 *   {
 *     sla: { confirmado: 4, separando: 8 },
 *     items: [
 *       { id, number, customer_name, status, since, hours_in_status,
 *         sla_hours, breached, total }
 *     ]
 *   }
 */

import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize }    from '../middleware/authorize.js'
import { query }        from '../lib/tenantDb.js'

// SLA hardcoded — Fase 1.
export const SLA_HOURS = {
  confirmado: 4,
  separando:  8,
}

export const ordersAgingRouter = Router()
ordersAgingRouter.use(authenticate)
ordersAgingRouter.use(authorize('admin', 'financeiro', 'estoque', 'operador'))

ordersAgingRouter.get('/', async (req, res) => {
  try {
    const reqStatus = req.query.status ? String(req.query.status).trim() : null
    const overHours = req.query.over_hours != null && req.query.over_hours !== ''
      ? Math.max(0, parseFloat(req.query.over_hours))
      : null
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 50))

    const params = []
    const where  = ["o.status NOT IN ('cancelado','entregue')"]

    if (reqStatus) {
      params.push(reqStatus)
      where.push(`o.status::text = $${params.length}`)
    }

    // Última transição (latest changed_at) de cada pedido via DISTINCT ON.
    // O índice idx_osl_order (order_id, changed_at DESC) acelera esse passo;
    // o idx_osl_status_at (criado na migração 20260627) acelera filtros por status.
    const sql = `
      WITH last_log AS (
        SELECT DISTINCT ON (order_id) order_id, to_status, changed_at
        FROM order_status_log
        ORDER BY order_id, changed_at DESC
      )
      SELECT
        o.id,
        o.number,
        o.customer_name,
        o.status::text  AS status,
        o.total,
        COALESCE(ll.changed_at, o.created_at) AS since,
        EXTRACT(EPOCH FROM (NOW() - COALESCE(ll.changed_at, o.created_at))) / 3600.0
          AS hours_in_status
      FROM orders o
      LEFT JOIN last_log ll ON ll.order_id = o.id
      WHERE ${where.join(' AND ')}
      ORDER BY hours_in_status DESC
      LIMIT ${limit}
    `

    const { rows } = await query(sql, params)

    let items = rows.map(r => {
      const status = r.status
      const sla    = Object.prototype.hasOwnProperty.call(SLA_HOURS, status)
        ? SLA_HOURS[status]
        : null
      const hours  = parseFloat(r.hours_in_status) || 0
      return {
        id:              r.id,
        number:          r.number,
        customer_name:   r.customer_name,
        status,
        since:           r.since,
        hours_in_status: Math.round(hours * 10) / 10,
        sla_hours:       sla,
        breached:        sla != null && hours > sla,
        total:           parseFloat(r.total) || 0,
      }
    })

    if (overHours != null) {
      items = items.filter(x => x.hours_in_status >= overHours)
    }

    res.json({ sla: SLA_HOURS, items })
  } catch (err) {
    console.error('[ordersAging] err', err)
    res.status(500).json({ error: 'Erro ao buscar aging de pedidos.' })
  }
})
