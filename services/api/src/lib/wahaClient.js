/**
 * lib/wahaClient.js
 *
 * Cliente compartilhado para o WAHA do tenant.
 * Lê configuração do aura_master.tenants.whatsapp_config (não mais da settings).
 *
 * Cache 60s para não bater no Postgres em cada request.
 * Fallback para env vars WAHA_URL / WAHA_API_KEY / WAHA_SESSION (legado/dev).
 *
 * Usado por:
 *  - routes/whatsapp.js    — operações autenticadas (admin/operador)
 *  - routes/whatsappWebhook.js — webhook público vindo do WAHA
 *  - lib/notifyWorker.js   — worker que envia notificações de status
 */

import { prismaMaster } from './prisma-master.js'

const TENANT_SLUG = process.env.TENANT_SLUG
const CFG_TTL     = 60_000

let _cfgCache    = null
let _cfgCachedAt = 0

export async function getWahaConfig() {
  const now = Date.now()
  if (_cfgCache && (now - _cfgCachedAt) < CFG_TTL) return _cfgCache

  let db = {}
  if (TENANT_SLUG) {
    try {
      const rows = await prismaMaster.$queryRaw`
        SELECT whatsapp_config FROM tenants WHERE slug = ${TENANT_SLUG} LIMIT 1
      `
      db = rows[0]?.whatsapp_config ?? {}
    } catch (err) {
      console.error('[wahaClient.getConfig]', err.message)
    }
  }

  _cfgCache = {
    url:             db.base_url        || process.env.WAHA_URL     || '',
    apiKey:          db.api_key         || process.env.WAHA_API_KEY || '',
    session:         db.session         || process.env.WAHA_SESSION || 'default',
    instance_id:     db.instance_id     || null,
    processor:       db.processor       || 'none',
    dify_api_url:    db.dify_api_url    || null,
    dify_api_key:    db.dify_api_key    || null,
    dify_app_id:     db.dify_app_id     || null,
    n8n_webhook_url: db.n8n_webhook_url || null,
    custom_url:      db.custom_url      || null,
    approver_phone:  db.approver_phone  || null,
    internal_api_key: db.internal_api_key || null,
    webhook_secret:   db.webhook_secret   || null,
  }
  _cfgCachedAt = now
  return _cfgCache
}

export function invalidateWahaCache() {
  _cfgCache    = null
  _cfgCachedAt = 0
}

/* ── Helper HTTP para o WAHA ── */
export async function waha(path, opts = {}) {
  const cfg = await getWahaConfig()
  if (!cfg.url) throw new Error('WhatsApp não configurado para este tenant')
  const res = await fetch(`${cfg.url}/api/${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': cfg.apiKey,
      ...(opts.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`WAHA ${res.status}: ${body.slice(0, 200)}`)
  }
  return res
}

export async function wahaJson(path, opts = {}) {
  const res = await waha(path, opts)
  return res.json()
}

/* Normaliza número → chatId WAHA */
export function toChatId(to) {
  if (!to) throw new Error('Número vazio')
  if (String(to).includes('@')) return String(to)
  const digits = String(to).replace(/\D/g, '')
  if (!digits) throw new Error('Número inválido')
  return `${digits}@c.us`
}

/* Extrai número do chatId (5561999@c.us → 5561999) */
export function fromChatId(chatId) {
  if (!chatId) return ''
  return String(chatId).split('@')[0].replace(/\D/g, '')
}

/* Envia mensagem de texto */
export async function sendText(toPhoneOrChatId, message) {
  const cfg = await getWahaConfig()
  return wahaJson('sendText', {
    method: 'POST',
    body: JSON.stringify({
      chatId:  toChatId(toPhoneOrChatId),
      text:    String(message),
      session: cfg.session,
    }),
  })
}
