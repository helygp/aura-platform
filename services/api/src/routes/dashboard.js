/**
 * routes/dashboard.js
 *
 * GET /api/dashboard/summary
 *   Retorna KPIs + dados do gráfico de vendas.
 */

import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { query }        from '../lib/tenantDb.js'

export const dashboardRouter = Router()
dashboardRouter.use(authenticate)

// Timezone canônico do negócio — usado em todos os recortes "por dia".
// Containers (Node/Postgres) rodam em UTC; sem isso, "hoje" começa às 21h BRT.
const TZ = 'America/Sao_Paulo'

dashboardRouter.get('/summary', async (req, res) => {
  try {
    const [
      revenueToday,
      revenueYesterday,
      pendingOrders,
      criticalSkus,
      activeCustomers,
      chartRows,
    ] = await Promise.all([
      /* Receita hoje (recorte em America/Sao_Paulo) */
      query(`SELECT COALESCE(SUM(total),0) AS val FROM orders
             WHERE status != 'cancelado'
               AND created_at >= date_trunc('day', now() AT TIME ZONE $1) AT TIME ZONE $1`,
        [TZ]),
      /* Receita ontem (recorte em America/Sao_Paulo) */
      query(`SELECT COALESCE(SUM(total),0) AS val FROM orders
             WHERE status != 'cancelado'
               AND created_at >= (date_trunc('day', now() AT TIME ZONE $1) - interval '1 day') AT TIME ZONE $1
               AND created_at <  date_trunc('day', now() AT TIME ZONE $1) AT TIME ZONE $1`,
        [TZ]),
      /* Pedidos pendentes */
      query(`SELECT COUNT(*) AS val FROM orders WHERE status = 'pendente'`),
      /* SKUs críticos (zerado ou abaixo do mínimo) */
      query(`SELECT COUNT(*) AS val FROM skus WHERE stock <= stock_min`),
      /* Clientes ativos */
      query(`SELECT COUNT(*) AS val FROM customers WHERE status = 'ativo'`),
      /* Gráfico: vendas últimos 7 dias (recorte em America/Sao_Paulo) */
      query(`
        SELECT
          to_char(d::date, 'Dy DD') AS date,
          COALESCE(SUM(o.total), 0)  AS total
        FROM generate_series(
          ((now() AT TIME ZONE $1)::date - interval '6 days'),
          (now() AT TIME ZONE $1)::date,
          '1 day'::interval
        ) d
        LEFT JOIN orders o
          ON (o.created_at AT TIME ZONE $1)::date = d::date
         AND o.status != 'cancelado'
        GROUP BY d ORDER BY d
      `, [TZ]),
    ])

    const rev     = parseFloat(revenueToday.rows[0].val)
    const revY    = parseFloat(revenueYesterday.rows[0].val)
    const revTrend = revY > 0 ? parseFloat(((rev - revY) / revY * 100).toFixed(1)) : 0

    const pending = parseInt(pendingOrders.rows[0].val)
    const critical = parseInt(criticalSkus.rows[0].val)
    const active   = parseInt(activeCustomers.rows[0].val)

    res.json({
      kpis: {
        revenue:         { value: rev,     trend: revTrend },
        pendingOrders:   { value: pending,  trend: 0 },
        criticalSkus:    { value: critical, trend: 0 },
        activeCustomers: { value: active,   trend: 0 },
      },
      chartData: chartRows.rows.map(r => ({
        date:  r.date,
        total: parseFloat(r.total),
      })),
    })
  } catch (err) {
    console.error('[dashboard/summary]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})
