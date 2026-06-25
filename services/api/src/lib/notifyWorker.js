/**
 * lib/notifyWorker.js
 *
 * Worker de notificações WhatsApp para mudanças de status de pedidos.
 *
 * Loop:
 *   1. Busca order_status_log WHERE notified_at IS NULL ORDER BY changed_at
 *   2. Para cada registro:
 *      a. Lê order + customer (telefone)
 *      b. Renderiza template do status
 *      c. Envia via Aurazap sendText
 *      d. Marca notified_at = now() (ou notify_error)
 *
 * Templates por status (orders.status):
 *   confirmado   → "Pedido aprovado e em produção"
 *   separando    → "Pedido em separação"
 *   enviado      → "Saiu para entrega"
 *   entregue     → "Pedido entregue. Obrigado!"
 *   cancelado    → "Pedido cancelado"
 *   item_cancelado → notifica mudança parcial (silencioso por ora)
 *   pendente     → não notifica (status inicial)
 *
 * Intervalo: 30s. Tem proteção contra execução paralela (lock em memória).
 *
 * NÃO bloqueia inicialização da API se WhatsApp não estiver configurado.
 */

import { query }       from './tenantDb.js'
import { getWahaConfig, sendText } from './wahaClient.js'

const POLL_INTERVAL = 30_000  // 30 segundos
const BATCH_SIZE    = 20
const MAX_ATTEMPTS  = 5

let _running = false
let _intervalId = null

/* ── Templates por status ── */
const STATUS_TEMPLATES = {
  confirmado: (o) =>
    `Olá ${o.customer_name}! 🎉\n` +
    `Seu pedido foi aprovado e está em produção.\n` +
    `Ref: ${o.ref ?? '#' + o.number}\n` +
    `Total: R$ ${Number(o.total).toFixed(2)}`,

  separando: (o) =>
    `Olá ${o.customer_name}!\n` +
    `Seu pedido ${o.ref ?? '#' + o.number} já está em separação. 📦\n` +
    `Em breve será despachado.`,

  enviado: (o) =>
    `Olá ${o.customer_name}!\n` +
    `Seu pedido ${o.ref ?? '#' + o.number} saiu para entrega. 🚚\n` +
    `Acompanhe a chegada.`,

  entregue: (o) =>
    `Olá ${o.customer_name}!\n` +
    `Seu pedido ${o.ref ?? '#' + o.number} foi entregue. ✅\n` +
    `Obrigado pela confiança!`,

  cancelado: (o) =>
    `Olá ${o.customer_name},\n` +
    `Seu pedido ${o.ref ?? '#' + o.number} foi cancelado.\n` +
    `Se tiver dúvidas, entre em contato.`,
}

/* Status que NÃO disparam notificação */
const SKIP_STATUSES = new Set(['pendente', 'item_cancelado'])

/* ── Loop principal ── */
export function startNotifyWorker() {
  if (_intervalId) return
  console.log('[notifyWorker] Iniciado (poll a cada ' + (POLL_INTERVAL/1000) + 's)')

  // Primeiro run depois de 60s (deixa boot completar)
  setTimeout(() => processBatch().catch(err =>
    console.error('[notifyWorker] erro inicial:', err.message)), 60_000)

  _intervalId = setInterval(() => {
    processBatch().catch(err =>
      console.error('[notifyWorker] erro loop:', err.message))
  }, POLL_INTERVAL)
}

export function stopNotifyWorker() {
  if (_intervalId) clearInterval(_intervalId)
  _intervalId = null
}

/* ── Process batch ── */
async function processBatch() {
  if (_running) return  // proteção paralelismo
  _running = true

  try {
    // Só roda se whatsapp configurado para este tenant
    const cfg = await getWahaConfig()
    if (!cfg.url || !cfg.session) return

    const { rows: pending } = await query(`
      SELECT
        osl.id          AS log_id,
        osl.order_id,
        osl.from_status,
        osl.to_status,
        osl.changed_at,
        o.ref,
        o.number,
        o.total,
        o.customer_name,
        o.customer_whatsapp,
        o.channel
      FROM order_status_log osl
      JOIN orders o ON o.id = osl.order_id
      WHERE osl.notified_at IS NULL
        AND osl.attempts < $2
        AND osl.to_status != 'pendente'
      ORDER BY osl.changed_at ASC
      LIMIT $1
    `, [BATCH_SIZE, MAX_ATTEMPTS])

    if (!pending.length) return

    console.log(`[notifyWorker] processando ${pending.length} notificacao(oes)`)

    for (const row of pending) {
      await notifyOne(row).catch(err =>
        console.error('[notifyWorker] erro item:', row.log_id, err.message))
    }
  } finally {
    _running = false
  }
}

/* ── Notifica um log ── */
async function notifyOne(row) {
  // Só notifica clientes do canal whatsapp e com número cadastrado
  if (row.channel !== 'whatsapp' || !row.customer_whatsapp) {
    await markNotified(row.log_id, null, 'no-whatsapp-channel')
    return
  }

  // Status sem template → marca notified mas não envia
  if (SKIP_STATUSES.has(row.to_status)) {
    await markNotified(row.log_id, null, 'skip-status')
    return
  }

  const template = STATUS_TEMPLATES[row.to_status]
  if (!template) {
    await markNotified(row.log_id, null, 'no-template:' + row.to_status)
    return
  }

  const message = template(row)

  try {
    await sendText(row.customer_whatsapp, message)
    await markNotified(row.log_id, null, null)
    console.log(`[notifyWorker] ✓ ${row.ref ?? row.order_id} → ${row.to_status} → ${row.customer_whatsapp.slice(-4)}`)
  } catch (err) {
    await markNotified(row.log_id, err.message, null)
    console.error(`[notifyWorker] ✗ ${row.ref ?? row.order_id}:`, err.message)
  }
}

async function markNotified(logId, error, skipReason) {
  if (skipReason) {
    // marca notified_at + notify_error com motivo do skip (para auditoria)
    await query(`
      UPDATE order_status_log
      SET notified_at = now(), notify_error = $1
      WHERE id = $2
    `, [skipReason, logId])
  } else if (error) {
    await query(`
      UPDATE order_status_log
      SET notify_error = $1, attempts = attempts + 1
      WHERE id = $2
    `, [error.slice(0, 500), logId])
  } else {
    await query(`
      UPDATE order_status_log
      SET notified_at = now(), notify_error = NULL
      WHERE id = $1
    `, [logId])
  }
}
