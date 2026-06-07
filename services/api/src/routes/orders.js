/**
 * routes/orders.js
 *
 * GET  /api/orders                    — lista com filtros
 * POST /api/orders                    — cria pedido manual (com validação de SKU/estoque)
 * PUT  /api/orders/:id/status         — muda status
 * POST /api/orders/:id/items          — adiciona item ao pedido
 * PUT  /api/orders/:id/items/:itemId  — edita quantidade do item
 * DELETE /api/orders/:id/items/:itemId — remove item do pedido
 * DELETE /api/orders/:id/items/:itemId/cancel — cancela item (mantém no pedido, devolve estoque)
 */

import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize }    from '../middleware/authorize.js'
import { query, getClient } from '../lib/tenantDb.js'
import { dispatch } from '../lib/webhookDispatcher.js'

const VALID_PAYMENT_METHODS = ['pix', 'boleto', 'a_combinar', 'credito']

/* ── helper: registra movimentação de estoque ── */
async function logMovement(client, { skuId, type, qty, qtyBefore, reason, userName, orderId, customerName }) {
  await client.query(`
    INSERT INTO stock_movements (sku_id, type, qty, qty_before, qty_after, reason, user_name, order_id, customer_name)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  `, [skuId, type, Math.abs(qty), qtyBefore, qtyBefore + (type === 'saida' ? -Math.abs(qty) : Math.abs(qty)),
      reason, userName, orderId ?? null, customerName ?? null])
}

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
      SELECT o.*, COALESCE(NULLIF(o.customer_name,''), c.name) AS resolved_customer_name,
        json_agg(
          json_build_object(
            'id', oi.id, 'skuId', oi.sku_id, 'skuCode', oi.sku_code,
            'productName', oi.product_name, 'attributes', oi.attributes,
            'qty', oi.qty, 'priceUnit', oi.price_unit,
            'status', COALESCE(oi.status, 'ativo')
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
      LEFT JOIN customers c ON c.id = o.customer_id
      ${wClause}
      GROUP BY o.id, c.name
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

    const {
      customerId, customerName, customerWhatsapp,
      channel='manual', items=[], notes='',
      paymentMethod='credito',
    } = req.body
    const userName = req.user?.name ?? req.user?.email ?? 'operador'

    const pm = VALID_PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : 'credito'

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Adicione pelo menos 1 item ao pedido.' })
    }

    const resolvedItems = []
    let total = 0

    for (const item of items) {
      const qty = parseInt(item.qty)
      if (!item.skuId || qty < 1) {
        return res.status(400).json({ error: 'SKU inválido ou quantidade incorreta.' })
      }

      const { rows: [sku] } = await client.query(`
        SELECT s.id, s.code, s.attributes, s.price_wholesale, s.stock,
               p.name AS product_name
        FROM skus s
        JOIN products p ON p.id = s.product_id
        WHERE s.id = $1
      `, [item.skuId])

      if (!sku) return res.status(404).json({ error: `SKU ${item.skuId} não encontrado.` })

      if (sku.stock < qty) {
        return res.status(422).json({
          error: `Estoque insuficiente para "${sku.product_name}" (${sku.code}). Disponível: ${sku.stock}.`,
        })
      }

      if (sku.stock <= 0) {
        return res.status(422).json({
          error: `Produto "${sku.product_name}" (${sku.code}) sem estoque disponível.`,
        })
      }

      total += parseFloat(sku.price_wholesale) * qty

      resolvedItems.push({
        skuId:       sku.id,
        skuCode:     sku.code,
        productName: sku.product_name,
        attributes:  sku.attributes,
        stock:       sku.stock,
        qty,
        priceUnit:   parseFloat(sku.price_wholesale),
      })
    }

    // Criar pedido
    const { rows:[order] } = await client.query(`
      INSERT INTO orders (customer_id, customer_name, customer_whatsapp, channel, total, notes, payment_method)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [customerId||null, customerName, customerWhatsapp||null, channel, total, notes, pm])

    // Inserir itens, decrementar estoque e registrar movimentação
    for (const item of resolvedItems) {
      await client.query(`
        INSERT INTO order_items (order_id, sku_id, sku_code, product_name, attributes, qty, price_unit)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)
      `, [order.id, item.skuId, item.skuCode, item.productName,
          JSON.stringify(item.attributes ?? {}), item.qty, item.priceUnit])

      await client.query(
        'UPDATE skus SET stock = stock - $1, updated_at = NOW() WHERE id = $2',
        [item.qty, item.skuId]
      )

      await logMovement(client, {
        skuId: item.skuId, type: 'saida', qty: item.qty,
        qtyBefore: item.stock,
        reason: `Pedido ${order.id.slice(-6).toUpperCase()}`,
        userName, orderId: order.id, customerName: customerName ?? null,
      })
    }

    await client.query(`
      INSERT INTO order_history (order_id, status, note, user_name)
      VALUES ($1,'pendente','Pedido criado.',$2)
    `, [order.id, userName])

    // Wallet: débito automático se pagamento = crédito e tem cliente
    if (pm === 'credito' && customerId) {
      await client.query(`
        INSERT INTO wallet_transactions (customer_id, type, amount, description, order_ref, created_by)
        VALUES ($1, 'debit', $2, $3, $4, 'erp')
      `, [customerId, total.toFixed(2), `Pedido ERP ${order.id}`, order.id])

      await client.query(
        'UPDATE customers SET credit_balance = credit_balance + $1, updated_at = NOW() WHERE id = $2',
        [total.toFixed(2), customerId]
      )
    }

    await client.query('COMMIT')
    res.status(201).json({ id: order.id, message: 'Pedido criado.', total, paymentMethod: pm })

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
    const orderId  = req.params.id
    const userName = req.user?.name ?? req.user?.email ?? 'operador'

    const { rows: [order] } = await client.query(
      'SELECT id, total, customer_name FROM orders WHERE id = $1', [orderId]
    )
    if (!order) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pedido não encontrado.' }) }

    const qtyInt = parseInt(qty)
    if (!skuId || qtyInt < 1) {
      return res.status(400).json({ error: 'SKU inválido ou quantidade incorreta.' })
    }

    const { rows: [sku] } = await client.query(`
      SELECT s.id, s.code, s.attributes, s.price_wholesale, s.stock,
             p.name AS product_name
      FROM skus s
      JOIN products p ON p.id = s.product_id
      WHERE s.id = $1
    `, [skuId])

    if (!sku) return res.status(404).json({ error: `SKU ${skuId} não encontrado.` })

    if (sku.stock < qtyInt) {
      return res.status(422).json({
        error: `Estoque insuficiente para "${sku.product_name}". Disponível: ${sku.stock}.`,
      })
    }

    const itemTotal = parseFloat(sku.price_wholesale) * qtyInt
    await client.query(`
      INSERT INTO order_items (order_id, sku_id, sku_code, product_name, attributes, qty, price_unit)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
    `, [orderId, sku.id, sku.code, sku.product_name,
        JSON.stringify(sku.attributes ?? {}), qtyInt, parseFloat(sku.price_wholesale)])

    await client.query(
      'UPDATE skus SET stock = stock - $1, updated_at = NOW() WHERE id = $2',
      [qtyInt, sku.id]
    )

    await logMovement(client, {
      skuId: sku.id, type: 'saida', qty: qtyInt, qtyBefore: sku.stock,
      reason: `Item adicionado pedido ${orderId.slice(-6).toUpperCase()}`,
      userName, orderId, customerName: order.customer_name,
    })

    const { rows: [totals] } = await client.query(`
      SELECT COALESCE(SUM(qty * price_unit), 0) AS new_total FROM order_items WHERE order_id = $1
    `, [orderId])

    await client.query(
      'UPDATE orders SET total = $1, updated_at = NOW() WHERE id = $2',
      [parseFloat(totals.new_total), orderId]
    )

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
    if (qtyInt < 1) return res.status(400).json({ error: 'Quantidade deve ser >= 1.' })

    const { rows: [item] } = await client.query(`
      SELECT oi.id, oi.sku_id, oi.qty AS old_qty, oi.product_name, s.stock,
             o.customer_name
      FROM order_items oi
      JOIN skus s ON s.id = oi.sku_id
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.id = $1 AND oi.order_id = $2
    `, [itemId, orderId])

    if (!item) return res.status(404).json({ error: 'Item não encontrado.' })

    const qtyDiff = qtyInt - item.old_qty
    if (qtyDiff > 0 && item.stock < qtyDiff) {
      return res.status(422).json({
        error: `Estoque insuficiente. Disponível para adicionar: ${item.stock}.`,
      })
    }

    await client.query(
      'UPDATE order_items SET qty = $1, updated_at = NOW() WHERE id = $2',
      [qtyInt, itemId]
    )

    await client.query(
      'UPDATE skus SET stock = stock - $1, updated_at = NOW() WHERE id = $2',
      [qtyDiff, item.sku_id]
    )

    if (qtyDiff !== 0) {
      await logMovement(client, {
        skuId: item.sku_id,
        type: qtyDiff > 0 ? 'saida' : 'entrada',
        qty: Math.abs(qtyDiff),
        qtyBefore: item.stock,
        reason: `Ajuste pedido ${orderId.slice(-6).toUpperCase()}: ${item.old_qty}x→${qtyInt}x`,
        userName, orderId, customerName: item.customer_name,
      })
    }

    const { rows: [totals] } = await client.query(`
      SELECT COALESCE(SUM(qty * price_unit), 0) AS new_total FROM order_items WHERE order_id = $1
    `, [orderId])

    await client.query(
      'UPDATE orders SET total = $1, updated_at = NOW() WHERE id = $2',
      [parseFloat(totals.new_total), orderId]
    )

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

/* ── PATCH /api/orders/:id/items/:itemId/cancel — cancela item parcial ── */
ordersRouter.patch('/:id/items/:itemId/cancel', authorize('admin','operador'), async (req, res) => {
  const client = await getClient()
  try {
    await client.query('BEGIN')

    const { id: orderId, itemId } = req.params
    const userName = req.user?.name ?? req.user?.email ?? 'operador'

    // Busca item + status do pedido (T1.3: bloqueia cancel a partir de separando)
    const { rows: [item] } = await client.query(`
      SELECT oi.id, oi.sku_id, oi.qty, oi.product_name, oi.price_unit,
             COALESCE(oi.status, 'ativo') AS status,
             s.stock, o.customer_name, o.status AS order_status
      FROM order_items oi
      JOIN skus s ON s.id = oi.sku_id
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.id = $1 AND oi.order_id = $2
    `, [itemId, orderId])

    if (!item) return res.status(404).json({ error: 'Item não encontrado.' })
    if (item.status === 'cancelado') return res.status(400).json({ error: 'Item já cancelado.' })

    // T1.3 — permite cancelar apenas em: pendente, confirmado, separando
    const ALLOWED_STATUSES = ['pendente', 'confirmado', 'separando']
    if (!ALLOWED_STATUSES.includes(item.order_status)) {
      await client.query('ROLLBACK')
      return res.status(422).json({
        error: `Cancelamento de item não permitido: pedido está "${item.order_status}". Só é possível cancelar itens em pedidos pendentes, confirmados ou em separação.`,
      })
    }

    // Marca item como cancelado (não remove)
    await client.query(
      "UPDATE order_items SET status='cancelado', updated_at=NOW() WHERE id=$1",
      [itemId]
    )

    // Devolve estoque
    await client.query(
      'UPDATE skus SET stock = stock + $1, updated_at = NOW() WHERE id = $2',
      [item.qty, item.sku_id]
    )

    await logMovement(client, {
      skuId: item.sku_id, type: 'entrada', qty: item.qty,
      qtyBefore: item.stock,
      reason: `Cancelamento item pedido ${orderId.slice(-6).toUpperCase()}`,
      userName, orderId, customerName: item.customer_name,
    })

    // Recalcula total do pedido (sem itens cancelados)
    const { rows: [totals] } = await client.query(`
      SELECT COALESCE(SUM(qty * price_unit), 0) AS new_total
      FROM order_items WHERE order_id = $1 AND COALESCE(status,'ativo') != 'cancelado'
    `, [orderId])

    await client.query(
      'UPDATE orders SET total = $1, updated_at = NOW() WHERE id = $2',
      [parseFloat(totals.new_total) || 0, orderId]
    )

    await client.query(`
      INSERT INTO order_history (order_id, status, note, user_name)
      VALUES ($1, 'item_cancelado', $2, $3)
    `, [orderId, `Item cancelado: ${item.product_name} (${item.qty}x) — estoque devolvido`, userName])

    await client.query('COMMIT')
    res.json({ ok: true, newOrderTotal: parseFloat(totals.new_total) || 0 })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[orders/items/cancel]', err.message)
    res.status(500).json({ error: 'Erro ao cancelar item.' })
  } finally { client.release() }
})

/* ── DELETE /api/orders/:id/items/:itemId — remove item ── */
ordersRouter.delete('/:id/items/:itemId', authorize('admin','operador'), async (req, res) => {
  const client = await getClient()
  try {
    await client.query('BEGIN')

    const { id: orderId, itemId } = req.params
    const userName = req.user?.name ?? req.user?.email ?? 'operador'

    const { rows: [item] } = await client.query(`
      SELECT oi.id, oi.sku_id, oi.qty, oi.product_name,
             COALESCE(oi.status,'ativo') AS status, s.stock, o.customer_name
      FROM order_items oi
      JOIN skus s ON s.id = oi.sku_id
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.id = $1 AND oi.order_id = $2
    `, [itemId, orderId])

    if (!item) return res.status(404).json({ error: 'Item não encontrado.' })

    await client.query('DELETE FROM order_items WHERE id = $1', [itemId])

    // Só devolve estoque se item não estava já cancelado
    if (item.status !== 'cancelado') {
      await client.query(
        'UPDATE skus SET stock = stock + $1, updated_at = NOW() WHERE id = $2',
        [item.qty, item.sku_id]
      )

      await logMovement(client, {
        skuId: item.sku_id, type: 'entrada', qty: item.qty,
        qtyBefore: item.stock,
        reason: `Item removido pedido ${orderId.slice(-6).toUpperCase()}`,
        userName, orderId, customerName: item.customer_name,
      })
    }

    const { rows: [totals] } = await client.query(`
      SELECT COALESCE(SUM(qty * price_unit), 0) AS new_total
      FROM order_items WHERE order_id = $1 AND COALESCE(status,'ativo') != 'cancelado'
    `, [orderId])

    await client.query(
      'UPDATE orders SET total = $1, updated_at = NOW() WHERE id = $2',
      [parseFloat(totals.new_total) || 0, orderId]
    )

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
    number:           o.number,
    customerId:       o.customer_id,
    customerName:     o.resolved_customer_name ?? o.customer_name,
    customerWhatsapp: o.customer_whatsapp,
    channel:          o.channel,
    paymentMethod:    o.payment_method ?? 'a_combinar',
    status:           o.status,
    total:            parseFloat(o.total ?? 0),
    notes:            o.notes,
    items:            o.items  ?? [],
    history:          o.history ?? [],
    createdAt:        o.created_at,
    updatedAt:        o.updated_at,
  }
}
