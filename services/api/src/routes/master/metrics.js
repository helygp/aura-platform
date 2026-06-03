/**
 * routes/master/metrics.js
 *
 * GET /master/metrics  — métricas globais da plataforma
 *
 * Retorna:
 *   - tenants ativos, em trial, suspensos, cancelados
 *   - novos tenants este mês
 *   - MRR (Monthly Recurring Revenue) — soma dos billings PAID do mês atual
 *   - MRR projetado — planos ativos somados
 *   - churn (tenants cancelados nos últimos 30 dias)
 *   - ARR estimado
 *   - evolução de tenants ativos (últimos 6 meses)
 *
 * Autenticação: authenticateMaster (x-master-secret header)
 */

import { Router }             from 'express'
import { prismaMaster as prisma }             from '../../lib/prisma-master.js'
import { authenticateMaster } from '../../middleware/authenticateMaster.js'

export const masterMetricsRouter = Router()
masterMetricsRouter.use(authenticateMaster)

masterMetricsRouter.get('/', async (req, res) => {
  try {
    const now       = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const last30    = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const currentPeriod = now.toISOString().slice(0, 7)  // "YYYY-MM"

    /* ── Contagens por status ── */
    const [statusCounts, newThisMonth, churnLast30, mrrPaid] = await Promise.all([
      /* Status breakdown */
      prisma.tenant.groupBy({
        by:      ['status'],
        _count:  { _all: true },
      }),

      /* Novos este mês */
      prisma.tenant.count({
        where: { createdAt: { gte: startOfMonth } },
      }),

      /* Churn: cancelados nos últimos 30 dias */
      prisma.tenant.count({
        where: { status: 'CANCELLED', updatedAt: { gte: last30 } },
      }),

      /* MRR realizado: billings PAID no período atual */
      prisma.billing.aggregate({
        where:   { status: 'PAID', period: currentPeriod },
        _sum:    { amount: true },
      }),
    ])

    /* ── Formata contagens por status ── */
    const byStatus = { TRIAL: 0, ACTIVE: 0, SUSPENDED: 0, CANCELLED: 0 }
    for (const row of statusCounts) {
      byStatus[row.status] = row._count._all
    }
    const totalTenants = Object.values(byStatus).reduce((s, v) => s + v, 0)

    /* ── MRR projetado: soma priceMonthly dos tenants ACTIVE ── */
    const activeTenants = await prisma.tenant.findMany({
      where:   { status: 'ACTIVE' },
      include: { plan: { select: { priceMonthly: true } } },
    })
    const mrrProjected = activeTenants.reduce(
      (sum, t) => sum + parseFloat(t.plan?.priceMonthly ?? 0),
      0
    )

    /* ── Evolução mensal: novos tenants por mês (últimos 6) ── */
    const growth = []
    for (let i = 5; i >= 0; i--) {
      const d     = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const dEnd  = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const count = await prisma.tenant.count({
        where: { createdAt: { gte: d, lt: dEnd } },
      })
      growth.push({
        period: d.toISOString().slice(0, 7),
        newTenants: count,
      })
    }

    const mrrValue = parseFloat(mrrPaid._sum.amount ?? 0)

    res.json({
      tenants: {
        total:     totalTenants,
        byStatus,
        newThisMonth,
        churnLast30,
      },
      revenue: {
        mrr:          +mrrValue.toFixed(2),
        mrrProjected: +mrrProjected.toFixed(2),
        arr:          +(mrrProjected * 12).toFixed(2),
      },
      growth,
      generatedAt: now.toISOString(),
    })
  } catch (err) {
    console.error('[master/metrics GET]', err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})
