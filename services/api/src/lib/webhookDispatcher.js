/**
 * lib/webhookDispatcher.js — Aura Platform
 *
 * Dispara eventos para URLs registradas via HMAC-SHA256.
 * Chamado após: order.created, order.status_changed, inventory.low, payment.received
 *
 * Fluxo:
 *  1. Busca webhooks ativos do tenant no banco master
 *  2. Filtra pelos que assinaram o evento
 *  3. Assina o payload com HMAC-SHA256 usando o secret de cada webhook
 *  4. Dispara HTTP POST para cada URL em paralelo (fire & forget)
 *  5. Registra resultado (success/failure) em webhook_deliveries
 *
 * Cabeçalhos enviados:
 *  X-Aura-Signature: sha256=<hmac>
 *  X-Aura-Event:     order.created
 *  X-Aura-Tenant:    acme
 *  X-Aura-Delivery:  <uuid>
 */

import crypto   from 'crypto'
import pg       from 'pg'

const { Pool } = pg

const MASTER_DB_URL = process.env.MASTER_DB_URL
const MAX_RETRIES   = 3
const TIMEOUT_MS    = 10_000

let _masterPool = null
function getMasterPool() {
  if (!_masterPool) _masterPool = new Pool({ connectionString: MASTER_DB_URL, max: 3 })
  return _masterPool
}

/**
 * dispatch — envia evento para todos os webhooks ativos do tenant
 *
 * @param {string} tenantSlug    — slug do tenant (acme, forroplastic...)
 * @param {string} eventType     — 'order.created' | 'order.status_changed' | 'inventory.low' | 'payment.received'
 * @param {object} payload       — dados do evento
 */
export async function dispatch(tenantSlug, eventType, payload) {
  // Sempre async — nunca bloqueia a resposta HTTP
  _dispatch(tenantSlug, eventType, payload).catch(e =>
    console.error(`[webhook] dispatch error ${tenantSlug}/${eventType}:`, e.message)
  )
}

async function _dispatch(tenantSlug, eventType, payload) {
  const pool = getMasterPool()

  // Buscar webhooks ativos para este tenant e evento
  const { rows: webhooks } = await pool.query(`
    SELECT w.id, w.url, w.secret
    FROM webhooks w
    JOIN tenants t ON t.slug = $1 AND t.id = w.tenant_id
    WHERE w.active = true
      AND $2 = ANY(w.events)
  `, [tenantSlug, eventType])

  if (!webhooks.length) return

  const body = JSON.stringify({
    event:     eventType,
    tenant:    tenantSlug,
    timestamp: new Date().toISOString(),
    data:      payload,
  })

  await Promise.allSettled(webhooks.map(wh => sendWebhook(wh, eventType, tenantSlug, body)))
}

async function sendWebhook(webhook, eventType, tenantSlug, body, attempt = 1) {
  const deliveryId = crypto.randomUUID()
  const sig = 'sha256=' + crypto.createHmac('sha256', webhook.secret).update(body).digest('hex')

  const start = Date.now()
  let statusCode = null
  let error = null

  try {
    const resp = await fetch(webhook.url, {
      method:  'POST',
      headers: {
        'Content-Type':     'application/json',
        'Content-Length':   String(Buffer.byteLength(body)),
        'X-Aura-Signature': sig,
        'X-Aura-Event':     eventType,
        'X-Aura-Tenant':    tenantSlug,
        'X-Aura-Delivery':  deliveryId,
        'User-Agent':       'AuraWebhook/1.0',
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    statusCode = resp.status
    if (!resp.ok) error = `HTTP ${resp.status}`
  } catch (e) {
    error = e.message
  }

  const latency = Date.now() - start
  const success = statusCode >= 200 && statusCode < 300

  // Registrar entrega (sem bloquear)
  getMasterPool().query(`
    INSERT INTO webhook_deliveries
      (id, webhook_id, event, status_code, success, error, latency_ms, attempt, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
    ON CONFLICT DO NOTHING
  `, [deliveryId, webhook.id, eventType, statusCode, success, error, latency, attempt]).catch(() => {})

  // Retry com backoff exponencial (até MAX_RETRIES)
  if (!success && attempt < MAX_RETRIES) {
    const delay = 1000 * Math.pow(2, attempt) // 2s, 4s
    await new Promise(r => setTimeout(r, delay))
    return sendWebhook(webhook, eventType, tenantSlug, body, attempt + 1)
  }

  if (!success) {
    console.warn(`[webhook] ❌ ${webhook.url} → ${error ?? statusCode} (${attempt} tentativas)`)
  }
}

/**
 * ensureSchema — cria tabela webhook_deliveries se não existir
 */
export async function ensureWebhookSchema() {
  await getMasterPool().query(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      tenant_id  TEXT NOT NULL,
      url        TEXT NOT NULL,
      events     TEXT[] NOT NULL,
      secret     TEXT NOT NULL,
      active     BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id          TEXT PRIMARY KEY,
      webhook_id  TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
      event       TEXT NOT NULL,
      status_code INT,
      success     BOOLEAN NOT NULL DEFAULT false,
      error       TEXT,
      latency_ms  INT,
      attempt     INT NOT NULL DEFAULT 1,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_wh_deliveries_webhook ON webhook_deliveries(webhook_id);
    CREATE INDEX IF NOT EXISTS idx_wh_deliveries_event   ON webhook_deliveries(event);
    CREATE INDEX IF NOT EXISTS idx_wh_deliveries_created ON webhook_deliveries(created_at);
  `).catch(() => {})
}
