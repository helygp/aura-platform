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
import {
  getWahaConfig,
  invalidateWahaCache as _invalidateCache,
  waha,
  wahaJson,
  toChatId,
} from '../lib/wahaClient.js'

export const whatsappRouter = Router()
whatsappRouter.use(authenticate)
whatsappRouter.use(authorize('admin', 'operador'))

// Re-exporta para compatibilidade com chamadas externas
export const invalidateWahaCache = _invalidateCache

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
    const code = /n[ãa]o configurad/i.test(e.message) ? 503 : 500
    res.status(code).json({ error: e.message })
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
/* Retorna lista de bot_orders + conversation. Status mapeado para o frontend. */
whatsappRouter.get('/orders', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        id,
        bot_order_id          AS "botOrderId",
        customer_name         AS "customerName",
        customer_phone        AS "customerPhone",
        items,
        total,
        conversation,
        dify_conversation_id  AS "difyConversationId",
        agent_metadata        AS "agentMetadata",
        status,
        received_at           AS "receivedAt",
        reviewed_at           AS "reviewedAt",
        reviewed_by           AS "reviewedBy",
        order_id              AS "orderId"
      FROM bot_orders
      ORDER BY received_at DESC
      LIMIT 100
    `)
    const orders = rows.map(r => ({
      id:            r.id,
      botOrderId:    r.botOrderId,
      customerName:  r.customerName ?? r.customerPhone,
      customerPhone: r.customerPhone,
      items:         (Array.isArray(r.items) ? r.items : []).map(it => ({
        productName: it.name ?? it.product_name ?? 'Item',
        sku:         it.sku_code ?? it.sku ?? null,
        attributes:  it.attributes ?? {},
        qty:         Number(it.quantity ?? it.qty ?? 1),
        priceUnit:   Number(it.price ?? it.price_unit ?? 0),
      })),
      total:         Number(r.total),
      conversation: Array.isArray(r.conversation) ? r.conversation : [],
      difyConversationId: r.difyConversationId,
      agentMetadata: r.agentMetadata ?? {},
      status:        r.status === 'pending_approval' ? 'PENDING_APPROVAL'
                   : r.status === 'approved'         ? 'APPROVED'
                   : r.status === 'rejected'         ? 'REJECTED'
                   : r.status?.toUpperCase(),
      receivedAt:    r.receivedAt,
      reviewedAt:    r.reviewedAt,
      reviewedBy:    r.reviewedBy,
      orderId:       r.orderId,
    }))
    res.json({ orders })
  } catch (err) {
    console.error('[whatsapp/orders GET]', err.message)
    res.json({ orders: [] })
  }
})

/* ── PUT /api/whatsapp/orders/:id ── */
/* Aprova ou rejeita um bot_order. Em caso de APPROVED, dispara conversao para orders. */
whatsappRouter.put('/orders/:id', async (req, res) => {
  try {
    const { status, note } = req.body ?? {}
    const targetStatus = status === 'APPROVED' ? 'approved'
                       : status === 'REJECTED' ? 'rejected'
                       : null
    if (!targetStatus) return res.status(400).json({ error: 'status deve ser APPROVED ou REJECTED' })

    const reviewer = req.user?.email ?? req.user?.name ?? 'erp-user'

    // Atualiza status do bot_order
    const { rows } = await query(`
      UPDATE bot_orders
      SET status=$1, reviewed_at=now(), reviewed_by=$2
      WHERE id=$3 OR bot_order_id=$3
      RETURNING id, bot_order_id, customer_name, customer_phone, items, total, status, order_id
    `, [targetStatus, reviewer, req.params.id])

    if (!rows[0]) return res.status(404).json({ error: 'Pedido não encontrado' })
    const botOrder = rows[0]

    let conversion = null
    if (targetStatus === 'approved' && !botOrder.order_id) {
      // Converte para orders + order_items
      try {
        const { convertBotOrderToOrder } = await import('../lib/botOrderConvert.js')
        conversion = await convertBotOrderToOrder(botOrder, reviewer)
      } catch (err) {
        console.error('[whatsapp/orders PUT convert]', err.message)
        // Aprovou mas conversão falhou — retorna ok parcial
        return res.status(207).json({
          ok: true,
          warning: 'Pedido marcado como aprovado, mas falhou ao criar no ERP: ' + err.message,
        })
      }
    }

    // Notifica cliente (sem await — não bloqueia)
    if (botOrder.customer_phone) {
      const msg = targetStatus === 'approved'
        ? `Olá ${botOrder.customer_name}! Seu pedido foi aprovado e está em produção.`
        : `Olá ${botOrder.customer_name}, infelizmente seu pedido não foi aprovado. Em breve um atendente entra em contato.`
      // Import dinamico para evitar circular
      import('../lib/wahaClient.js').then(m =>
        m.sendText(botOrder.customer_phone, msg).catch(err =>
          console.error('[whatsapp/orders notify]', err.message))
      )
    }

    res.json({ ok: true, conversion })
  } catch (err) {
    console.error('[whatsapp/orders PUT]', err.message)
    res.status(500).json({ error: err.message })
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
