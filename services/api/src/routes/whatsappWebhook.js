/**
 * routes/whatsappWebhook.js
 *
 * Webhook PÚBLICO que recebe eventos do WAHA.
 *
 * URL: POST /api/whatsapp/webhook (sem autenticação convencional)
 *
 * Segurança: validação por shared secret no header `X-Webhook-Secret`
 * (configurado em aura_master.tenants.whatsapp_config.webhook_secret).
 *
 * Eventos suportados:
 *   - message            — mensagem nova
 *   - message.ack        — recibo (ignorado por ora)
 *   - session.status     — mudança de estado da sessão
 *
 * Pipeline ao receber message:
 *   1. Valida secret
 *   2. Ignora mensagens de grupo, fromMe, status broadcast
 *   3. Detecta padrão APROVAR <num> / REJEITAR <num> (atalho aprovador)
 *      → atualiza bot_orders sem passar pelo dispatcher
 *   4. Dispatcher: dify | n8n | custom | none
 *   5. Envia resposta de volta via Aurazap send_text
 *
 * Erros NUNCA devolvem 5xx para o WAHA — sempre 200 com log interno
 * (caso contrário o WAHA tenta reentregar e gera loop).
 */

import { Router } from 'express'
import { query }  from '../lib/tenantDb.js'
import { getWahaConfig, fromChatId, sendText } from '../lib/wahaClient.js'
import { convertBotOrderToOrder } from '../lib/botOrderConvert.js'

export const whatsappWebhookRouter = Router()

/* ── Padrões de aprovação por WhatsApp ── */
const APPROVE_REGEX = /^\s*APROVAR\s+(?:#?BOT-?)?([A-Z0-9]{3,12})\s*$/i
const REJECT_REGEX  = /^\s*REJEITAR\s+(?:#?BOT-?)?([A-Z0-9]{3,12})\s*$/i

/* ── Helper: ack rápido e seguro ── */
function ackOk(res, extra = {}) {
  return res.status(200).json({ ok: true, ...extra })
}

/* ─────────────────────────────────────────────────────────────────────
   POST /api/whatsapp/webhook
   ───────────────────────────────────────────────────────────────────── */
whatsappWebhookRouter.post('/', async (req, res) => {
  // Sempre 200 — WAHA retry agressivo causa loops
  try {
    const cfg = await getWahaConfig()

    // Valida shared secret (se configurado)
    if (cfg.webhook_secret) {
      const provided = req.headers['x-webhook-secret']
      if (provided !== cfg.webhook_secret) {
        console.warn('[wpp/webhook] secret invalido')
        return ackOk(res, { ignored: 'invalid-secret' })
      }
    }

    const body  = req.body ?? {}
    const event = body.event ?? body.type ?? ''
    const data  = body.payload ?? body.data ?? body

    // Ignora eventos que não são mensagem nova
    if (event && !['message', 'message.any'].includes(event)) {
      return ackOk(res, { ignored: 'non-message' })
    }

    // Extrai dados da mensagem (formato WAHA padrão)
    const chatId    = data.from ?? data.chatId ?? data.chat_id
    const text      = (data.body ?? data.text ?? data.message ?? '').toString().trim()
    const fromMe    = Boolean(data.fromMe ?? data.from_me)
    const isGroup   = chatId?.includes('@g.us')
    const isStatus  = chatId === 'status@broadcast'
    const messageId = data.id ?? data.messageId ?? null

    if (fromMe || isGroup || isStatus || !chatId || !text) {
      return ackOk(res, { ignored: 'filtered' })
    }

    const senderPhone = fromChatId(chatId)
    if (!senderPhone) return ackOk(res, { ignored: 'no-phone' })

    /* ── 1. Atalho de aprovação por WhatsApp ─────────────────────────
       Detecta APROVAR / REJEITAR ANTES de chamar o dispatcher.
       Só processa se vier do número cadastrado como aprovador.
    */
    if (cfg.approver_phone && senderPhone.endsWith(cfg.approver_phone.slice(-10))) {
      const apprMatch = text.match(APPROVE_REGEX)
      const rejMatch  = text.match(REJECT_REGEX)
      if (apprMatch || rejMatch) {
        const ref     = (apprMatch ?? rejMatch)[1].toUpperCase()
        const decision = apprMatch ? 'APROVAR' : 'REJEITAR'
        await handleApproval(ref, decision, senderPhone)
          .catch(err => console.error('[wpp/webhook approval]', err.message))
        return ackOk(res, { handled: 'approval', ref, decision })
      }
    }

    /* ── 2. Dispatcher conforme processor configurado ───────────────── */
    const reply = await dispatch(cfg, { chatId, text, senderPhone, messageId, raw: data })
      .catch(err => {
        console.error('[wpp/webhook dispatch]', err.message)
        return null
      })

    /* ── 3. Envia resposta de volta ao cliente, se houver ───────────── */
    if (reply && typeof reply === 'string' && reply.trim()) {
      try {
        await sendText(chatId, reply.trim())
      } catch (err) {
        console.error('[wpp/webhook sendText]', err.message)
      }
    }

    return ackOk(res, { processor: cfg.processor })
  } catch (err) {
    console.error('[wpp/webhook] erro nao tratado:', err.message)
    return ackOk(res, { error: 'internal' })
  }
})

/* ─────────────────────────────────────────────────────────────────────
   Handle approval — APROVAR/REJEITAR <num>
   ───────────────────────────────────────────────────────────────────── */
async function handleApproval(ref, decision, approverPhone) {
  // Aceita BOT-XX, #BOT-XX, ou só o sufixo XX
  const variants = [ref, `BOT-${ref}`, ref.replace(/^BOT-?/i, '')]

  const { rows } = await query(`
    SELECT id, bot_order_id, customer_name, customer_phone, total, status
    FROM bot_orders
    WHERE bot_order_id = ANY($1::text[])
       OR bot_order_id ILIKE '%' || $2
    ORDER BY received_at DESC
    LIMIT 1
  `, [variants, ref])

  const order = rows[0]
  if (!order) {
    await sendText(approverPhone, `Pedido ${ref} não encontrado.`).catch(() => {})
    return
  }

  if (order.status !== 'pending_approval') {
    await sendText(approverPhone, `Pedido ${order.bot_order_id} já estava ${order.status}.`).catch(() => {})
    return
  }

  if (decision === 'APROVAR') {
    // 1. Marca bot_order como aprovado
    await query(`
      UPDATE bot_orders
      SET status='approved', reviewed_at=now(), reviewed_by=$2
      WHERE id=$1
    `, [order.id, approverPhone])

    // 2. Recarrega bot_order completo (com items) para conversão
    const { rows: [full] } = await query(`
      SELECT id, bot_order_id, customer_name, customer_phone, items, total
      FROM bot_orders WHERE id=$1
    `, [order.id])

    // 3. Converte para orders + order_items (find or create customer)
    let conversion = null
    try {
      conversion = await convertBotOrderToOrder(full, approverPhone)
    } catch (err) {
      console.error('[wpp/webhook convert]', err.message)
      // Avisa aprovador que aprovação foi marcada mas conversão falhou
      await sendText(approverPhone,
        `⚠️ Pedido ${order.bot_order_id} aprovado, mas houve erro ao criar o pedido no ERP.\n` +
        `Erro: ${err.message}\n` +
        `Verifique manualmente em https://${process.env.TENANT_SLUG}.aurabr.app/whatsapp`
      ).catch(() => {})
      return
    }

    // 4. Confirma para aprovador
    await sendText(approverPhone,
      `✅ Pedido ${order.bot_order_id} aprovado e criado no ERP.\n` +
      `Cliente: ${order.customer_name}\n` +
      `Total: R$ ${Number(order.total).toFixed(2)}\n` +
      `Ref: ${conversion.ref} (Nº ${conversion.number ?? '—'})`
    ).catch(() => {})

    // 5. Notifica cliente (sem await — não bloqueia)
    sendText(order.customer_phone,
      `Olá ${order.customer_name}! Seu pedido foi aprovado e está em produção.`
    ).catch(err => console.error('[wpp/webhook notify customer]', err.message))
  } else {
    await query(`
      UPDATE bot_orders
      SET status='rejected', reviewed_at=now(), reviewed_by=$2
      WHERE id=$1
    `, [order.id, approverPhone])

    await sendText(approverPhone,
      `❌ Pedido ${order.bot_order_id} rejeitado.`
    ).catch(() => {})

    sendText(order.customer_phone,
      `Olá ${order.customer_name}, infelizmente seu pedido não foi aprovado. ` +
      `Em breve um atendente entra em contato.`
    ).catch(err => console.error('[wpp/webhook notify customer]', err.message))
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Dispatcher — chama o processor configurado no master
   Retorna a string de resposta para enviar de volta ao cliente.
   ───────────────────────────────────────────────────────────────────── */
async function dispatch(cfg, ctx) {
  const { chatId, text, senderPhone, messageId } = ctx

  switch (cfg.processor) {
    case 'dify':    return await dispatchDify(cfg, ctx)
    case 'n8n':     return await dispatchN8n(cfg, ctx)
    case 'custom':  return await dispatchCustom(cfg, ctx)
    case 'none':
    default:        return null
  }
}

/* ── Dify dispatcher ── */
async function dispatchDify(cfg, ctx) {
  if (!cfg.dify_api_url || !cfg.dify_api_key) {
    console.warn('[dispatch.dify] config incompleta')
    return null
  }

  // Recupera conversation_id existente para o phone (se houver)
  let difyConversationId = null
  try {
    const { rows } = await query(`
      SELECT dify_conversation_id FROM bot_orders
      WHERE customer_phone = $1 AND dify_conversation_id IS NOT NULL
      ORDER BY received_at DESC LIMIT 1
    `, [ctx.senderPhone])
    difyConversationId = rows[0]?.dify_conversation_id ?? null
  } catch {}

  const url = `${cfg.dify_api_url.replace(/\/$/, '')}/v1/chat-messages`
  const body = {
    inputs: {},
    query: ctx.text,
    response_mode: 'blocking',
    conversation_id: difyConversationId ?? '',
    user: ctx.senderPhone, // Dify identifica end_user por isso
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.dify_api_key}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Dify ${res.status}: ${errText.slice(0, 200)}`)
  }

  const result = await res.json()
  return result.answer ?? null
}

/* ── n8n dispatcher (forward simples) ── */
async function dispatchN8n(cfg, ctx) {
  if (!cfg.n8n_webhook_url) return null
  const res = await fetch(cfg.n8n_webhook_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: ctx.senderPhone,
      chatId: ctx.chatId,
      text: ctx.text,
      messageId: ctx.messageId,
    }),
  })
  if (!res.ok) throw new Error(`n8n ${res.status}`)
  const json = await res.json().catch(() => ({}))
  return json.reply ?? json.answer ?? json.text ?? null
}

/* ── Custom URL dispatcher (mesmo formato do n8n) ── */
async function dispatchCustom(cfg, ctx) {
  if (!cfg.custom_url) return null
  const res = await fetch(cfg.custom_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: ctx.senderPhone,
      chatId: ctx.chatId,
      text: ctx.text,
      messageId: ctx.messageId,
    }),
  })
  if (!res.ok) throw new Error(`custom ${res.status}`)
  const json = await res.json().catch(() => ({}))
  return json.reply ?? json.answer ?? json.text ?? null
}
