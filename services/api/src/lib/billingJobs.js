/**
 * lib/billingJobs.js
 *
 * Jobs recorrentes de billing — executados via setInterval na inicialização da API.
 *
 * Jobs:
 *   checkTrialEnding()  — roda 1x/dia às 09h
 *     → Busca tenants com trial_ends_at entre hoje e 3 dias
 *     → Envia email billing.trial_ending se ainda não enviado
 *
 * Uso (em index.js):
 *   import { startBillingJobs } from './lib/billingJobs.js'
 *   startBillingJobs()
 */

import { prismaMaster as prisma } from './prisma-master.js'
import { sendEmail } from './mailer.js'
import { render }   from './billingTemplates.js'

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'suporte@aurabr.app'

/* ─── Agenda ─── */

export function startBillingJobs() {
  /* Roda na inicialização e depois a cada 24h */
  runWithDelay(checkTrialEnding, 60_000)               // primeiro run: 60s após boot
  setInterval(checkTrialEnding, 24 * 60 * 60 * 1000)  // depois: 1x/dia

  console.log('[billingJobs] Jobs de billing iniciados.')
}

/** Aguarda `delay` ms e então executa `fn` */
function runWithDelay(fn, delay) {
  setTimeout(() => fn().catch(err =>
    console.error('[billingJobs] Erro no job inicial:', err.message)
  ), delay)
}

/* ─── checkTrialEnding ─── */

async function checkTrialEnding() {
  try {
    const now      = new Date()
    const in3days  = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

    /* Tenants com trial expirando nos próximos 3 dias e que ainda não foram notificados */
    const tenants = await prisma.tenant.findMany({
      where: {
        status:       'TRIAL',
        trialEndsAt:  { gte: now, lte: in3days },
        billingStatus: { not: 'trial_ending' }, // evita reenvio
      },
      include: { plan: { select: { name: true, priceMonthly: true } } },
    })

    if (!tenants.length) {
      console.log('[billingJobs] checkTrialEnding: nenhum tenant a notificar.')
      return
    }

    console.log(`[billingJobs] checkTrialEnding: ${tenants.length} tenant(s) para notificar.`)

    for (const tenant of tenants) {
      await notifyTrialEnding(tenant)
    }
  } catch (err) {
    console.error('[billingJobs] checkTrialEnding error:', err.message)
  }
}

async function notifyTrialEnding(tenant) {
  try {
    /* Busca admin */
    const admin = await prisma.user.findFirst({
      where:   { tenantId: tenant.id, role: 'ADMIN', active: true },
      select:  { name: true, email: true },
      orderBy: { createdAt: 'asc' },
    })

    if (!admin?.email) {
      console.warn(`[billingJobs] Sem admin para trial_ending: ${tenant.slug}`)
      return
    }

    const rendered = render('billing.trial_ending', 'pt', {
      adminName:    admin.name,
      companyName:  tenant.name,
      planName:     tenant.plan?.name   ?? '—',
      priceMonthly: fmtBRL(tenant.plan?.priceMonthly),
      trialEndsAt:  fmtDate(tenant.trialEndsAt),
      supportEmail: SUPPORT_EMAIL,
    })

    await sendEmail(admin.email, {
      subject: rendered.subject,
      text:    rendered.body,
      html:    buildEmailHtml(rendered.title, rendered.body),
    })

    /* Marca como notificado para não reenviar amanhã */
    await prisma.tenant.update({
      where: { id: tenant.id },
      data:  { billingStatus: 'trial_ending' },
    })

    console.log(`[billingJobs] ✓ Trial ending email → ${admin.email} (${tenant.slug})`)
  } catch (err) {
    console.error(`[billingJobs] Erro ao notificar trial_ending ${tenant.slug}:`, err.message)
  }
}

/* ── Helpers ────────────────────────────────────────────── */

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

function fmtBRL(v) {
  if (v == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function fmtDate(v) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
