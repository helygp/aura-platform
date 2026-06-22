/**
 * routes/whatsapp.js
 *
 * Integração direta com o WAHA do tenant.
 * Cada tenant tem sua própria instância WAHA — isolamento total.
 *
 * Configuração dinâmica via DB (settings key: whatsapp_config).
 * Fallback para env vars WAHA_URL / WAHA_API_KEY / WAHA_SESSION.
 * Cache em memória de 60s para não bater o banco em cada request.
 *
 * GET  /api/whatsapp/session        — status da sessão
 * POST /api/whatsapp/session/start  — inicia/reconecta sessão
 * POST /api/whatsapp/session/stop   — para sessão
 * GET  /api/whatsapp/qr             — QR code (base64 PNG)
 * POST /api/whatsapp/send           — envio manual
 * GET  /api/whatsapp/orders         — fila de aprovação bot
 * PUT  /api/whatsapp/orders/:id     — aprovar/recusar pedido
 * GET  /api/whatsapp/messages       — histórico de conversas
 */

import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize }    from '../middleware/authorize.js'
import { query }        from '../lib/tenantDb.js'

export const whatsappRouter = Router()
whatsappRouter.use(authenticate)
whatsappRouter.use(authorize('admin', 'operador'))

/* ── Config dinâmica com cache 60s ── */
let _cfgCache    = null
let _cfgCachedAt = 0
const CFG_TTL    = 60_000

async function getWahaConfig() {
  const now = Date.now()
  if (_cfgCache && (now - _cfgCachedAt) < CFG_TTL) return _cfgCache
  try {
    const { rows } = await query("SELECT value FROM settings WHERE key='whatsapp_config'")
    const db = rows[0]?.value ?? {}
    _cfgCache = {
      url:     db.url     || process.env.WAHA_URL     || '',
      apiKey:  db.apiKey  || process.env.WAHA_API_KEY || '',
      session: db.session || process.env.WAHA_SESSION || 'default',
    }
  } catch {
    _cfgCache = {
      url:     process.env.WAHA_URL     || '',
      apiKey:  process.env.WAHA_API_KEY || '',
      session: process.env.WAHA_SESSION || 'default',
    }
  }
  _cfgCachedAt = now
  return _cfgCache
}

/* Invalida o cache (chamado após salvar nova config via UI) */
export function invalidateWahaCache() { _cfgCache = null; _cfgCachedAt = 0 }

/* ── Helper HTTP para o WAHA ── */
async function waha(path, opts = {}) {
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

async function wahaJson(path, opts = {}) {
  const res = await waha(path, opts)
  return res.json()
}

/* Normaliza número → chatId WAHA */
function toChatId(to) {
  if (to.includes('@')) return to
  const digits = to.replace(/\D/g, '')
  if (!digits) throw new Error('Número inválido')
  return `${digits}@c.us`
}

/* ── GET /api/whatsapp/session ── */
whatsappRouter.get('/session', async (req, res) => {
  try {
    const { session } = await getWahaConfig()
    const data = await wahaJson(`sessions/${session}`)
    res.json({
      status: data.status,
      phone:  data.me?.id?.split('@')[0] ?? null,
      name:   data.me?.pushName ?? null,
    })
  } catch (_e) {
    res.json({ status: 'STOPPED', phone: null, name: null })
  }
})

/* ── POST /api/whatsapp/session/start ── */
whatsappRouter.post('/session/start', async (req, res) => {
  try {
    const { session } = await getWahaConfig()
    const data = await wahaJson(
      `sessions/${session}/restart`,
      { method: 'POST', body: '{}' }
    )
    res.json({ ok: true, status: data.status ?? 'STARTING' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/* ── POST /api/whatsapp/session/stop ── */
whatsappRouter.post('/session/stop', async (req, res) => {
  try {
    const { session } = await getWahaConfig()
    await waha(`sessions/${session}/stop`, { method: 'POST', body: '{}' })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/* ── GET /api/whatsapp/qr ── */
whatsappRouter.get('/qr', async (req, res) => {
  try {
    const { session } = await getWahaConfig()
    const r = await waha(`${session}/auth/qr`)
    const buf = await r.arrayBuffer()
    const b64 = Buffer.from(buf).toString('base64')
    res.json({ qr: 'data:image/png;base64,' + b64 })
  } catch (e) {
    res.status(503).json({ error: e.message })
  }
})

/* ── POST /api/whatsapp/send ── */
whatsappRouter.post('/send', async (req, res) => {
  try {
    const { to, message } = req.body
    if (!to || !message) {
      return res.status(400).json({ error: 'to e message são obrigatórios' })
    }
    const { session } = await getWahaConfig()
    const data = await wahaJson('sendText', {
      method: 'POST',
      body: JSON.stringify({
        chatId:  toChatId(to),
        text:    message,
        session,
      }),
    })
    res.json({ ok: true, message_id: data.id ?? data._data?.id?._serialized })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/* ── GET /api/whatsapp/orders ── */
whatsappRouter.get('/orders', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        id,
        numero         AS "botOrderId",
        nome_cliente   AS "customerName",
        numero         AS "customerPhone",
        dados_pedido   AS "dados",
        resumo_texto   AS "resumo",
        status,
        created_at     AS "receivedAt"
      FROM fab_wha_fila
      ORDER BY created_at DESC
      LIMIT 50
    `)
    const orders = rows.map(r => ({
      id:            r.id,
      botOrderId:    r.botOrderId,
      customerName:  r.customerName  ?? r.customerPhone,
      customerPhone: r.customerPhone,
      items:         r.dados?.itens  ?? [],
      total:         r.dados?.total  ?? 0,
      status:        r.status === 'aguardando' ? 'PENDING_APPROVAL'
                   : r.status === 'aprovado'   ? 'APPROVED'
                   : 'REJECTED',
      receivedAt:    r.receivedAt,
    }))
    res.json({ orders })
  } catch (_e) {
    res.json({ orders: [] })
  }
})

/* ── PUT /api/whatsapp/orders/:id ── */
whatsappRouter.put('/orders/:id', async (req, res) => {
  try {
    const { status } = req.body
    const dbStatus = status === 'APPROVED' ? 'aprovado' : 'recusado'
    await query(
      `UPDATE fab_wha_fila SET status=$1, resolvido_at=now() WHERE id=$2`,
      [dbStatus, req.params.id]
    )
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/* ── GET /api/whatsapp/messages ── */
whatsappRouter.get('/messages', async (req, res) => {
  try {
    const { session } = await getWahaConfig()
    const data = await wahaJson(`${session}/chats?limit=30`)
    const chats = Array.isArray(data) ? data : (data.chats ?? [])
    const messages = chats.map((c, i) => ({
      id:          `chat-${i}`,
      from:        'customer',
      text:        c.lastMessage?.body ?? '',
      phone:       c.id?.split('@')[0] ?? '',
      contactName: c.name ?? c.id?.split('@')[0] ?? '',
      at:          c.lastMessage?.timestamp
                   ? new Date(c.lastMessage.timestamp * 1000).toISOString()
                   : new Date().toISOString(),
    }))
    res.json({ messages })
  } catch (_e) {
    res.json({ messages: [] })
  }
})
