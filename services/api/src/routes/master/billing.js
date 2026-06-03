/**
 * routes/master/billing.js
 *
 * GET  /master/billing              — visão geral de billing (MRR, inadimplentes etc.)
 * POST /master/billing/webhook-test — simula um evento de webhook (apenas dev/staging)
 * POST /master/billing/sync-pagarme — sincroniza status de uma assinatura com o Pagar.me
 *
 * Autenticação: authenticateMaster (x-master-secret header)
 */

import { Router }                   from 'express'
import { prismaMaster as prisma }   from '../../lib/prisma-master.js'
import { authenticateMaster }       from '../../middleware/authenticateMaster.js'
import { getSubscription }          from '../../lib/pagarme.js'
import { signWebhookPayload }       from '../../lib/pagarme.js'

export const masterBillingRouter = Router()
masterBillingRouter.use(authenticateMaster)

/* ─────────────────────────────────────────────────────────────────────────────
 * GET /master/billing
 * ───────────────────────────────────────────────────────────────────────────── */
masterBillingRouter.get('/', async (req, res) => {
  try {
    const months = Math.min(24, Math.max(1, parseInt(req.query.months ?? '12', 10)))
    const since  = new Date()
    since.setMonth(since.getMonth() - months)

    const billings = await prisma.billing.findMany({
      where:   { createdAt: { gte: since } },
      include: { tenant: { select: { id: true, slug: true, name: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    })

    /* Receita por mês */
    const revenueByMonth = {}
    for (const b of billings) {
      if (b.status !== 'PAID') continue
      const key = b.period
      revenueByMonth[key] = (revenueByMonth[key] ?? 0) + parseFloat(b.amount)
    }
    const revenueChart = Object.entries(revenueByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, amount]) => ({ period, amount: +amount.toFixed(2) }))

    /* Inadimplentes */
    const overdue = billings
      .filter(b => b.status === 'OVERDUE')
      .map(b => ({
        tenantSlug:   b.tenant.slug,
        tenantName:   b.tenant.name,
        tenantStatus: b.tenant.status,
        period:       b.period,
        amount:       parseFloat(b.amount),
        type:         b.type,
        createdAt:    b.createdAt,
      }))

    /* Próximas cobranças */
    const currentPeriod = new Date().toISOString().slice(0, 7)
    const upcoming = billings
      .filter(b => b.status === 'PENDING' && b.period >= currentPeriod)
      .map(b => ({
        tenantSlug: b.tenant.slug,
        tenantName: b.tenant.name,
        period:     b.period,
        amount:     parseFloat(b.amount),
        type:       b.type,
      }))

    /* Totais */
    const totals = billings.reduce(
      (acc, b) => {
        const amt = parseFloat(b.amount)
        if (b.status === 'PAID')    acc.paid    += amt
        if (b.status === 'PENDING') acc.pending += amt
        if (b.status === 'OVERDUE') acc.overdue += amt
        return acc
      },
      { paid: 0, pending: 0, overdue: 0 }
    )
    totals.paid    = +totals.paid.toFixed(2)
    totals.pending = +totals.pending.toFixed(2)
    totals.overdue = +totals.overdue.toFixed(2)

    /* MRR = soma de assinaturas ACTIVE */
    const activeTenants = await prisma.tenant.findMany({
      where:   { status: 'ACTIVE' },
      include: { plan: { select: { priceMonthly: true } } },
    })
    const mrr = activeTenants.reduce((s, t) => s + parseFloat(t.plan?.priceMonthly ?? 0), 0)
    const arr  = +(mrr * 12).toFixed(2)

    /* Contagem por status */
    const countByStatus = await prisma.tenant.groupBy({
      by:      ['status'],
      _count:  { _all: true },
    })

    res.json({
      revenueChart,
      overdue,
      upcoming,
      totals,
      mrr:    +mrr.toFixed(2),
      arr,
      countByStatus: countByStatus.map(r => ({ status: r.status, count: r._count._all })),
      meta:   { months, since: since.toISOString() },
    })
  } catch (err) {
    console.error('[master/billing GET]', err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /master/billing/webhook-test
 *
 * Dispara um evento simulado para o /billing/webhook sem passar pelo Pagar.me.
 * Útil para testar o fluxo completo em staging.
 *
 * Body:
 *   { type: 'subscription.payment.paid' | 'subscription.payment.failed' | ...,
 *     tenantSlug: 'acme',
 *     amount: 297 }
 * ───────────────────────────────────────────────────────────────────────────── */
masterBillingRouter.post('/webhook-test', async (req, res) => {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_WEBHOOK_TEST) {
    return res.status(403).json({ error: 'Não disponível em produção. Defina ALLOW_WEBHOOK_TEST=true para habilitar.' })
  }

  const { type, tenantSlug, amount = 297 } = req.body ?? {}
  if (!type || !tenantSlug) {
    return res.status(400).json({ error: 'type e tenantSlug são obrigatórios.' })
  }

  const validTypes = [
    'subscription.payment.paid',
    'subscription.payment.failed',
    'subscription.canceled',
    'subscription.trial_end',
    'charge.paid',
    'charge.payment_failed',
  ]
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `type inválido. Use: ${validTypes.join(', ')}` })
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } })
  if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado.' })

  /* Monta payload compatível com o formato Pagar.me */
  const fakePayload = JSON.stringify({
    type,
    data: {
      id:              tenant.pagarmeSubscriptionId ?? `sub_test_${tenantSlug}`,
      status:          type.includes('paid') ? 'paid' : type.includes('failed') ? 'failed' : 'canceled',
      metadata:        { tenant_slug: tenantSlug },
      last_transaction: {
        id:             `ch_test_${Date.now()}`,
        amount:         Math.round(amount * 100),
        status:         type.includes('paid') ? 'paid' : 'failed',
        gateway_response: { errors: type.includes('failed') ? [{ message: 'Teste: cartão recusado' }] : [] },
      },
    },
  })

  /* Gera assinatura HMAC válida */
  const signature = process.env.PAGARME_WEBHOOK_SECRET
    ? signWebhookPayload(Buffer.from(fakePayload))
    : 'sha256=test_no_secret'

  /* Dispara para o próprio webhook */
  const port    = process.env.PORT ?? 3001
  const baseUrl = `http://localhost:${port}`

  try {
    const webhookRes = await fetch(`${baseUrl}/billing/webhook`, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-hub-signature': signature,
      },
      body: fakePayload,
    })
    const result = await webhookRes.json()
    return res.json({ dispatched: true, webhookStatus: webhookRes.status, result, payload: JSON.parse(fakePayload) })
  } catch (err) {
    return res.status(500).json({ error: `Falha ao chamar webhook: ${err.message}` })
  }
})

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /master/billing/sync-pagarme
 *
 * Sincroniza o status de uma assinatura específica com o Pagar.me.
 * Útil após resolver manualmente um problema de billing.
 *
 * Body: { tenantSlug: 'acme' }
 * ───────────────────────────────────────────────────────────────────────────── */
masterBillingRouter.post('/sync-pagarme', async (req, res) => {
  const { tenantSlug } = req.body ?? {}
  if (!tenantSlug) return res.status(400).json({ error: 'tenantSlug obrigatório.' })

  if (!process.env.PAGARME_API_KEY) {
    return res.status(503).json({ error: 'PAGARME_API_KEY não configurada.' })
  }

  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } })
    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado.' })
    if (!tenant.pagarmeSubscriptionId) {
      return res.status(400).json({ error: 'Tenant não possui assinatura Pagar.me.' })
    }

    const sub = await getSubscription(tenant.pagarmeSubscriptionId)

    /* Mapeia status Pagar.me → status interno */
    const statusMap = {
      active:    { status: 'ACTIVE',    billingStatus: 'paid' },
      canceled:  { status: 'CANCELLED', billingStatus: 'canceled' },
      trialing:  { status: 'TRIAL',     billingStatus: 'trial' },
      past_due:  { status: 'ACTIVE',    billingStatus: 'failed' },
      unpaid:    { status: 'SUSPENDED', billingStatus: 'failed' },
    }
    const mapped = statusMap[sub.status] ?? { billingStatus: sub.status }

    await prisma.tenant.update({
      where: { id: tenant.id },
      data:  { ...mapped },
    })

    return res.json({
      tenantSlug,
      pagarmeStatus:  sub.status,
      internalStatus: mapped.status ?? tenant.status,
      billingStatus:  mapped.billingStatus,
      nextBilling:    sub.next_billing_at,
    })
  } catch (err) {
    console.error('[billing/sync-pagarme]', err)
    return res.status(500).json({ error: err.message })
  }
})
