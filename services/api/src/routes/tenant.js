/**
 * routes/tenant.js
 *
 * GET   /api/tenant/me          — info + tema do tenant logado
 * PUT   /api/tenant/theme       — salva tema no banco
 * GET   /api/tenant/billing     — plano atual, próxima cobrança, histórico (self-service)
 * PATCH /api/tenant/plan        — upgrade/downgrade de plano (admin only)
 * POST  /api/tenant/cancel      — cancela assinatura com confirmação (admin only)
 */

import { Router }                 from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize }    from '../middleware/authorize.js'
import { prismaMaster as prisma }                 from '../lib/prisma-master.js'
import { prismaMaster }           from '../lib/prisma-master.js'
import { query }                  from '../lib/tenantDb.js'
import {
  updateSubscriptionPlan,
  cancelSubscription,
}                                 from '../lib/pagarme.js'
import { sendEmail }              from '../lib/mailer.js'
import { render }                 from '../lib/billingTemplates.js'

export const tenantRouter = Router()
tenantRouter.use(authenticate)

/* ── GET /api/tenant/me ── */
tenantRouter.get('/me', async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where:  { slug: req.user.tenantSlug },
      select: { id: true, slug: true, name: true, themeConfig: true, status: true },
    })
    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado.' })

    let logoUrl     = null
    let displayName = null
    let storeEnabled = true
    try {
      const { rows } = await query("SELECT key, value FROM settings WHERE key IN ('theme','store_config')")
      for (const row of rows) {
        if (row.key === 'theme')        logoUrl      = row.value?.logoUrl     ?? null
        if (row.key === 'store_config') {
          displayName  = row.value?.displayName  ?? null
          storeEnabled = row.value?.storeEnabled ?? true
        }
      }
    } catch {}

    res.json({
      id:           tenant.id,
      slug:         tenant.slug,
      name:         displayName ?? tenant.name,
      displayName,
      storeEnabled,
      status:       tenant.status,
      theme_config: tenant.themeConfig ?? {},
      logoUrl,
    })
  } catch (err) {
    console.error('[tenant/me]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── PUT /api/tenant/theme ── */
tenantRouter.put('/theme', async (req, res) => {
  try {
    const { primaryColor, mood, fontPair, radius, logoUrl, ga4MeasurementId, metaPixelId } = req.body

    await prisma.tenant.update({
      where: { slug: req.user.tenantSlug },
      data:  {
        themeConfig: { primaryColor, mood, fontPair, radius, ga4MeasurementId: ga4MeasurementId ?? null, metaPixelId: metaPixelId ?? null },
        updatedAt:   new Date(),
      },
    })

    await query(`
      INSERT INTO settings (key, value) VALUES ('theme', $1::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = now()
    `, [JSON.stringify({ primaryColor, mood, fontPair, radius, logoUrl })])

    res.json({ ok: true })
  } catch (err) {
    console.error('[tenant/theme]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── PUT /api/tenant/settings ── */
tenantRouter.put('/settings', authorize('admin'), async (req, res) => {
  try {
    const { displayName, storeEnabled } = req.body ?? {}
    const payload = {}
    if (displayName  !== undefined) payload.displayName  = String(displayName).trim().slice(0, 120)
    if (storeEnabled !== undefined) payload.storeEnabled = Boolean(storeEnabled)
    if (!Object.keys(payload).length) return res.status(400).json({ error: 'Nenhum campo enviado.' })

    // Merge parcial: preserva chaves não enviadas
    await query(`
      INSERT INTO settings (key, value) VALUES ('store_config', $1::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = settings.value || $1::jsonb, updated_at = now()
    `, [JSON.stringify(payload)])

    res.json({ ok: true })
  } catch (err) {
    console.error('[tenant/settings]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── GET /api/tenant/billing ── */
tenantRouter.get('/billing', async (req, res) => {
  try {
    const tenant = await prismaMaster.tenant.findUnique({
      where:   { slug: req.user.tenantSlug },
      include: {
        plan:    true,
        billings: {
          orderBy: { createdAt: 'desc' },
          take:    12,
          select:  { id: true, period: true, amount: true, status: true, type: true, paidAt: true, invoiceRef: true },
        },
      },
    })

    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado.' })

    const pagarmePortalUrl = tenant.pagarmeSubscriptionId
      ? `https://app.pagar.me/subscriptions/${tenant.pagarmeSubscriptionId}`
      : null

    const isAdmin = req.user?.role === 'ADMIN'

    // Calcula se há condições contratuais especiais
    const hasSpecialContract = isAdmin && (
      tenant.contractPrice != null ||
      tenant.contractLimits != null ||
      (tenant.accessLevel && tenant.accessLevel !== 'NORMAL')
    )

    res.json({
      plan: {
        id:           tenant.plan?.id,
        name:         tenant.plan?.name,
        priceMonthly: tenant.plan?.priceMonthly,
        priceSetup:   tenant.plan?.priceSetup,
        maxUsers:     tenant.plan?.maxUsers,
        maxProducts:  tenant.plan?.maxProducts,
        mcpQuota:     tenant.plan?.mcpQuota,
        features:     tenant.plan?.features,
      },
      subscription: {
        status:               tenant.status,
        billingStatus:        tenant.billingStatus,
        trialEndsAt:          tenant.trialEndsAt,
        nextBillingDate:      tenant.nextBillingDate,
        pagarmeSubscriptionId: tenant.pagarmeSubscriptionId,
        pagarmePortalUrl,
      },
      // Condições especiais — só visível para ADMIN
      contract: isAdmin ? {
        hasSpecial:     hasSpecialContract,
        accessLevel:    tenant.accessLevel,
        contractPrice:  tenant.contractPrice != null ? parseFloat(tenant.contractPrice) : null,
        contractLimits: tenant.contractLimits ?? null,
        accessNote:     tenant.accessNote ?? null,
      } : null,
      history: tenant.billings.map(b => ({
        id:        b.id,
        period:    b.period,
        amount:    parseFloat(b.amount),
        status:    b.status,
        type:      b.type,
        paidAt:    b.paidAt,
        invoiceRef: b.invoiceRef,
      })),
    })
  } catch (err) {
    console.error('[tenant/billing]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── PATCH /api/tenant/plan ── */
tenantRouter.patch('/plan', async (req, res) => {
  /* Apenas ADMIN pode trocar de plano */
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Apenas admins podem alterar o plano.' })
  }

  const { planId } = req.body ?? {}
  if (!planId) return res.status(400).json({ error: 'planId obrigatório.' })

  try {
    const [tenant, newPlan] = await Promise.all([
      prismaMaster.tenant.findUnique({
        where:   { slug: req.user.tenantSlug },
        include: { plan: true },
      }),
      prismaMaster.plan.findUnique({ where: { id: planId } }),
    ])

    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado.' })
    if (!newPlan || !newPlan.active) return res.status(400).json({ error: 'Plano inválido.' })
    if (tenant.planId === planId)    return res.status(400).json({ error: 'Já está neste plano.' })

    const direction = parseFloat(newPlan.priceMonthly) > parseFloat(tenant.plan?.priceMonthly ?? 0)
      ? 'upgrade'
      : 'downgrade'

    /* Atualiza no Pagar.me se houver assinatura ativa */
    if (tenant.pagarmeSubscriptionId && process.env.PAGARME_API_KEY) {
      await updateSubscriptionPlan(
        tenant.pagarmeSubscriptionId,
        newPlan.name,
        newPlan.priceMonthly
      )
    }

    /* Atualiza banco master */
    await prismaMaster.tenant.update({
      where: { id: tenant.id },
      data:  { planId, updatedAt: new Date() },
    })

    console.log(`[tenant/plan] ${tenant.slug}: ${tenant.plan?.name} → ${newPlan.name} (${direction})`)

    /* Notificação em background */
    notifyPlanChange({
      tenant,
      newPlan,
      oldPlanName: tenant.plan?.name,
      direction,
    }).catch(err => console.error('[tenant/plan] notify:', err.message))

    res.json({
      ok:           true,
      direction,
      oldPlan:      tenant.plan?.name,
      newPlan:      newPlan.name,
      newPrice:     parseFloat(newPlan.priceMonthly),
      newMaxUsers:  newPlan.maxUsers,
      newMaxProducts: newPlan.maxProducts,
      newMcpQuota:  newPlan.mcpQuota,
    })
  } catch (err) {
    console.error('[tenant/plan]', err.message)
    res.status(500).json({ error: err.message ?? 'Erro interno.' })
  }
})

/* ── POST /api/tenant/cancel ── */
tenantRouter.post('/cancel', async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Apenas admins podem cancelar a assinatura.' })
  }

  const { confirm } = req.body ?? {}
  if (confirm !== true) {
    return res.status(400).json({ error: 'Envie { confirm: true } para confirmar o cancelamento.' })
  }

  try {
    const tenant = await prismaMaster.tenant.findUnique({
      where: { slug: req.user.tenantSlug },
    })
    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado.' })

    /* Cancela no Pagar.me */
    if (tenant.pagarmeSubscriptionId && process.env.PAGARME_API_KEY) {
      await cancelSubscription(tenant.pagarmeSubscriptionId).catch(err =>
        console.warn('[tenant/cancel] Pagar.me:', err.message)
      )
    }

    /* Atualiza banco */
    await prismaMaster.tenant.update({
      where: { id: tenant.id },
      data:  { status: 'CANCELLED', billingStatus: 'canceled' },
    })

    console.log(`[tenant/cancel] ${tenant.slug} cancelado pelo admin ${req.user.email}`)

    res.json({ ok: true, message: 'Assinatura cancelada. Seus dados ficam disponíveis por 30 dias.' })
  } catch (err) {
    console.error('[tenant/cancel]', err.message)
    res.status(500).json({ error: err.message ?? 'Erro interno.' })
  }
})

/* ── GET /api/tenant/whatsapp-config ── */
tenantRouter.get('/whatsapp-config', authorize('admin'), async (req, res) => {
  try {
    const { rows } = await query("SELECT value FROM settings WHERE key='whatsapp_config'")
    const cfg = rows[0]?.value ?? {}
    res.json({
      url:     cfg.url     ?? '',
      apiKey:  cfg.apiKey  ?? '',
      session: cfg.session ?? '',
    })
  } catch (err) {
    console.error('[tenant/whatsapp-config GET]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── PUT /api/tenant/whatsapp-config ── */
tenantRouter.put('/whatsapp-config', authorize('admin'), async (req, res) => {
  try {
    const { url, apiKey, session } = req.body ?? {}
    const payload = {}
    if (url     !== undefined) payload.url     = String(url).trim()
    if (apiKey  !== undefined) payload.apiKey  = String(apiKey).trim()
    if (session !== undefined) payload.session = String(session).trim() || 'default'
    if (!Object.keys(payload).length) return res.status(400).json({ error: 'Nenhum campo enviado.' })

    await query(`
      INSERT INTO settings (key, value) VALUES ('whatsapp_config', $1::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = settings.value || $1::jsonb, updated_at = now()
    `, [JSON.stringify(payload)])

    res.json({ ok: true })
  } catch (err) {
    console.error('[tenant/whatsapp-config PUT]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── Helpers internos ─────────────────────────────────────── */

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'suporte@aurabr.app'

/**
 * Envia email de notificação de mudança de plano para o admin do tenant.
 * Roda em background — não bloqueia a resposta da API.
 */
async function notifyPlanChange({ tenant, newPlan, oldPlanName, direction }) {
  try {
    /* Busca admin */
    const admin = await prismaMaster.user.findFirst({
      where:   { tenantId: tenant.id, role: 'ADMIN', active: true },
      select:  { name: true, email: true },
      orderBy: { createdAt: 'asc' },
    })
    if (!admin?.email) return

    const event = direction === 'upgrade' ? 'plan.upgraded' : 'plan.downgraded'
    const lang  = 'pt'

    /* Formata limites legíveis */
    const fmtLimit = v => v === -1 ? 'Ilimitado' : String(v)
    const fmtBRL   = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))

    const data = {
      adminName:   admin.name,
      companyName: tenant.name,
      oldPlan:     oldPlanName ?? '—',
      newPlan:     newPlan.name,
      newPrice:    fmtBRL(newPlan.priceMonthly),
      maxUsers:    fmtLimit(newPlan.maxUsers),
      maxProducts: fmtLimit(newPlan.maxProducts),
      supportEmail: SUPPORT_EMAIL,
    }

    const rendered = render(event, lang, data)

    await sendEmail(admin.email, {
      subject: rendered.subject,
      text:    rendered.body,
      html:    buildSimpleHtml(rendered.title, rendered.body),
    })

    console.log(`[tenant/plan] ✓ Email "${event}" → ${admin.email} (${tenant.slug})`)
  } catch (err) {
    console.error('[tenant/plan] notifyPlanChange:', err.message)
  }
}

function buildSimpleHtml(title, body) {
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
    <p>${body.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
  </div>
  <div class="foot">Aura Platform · aurabr.app · Mensagem automática</div>
</div></body></html>`
}

/* ── GET /api/tenant/permissions ── */
tenantRouter.get('/permissions', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { rows } = await query("SELECT value FROM settings WHERE key='access_permissions'")
    res.json({ permissions: rows[0]?.value ?? {} })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* ── PUT /api/tenant/permissions ── */
tenantRouter.put('/permissions', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { permissions } = req.body
    await query(`
      INSERT INTO settings (key, value) VALUES ('access_permissions', $1::jsonb)
      ON CONFLICT (key) DO UPDATE SET value=$1::jsonb, updated_at=now()
    `, [JSON.stringify(permissions)])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
