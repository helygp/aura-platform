/**
 * services/api/src/index.js
 * Entry-point da API Aura Platform.
 * Sprint 4 — Tarefa 3: Integração Pagar.me + webhook /billing/webhook
 */

import express      from 'express'
import helmet       from 'helmet'
import cors         from 'cors'
import cookieParser from 'cookie-parser'
import rateLimit    from 'express-rate-limit'

import { ENV, IS_PROD } from './lib/env.js'

/* ─── Rotas ERP ─── */
import { authRouter }      from './routes/auth.js'
import { tenantRouter }    from './routes/tenant.js'
import { dashboardRouter } from './routes/dashboard.js'
import { productsRouter }       from './routes/products.js'
import { productsImportRouter } from './routes/productsImport.js'
import { productAttributesRouter }  from './routes/productAttributes.js'
import { productCategoriesRouter }  from './routes/productCategories.js'
import { separationSheetRouter }     from './routes/separationSheet.js'
import { orderDraftsRouter }         from './routes/orderDrafts.js'
import { inventoryRouter } from './routes/inventory.js'
import { ordersRouter }    from './routes/orders.js'
import { customersRouter } from './routes/customers.js'
import { usersRouter }     from './routes/users.js'
import { whatsappRouter }  from './routes/whatsapp.js'
import { agentRouter }     from './routes/agent.js'
import { whatsappWebhookRouter } from './routes/whatsappWebhook.js'
import { reportsRouter }    from './routes/reports.js'
import { walletRouter }     from './routes/wallet.js'

/* ─── Rotas Store ─── */
import { storeTenantRouter }     from './routes/store/tenant.js'
import { storeCatalogRouter }    from './routes/store/catalog.js'
import { storeOrdersRouter }     from './routes/store/orders.js'
import { storeAuthRouter }       from './routes/store/auth.js'
import { storeTenantMiddleware } from './middleware/storeTenant.js'

/* ─── Rotas Master + Webhook ─── */
import { masterRouter, billingWebhookRouter } from './routes/master/index.js'
import { onboardingRouter } from './routes/onboarding.js'
import { ensureWebhookSchema } from './lib/webhookDispatcher.js'
import { startBillingJobs } from './lib/billingJobs.js'
import { startNotifyWorker } from './lib/notifyWorker.js'

const app = express()

/* ─────────────────────────────────────────────────────────────────────────────
 * Segurança base
 * ───────────────────────────────────────────────────────────────────────────── */
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))
app.set('trust proxy', IS_PROD ? 1 : 0)

/* ─────────────────────────────────────────────────────────────────────────────
 * CORS
 * ───────────────────────────────────────────────────────────────────────────── */
const erpOrigins = ENV.CORS_ORIGINS

function isStoreOrigin(origin) {
  if (!origin) return false
  if (!IS_PROD) return true
  return /^https:\/\/loja\.[a-z0-9-]+\.aurabr\.app$/.test(origin)
}

function isMasterOrigin(origin) {
  if (!origin) return false
  if (!IS_PROD) return true
  return /^https:\/\/master\.aurabr\.app$/.test(origin)
}

app.use((req, res, next) => {
  const origin   = req.headers.origin ?? ''
  const isStore      = req.path.startsWith('/store/')
  const isMaster     = req.path.startsWith('/master/')
  const isOnboarding = req.path.startsWith('/onboarding')

  cors({
    origin: isMaster
      ? (o, cb) => cb(null, isMasterOrigin(o ?? ''))
      : isOnboarding
        ? (o, cb) => cb(null, !IS_PROD || /^https:\/\/(www.)?aurabr.app$/.test(o ?? ''))
        : isStore
          ? (o, cb) => cb(null, isStoreOrigin(o ?? ''))
          : erpOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })(req, res, next)
})

/* ─────────────────────────────────────────────────────────────────────────────
 * ⚠️  WEBHOOK Pagar.me — DEVE ser montado ANTES do express.json()
 *     O Pagar.me assina o body raw; se o express.json() processar primeiro
 *     a assinatura HMAC não bate mais.
 * ───────────────────────────────────────────────────────────────────────────── */
app.use(
  '/billing/webhook',
  express.raw({ type: 'application/json' }),
  billingWebhookRouter
)

/* ─────────────────────────────────────────────────────────────────────────────
 * Parse (JSON para todas as outras rotas)
 * ───────────────────────────────────────────────────────────────────────────── */
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())

/* ─────────────────────────────────────────────────────────────────────────────
 * Rate limiting
 * ───────────────────────────────────────────────────────────────────────────── */
app.use(rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em 1 minuto.' },
}))

// Auth ERP
const erpAuthLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: IS_PROD ? 10 : 1000,
  message: { error: 'Muitas tentativas de login. Aguarde 15 minutos.' },
})
app.use('/auth/login',   erpAuthLimiter)
app.use('/auth/refresh', erpAuthLimiter)

// Master
const masterLimiter = rateLimit({
  windowMs: 60_000,
  max: IS_PROD ? 60 : 10000,
  message: { error: 'Muitas requisições master. Aguarde 1 minuto.' },
})
app.use('/master', masterLimiter)

// Auth loja
// Onboarding público — restritivo para prevenir spam
const onboardingLimiter = rateLimit({
  windowMs: 60 * 60_000,  // 1 hora
  max:      IS_PROD ? 5 : 1000,
  message:  { error: 'Muitas tentativas de cadastro. Aguarde antes de tentar novamente.' },
})

const storeAuthLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: IS_PROD ? 15 : 1000,
  keyGenerator: (req) => `${req.headers['x-tenant-slug'] ?? 'unknown'}:${req.ip}`,
  message: { error: 'Muitas tentativas. Aguarde 15 minutos.' },
})
app.use('/store/auth/login',    storeAuthLimiter)
app.use('/store/auth/register', storeAuthLimiter)
app.use('/store/auth/refresh',  storeAuthLimiter)

// Pedidos loja
app.use('/store/orders', rateLimit({
  windowMs: 60_000,
  max: IS_PROD ? 10 : 1000,
  keyGenerator: (req) => `${req.headers['x-tenant-slug'] ?? 'unknown'}:${req.ip}`,
  message: { error: 'Muitas requisições. Tente novamente em 1 minuto.' },
}))

// Catálogo loja
app.use('/store/catalog', rateLimit({
  windowMs: 60_000,
  max: IS_PROD ? 300 : 10000,
  keyGenerator: (req) => `${req.headers['x-tenant-slug'] ?? 'unknown'}:${req.ip}`,
  message: { error: 'Muitas requisições. Tente novamente em 1 minuto.' },
}))

/* ─────────────────────────────────────────────────────────────────────────────
 * Rotas Master  (x-master-secret)
 * ───────────────────────────────────────────────────────────────────────────── */
app.use('/master',     masterRouter)
app.use('/onboarding', onboardingLimiter, onboardingRouter)

/* ─────────────────────────────────────────────────────────────────────────────
 * Rotas ERP  (JWT + RBAC)
 * ───────────────────────────────────────────────────────────────────────────── */
app.use('/auth',          authRouter)
app.use('/api/tenant',    tenantRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/products/import', productsImportRouter)
app.use('/api/product-attributes', productAttributesRouter)
app.use('/api/product-categories', productCategoriesRouter)
app.use('/api/orders/separation-sheet', separationSheetRouter)
app.use('/api/orders/drafts',           orderDraftsRouter)
app.use('/api/products',  productsRouter)
app.use('/api/inventory', inventoryRouter)
app.use('/api/orders',    ordersRouter)
app.use('/api/customers', customersRouter)
app.use('/api/users',     usersRouter)
// Webhook publico (sem auth) — DEVE vir ANTES do whatsappRouter autenticado
app.use('/api/whatsapp/webhook', whatsappWebhookRouter)
app.use('/api/whatsapp',  whatsappRouter)
app.use('/api/agent',     agentRouter)
app.use('/api/reports',   reportsRouter)
app.use('/api/wallet',    walletRouter)
app.use('/master',         masterRouter)
app.use('/store/auth',     storeAuthRouter)
app.use('/store/catalog',  storeCatalogRouter)
app.use('/store/orders',   storeOrdersRouter)
app.use('/store/tenant',   storeTenantRouter)

/* ─────────────────────────────────────────────────────────────────────────────
 * Rotas Store  (storeTenantMiddleware)
 * ───────────────────────────────────────────────────────────────────────────── */
app.use('/store', storeTenantMiddleware)
app.use('/store/tenant',  storeTenantRouter)
app.use('/store/catalog', storeCatalogRouter)
app.use('/store/auth',    storeAuthRouter)
app.use('/store/orders',  storeOrdersRouter)

/* ─────────────────────────────────────────────────────────────────────────────
 * Health check
 * ───────────────────────────────────────────────────────────────────────────── */
app.get('/health', (_, res) => res.json({
  status: 'ok',
  ts:     Date.now(),
  env:    ENV.NODE_ENV,
}))

/* ─────────────────────────────────────────────────────────────────────────────
 * Error handlers
 * ───────────────────────────────────────────────────────────────────────────── */
app.use((_, res) => res.status(404).json({ error: 'Rota não encontrada.' }))
app.use((err, req, res, _next) => {
  console.error('[unhandled]', err)
  res.status(500).json({ error: 'Erro interno do servidor.' })
})

/* ─────────────────────────────────────────────────────────────────────────────
 * Start
 * ───────────────────────────────────────────────────────────────────────────── */
/* Inicia jobs recorrentes de billing (trial_ending check 1x/dia) */

startBillingJobs()
startNotifyWorker()
ensureWebhookSchema().catch(e => console.warn('[webhooks] schema warn:', e.message))

app.listen(ENV.PORT, () => {
  console.log(`API Aura rodando na porta ${ENV.PORT} [${ENV.NODE_ENV}]`)
  if (!ENV.PAGARME_API_KEY) {
    console.warn('⚠️  PAGARME_API_KEY não definida — integração Pagar.me desativada.')
  }
  if (!ENV.MASTER_SECRET) {
    console.warn('⚠️  MASTER_SECRET não definida — rotas /master/* responderão 503.')
  }
})

export default app
