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

dashboardRouter.get('/summary', async (req, res) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [
      revenueToday,
      revenueYesterday,
      pendingOrders,
      criticalSkus,
      activeCustomers,
      chartRows,
    ] = await Promise.all([
      /* Receita hoje */
      query(`SELECT COALESCE(SUM(total),0) AS val FROM orders
             WHERE status != 'cancelado' AND created_at >= $1`, [today]),
      /* Receita ontem */
      query(`SELECT COALESCE(SUM(total),0) AS val FROM orders
             WHERE status != 'cancelado'
               AND created_at >= $1 AND created_at < $2`,
        [new Date(today.getTime() - 86400000), today]),
      /* Pedidos pendentes */
      query(`SELECT COUNT(*) AS val FROM orders WHERE status = 'pendente'`),
      /* SKUs críticos (zerado ou abaixo do mínimo) */
      query(`SELECT COUNT(*) AS val FROM skus WHERE stock <= stock_min`),
      /* Clientes ativos */
      query(`SELECT COUNT(*) AS val FROM customers WHERE status = 'ativo'`),
      /* Gráfico: vendas últimos 7 dias */
      query(`
        SELECT
          to_char(d::date, 'Dy DD') AS date,
          COALESCE(SUM(o.total), 0)  AS total
        FROM generate_series(
          (now() - interval '6 days')::date,
          now()::date,
          '1 day'::interval
        ) d
        LEFT JOIN orders o
          ON o.created_at::date = d::date
         AND o.status != 'cancelado'
        GROUP BY d ORDER BY d
      `),
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
