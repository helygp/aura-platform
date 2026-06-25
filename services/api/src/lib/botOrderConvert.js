/**
 * lib/botOrderConvert.js
 *
 * Converte um bot_order aprovado em um pedido real (orders + order_items).
 *
 * Fluxo:
 *  1. Find-or-create customer (matching por sufixo do whatsapp)
 *  2. Cria orders com channel='whatsapp', status='confirmado'
 *  3. Cria order_items a partir de bot_orders.items
 *  4. Vincula bot_orders.order_id
 *
 * Retorna { order_id, ref, number } ou lança erro.
 *
 * IMPORTANTE: NÃO usa transação Postgres pq query() do tenantDb é por-statement.
 * Se algum step falhar, deixa o estado inconsistente — o caller deve logar.
 * Em produção real seria interessante mover para BEGIN/COMMIT explícito.
 */

import { query } from './tenantDb.js'

/**
 * Localiza ou cria um customer pelo telefone.
 */
async function findOrCreateCustomer(name, phone) {
  const phoneClean = String(phone).replace(/\D/g, '')
  const last10 = phoneClean.slice(-10)

  // Tenta match por sufixo
  const { rows: existing } = await query(`
    SELECT id, name FROM customers
    WHERE regexp_replace(coalesce(whatsapp,''), '\\D', '', 'g') ILIKE $1
    LIMIT 1
  `, [`%${last10}`])

  if (existing[0]) return existing[0]

  // Cria customer mínimo
  const { rows: [created] } = await query(`
    INSERT INTO customers (name, whatsapp, person_type, status)
    VALUES ($1, $2, 'pf', 'ativo')
    RETURNING id, name
  `, [name || `Cliente ${last10}`, phoneClean])

  return created
}

/**
 * Converte bot_order → orders + order_items.
 *
 * @param {object} botOrder — registro de bot_orders (deve estar APPROVED ou PENDING)
 * @param {string} approverPhone — quem aprovou (para log)
 * @returns {Promise<{order_id, ref, number, customer_id}>}
 */
export async function convertBotOrderToOrder(botOrder, approverPhone = null) {
  if (!botOrder?.id) throw new Error('botOrder inválido')

  // 1. Find or create customer
  const customer = await findOrCreateCustomer(botOrder.customer_name, botOrder.customer_phone)

  // 2. Cria order
  const ref = `BOT-${botOrder.bot_order_id.replace(/^BOT-/, '')}`
  const items = Array.isArray(botOrder.items) ? botOrder.items : []

  const notes = `Pedido criado via WhatsApp Agent.\nBot Order: ${botOrder.bot_order_id}` +
                (approverPhone ? `\nAprovado por: ${approverPhone}` : '')

  const { rows: [order] } = await query(`
    INSERT INTO orders (
      customer_id, customer_name, customer_whatsapp,
      channel, status, total, notes, ref
    ) VALUES ($1, $2, $3, 'whatsapp', 'confirmado', $4, $5, $6)
    RETURNING id, ref, number, status, total
  `, [
    customer.id,
    botOrder.customer_name,
    String(botOrder.customer_phone).replace(/\D/g, ''),
    botOrder.total,
    notes,
    ref,
  ])

  // 3. Cria order_items
  for (const item of items) {
    const qty       = parseInt(item.quantity ?? item.qty ?? 1, 10)
    const priceUnit = Number(item.price ?? item.price_unit ?? 0)
    const skuId     = item.sku_id   ?? item.skuId   ?? null
    const skuCode   = item.sku_code ?? item.skuCode ?? item.code ?? skuId ?? 'BOT-ITEM'
    const prodName  = item.name     ?? item.product_name ?? 'Item do agente'
    const attrs     = item.attributes ?? item.attrs ?? {}

    await query(`
      INSERT INTO order_items (
        order_id, sku_id, sku_code, product_name, attributes, qty, price_unit, status
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, 'ativo')
    `, [
      order.id,
      skuId,
      String(skuCode).slice(0, 100),
      String(prodName).slice(0, 200),
      JSON.stringify(attrs),
      qty,
      priceUnit,
    ])
  }

  // 4. Vincula bot_orders.order_id
  await query(`UPDATE bot_orders SET order_id=$1 WHERE id=$2`, [order.id, botOrder.id])

  return {
    order_id:    order.id,
    ref:         order.ref,
    number:      order.number,
    customer_id: customer.id,
  }
}
