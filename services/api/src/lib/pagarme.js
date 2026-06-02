/**
 * lib/pagarme.js
 * Integração com Pagar.me v5 API
 *
 * Funções expostas:
 *   createCustomer(data)
 *   createSubscription(data)
 *   cancelSubscription(subId)
 *   updateSubscriptionPlan(subId, newPlanId)
 *   getSubscription(subId)
 *   validateWebhookSignature(rawBody, sig)
 *
 * Env vars:
 *   PAGARME_API_KEY         — chave secreta sk_live_... ou sk_test_...
 *   PAGARME_WEBHOOK_SECRET  — secret HMAC configurado no dashboard
 *
 * Docs: https://docs.pagar.me/reference
 */

import crypto from 'crypto'

const BASE_URL = 'https://api.pagar.me/core/v5'

function getApiKey() {
  const key = process.env.PAGARME_API_KEY
  if (!key) throw new Error('PAGARME_API_KEY não definido.')
  return key
}

function getWebhookSecret() {
  const s = process.env.PAGARME_WEBHOOK_SECRET
  if (!s) throw new Error('PAGARME_WEBHOOK_SECRET não definido.')
  return s
}

/* ── Requisição base ──────────────────────────────────────── */

async function pagarmeRequest(method, path, body = null) {
  const apiKey = getApiKey()
  const auth   = Buffer.from(`${apiKey}:`).toString('base64')

  const opts = {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type':  'application/json',
      'Accept':        'application/json',
    },
  }
  if (body) opts.body = JSON.stringify(body)

  let res, data
  try {
    res  = await fetch(`${BASE_URL}${path}`, opts)
    data = await res.json()
  } catch (err) {
    throw new Error(`Pagar.me network error: ${err.message}`)
  }

  if (!res.ok) {
    const msg = data?.message
      ?? data?.errors?.[0]?.message
      ?? `Pagar.me HTTP ${res.status}`
    const err    = new Error(msg)
    err.status   = res.status
    err.pagarme  = data
    throw err
  }

  return data
}

/* ── Customer ─────────────────────────────────────────────── */

/**
 * Cria customer no Pagar.me.
 *
 * @param {Object} data
 * @param {string} data.name
 * @param {string} data.email
 * @param {string} [data.document]  CPF/CNPJ sem máscara
 * @param {string} [data.type]      'individual' | 'company'
 * @param {string} [data.phone]     ex: +5511999999999
 */
export async function createCustomer({ name, email, document, type = 'company', phone }) {
  const payload = { name, email, type }

  if (document) payload.document = document

  if (phone) {
    // Normalizar: remover +55, extrair DDD e número
    const digits = phone.replace(/\D/g, '')
    const withoutCC = digits.startsWith('55') ? digits.slice(2) : digits
    const areaCode  = withoutCC.slice(0, 2)
    const number    = withoutCC.slice(2)
    payload.phones  = {
      mobile_phone: { country_code: '55', area_code: areaCode, number },
    }
  }

  return pagarmeRequest('POST', '/customers', payload)
}

/* ── Subscription ─────────────────────────────────────────── */

/**
 * Cria assinatura recorrente mensal.
 *
 * @param {Object} data
 * @param {string} data.customerId       ID do customer Pagar.me
 * @param {string} data.planCode         nome do plano ('starter', 'pro', 'full')
 * @param {number|string} data.priceMonthly  valor em reais (ex: 297 ou "297.00")
 * @param {string} data.tenantSlug       usado como metadata
 * @param {Object} [data.card]           dados do cartão para credit_card
 * @param {string} [data.paymentMethod]  'credit_card' | 'boleto' (default 'boleto')
 */
export async function createSubscription({
  customerId,
  planCode,
  priceMonthly,
  tenantSlug,
  card,
  paymentMethod = 'boleto',
}) {
  const priceReais     = parseFloat(String(priceMonthly))
  const priceCentavos  = Math.round(priceReais * 100)

  const trialDays = parseInt(process.env.TRIAL_DAYS ?? '14', 10)
  const startAt   = new Date()
  startAt.setDate(startAt.getDate() + trialDays)

  const payload = {
    customer_id:    customerId,
    payment_method: paymentMethod,
    currency:       'BRL',
    interval:       'month',
    interval_count: 1,
    billing_type:   'prepaid',
    start_at:       startAt.toISOString(),
    items: [
      {
        description:   `Aura Platform — Plano ${planCode}`,
        quantity:      1,
        pricing_scheme: {
          scheme_type: 'unit',
          price:       priceCentavos,
        },
      },
    ],
    metadata: {
      tenant_slug:   tenantSlug,
      plan_code:     planCode,
      source:        'aura-platform',
    },
  }

  if (paymentMethod === 'credit_card' && card) {
    payload.card = card
  }

  return pagarmeRequest('POST', '/subscriptions', payload)
}

/**
 * Cancela assinatura.
 */
export async function cancelSubscription(subscriptionId) {
  return pagarmeRequest('DELETE', `/subscriptions/${subscriptionId}`)
}

/**
 * Busca assinatura pelo ID.
 */
export async function getSubscription(subscriptionId) {
  return pagarmeRequest('GET', `/subscriptions/${subscriptionId}`)
}

/**
 * Atualiza item de preço da assinatura (upgrade/downgrade).
 * Busca o item atual e atualiza o price.
 *
 * @param {string} subscriptionId  ID da assinatura no Pagar.me
 * @param {string} newPlanCode     nome do novo plano
 * @param {number} newPrice        novo preço em reais
 */
export async function updateSubscriptionPlan(subscriptionId, newPlanCode, newPrice) {
  // Busca assinatura para pegar item ID
  const sub    = await getSubscription(subscriptionId)
  const itemId = sub.items?.[0]?.id
  if (!itemId) throw new Error('Item da assinatura não encontrado.')

  const priceCentavos = Math.round(parseFloat(String(newPrice)) * 100)

  // Atualiza item
  await pagarmeRequest('PUT', `/subscriptions/${subscriptionId}/items/${itemId}`, {
    description:    `Aura Platform — Plano ${newPlanCode}`,
    quantity:       1,
    pricing_scheme: {
      scheme_type: 'unit',
      price:       priceCentavos,
    },
  })

  return pagarmeRequest('GET', `/subscriptions/${subscriptionId}`)
}

/* ── Webhook ──────────────────────────────────────────────── */

/**
 * Valida assinatura HMAC-SHA256 do webhook Pagar.me.
 * Header enviado: x-hub-signature: sha256=<hex>
 *
 * @param {Buffer|string} rawBody   body bruto (antes de JSON.parse)
 * @param {string}        signature valor do header x-hub-signature
 * @returns {boolean}
 */
export function validateWebhookSignature(rawBody, signature) {
  try {
    const secret = getWebhookSecret()
    if (!signature?.startsWith('sha256=')) return false

    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')

    const received = signature.slice('sha256='.length)

    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(received,  'hex')
    )
  } catch {
    return false
  }
}

/**
 * Gera a string de assinatura esperada (útil para debug/teste).
 */
export function signWebhookPayload(rawBody) {
  const secret = getWebhookSecret()
  const sig = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
  return `sha256=${sig}`
}
