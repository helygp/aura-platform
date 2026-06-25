/**
 * lib/interactionManager.js
 *
 * Gerencia o ciclo de vida de whatsapp_interactions e whatsapp_messages.
 *
 * Regras de negócio:
 *   - Janela de sessão: 24h de inatividade → nova interação
 *   - Uma interação "open" por phone por vez
 *   - Mensagens (inbound/outbound) são persistidas em whatsapp_messages
 *   - bot_order_id é vinculado à interação ativa quando um pedido é criado
 *   - dify_conversation_id é atualizado quando o Dify retorna novo conversation_id
 */

import { query } from './tenantDb.js'

const SESSION_WINDOW_HOURS = 24

/**
 * Retorna a interação aberta ativa para o phone, ou cria uma nova.
 * Também resolve customer_id se existir cadastro.
 *
 * @param {string} phone  – número E.164 sem + (ex: 5516991773765)
 * @returns {object}      – linha de whatsapp_interactions
 */
export async function getOrCreateInteraction(phone) {
  // Busca interação aberta dentro da janela de sessão
  const { rows } = await query(`
    SELECT *
    FROM whatsapp_interactions
    WHERE customer_phone = $1
      AND status = 'open'
      AND last_message_at > now() - interval '${SESSION_WINDOW_HOURS} hours'
    ORDER BY last_message_at DESC
    LIMIT 1
  `, [phone])

  if (rows[0]) {
    const interaction = rows[0]
    // Se customer_id era NULL mas agora tem cliente cadastrado, atualiza
    if (!interaction.customer_id) {
      const { rows: custs } = await query('SELECT id FROM customers WHERE whatsapp = $1 LIMIT 1', [phone])
      if (custs[0]) {
        await query('UPDATE whatsapp_interactions SET customer_id = $1 WHERE id = $2', [custs[0].id, interaction.id]).catch(() => {})
        interaction.customer_id = custs[0].id
      }
    }
    return interaction
  }

  // Fecha interações antigas abertas do mesmo phone (abandono por timeout)
  await query(`
    UPDATE whatsapp_interactions
    SET status = 'abandoned', last_message_at = last_message_at
    WHERE customer_phone = $1 AND status = 'open'
  `, [phone])

  // Resolve customer_id
  const { rows: customers } = await query(`
    SELECT id FROM customers WHERE whatsapp = $1 LIMIT 1
  `, [phone])
  const customerId = customers[0]?.id ?? null

  // Cria nova interação
  const { rows: [created] } = await query(`
    INSERT INTO whatsapp_interactions (customer_phone, customer_id, status)
    VALUES ($1, $2, 'open')
    RETURNING *
  `, [phone, customerId])

  return created
}

/**
 * Persiste uma mensagem na interação e atualiza last_message_at.
 *
 * @param {string} interactionId
 * @param {object} msg
 * @param {string} msg.direction   – 'inbound' | 'outbound'
 * @param {string} msg.sender      – 'customer' | 'bot' | 'human'
 * @param {string} msg.content
 * @param {string} [msg.wahaMessageId]
 */
export async function saveMessage(interactionId, { direction, sender, content, wahaMessageId = null }) {
  // Evita duplicata pelo wahaMessageId
  if (wahaMessageId) {
    const { rows } = await query(`
      SELECT id FROM whatsapp_messages WHERE waha_message_id = $1 LIMIT 1
    `, [wahaMessageId])
    if (rows[0]) {
    const interaction = rows[0]
    // Atualiza customer_id se ainda estava NULL e agora tem cliente cadastrado
    if (!interaction.customer_id) {
      const { rows: custs } = await query(
        `SELECT id FROM customers WHERE whatsapp = $1 LIMIT 1`, [phone]
      )
      if (custs[0]) {
        await query(
          `UPDATE whatsapp_interactions SET customer_id = $1 WHERE id = $2`,
          [custs[0].id, interaction.id]
        ).catch(() => {})
        interaction.customer_id = custs[0].id
      }
    }
    return interaction
  }
  }

  const { rows: [msg] } = await query(`
    INSERT INTO whatsapp_messages (interaction_id, direction, sender, content, waha_message_id)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [interactionId, direction, sender, content, wahaMessageId])

  // Atualiza last_message_at da interação
  await query(`
    UPDATE whatsapp_interactions SET last_message_at = now() WHERE id = $1
  `, [interactionId])

  return msg
}

/**
 * Vincula dify_conversation_id à interação (quando Dify retorna novo ID).
 */
export async function setDifyConversationId(interactionId, difyConversationId) {
  if (!difyConversationId) return
  await query(`
    UPDATE whatsapp_interactions SET dify_conversation_id = $1 WHERE id = $2
  `, [difyConversationId, interactionId])
}

/**
 * Vincula bot_order_id à interação ativa do phone.
 */
export async function linkBotOrder(phone, botOrderId) {
  await query(`
    UPDATE whatsapp_interactions
    SET bot_order_id = $1
    WHERE customer_phone = $2
      AND status = 'open'
      AND last_message_at > now() - interval '${SESSION_WINDOW_HOURS} hours'
    ORDER BY last_message_at DESC
    LIMIT 1
  `, [botOrderId, phone])
}

/**
 * Retorna as mensagens de uma interação em ordem cronológica.
 */
export async function getMessages(interactionId) {
  const { rows } = await query(`
    SELECT id, direction, sender, content, waha_message_id, sent_at
    FROM whatsapp_messages
    WHERE interaction_id = $1
    ORDER BY sent_at ASC
  `, [interactionId])
  return rows
}

/**
 * Lista interações agrupadas por phone para o inbox.
 * Retorna uma por phone (a mais recente aberta, ou a última de qualquer status).
 */
export async function listInbox() {
  const { rows } = await query(`
    SELECT DISTINCT ON (wi.customer_phone)
      wi.id,
      wi.customer_phone,
      COALESCE(wi.customer_id, c2.id) AS customer_id,
      wi.dify_conversation_id,
      wi.bot_order_id,
      wi.status,
      wi.started_at,
      wi.last_message_at,
      COALESCE(c1.name, c2.name)   AS customer_name,
      COALESCE(c1.status, c2.status) AS customer_status,
      COALESCE(c1.person_type, c2.person_type) AS person_type,
      (
        SELECT content FROM whatsapp_messages
        WHERE interaction_id = wi.id
        ORDER BY sent_at DESC LIMIT 1
      ) AS last_text,
      (
        SELECT COUNT(*) FROM bot_orders bo
        WHERE bo.customer_phone = wi.customer_phone
          AND bo.status = 'pending_approval'
      )::int AS pending_orders_count
    FROM whatsapp_interactions wi
    LEFT JOIN customers c1 ON c1.id = wi.customer_id
    LEFT JOIN customers c2 ON c2.whatsapp = wi.customer_phone AND wi.customer_id IS NULL
    ORDER BY wi.customer_phone, wi.last_message_at DESC
  `)
  // Re-ordena por last_message_at global
  return rows.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at))
}
