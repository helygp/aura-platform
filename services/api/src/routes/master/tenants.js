/**
 * routes/master/tenants.js
 *
 * GET    /master/tenants                   — lista tenants (paginado, filtrável)
 * GET    /master/tenants/:slug             — detalhe do tenant
 * POST   /master/tenants                   — provisiona novo tenant + Pagar.me
 * PATCH  /master/tenants/:slug/status      — ativa / suspende / cancela
 *
 * Todas as rotas exigem authenticateMaster (x-master-secret header).
 */

import { Router }             from 'express'
import { z }                  from 'zod'
import { execFile }           from 'child_process'
import { promisify }          from 'util'
import { prismaMaster as prisma }             from '../../lib/prisma-master.js'
import { authenticateMaster } from '../../middleware/authenticateMaster.js'
import {
  createCustomer,
  createSubscription,
  cancelSubscription,
} from '../../lib/pagarme.js'
import { sendWelcomeEmail } from '../../lib/mailer.js'
import { randomBytes } from 'crypto'

const execFileAsync = promisify(execFile)

export const masterTenantsRouter = Router()
masterTenantsRouter.use(authenticateMaster)

/* ─────────────────────────────────────────────────────────────────────────────
 * GET /master/tenants
 * ───────────────────────────────────────────────────────────────────────────── */
masterTenantsRouter.get('/', async (req, res) => {
  try {
    const { status, search, page = '1', limit = '20' } = req.query

    const pageN  = Math.max(1, parseInt(page, 10))
    const limitN = Math.min(100, Math.max(1, parseInt(limit, 10)))
    const skip   = (pageN - 1) * limitN

    const where = {}
    if (status) where.status = status.toUpperCase()
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ]

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        skip,
        take: limitN,
        orderBy: { createdAt: 'desc' },
        include: {
          plan:     { select: { id: true, name: true, priceMonthly: true } },
          billings: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { period: true, amount: true, status: true, paidAt: true },
          },
          _count: { select: { users: true } },
        },
      }),
      prisma.tenant.count({ where }),
    ])

    res.json({
      data: tenants.map(t => ({
        id:          t.id,
        slug:        t.slug,
        name:        t.name,
        status:      t.status,
        billingStatus: t.billingStatus,
        plan:        t.plan,
        users:       t._count.users,
        lastBilling: t.billings[0] ?? null,
        createdAt:   t.createdAt,
        updatedAt:   t.updatedAt,
      })),
      meta: { page: pageN, limit: limitN, total, pages: Math.ceil(total / limitN) },
    })
  } catch (err) {
    console.error('[master/tenants GET]', err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ─────────────────────────────────────────────────────────────────────────────
 * GET /master/tenants/:slug
 * ───────────────────────────────────────────────────────────────────────────── */
masterTenantsRouter.get('/:slug', async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where:   { slug: req.params.slug },
      include: {
        plan:     true,
        billings: { orderBy: { createdAt: 'desc' }, take: 12 },
        _count:   { select: { users: true } },
      },
    })
    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado.' })

    res.json({
      id:                     tenant.id,
      slug:                   tenant.slug,
      name:                   tenant.name,
      status:                 tenant.status,
      billingStatus:          tenant.billingStatus,
      pagarmeCustomerId:      tenant.pagarmeCustomerId,
      pagarmeSubscriptionId:  tenant.pagarmeSubscriptionId,
      nextBillingDate:        tenant.nextBillingDate,
      trialEndsAt:            tenant.trialEndsAt,
      plan:                   tenant.plan,
      dbName:                 tenant.dbName,
      wahaSession:            tenant.wahaSession,
      themeConfig:            tenant.themeConfig,
      users:                  tenant._count.users,
      billings:               tenant.billings,
      whatsappConfig:         await getSafeWhatsappConfig(req.params.slug),
      createdAt:              tenant.createdAt,
      updatedAt:              tenant.updatedAt,
    })
  } catch (err) {
    console.error('[master/tenants/:slug GET]', err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /master/tenants
 * 1. Valida body
 * 2. Cria tenant no banco (status TRIAL)
 * 3. Cria customer + subscription no Pagar.me (se PAGARME_API_KEY definida)
 * 4. Dispara provisionar.sh em background
 * Body: { slug, name, planId, adminName, adminEmail, adminPassword,
 *         document?, phone?, paymentMethod? }
 * ───────────────────────────────────────────────────────────────────────────── */
const createTenantSchema = z.object({
  slug:          z.string().min(2).max(32).regex(/^[a-z0-9-]+$/, 'Slug: apenas letras minúsculas, números e hífens.'),
  name:          z.string().min(2).max(120),
  planId:        z.string().min(1),
  adminName:     z.string().min(2).max(120),
  adminEmail:    z.string().email(),
  adminPassword: z.string().min(8).max(128),
  document:      z.string().optional(),                          // CPF ou CNPJ
  phone:         z.string().optional(),                          // +5511999999999
  paymentMethod: z.enum(['boleto', 'credit_card']).optional(),
  seedDemo:      z.boolean().optional().default(false),
})

masterTenantsRouter.post('/', async (req, res) => {
  const parsed = createTenantSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error:  'Dados inválidos.',
      fields: parsed.error.flatten().fieldErrors,
    })
  }

  const {
    slug, name, planId,
    adminName, adminEmail, adminPassword,
    document, phone, paymentMethod = 'boleto', seedDemo = false,
  } = parsed.data

  try {
    /* 1. Slug duplicado? */
    const existing = await prisma.tenant.findUnique({ where: { slug } })
    if (existing) return res.status(409).json({ error: `Slug "${slug}" já está em uso.` })

    /* 2. Plano existe? */
    const plan = await prisma.plan.findUnique({ where: { id: planId } })
    if (!plan || !plan.active) return res.status(400).json({ error: 'Plano inválido ou inativo.' })

    /* 3. Configura datas de trial */
    const trialDays = parseInt(process.env.TRIAL_DAYS ?? '14', 10)
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays)

    /* 4. Cria tenant no banco */
    const tenant = await prisma.tenant.create({
      data: {
        slug,
        name,
        planId,
        status:       'TRIAL',
        billingStatus: 'trial',
        dbName:       `aura_${slug}`,
        trialEndsAt,
      },
    })

    /* 5. Integração Pagar.me (assíncrona — não bloqueia resposta) */
    const hasPagarme = !!process.env.PAGARME_API_KEY

    if (hasPagarme) {
      setupPagarme({ tenant, plan, adminName, adminEmail, document, phone, paymentMethod, slug })
        .catch(err => console.error(`[master/tenants] Erro Pagar.me para ${slug}:`, err.message))
    } else {
      console.warn(`[master/tenants] PAGARME_API_KEY não definida — pulando integração para ${slug}.`)
    }

    /* 6. Provisiona infra em background via provision-agent */
    const AGENT_URL    = process.env.PROVISION_AGENT_URL ?? 'http://provision-agent:4001'
    const AGENT_SECRET = process.env.AGENT_SECRET        ?? 'aura-provision-secret-2024'

    fetch(AGENT_URL + '/provision', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-secret': AGENT_SECRET },
      body: JSON.stringify({
        slug,
        tenantId:      tenant.id,
        tenantName:    name,
        planId:        plan.id,
        adminName,
        adminEmail,
        adminPassword,
        segment:       '',
        seedDemo:      seedDemo,
      }),
    })
    .then(r => r.json())
    .then(data => {
      console.log(`[master/tenants] Provision-agent iniciado para ${slug}:`, data.message ?? data)
      sendWelcomeEmail({
        adminName,
        adminEmail,
        companyName:  name,
        slug,
        planName:     plan.name,
        erpUrl:       `https://${slug}.${process.env.AURA_DOMAIN ?? 'aurabr.app'}`,
        storeUrl:     `https://loja.${slug}.${process.env.AURA_DOMAIN ?? 'aurabr.app'}`,
        tempPassword: adminPassword,
      }).catch(e => console.error(`[master/tenants] Email erro ${slug}:`, e.message))
    })
    .catch(err => {
      console.error(`[master/tenants] Provision-agent erro ${slug}:`, err.message)
      prisma.tenant.update({ where:{ slug }, data:{ status:'SUSPENDED' } }).catch(()=>{})
    })

    return res.status(202).json({
      message: 'Tenant criado. Provisionamento e billing em andamento.',
      tenant: {
        id:           tenant.id,
        slug:         tenant.slug,
        name:         tenant.name,
        status:       tenant.status,
        trialEndsAt:  tenant.trialEndsAt,
        pagarme:      hasPagarme ? 'iniciando' : 'não configurado',
      },
    })
  } catch (err) {
    console.error('[master/tenants POST]', err)
    res.status(500).json({ error: 'Erro interno ao criar tenant.' })
  }
})

/**
 * Cria customer + subscription no Pagar.me e persiste os IDs no banco.
 * Executado de forma assíncrona — erros são logados mas não afetam a resposta.
 */
async function setupPagarme({ tenant, plan, adminName, adminEmail, document, phone, paymentMethod, slug }) {
  try {
    /* Customer */
    const customer = await createCustomer({
      name:     adminName,
      email:    adminEmail,
      type:     'company',
      document: document ?? undefined,
      phone:    phone    ?? undefined,
    })

    /* Subscription */
    const subscription = await createSubscription({
      customerId:    customer.id,
      planCode:      plan.name,
      priceMonthly:  parseFloat(plan.priceMonthly),
      tenantSlug:    slug,
      paymentMethod,
    })

    /* Persiste IDs no banco */
    await prisma.tenant.update({
      where: { slug },
      data:  {
        pagarmeCustomerId:     customer.id,
        pagarmeSubscriptionId: subscription.id,
        billingStatus:         'trial',
      },
    })

    console.log(`[master/tenants] Pagar.me configurado para ${slug}: customer=${customer.id} sub=${subscription.id}`)
  } catch (err) {
    /* Persiste erro de billing sem bloquear o tenant */
    await prisma.tenant.update({
      where: { slug },
      data:  { billingStatus: 'pagarme_error' },
    }).catch(() => {})
    throw err
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * PATCH /master/tenants/:slug/status
 * Ativa, suspende ou cancela — cancela também no Pagar.me se necessário.
 * Body: { status: 'ACTIVE'|'SUSPENDED'|'CANCELLED'|'TRIAL', reason?: string }
 * ───────────────────────────────────────────────────────────────────────────── */
const VALID_STATUSES = ['ACTIVE', 'SUSPENDED', 'CANCELLED', 'TRIAL']

/* ─────────────────────────────────────────────────────────────────────────────
 * Helpers de WhatsApp
 * ───────────────────────────────────────────────────────────────────────────── */

/* Lê whatsapp_config do tenant — retorna objeto vazio se não configurado */
async function getRawWhatsappConfig(slug) {
  const rows = await prisma.$queryRaw`
    SELECT whatsapp_config FROM tenants WHERE slug = ${slug} LIMIT 1
  `
  return rows[0]?.whatsapp_config ?? {}
}

/* Sanitiza para enviar ao frontend — não expõe valores completos de secrets */
async function getSafeWhatsappConfig(slug) {
  const c = await getRawWhatsappConfig(slug)
  const mask = (v) => {
    if (!v || typeof v !== 'string') return null
    if (v.length <= 8) return { set: true, preview: '••••' }
    return { set: true, preview: v.slice(0, 4) + '…' + v.slice(-4) }
  }
  return {
    instance_id:      c.instance_id      ?? null,
    base_url:         c.base_url         ?? null,
    session:          c.session          ?? 'default',
    processor:        c.processor        ?? 'none',
    approver_phone:   c.approver_phone   ?? null,
    dify_api_url:     c.dify_api_url     ?? null,
    dify_app_id:      c.dify_app_id      ?? null,
    n8n_webhook_url:  c.n8n_webhook_url  ?? null,
    custom_url:       c.custom_url       ?? null,
    // Sensitive — apenas indicadores
    api_key:          mask(c.api_key),
    dify_api_key:     mask(c.dify_api_key),
    internal_api_key: mask(c.internal_api_key),
    webhook_secret:   mask(c.webhook_secret),
  }
}

/* Aplica merge parcial no whatsapp_config */
async function updateWhatsappConfig(slug, patch) {
  await prisma.$executeRaw`
    UPDATE tenants
    SET whatsapp_config = whatsapp_config || ${JSON.stringify(patch)}::jsonb,
        updated_at = now()
    WHERE slug = ${slug}
  `
}

/* ─────────────────────────────────────────────────────────────────────────────
 * GET /master/tenants/:slug/whatsapp
 * Retorna a configuração sanitizada.
 * ───────────────────────────────────────────────────────────────────────────── */
masterTenantsRouter.get('/:slug/whatsapp', async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: req.params.slug }, select: { id: true } })
    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado.' })
    res.json(await getSafeWhatsappConfig(req.params.slug))
  } catch (err) {
    console.error('[master/tenants/:slug/whatsapp GET]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ─────────────────────────────────────────────────────────────────────────────
 * PUT /master/tenants/:slug/whatsapp
 * Atualiza campos do whatsapp_config. Aceita merge parcial.
 * Campos sensíveis (api_key, dify_api_key) só são atualizados se enviados.
 * ───────────────────────────────────────────────────────────────────────────── */
const whatsappPatchSchema = z.object({
  instance_id:      z.string().nullable().optional(),
  base_url:         z.string().url().nullable().optional(),
  api_key:          z.string().nullable().optional(),
  session:          z.string().nullable().optional(),
  processor:        z.enum(['dify', 'n8n', 'custom', 'none']).optional(),
  approver_phone:   z.string().nullable().optional(),
  dify_api_url:     z.string().url().nullable().optional(),
  dify_api_key:     z.string().nullable().optional(),
  dify_app_id:      z.string().nullable().optional(),
  n8n_webhook_url:  z.string().url().nullable().optional(),
  custom_url:       z.string().url().nullable().optional(),
})

masterTenantsRouter.put('/:slug/whatsapp', async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: req.params.slug }, select: { id: true } })
    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado.' })

    const parsed = whatsappPatchSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos.', fields: parsed.error.format() })
    }

    // Normalize: phone só dígitos
    const patch = { ...parsed.data }
    if (patch.approver_phone) patch.approver_phone = String(patch.approver_phone).replace(/\D/g, '')

    await updateWhatsappConfig(req.params.slug, patch)
    res.json(await getSafeWhatsappConfig(req.params.slug))
  } catch (err) {
    console.error('[master/tenants/:slug/whatsapp PUT]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /master/tenants/:slug/whatsapp/rotate-keys
 * Gera novos internal_api_key e webhook_secret. Útil em caso de comprometimento.
 * ───────────────────────────────────────────────────────────────────────────── */
masterTenantsRouter.post('/:slug/whatsapp/rotate-keys', async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: req.params.slug }, select: { id: true } })
    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado.' })

    const internal_api_key = randomBytes(32).toString('base64url')
    const webhook_secret   = randomBytes(24).toString('base64url')

    await updateWhatsappConfig(req.params.slug, { internal_api_key, webhook_secret })

    // Retorna os valores completos UMA ÚNICA VEZ para o admin copiar
    res.json({
      ok: true,
      internal_api_key,
      webhook_secret,
      message: 'Chaves geradas. Guarde-as agora — não serão exibidas novamente.',
    })
  } catch (err) {
    console.error('[master/tenants/:slug/whatsapp/rotate-keys]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /master/tenants/:slug/whatsapp/provision
 * Provisiona instância WAHA via Aurazap orchestrator.
 * body: { instance_id?, webhook_url? }  — defaults gerados a partir do slug
 * ───────────────────────────────────────────────────────────────────────────── */
masterTenantsRouter.post('/:slug/whatsapp/provision', async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: req.params.slug }, select: { slug: true } })
    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado.' })

    const orchUrl = process.env.WAHA_ORCHESTRATOR_URL ?? 'http://waha-orchestrator:4000'
    const orchKey = process.env.WAHA_ORCHESTRATOR_KEY ?? ''
    if (!orchKey) return res.status(503).json({ error: 'Aurazap orchestrator não configurado (WAHA_ORCHESTRATOR_KEY ausente).' })

    const instance_id = req.body?.instance_id?.trim() || tenant.slug
    const webhook_url = req.body?.webhook_url?.trim()
                       || `https://api.${tenant.slug}.aurabr.app/api/whatsapp/webhook`

    // Chama o orchestrator
    const resp = await fetch(`${orchUrl}/provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': orchKey },
      body: JSON.stringify({ instance_id, webhook_url }),
    })
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      return res.status(502).json({ error: `Aurazap respondeu ${resp.status}: ${txt.slice(0, 200)}` })
    }
    const data = await resp.json()
    // data esperado: { instance_id, base_url, api_key, session, webhook_url, ... }

    // Garante secrets gerados se ainda não existem
    const current = await getRawWhatsappConfig(req.params.slug)
    const newSecrets = {}
    if (!current.internal_api_key) newSecrets.internal_api_key = randomBytes(32).toString('base64url')
    if (!current.webhook_secret)   newSecrets.webhook_secret   = randomBytes(24).toString('base64url')

    await updateWhatsappConfig(req.params.slug, {
      instance_id: data.instance_id ?? instance_id,
      base_url:    data.base_url ?? null,
      api_key:     data.api_key ?? null,
      session:     data.session ?? 'default',
      ...newSecrets,
    })

    res.status(201).json({
      ok: true,
      provisioned: {
        instance_id: data.instance_id,
        base_url:    data.base_url,
        session:     data.session,
        webhook_url,
      },
      // Mostra secrets uma vez se foram gerados agora
      ...(Object.keys(newSecrets).length ? { secrets_generated: newSecrets } : {}),
    })
  } catch (err) {
    console.error('[master/tenants/:slug/whatsapp/provision]', err.message)
    res.status(500).json({ error: 'Erro ao provisionar: ' + err.message })
  }
})

masterTenantsRouter.patch('/:slug/status', async (req, res) => {
  const { status, reason } = req.body

  if (!status || !VALID_STATUSES.includes(status.toUpperCase())) {
    return res.status(400).json({
      error: `Status inválido. Valores aceitos: ${VALID_STATUSES.join(', ')}.`,
    })
  }

  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: req.params.slug } })
    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado.' })

    const newStatus = status.toUpperCase()

    /* Cancela assinatura no Pagar.me se estiver cancelando o tenant */
    if (newStatus === 'CANCELLED' && tenant.pagarmeSubscriptionId) {
      cancelSubscription(tenant.pagarmeSubscriptionId)
        .then(() => console.log(`[master/tenants] Sub Pagar.me cancelada: ${tenant.pagarmeSubscriptionId}`))
        .catch(e  => console.error('[master/tenants] Erro ao cancelar sub Pagar.me:', e.message))
    }

    const updated = await prisma.tenant.update({
      where:  { slug: req.params.slug },
      data:   { status: newStatus, updatedAt: new Date() },
      select: { id: true, slug: true, name: true, status: true, updatedAt: true },
    })

    console.log(`[master/tenants] Status: ${req.params.slug} → ${newStatus}${reason ? ` | Motivo: ${reason}` : ''}`)

    res.json({ message: 'Status atualizado.', tenant: updated })
  } catch (err) {
    console.error('[master/tenants/:slug/status PATCH]', err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})
