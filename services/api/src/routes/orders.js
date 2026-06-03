/**
 * routes/orders.js
 *
 * GET  /api/orders                    — lista com filtros
 * POST /api/orders                    — cria pedido manual (com validação de SKU/estoque)
 * PUT  /api/orders/:id/status         — muda status
 * POST /api/orders/:id/items          — adiciona item ao pedido
 * PUT  /api/orders/:id/items/:itemId  — edita quantidade do item
 * DELETE /api/orders/:id/items/:itemId — remove item do pedido
 */

import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize }    from '../middleware/authorize.js'
import { query, getClient } from '../lib/tenantDb.js'
import { dispatch } from '../lib/webhookDispatcher.js'

export const ordersRouter = Router()
ordersRouter.use(authenticate)

/* ── GET /api/orders ── */
ordersRouter.get('/', async (req, res) => {
  try {
    const { search='', status='', channel='', dateFrom='', dateTo='' } = req.query
    const params = []
    const where  = []

    if (search) {
      params.push(`%${search}%`)
      where.push(`(o.id ILIKE $${params.length} OR o.customer_name ILIKE $${params.length})`)
    }
    if (status)  { params.push(status);  where.push(`o.status=$${params.length}`) }
    if (channel) { params.push(channel); where.push(`o.channel=$${params.length}`) }
    if (dateFrom){ params.push(dateFrom); where.push(`o.created_at >= $${params.length}`) }
    if (dateTo)  { params.push(dateTo);   where.push(`o.created_at <= ($${params.length}::date + interval '1 day')`) }

    const wClause = where.length ? 'WHERE ' + where.join(' AND ') : ''

    const { rows: orders } = await query(`
      SELECT o.*,
        json_agg(
          json_build_object(
            'id', oi.id, 'skuId', oi.sku_id, 'skuCode', oi.sku_code,
            'productName', oi.product_name, 'attributes', oi.attributes,
            'qty', oi.qty, 'priceUnit', oi.price_unit
          )
        ) FILTER (WHERE oi.id IS NOT NULL) AS items,
        (SELECT json_agg(json_build_object(
            'status', oh.status, 'note', oh.note,
            'user', oh.user_name, 'at', oh.created_at
          ) ORDER BY oh.created_at)
         FROM order_history oh WHERE oh.order_id = o.id
        ) AS history
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      ${wClause}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT 200
    `, params)

    res.json({ orders: orders.map(normalizeOrder) })
  } catch (err) {
    console.error('[orders/list]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── POST /api/orders ── */
ordersRouter.post('/', authorize('admin','operador'), async (req, res) => {
  const client = await getClient()
  try {
    await client.query('BEGIN')

    const { customerId, customerName, customerWhatsapp, channel='manual', items=[], notes='' } = req.body
    const userName = req.user?.name ?? req.user?.email ?? 'operador'

    // ── Validação: verificar se items não está vazio ──
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Adicione pelo menos 1 item ao pedido.' })
    }

    // ── Validar e resolver todos os SKUs + estoque ──
    const resolvedItems = []
    let total = 0

    for (const item of items) {
      const qty = parseInt(item.qty)
      if (!item.skuId || qty < 1) {
        return res.status(400).json({ error: 'SKU inválido ou quantidade incorreta.' })
      }

      // Buscar SKU no banco — usar dados confiáveis
      const { rows: [sku] } = await client.query(`
        SELECT id, produto_id, codigo, atributos, preco_atacado, estoque,
               (SELECT nome FROM produtos WHERE id = skus.produto_id) AS product_name
        FROM skus
        WHERE id = $1 AND ativo = true
      `, [item.skuId])

      if (!sku) {
        return res.status(404).json({ error: `SKU ${item.skuId} não encontrado ou inativo.` })
      }

      if (sku.estoque < qty) {
        return res.status(422).json({
          error: `Estoque insuficiente para ${sku.product_name} (${sku.codigo}). Disponível: ${sku.estoque}.`,
        })
      }

      const itemTotal = sku.preco_atacado * qty
      total += itemTotal

      resolvedItems.push({
        skuId: sku.id,
        skuCode: sku.codigo,
        productName: sku.product_name,
        attributes: sku.atributos,
        qty,
        priceUnit: parseFloat(sku.preco_atacado),
      })
    }

    // ── Criar pedido ──
    const { rows:[order] } = await client.query(`
      INSERT INTO orders (customer_id, customer_name, customer_whatsapp, channel, total, notes)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [customerId||null, customerName, customerWhatsapp||null, channel, total, notes])

    // ── Inserir itens e atualizar estoque ──
    for (const item of resolvedItems) {
      await client.query(`
        INSERT INTO order_items (order_id, sku_id, sku_code, product_name, attributes, qty, price_unit)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)
      `, [order.id, item.skuId, item.skuCode, item.productName,
          JSON.stringify(item.attributes ?? {}), item.qty, item.priceUnit])

      // Decrementa estoque
      await client.query(
        'UPDATE skus SET estoque = estoque - $1, updated_at = NOW() WHERE id = $2',
        [item.qty, item.skuId]
      )
    }

    // ── Inserir histórico ──
    await client.query(`
      INSERT INTO order_history (order_id, status, note, user_name)
      VALUES ($1,'pendente','Pedido criado.',$2)
    `, [order.id, userName])

    await client.query('COMMIT')
    res.status(201).json({ id: order.id, message: 'Pedido criado.', total })
    // Webhook: order.created (fire & forget)
    dispatch(req.tenantSlug ?? process.env.TENANT_SLUG, 'order.created', {
      id: order.id, customer_name: order.customer_name,
      total: parseFloat(total), status: 'pendente', channel: order.channel,
    })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[orders/create]', err.message)
    res.status(500).json({ error: 'Erro ao criar pedido.' })
  } finally { client.release() }
})

/* ── PUT /api/orders/:id/status ── */
ordersRouter.put('/:id/status', async (req, res) => {
  const client = await getClient()
  try {
    await client.query('BEGIN')
    const { status, note='' } = req.body
    const userName = req.user?.name ?? req.user?.email ?? 'sistema'

    const { rows:[order] } = await client.query(
      'UPDATE orders SET status=$1, updated_at=now() WHERE id=$2 RETURNING id',
      [status, req.params.id]
    )
    if (!order) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pedido não encontrado.' }) }

    await client.query(`
      INSERT INTO order_history (order_id, status, note, user_name) VALUES ($1,$2,$3,$4)
    `, [req.params.id, status, note, userName])

    await client.query('COMMIT')
    res.json({ ok: true })
    // Webhook: order.status_changed (fire & forget)
    dispatch(req.tenantSlug ?? process.env.TENANT_SLUG, 'order.status_changed', {
      id: req.params.id, new_status: status, note,
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[orders/status]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  } finally { client.release() }
})

/* ── POST /api/orders/:id/items — adiciona item ao pedido ── */
ordersRouter.post('/:id/items', authorize('admin','operador'), async (req, res) => {
  const client = await getClient()
  try {
    await client.query('BEGIN')

    const { skuId, qty } = req.body
    const orderId = req.params.id
    const userName = req.user?.name ?? req.user?.email ?? 'operador'

    // Validar pedido existe
    const { rows: [order] } = await client.query(
      'SELECT id, total FROM orders WHERE id = $1',
      [orderId]
    )
    if (!order) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pedido não encontrado.' }) }

    // Validar SKU
    const qtyInt = parseInt(qty)
    if (!skuId || qtyInt < 1) {
      return res.status(400).json({ error: 'SKU inválido ou quantidade incorreta.' })
    }

    const { rows: [sku] } = await client.query(`
      SELECT id, codigo, atributos, preco_atacado, estoque,
             (SELECT nome FROM produtos WHERE id = skus.produto_id) AS product_name
      FROM skus
      WHERE id = $1 AND ativo = true
    `, [skuId])

    if (!sku) {
      return res.status(404).json({ error: `SKU ${skuId} não encontrado ou inativo.` })
    }

    if (sku.estoque < qtyInt) {
      return res.status(422).json({
        error: `Estoque insuficiente para ${sku.product_name}. Disponível: ${sku.estoque}.`,
      })
    }

    // Inserir item
    const itemTotal = parseFloat(sku.preco_atacado) * qtyInt
    await client.query(`
      INSERT INTO order_items (order_id, sku_id, sku_code, product_name, attributes, qty, price_unit)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
    `, [orderId, sku.id, sku.codigo, sku.product_name,
        JSON.stringify(sku.atributos ?? {}), qtyInt, parseFloat(sku.preco_atacado)])

    // Atualizar estoque
    await client.query(
      'UPDATE skus SET estoque = estoque - $1, updated_at = NOW() WHERE id = $2',
      [qtyInt, sku.id]
    )

    // Recalcular total do pedido
    const { rows: [totals] } = await client.query(`
      SELECT COALESCE(SUM(qty * price_unit), 0) AS new_total FROM order_items WHERE order_id = $1
    `, [orderId])

    await client.query(
      'UPDATE orders SET total = $1, updated_at = NOW() WHERE id = $2',
      [parseFloat(totals.new_total), orderId]
    )

    // Histórico
    await client.query(`
      INSERT INTO order_history (order_id, status, note, user_name)
      VALUES ($1, 'item_adicionado', $2, $3)
    `, [orderId, `Item adicionado: ${sku.product_name} (${qtyInt}x)`, userName])

    await client.query('COMMIT')
    res.status(201).json({ ok: true, itemTotal, newOrderTotal: parseFloat(totals.new_total) })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[orders/items/add]', err.message)
    res.status(500).json({ error: 'Erro ao adicionar item.' })
  } finally { client.release() }
})

/* ── PUT /api/orders/:id/items/:itemId — edita quantidade ── */
ordersRouter.put('/:id/items/:itemId', authorize('admin','operador'), async (req, res) => {
  const client = await getClient()
  try {
    await client.query('BEGIN')

    const { id: orderId, itemId } = req.params
    const { qty } = req.body
    const userName = req.user?.name ?? req.user?.email ?? 'operador'

    const qtyInt = parseInt(qty)
    if (qtyInt < 1) {
      return res.status(400).json({ error: 'Quantidade deve ser >= 1.' })
    }

    // Buscar item e SKU
    const { rows: [item] } = await client.query(`
      SELECT oi.id, oi.sku_id, oi.qty AS old_qty, oi.product_name, s.estoque
      FROM order_items oi
      JOIN skus s ON s.id = oi.sku_id
      WHERE oi.id = $1 AND oi.order_id = $2
    `, [itemId, orderId])

    if (!item) {
      return res.status(404).json({ error: 'Item não encontrado.' })
    }

    const qtyDiff = qtyInt - item.old_qty
    // Se aumentou, validar estoque
    if (qtyDiff > 0 && item.estoque < qtyDiff) {
      return res.status(422).json({
        error: `Estoque insuficiente. Disponível para adicionar: ${item.estoque}.`,
      })
    }

    // Atualizar item
    await client.query(
      'UPDATE order_items SET qty = $1, updated_at = NOW() WHERE id = $2',
      [qtyInt, itemId]
    )

    // Ajustar estoque
    await client.query(
      'UPDATE skus SET estoque = estoque - $1, updated_at = NOW() WHERE id = $2',
      [qtyDiff, item.sku_id]
    )

    // Recalcular total
    const { rows: [totals] } = await client.query(`
      SELECT COALESCE(SUM(qty * price_unit), 0) AS new_total FROM order_items WHERE order_id = $1
    `, [orderId])

    await client.query(
      'UPDATE orders SET total = $1, updated_at = NOW() WHERE id = $2',
      [parseFloat(totals.new_total), orderId]
    )

    // Histórico
    await client.query(`
      INSERT INTO order_history (order_id, status, note, user_name)
      VALUES ($1, 'item_editado', $2, $3)
    `, [orderId, `${item.product_name}: ${item.old_qty}x → ${qtyInt}x`, userName])

    await client.query('COMMIT')
    res.json({ ok: true, newOrderTotal: parseFloat(totals.new_total) })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[orders/items/update]', err.message)
    res.status(500).json({ error: 'Erro ao editar item.' })
  } finally { client.release() }
})

/* ── DELETE /api/orders/:id/items/:itemId — remove item ── */
ordersRouter.delete('/:id/items/:itemId', authorize('admin','operador'), async (req, res) => {
  const client = await getClient()
  try {
    await client.query('BEGIN')

    const { id: orderId, itemId } = req.params
    const userName = req.user?.name ?? req.user?.email ?? 'operador'

    // Buscar item antes de deletar
    const { rows: [item] } = await client.query(`
      SELECT oi.id, oi.sku_id, oi.qty, oi.product_name
      FROM order_items oi
      WHERE oi.id = $1 AND oi.order_id = $2
    `, [itemId, orderId])

    if (!item) {
      return res.status(404).json({ error: 'Item não encontrado.' })
    }

    // Deletar item
    await client.query(
      'DELETE FROM order_items WHERE id = $1',
      [itemId]
    )

    // Devolver estoque
    await client.query(
      'UPDATE skus SET estoque = estoque + $1, updated_at = NOW() WHERE id = $2',
      [item.qty, item.sku_id]
    )

    // Recalcular total
    const { rows: [totals] } = await client.query(`
      SELECT COALESCE(SUM(qty * price_unit), 0) AS new_total FROM order_items WHERE order_id = $1
    `, [orderId])

    await client.query(
      'UPDATE orders SET total = $1, updated_at = NOW() WHERE id = $2',
      [parseFloat(totals.new_total) || 0, orderId]
    )

    // Histórico
    await client.query(`
      INSERT INTO order_history (order_id, status, note, user_name)
      VALUES ($1, 'item_removido', $2, $3)
    `, [orderId, `Item removido: ${item.product_name} (${item.qty}x)`, userName])

    await client.query('COMMIT')
    res.json({ ok: true, newOrderTotal: parseFloat(totals.new_total) || 0 })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[orders/items/delete]', err.message)
    res.status(500).json({ error: 'Erro ao remover item.' })
  } finally { client.release() }
})

function normalizeOrder(o) {
  return {
    id:               o.id,
    customerId:       o.customer_id,
    customerName:     o.customer_name,
    customerWhatsapp: o.customer_whatsapp,
    channel:          o.channel,
    status:           o.status,
    total:            parseFloat(o.total ?? 0),
    notes:            o.notes,
    items:            o.items  ?? [],
    history:          o.history ?? [],
    createdAt:        o.created_at,
    updatedAt:        o.updated_at,
  }
}
