/**
 * routes/master/webhook.js
 *
 * POST /billing/webhook
 * Recebe eventos do Pagar.me e despacha emails de billing.
 *
 * Emails disparados por evento:
 *   subscription.payment.paid    → billing.payment_success
 *   subscription.payment.failed  → billing.payment_failed  (+ billing.suspended se ≥3 falhas)
 *   subscription.trial_end       → billing.trial_ending
 *   subscription.canceled        → (sem email — cancelamento é intencional)
 *
 * Segurança: valida x-hub-signature HMAC-SHA256 antes de qualquer lógica.
 * O body chega como Buffer (express.raw montado no index.js).
 */

import { Router } from 'express'
import { prismaMaster as prisma } from '../../lib/prisma-master.js'
import { validateWebhookSignature } from '../../lib/pagarme.js'
import { sendEmail } from '../../lib/mailer.js'
import { render } from '../../lib/billingTemplates.js'

export const billingWebhookRouter = Router()

const MAX_PAYMENT_FAILURES = parseInt(process.env.MAX_PAYMENT_FAILURES ?? '3', 10)
const SUPPORT_EMAIL        = process.env.SUPPORT_EMAIL ?? 'suporte@aurabr.app'

/* ─── POST /billing/webhook ─── */
billingWebhookRouter.post('/', async (req, res) => {
  /* 1. Body como Buffer */
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(JSON.stringify(req.body ?? ''))

  /* 2. Valida HMAC */
  const signature = req.headers['x-hub-signature'] ?? ''
  if (!validateWebhookSignature(rawBody, signature)) {
    console.warn('[webhook] Assinatura inválida.', { ip: req.ip, sig: signature.slice(0, 20) })
    return res.status(401).json({ error: 'Assinatura inválida.' })
  }

  /* 3. Parse */
  let event
  try { event = JSON.parse(rawBody.toString()) }
  catch { return res.status(400).json({ error: 'JSON inválido.' }) }

  /* Responde 200 imediatamente */
  res.status(200).json({ received: true })

  /* 4. Extrai campos */
  const eventType      = event.type ?? event.event ?? ''
  const subscriptionId = event.data?.id ?? event.data?.subscription?.id ?? ''
  const charge         = event.data?.last_transaction ?? event.data?.charge ?? {}
  const chargeId       = charge.id ?? ''
  const amount         = charge.amount ? charge.amount / 100 : null // centavos → reais

  console.log(`[webhook] ${eventType} | sub: ${subscriptionId}`)

  /* 5. Localiza tenant */
  const tenant = await findTenantBySubscription(subscriptionId, event)

  /* 6. Registra billing_event (auditoria imutável) */
  if (tenant) {
    logBillingEvent({
      tenantId: tenant.id, eventType, amount,
      status: mapEventStatus(eventType), chargeId, payload: event,
    }).catch(err => console.error('[webhook] logBillingEvent:', err.message))
  }

  /* 7. Processa */
  handleEvent({ eventType, tenant, subscriptionId, chargeId, amount, event })
    .catch(err => console.error('[webhook] handleEvent error:', err.message))
})

/* ── Handlers ───────────────────────────────────────────── */

async function handleEvent({ eventType, tenant, subscriptionId, chargeId, amount, event }) {
  switch (eventType) {

    /* ── Pagamento aprovado ─────────────────────────────── */
    case 'subscription.payment.paid':
    case 'charge.paid': {
      if (!tenant) { console.warn('[webhook] tenant não encontrado (paid):', subscriptionId); return }

      const period = getCurrentPeriod()

      await Promise.all([
        prisma.tenant.update({
          where: { id: tenant.id },
          data: { status: 'ACTIVE', billingStatus: 'paid', nextBillingDate: nextMonthDate() },
        }),
        prisma.billing.upsert({
          where:  { tenantId_period_type: { tenantId: tenant.id, period, type: 'MONTHLY' } },
          create: { tenantId: tenant.id, period, amount: amount ?? 0, type: 'MONTHLY',
                    status: 'PAID', paidAt: new Date(), invoiceRef: chargeId || null },
          update: { status: 'PAID', paidAt: new Date(), invoiceRef: chargeId || null },
        }),
      ])

      console.log(`[webhook] ✓ ${tenant.slug} ATIVO | billing ${period} PAID`)

      /* Email: billing.payment_success */
      await sendBillingEmail(tenant, 'billing.payment_success', {
        amount:     fmtBRL(amount),
        period:     fmtPeriod(period),
        invoiceRef: chargeId || '—',
      })
      break
    }

    /* ── Pagamento falhou ───────────────────────────────── */
    case 'subscription.payment.failed':
    case 'charge.payment_failed': {
      if (!tenant) { console.warn('[webhook] tenant não encontrado (failed):', subscriptionId); return }

      const reason = event.data?.last_transaction?.gateway_response?.errors?.[0]?.message
        ?? 'Falha no pagamento'

      /* Registra falha */
      await prisma.$executeRawUnsafe(
        `INSERT INTO payment_failures (tenant_id, pagarme_charge_id, reason) VALUES ($1,$2,$3)`,
        tenant.id, chargeId || null, reason
      )

      /* Conta falhas nos últimos 90 dias */
      const rows = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS cnt FROM payment_failures
         WHERE tenant_id=$1 AND failed_at > now() - interval '90 days'`,
        tenant.id
      )
      const failureCount = rows[0]?.cnt ?? 0

      const willSuspend = failureCount >= MAX_PAYMENT_FAILURES

      await prisma.tenant.update({
        where: { id: tenant.id },
        data:  { billingStatus: 'failed', ...(willSuspend ? { status: 'SUSPENDED' } : {}) },
      })

      if (willSuspend) {
        console.warn(`[webhook] ⚠ ${tenant.slug} SUSPENSO após ${failureCount} falhas`)

        /* Email: billing.suspended */
        await sendBillingEmail(tenant, 'billing.suspended', {
          failureCount: String(failureCount),
          supportEmail: SUPPORT_EMAIL,
        })
      } else {
        console.warn(`[webhook] ⚠ Falha #${failureCount} para ${tenant.slug}`)

        /* Email: billing.payment_failed */
        await sendBillingEmail(tenant, 'billing.payment_failed', {
          amount:       fmtBRL(amount),
          period:       fmtPeriod(getCurrentPeriod()),
          failureCount: String(failureCount),
          maxFailures:  String(MAX_PAYMENT_FAILURES),
        })
      }
      break
    }

    /* ── Assinatura cancelada ───────────────────────────── */
    case 'subscription.canceled': {
      if (!tenant) return
      await prisma.tenant.update({
        where: { id: tenant.id },
        data:  { status: 'CANCELLED', billingStatus: 'canceled' },
      })
      console.log(`[webhook] ✓ ${tenant.slug} CANCELADO`)
      /* Sem email — cancelamento costuma ser intencional ou manual */
      break
    }

    /* ── Trial encerrando ───────────────────────────────── */
    case 'subscription.trial_end': {
      if (!tenant) return
      await prisma.tenant.update({
        where: { id: tenant.id },
        data:  { billingStatus: 'trial_ending' },
      })
      console.log(`[webhook] Trial encerrando: ${tenant.slug}`)

      /* Email: billing.trial_ending */
      const tenantWithPlan = await prisma.tenant.findUnique({
        where:   { id: tenant.id },
        include: { plan: { select: { name: true, priceMonthly: true } } },
      })

      if (tenantWithPlan?.trialEndsAt) {
        await sendBillingEmail(tenant, 'billing.trial_ending', {
          trialEndsAt:  fmtDate(tenantWithPlan.trialEndsAt),
          planName:     tenantWithPlan.plan?.name ?? '—',
          priceMonthly: fmtBRL(tenantWithPlan.plan?.priceMonthly),
        })
      }
      break
    }

    default:
      console.log(`[webhook] Evento não tratado: ${eventType}`)
  }
}

/* ── sendBillingEmail ───────────────────────────────────── */

/**
 * Busca o admin do tenant, renderiza o template e envia o email.
 * Fail-gracioso — nunca lança exceção que cancele o handler.
 *
 * @param {object} tenant   — registro do banco
 * @param {string} event    — ex: 'billing.payment_success'
 * @param {object} extraData — dados adicionais além dos padrões
 */
async function sendBillingEmail(tenant, event, extraData = {}) {
  try {
    const admin = await getTenantAdmin(tenant.id)
    if (!admin?.email) {
      console.warn(`[webhook] Sem admin para email de billing: ${tenant.slug}`)
      return
    }

    const data = {
      adminName:   admin.name,
      companyName: tenant.name,
      planName:    tenant.plan?.name ?? extraData.planName ?? '—',
      supportEmail: SUPPORT_EMAIL,
      ...extraData,
    }

    const rendered = render(event, 'pt', data)

    await sendEmail(admin.email, {
      subject: rendered.subject,
      text:    rendered.body,
      html:    buildEmailHtml(rendered.title, rendered.body),
    })

    console.log(`[webhook] ✓ Email "${event}" enviado para ${admin.email} (${tenant.slug})`)
  } catch (err) {
    console.error(`[webhook] Erro ao enviar email "${event}" para ${tenant.slug}:`, err.message)
  }
}

/* ── Helpers ────────────────────────────────────────────── */

/** Busca o primeiro ADMIN do tenant no banco master */
async function getTenantAdmin(tenantId) {
  return prisma.user.findFirst({
    where:   { tenantId, role: 'ADMIN', active: true },
    select:  { name: true, email: true },
    orderBy: { createdAt: 'asc' },
  }).catch(() => null)
}

async function findTenantBySubscription(subscriptionId, event) {
  if (subscriptionId) {
    const t = await prisma.tenant.findFirst({
      where:   { pagarmeSubscriptionId: subscriptionId },
      include: { plan: { select: { name: true, priceMonthly: true } } },
    }).catch(() => null)
    if (t) return t
  }

  const slug = event.data?.metadata?.tenant_slug
  if (slug) {
    const t = await prisma.tenant.findUnique({
      where:   { slug },
      include: { plan: { select: { name: true, priceMonthly: true } } },
    }).catch(() => null)

    if (t && !t.pagarmeSubscriptionId && subscriptionId) {
      prisma.tenant.update({
        where: { id: t.id },
        data:  { pagarmeSubscriptionId: subscriptionId },
      }).catch(() => {})
    }

    return t
  }

  return null
}

async function logBillingEvent({ tenantId, eventType, amount, status, chargeId, payload }) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO billing_events (tenant_id, event_type, amount, status, pagarme_charge_id, payload)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
    tenantId, eventType, amount, status, chargeId || null, JSON.stringify(payload)
  )
}

/** Monta HTML simples reutilizando o mesmo layout do mailer.js */
function buildEmailHtml(title, body) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<style>
body{font-family:Inter,-apple-system,sans-serif;background:#f8fafc;margin:0;padding:0}
.wrap{max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden}
.bar{height:4px;background:linear-gradient(90deg,#0284C7,#0EA5E9)}
.body{padding:32px}
h2{margin:0 0 12px;font-size:18px;color:#0f172a;font-weight:700}
p{margin:0;color:#475569;line-height:1.7;font-size:14px;white-space:pre-line}
.foot{padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center}
</style></head><body>
<div class="wrap">
  <div class="bar"></div>
  <div class="body">
    <h2>${title}</h2>
    <p>${body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
  </div>
  <div class="foot">Aura Platform · aurabr.app · Mensagem automática</div>
</div></body></html>`
}

function mapEventStatus(eventType) {
  if (eventType.includes('paid'))   return 'paid'
  if (eventType.includes('failed')) return 'failed'
  if (eventType.includes('cancel')) return 'canceled'
  if (eventType.includes('trial'))  return 'trial'
  return 'pending'
}

function getCurrentPeriod() {
  return new Date().toISOString().slice(0, 7)
}

function nextMonthDate() {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return d.toISOString() // ISO-8601 full DateTime
}

function fmtBRL(v) {
  if (v == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function fmtPeriod(v) {
  if (!v) return '—'
  const [y, m] = v.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function fmtDate(v) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
