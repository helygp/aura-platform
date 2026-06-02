/**
 * routes/master/index.js
 * Agrega todas as rotas do painel master.
 *
 * Rotas montadas em /master:
 *   GET    /master/tenants
 *   GET    /master/tenants/:slug
 *   POST   /master/tenants           ← provisiona + Pagar.me
 *   PATCH  /master/tenants/:slug/status
 *   GET    /master/billing
 *   GET    /master/metrics
 *
 * Webhook montado em /billing/webhook no index.js principal
 * (precisa de express.raw — não pode estar dentro do /master com express.json já aplicado)
 */

import { Router } from 'express'
import { masterTenantsRouter } from './tenants.js'
import { masterBillingRouter } from './billing.js'
import { masterMetricsRouter } from './metrics.js'

export { billingWebhookRouter } from './webhook.js'

export const masterRouter = Router()

masterRouter.use('/tenants', masterTenantsRouter)
masterRouter.use('/billing', masterBillingRouter)
masterRouter.use('/metrics', masterMetricsRouter)
