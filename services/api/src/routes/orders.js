/**
 * routes/orders.js
 *
 * GET  /api/orders                            — lista com filtros
 * POST /api/orders                            — cria pedido manual (valida SKU/estoque)
 * PUT  /api/orders/:id/status                 — muda status (com side-effects p/ cancelamento)
 * POST /api/orders/:id/items                  — adiciona item (só até status 'separando')
 * PUT  /api/orders/:id/items/:itemId          — edita qty (só até 'separando')
 * DELETE /api/orders/:id/items/:itemId        — remove item (só até 'separando')
 * PATCH /api/orders/:id/items/:itemId/cancel  — cancela item (mantém linha, devolve estoque)
 * POST /api/orders/:id/return                 — devolução parcial/total (pedido 'entregue')
 *
 * Tickets #83 + #117:
 *  - Cancelamento via PUT /status agora estorna wallet + devolve estoque (era stub).
 *  - Edição de itens passou a registrar order_history corretamente (enum estendido).
 *  - Qualquer mudança no total propaga em wallet_transactions + customers.credit_balance
 *    para pedidos com payment_method='credito'.
 *  - Devolução é uma nova rota, com motivo obrigatório. Devolução total = cancelamento.
 */

import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize }    from '../middleware/authorize.js'
import { query, getClient } from '../lib/tenantDb.js'
import { dispatch } from '../lib/webhookDispatcher.js'

const VALID_PAYMENT_METHODS = ['pix', 'boleto', 'a_combinar', 'credito']
const EDITABLE_STATUSES     = ['pendente', 'confirmado', 'separando']

/* ────────────────────────────────────────────────────────────────────────── */
/* HELPERS                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

/** Registra movimentação de estoque. */
async function logMovement(client, { skuId, type, qty, qtyBefore, reason, userName, orderId, customerName }) {
  await client.query(`
    INSERT INTO stock_movements (sku_id, type, qty, qty_before, qty_after, reason, user_name, order_id, customer_name)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  `, [skuId, type, Math.abs(qty), qtyBefore,
      qtyBefore + (type === 'saida' ? -Math.abs(qty) : Math.abs(qty)),
      reason, userName, orderId ?? null, customerName ?? null])
}

/**
 * Ajusta saldo devedor do cliente (wallet B2B) quando o valor líquido do
 * pedido muda. Só atua em pedidos a crédito com cliente associado.
 *
 *   deltaDecimal > 0 → débito  (acréscimo a pagar)
 *   deltaDecimal < 0 → crédito (estorno)
 *   deltaDecimal ≈ 0 → no-op
 *
 * `description` é o texto que aparece no extrato; precisa começar com
 * "Estorno" quando for crédito relacionado a cancelamento total (a guarda
 * de idempotência em `cancelOrderFully` usa essa convenção).
 */
async function applyOrderWalletDelta(client, { order, deltaDecimal, description, userName, consolidate = false }) {
  if (!order || !order.customer_id) return
  if (order.payment_method !== 'credito') return
  const d = parseFloat(deltaDecimal)
  if (!d || Math.abs(d) < 0.005) return

  const abs = Math.abs(d).toFixed(2)
  const type = d > 0 ? 'debit' : 'credit'

  // Consolidação: se o caller pede E há transação recente do mesmo pedido/tipo/usuário
  // (descrição começa com "Ajuste pedido"), atualiza o amount somando o delta + contador.
  if (consolidate) {
    const { rows: [recent] } = await client.query(`
      SELECT id, amount, description FROM wallet_transactions
      WHERE order_ref = $1 AND type = $2 AND created_by = $3
        AND order_status IS NOT DISTINCT FROM $4
        AND created_at > NOW() - INTERVAL '10 minutes'
        AND description ILIKE 'Ajuste pedido%'
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
    `, [order.id, type, userName ?? 'erp', order.status ?? null])

    if (recent) {
      const newAmount = (parseFloat(recent.amount) + parseFloat(abs)).toFixed(2)
      const oldDesc = recent.description ?? ''
      const m = oldDesc.match(/\((\d+) alteraç[ãa]o[es]*\)\s*$/)
      const count = m ? parseInt(m[1]) + 1 : 2
      const newDesc = `Ajuste pedido ${order.id.slice(-6).toUpperCase()} (${count} alterações)`
      await client.query(`
        UPDATE wallet_transactions
        SET amount = $1, description = $2, created_at = NOW()
        WHERE id = $3
      `, [newAmount, newDesc, recent.id])

      if (type === 'debit') {
        await client.query(
          'UPDATE customers SET credit_balance = credit_balance + $1, updated_at = NOW() WHERE id = $2',
          [abs, order.customer_id]
        )
      } else {
        await client.query(
          'UPDATE customers SET credit_balance = GREATEST(0, credit_balance - $1), updated_at = NOW() WHERE id = $2',
          [abs, order.customer_id]
        )
      }
      return
    }
  }

  // Caso padrão (não consolida): cria nova transação
  await client.query(`
    INSERT INTO wallet_transactions (customer_id, type, amount, description, order_ref, created_by, order_status)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [order.customer_id, type, abs, description, order.id, userName ?? 'erp', order.status ?? null])

  if (type === 'debit') {
    await client.query(
      'UPDATE customers SET credit_balance = credit_balance + $1, updated_at = NOW() WHERE id = $2',
      [abs, order.customer_id]
    )
  } else {
    await client.query(
      'UPDATE customers SET credit_balance = GREATEST(0, credit_balance - $1), updated_at = NOW() WHERE id = $2',
      [abs, order.customer_id]
    )
  }
}

/**
 * Registra um evento em order_history.
 *
 * Quando consolidate=true, verifica se a ÚLTIMA linha do history desse pedido
 * tem o mesmo status do evento + mesmo user_name + foi criada nos últimos 10 min.
 * Se sim, atualiza concatenando a nova nota (separada por '\n') e move o
 * created_at para now(). Se não, insere normal.
 *
 * Quebra natural: se entre dois "item_editado" houve transição de status
 * (confirmado, separando, etc), a última linha já não bate o critério.
 */
async function logHistory(client, orderId, status, note, userName, { consolidate = false } = {}) {
  if (consolidate) {
    const { rows: [last] } = await client.query(`
      SELECT id, status::text AS status, note, user_name, created_at
      FROM order_history
      WHERE order_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
    `, [orderId])

    if (last
        && last.status === status
        && last.user_name === userName
        && new Date(last.created_at).getTime() > Date.now() - 10 * 60 * 1000) {
      const combined = last.note ? `${last.note}\n${note}` : note
      await client.query(
        'UPDATE order_history SET note = $1, created_at = NOW() WHERE id = $2',
        [combined, last.id]
      )
      return
    }
  }

  await client.query(`
    INSERT INTO order_history (order_id, status, note, user_name)
    VALUES ($1, $2, $3, $4)
  `, [orderId, status, note, userName])
}

/**
 * Resolve um reasonId em label, validando o kind esperado ('cancellation' | 'return').
 * Retorna { id, label, kind } ou null se não encontrado/kind divergente.
 */
async function resolveReason(client, reasonId, expectedKind) {
  if (!reasonId) return null
  const { rows: [r] } = await client.query(
    `SELECT id, kind::text AS kind, label FROM order_reasons WHERE id = $1 AND active = true`,
    [reasonId]
  )
  if (!r) return null
  if (expectedKind && r.kind !== expectedKind) return null
  return r
}

/** Carrega pedido em modo gravação (FOR UPDATE). Retorna `null` se não existir. */
async function loadOrderForUpdate(client, orderId) {
  const { rows: [order] } = await client.query(
    `SELECT id, customer_id, customer_name, payment_method, status, total
     FROM orders WHERE id = $1 FOR UPDATE`,
    [orderId]
  )
  return order ?? null
}

/** Lança erro 422 se o pedido não está em estado que aceita edição de itens. */
function assertEditable(order) {
  if (!EDITABLE_STATUSES.includes(order.status)) {
    const err = new Error(
      `Edição de itens só é permitida até o status "separando". ` +
      `Pedido atual: "${order.status}". ` +
      `Para pedidos entregues use devolução; pedidos cancelados não podem ser editados.`
    )
    err.statusCode = 422
    throw err
  }
}

/**
 * Cancela o pedido por completo com TODOS os side-effects:
 *   - devolve estoque dos itens ativos (qty - qty_returned)
 *   - marca itens e pedido como 'cancelado'
 *   - estorna em wallet o saldo ainda em aberto (idempotente via descrição)
 *   - registra em order_history
 *
 * NÃO faz dispatch (caller decide). NÃO faz BEGIN/COMMIT (caller decide).
 */
async function cancelOrderFully(client, order, { reason, userName, historyStatus = 'cancelado' }) {
  // Idempotência básica
  if (order.status === 'cancelado') {
    return { changed: false, reason: 'já cancelado' }
  }

  // 1. Devolve estoque (somente o que ainda estava ativo)
  const { rows: items } = await client.query(`
    SELECT oi.id, oi.sku_id, oi.qty, oi.qty_returned, oi.product_name, s.stock
    FROM order_items oi
    JOIN skus s ON s.id = oi.sku_id
    WHERE oi.order_id = $1 AND COALESCE(oi.status,'ativo') != 'cancelado'
  `, [order.id])

  for (const item of items) {
    const restoreQty = (item.qty ?? 0) - (item.qty_returned ?? 0)
    if (restoreQty <= 0) continue
    await client.query(
      'UPDATE skus SET stock = stock + $1, updated_at = NOW() WHERE id = $2',
      [restoreQty, item.sku_id]
    )
    await logMovement(client, {
      skuId: item.sku_id, type: 'entrada', qty: restoreQty, qtyBefore: item.stock,
      reason: `Cancelamento pedido ${order.id.slice(-6).toUpperCase()}${reason ? ' — ' + reason : ''}`,
      userName, orderId: order.id, customerName: order.customer_name,
    })
  }

  // 2. Marca itens e pedido como cancelado
  await client.query(
    `UPDATE order_items SET status='cancelado', updated_at = NOW()
     WHERE order_id = $1 AND COALESCE(status,'ativo') != 'cancelado'`,
    [order.id]
  )
  await client.query(
    "UPDATE orders SET status='cancelado', updated_at = NOW() WHERE id = $1",
    [order.id]
  )

  // 3. Estorna wallet (idempotente: se já há crédito 'Estorno%' p/ este pedido, pula)
  if (order.payment_method === 'credito' && order.customer_id) {
    const { rows: [existingEstorno] } = await client.query(`
      SELECT id FROM wallet_transactions
      WHERE order_ref = $1 AND type = 'credit' AND description ILIKE 'Estorno%'
      LIMIT 1
    `, [order.id])

    if (!existingEstorno) {
      // Quanto ainda está em aberto = total - tudo que já foi creditado (devoluções parciais)
      const { rows: [{ refunded }] } = await client.query(`
        SELECT COALESCE(SUM(amount), 0) AS refunded
        FROM wallet_transactions
        WHERE order_ref = $1 AND type = 'credit'
      `, [order.id])
      const toRefund = +(parseFloat(order.total ?? 0) - parseFloat(refunded ?? 0)).toFixed(2)
      if (toRefund > 0) {
        await applyOrderWalletDelta(client, {
          order,
          deltaDecimal: -toRefund,
          description: `Estorno cancelamento ${order.id.slice(-6).toUpperCase()}${reason ? ' — ' + reason : ''}`,
          userName,
        })
      }
    }
  }

  // 4. order_history
  await client.query(`
    INSERT INTO order_history (order_id, status, note, user_name)
    VALUES ($1, $2, $3, $4)
  `, [order.id, historyStatus,
      reason ? `Cancelado: ${reason}` : 'Pedido cancelado',
      userName])

  return { changed: true }
}

/** Recalcula `orders.total` a partir do soma dos itens ativos (descontando devolvidos). */
async function recalcOrderTotal(client, orderId) {
  const { rows: [t] } = await client.query(`
    SELECT COALESCE(SUM((qty - qty_returned) * price_unit), 0) AS new_total
    FROM order_items
    WHERE order_id = $1 AND COALESCE(status,'ativo') != 'cancelado'
  `, [orderId])
  const total = parseFloat(t.new_total) || 0
  await client.query(
    'UPDATE orders SET total = $1, updated_at = NOW() WHERE id = $2',
    [total, orderId]
  )
  return total
}

/* ────────────────────────────────────────────────────────────────────────── */
/* ROUTER                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

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
            'qty', oi.qty, 'qtyReturned', oi.qty_returned, 'priceUnit', oi.price_unit,
            'status', COALESCE(oi.status, 'ativo')
          )
          ORDER BY oi.created_at, oi.id
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
      await applyOrderWalletDelta(client, {
        order: { ...order, customer_id: customerId },
        deltaDecimal: total,
        description: `Pedido ERP ${order.id.slice(-6).toUpperCase()}`,
        userName: 'erp',
      })
    }

    await client.query('COMMIT')

    // Ticket #49: limpa rascunho do usuario apos criacao bem-sucedida
    try { await client.query('DELETE FROM order_drafts WHERE user_id = $1', [req.user.id]) } catch (_) { /* best-effort */ }
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

/* ── PUT /api/orders/:id/status ──
 * Body: { status, note?, reason? }
 *
 * Quando newStatus === 'cancelado' e o pedido NÃO estava cancelado, dispara
 * o cancelamento completo (estoque + wallet + history). Para outras transições
 * mantém o comportamento simples de mudar status.
 */
ordersRouter.put('/:id/status', async (req, res) => {
  const client = await getClient()
  try {
    await client.query('BEGIN')
    const { status, note = '', reasonId } = req.body
    const userName = req.user?.name ?? req.user?.email ?? 'sistema'

    const order = await loadOrderForUpdate(client, req.params.id)
    if (!order) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pedido não encontrado.' }) }

    const isCancelling = status === 'cancelado' && order.status !== 'cancelado'

    let reasonText = ''
    if (isCancelling) {
      if (!reasonId) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'Motivo do cancelamento é obrigatório (reasonId).' })
      }
      const r = await resolveReason(client, reasonId, 'cancellation')
      if (!r) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'Motivo de cancelamento inválido ou inativo.' })
      }
      reasonText = note?.trim() ? `${r.label} — ${note.trim()}` : r.label
    }

    if (isCancelling) {
      await cancelOrderFully(client, order, { reason: reasonText, userName })
    } else {
      await client.query(
        'UPDATE orders SET status=$1, updated_at=now() WHERE id=$2',
        [status, req.params.id]
      )
      await client.query(`
        INSERT INTO order_history (order_id, status, note, user_name) VALUES ($1,$2,$3,$4)
      `, [req.params.id, status, note, userName])
    }

    await client.query('COMMIT')
    res.json({ ok: true, cancelled: isCancelling })
    dispatch(req.tenantSlug ?? process.env.TENANT_SLUG, 'order.status_changed', {
      id: req.params.id, new_status: status, note, reason: reasonText || undefined,
    })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[orders/status]', err.message)
    const code = err.statusCode || 500
    res.status(code).json({ error: code === 500 ? 'Erro interno.' : err.message })
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

    const order = await loadOrderForUpdate(client, orderId)
    if (!order) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pedido não encontrado.' }) }
    assertEditable(order)

    const qtyInt = parseInt(qty)
    if (!skuId || qtyInt < 1) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'SKU inválido ou quantidade incorreta.' })
    }

    const { rows: [sku] } = await client.query(`
      SELECT s.id, s.code, s.attributes, s.price_wholesale, s.stock,
             p.name AS product_name
      FROM skus s
      JOIN products p ON p.id = s.product_id
      WHERE s.id = $1
    `, [skuId])

    if (!sku) { await client.query('ROLLBACK'); return res.status(404).json({ error: `SKU ${skuId} não encontrado.` }) }

    if (sku.stock < qtyInt) {
      await client.query('ROLLBACK')
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

    const newTotal = await recalcOrderTotal(client, orderId)

    await applyOrderWalletDelta(client, {
      order, deltaDecimal: +itemTotal,
      description: `Ajuste pedido ${orderId.slice(-6).toUpperCase()}: ${sku.product_name} +${qtyInt}x`,
      userName, consolidate: true,
    })

    await logHistory(client, orderId, 'item_adicionado',
      `${sku.product_name} (+${qtyInt}x)`, userName, { consolidate: true })

    await client.query('COMMIT')
    res.status(201).json({ ok: true, itemTotal, newOrderTotal: newTotal })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[orders/items/add]', err.message)
    const code = err.statusCode || 500
    res.status(code).json({ error: code === 500 ? 'Erro ao adicionar item.' : err.message })
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
    if (qtyInt < 1) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Quantidade deve ser >= 1.' }) }

    const order = await loadOrderForUpdate(client, orderId)
    if (!order) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pedido não encontrado.' }) }
    assertEditable(order)

    const { rows: [item] } = await client.query(`
      SELECT oi.id, oi.sku_id, oi.qty AS old_qty, oi.qty_returned, oi.product_name, oi.price_unit, s.stock,
             COALESCE(oi.status,'ativo') AS item_status
      FROM order_items oi
      JOIN skus s ON s.id = oi.sku_id
      WHERE oi.id = $1 AND oi.order_id = $2
    `, [itemId, orderId])

    if (!item) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Item não encontrado.' }) }
    if (item.item_status === 'cancelado') {
      await client.query('ROLLBACK')
      return res.status(422).json({ error: 'Item cancelado não pode ser editado.' })
    }
    if (qtyInt < (item.qty_returned ?? 0)) {
      await client.query('ROLLBACK')
      return res.status(422).json({ error: `Quantidade não pode ser menor que o já devolvido (${item.qty_returned}).` })
    }

    const qtyDiff = qtyInt - item.old_qty
    if (qtyDiff > 0 && item.stock < qtyDiff) {
      await client.query('ROLLBACK')
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
        userName, orderId, customerName: order.customer_name,
      })

      await applyOrderWalletDelta(client, {
        order, deltaDecimal: qtyDiff * parseFloat(item.price_unit),
        description: `Ajuste pedido ${orderId.slice(-6).toUpperCase()}: ${item.product_name} (${item.old_qty}x→${qtyInt}x)`,
        userName, consolidate: true,
      })
    }

    const newTotal = await recalcOrderTotal(client, orderId)

    await logHistory(client, orderId, 'item_editado',
      `${item.product_name}: ${item.old_qty}x → ${qtyInt}x`, userName, { consolidate: true })

    await client.query('COMMIT')
    res.json({ ok: true, newOrderTotal: newTotal })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[orders/items/update]', err.message)
    const code = err.statusCode || 500
    res.status(code).json({ error: code === 500 ? 'Erro ao editar item.' : err.message })
  } finally { client.release() }
})

/* ── PATCH /api/orders/:id/items/:itemId/cancel — cancela item (parcial ou total) ── */
ordersRouter.patch('/:id/items/:itemId/cancel', authorize('admin','operador'), async (req, res) => {
  const client = await getClient()
  try {
    await client.query('BEGIN')

    const { id: orderId, itemId } = req.params
    const userName = req.user?.name ?? req.user?.email ?? 'operador'

    const order = await loadOrderForUpdate(client, orderId)
    if (!order) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pedido não encontrado.' }) }

    if (!EDITABLE_STATUSES.includes(order.status)) {
      await client.query('ROLLBACK')
      return res.status(422).json({
        error: `Cancelamento de item não permitido: pedido está "${order.status}". Só é possível cancelar itens em pedidos pendentes, confirmados ou em separação.`,
      })
    }

    const { rows: [item] } = await client.query(`
      SELECT oi.id, oi.sku_id, oi.qty, oi.qty_returned, oi.price_unit, oi.product_name,
             COALESCE(oi.status,'ativo') AS status, s.stock
      FROM order_items oi
      JOIN skus s ON s.id = oi.sku_id
      WHERE oi.id = $1 AND oi.order_id = $2
    `, [itemId, orderId])

    if (!item) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Item não encontrado.' }) }
    if (item.status === 'cancelado') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Item já cancelado.' }) }

    const cancelQty = Math.min(
      Math.max(1, parseInt(req.body?.cancelQty) || item.qty),
      item.qty
    )
    const isPartial = cancelQty < item.qty

    if (isPartial) {
      // Reduz qty do item original; insere linha cancelada separada
      await client.query(
        'UPDATE order_items SET qty = qty - $1, updated_at = NOW() WHERE id = $2',
        [cancelQty, itemId]
      )
      await client.query(`
        INSERT INTO order_items (order_id, sku_id, sku_code, product_name, attributes, qty, price_unit, status)
        SELECT order_id, sku_id, sku_code, product_name, attributes, $1, price_unit, 'cancelado'
        FROM order_items WHERE id = $2
      `, [cancelQty, itemId])
    } else {
      // Cancela linha inteira
      await client.query(
        "UPDATE order_items SET status='cancelado', updated_at=NOW() WHERE id=$1",
        [itemId]
      )
    }

    // Devolve apenas a qty cancelada ao estoque
    await client.query(
      'UPDATE skus SET stock = stock + $1, updated_at = NOW() WHERE id = $2',
      [cancelQty, item.sku_id]
    )

    await logMovement(client, {
      skuId: item.sku_id, type: 'entrada', qty: cancelQty,
      qtyBefore: item.stock,
      reason: `Cancelamento ${isPartial ? 'parcial' : ''} item pedido ${orderId.slice(-6).toUpperCase()}`,
      userName, orderId, customerName: order.customer_name,
    })

    // Estorna em wallet o valor do cancelamento
    await applyOrderWalletDelta(client, {
      order, deltaDecimal: -(cancelQty * parseFloat(item.price_unit)),
      description: `Ajuste pedido ${orderId.slice(-6).toUpperCase()}: ${item.product_name} cancelado (${cancelQty}x)`,
      userName, consolidate: true,
    })

    const newTotal = await recalcOrderTotal(client, orderId)

    const noteQty = isPartial ? `${cancelQty} de ${item.qty}` : `${item.qty}`
    await logHistory(client, orderId, 'item_cancelado',
      `${item.product_name} (${noteQty}x cancelado)`, userName, { consolidate: true })

    await client.query('COMMIT')
    res.json({ ok: true, cancelQty, isPartial, newOrderTotal: newTotal })
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

    const order = await loadOrderForUpdate(client, orderId)
    if (!order) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pedido não encontrado.' }) }
    assertEditable(order)

    const { rows: [item] } = await client.query(`
      SELECT oi.id, oi.sku_id, oi.qty, oi.qty_returned, oi.price_unit, oi.product_name,
             COALESCE(oi.status,'ativo') AS status, s.stock
      FROM order_items oi
      JOIN skus s ON s.id = oi.sku_id
      WHERE oi.id = $1 AND oi.order_id = $2
    `, [itemId, orderId])

    if (!item) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Item não encontrado.' }) }

    await client.query('DELETE FROM order_items WHERE id = $1', [itemId])

    // Só devolve estoque + estorna wallet se item não estava já cancelado
    if (item.status !== 'cancelado') {
      const restoreQty = item.qty - (item.qty_returned ?? 0)
      if (restoreQty > 0) {
        await client.query(
          'UPDATE skus SET stock = stock + $1, updated_at = NOW() WHERE id = $2',
          [restoreQty, item.sku_id]
        )
        await logMovement(client, {
          skuId: item.sku_id, type: 'entrada', qty: restoreQty,
          qtyBefore: item.stock,
          reason: `Item removido pedido ${orderId.slice(-6).toUpperCase()}`,
          userName, orderId, customerName: order.customer_name,
        })
      }

      const refund = restoreQty * parseFloat(item.price_unit)
      if (refund > 0) {
        await applyOrderWalletDelta(client, {
          order, deltaDecimal: -refund,
          description: `Ajuste pedido ${orderId.slice(-6).toUpperCase()}: ${item.product_name} removido`,
          userName, consolidate: true,
        })
      }
    }

    const newTotal = await recalcOrderTotal(client, orderId)

    await logHistory(client, orderId, 'item_removido',
      `${item.product_name} (${item.qty}x removido)`, userName, { consolidate: true })

    await client.query('COMMIT')
    res.json({ ok: true, newOrderTotal: newTotal })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[orders/items/delete]', err.message)
    const code = err.statusCode || 500
    res.status(code).json({ error: code === 500 ? 'Erro ao remover item.' : err.message })
  } finally { client.release() }
})

/* ── POST /api/orders/:id/return — devolução parcial ou total ──
 *  Body: { items?: [{ itemId, qty }], reason }
 *
 *  - Pedido deve estar em 'entregue'. Motivo é obrigatório.
 *  - Se `items` ausente ou vazio: devolução total (= cancelar pedido entregue).
 *  - Para devolução parcial: aumenta order_items.qty_returned, devolve estoque,
 *    estorna wallet proporcionalmente.
 */
ordersRouter.post('/:id/return', authorize('admin','operador'), async (req, res) => {
  const client = await getClient()
  try {
    await client.query('BEGIN')

    const orderId  = req.params.id
    const userName = req.user?.name ?? req.user?.email ?? 'operador'
    const { items: reqItems = [], reasonId, note = '' } = req.body || {}

    if (!reasonId) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Motivo da devolução é obrigatório (reasonId).' })
    }
    const reasonRow = await resolveReason(client, reasonId, 'return')
    if (!reasonRow) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Motivo de devolução inválido ou inativo.' })
    }
    const reason = note?.trim() ? `${reasonRow.label} — ${note.trim()}` : reasonRow.label

    const order = await loadOrderForUpdate(client, orderId)
    if (!order) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pedido não encontrado.' }) }

    if (order.status !== 'entregue') {
      await client.query('ROLLBACK')
      return res.status(422).json({
        error: `Devolução só é permitida em pedidos com status "entregue". Atual: "${order.status}".`,
      })
    }

    // Devolução total: simplesmente cancela o pedido (com motivo)
    const isTotal = !Array.isArray(reqItems) || reqItems.length === 0
    if (isTotal) {
      await cancelOrderFully(client, order, {
        reason, userName, historyStatus: 'devolucao_total',
      })
      await client.query('COMMIT')
      res.json({ ok: true, type: 'total' })
      return
    }

    // Devolução parcial: itera os itens informados
    let totalRefund = 0
    const summaries = []

    for (const ri of reqItems) {
      const retQty = parseInt(ri.qty)
      if (!ri.itemId || !(retQty > 0)) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'Itens inválidos para devolução.' })
      }

      const { rows: [item] } = await client.query(`
        SELECT oi.id, oi.sku_id, oi.qty, oi.qty_returned, oi.price_unit, oi.product_name,
               COALESCE(oi.status,'ativo') AS status, s.stock
        FROM order_items oi
        JOIN skus s ON s.id = oi.sku_id
        WHERE oi.id = $1 AND oi.order_id = $2
      `, [ri.itemId, orderId])

      if (!item) { await client.query('ROLLBACK'); return res.status(404).json({ error: `Item ${ri.itemId} não encontrado.` }) }
      if (item.status === 'cancelado') { await client.query('ROLLBACK'); return res.status(422).json({ error: `Item "${item.product_name}" está cancelado.` }) }

      const remaining = item.qty - (item.qty_returned ?? 0)
      if (retQty > remaining) {
        await client.query('ROLLBACK')
        return res.status(422).json({
          error: `Quantidade a devolver (${retQty}) maior que o disponível para "${item.product_name}" (${remaining}).`,
        })
      }

      // Atualiza qty_returned, devolve estoque, contabiliza refund
      await client.query(
        'UPDATE order_items SET qty_returned = qty_returned + $1, updated_at = NOW() WHERE id = $2',
        [retQty, item.id]
      )
      await client.query(
        'UPDATE skus SET stock = stock + $1, updated_at = NOW() WHERE id = $2',
        [retQty, item.sku_id]
      )
      await logMovement(client, {
        skuId: item.sku_id, type: 'entrada', qty: retQty, qtyBefore: item.stock,
        reason: `Devolução pedido ${orderId.slice(-6).toUpperCase()}: ${reason}`,
        userName, orderId, customerName: order.customer_name,
      })

      const itemRefund = retQty * parseFloat(item.price_unit)
      totalRefund += itemRefund
      summaries.push(`${item.product_name} (${retQty}x)`)
    }

    // Estorno único agregando todos os itens (uma linha em wallet_transactions)
    if (totalRefund > 0) {
      await applyOrderWalletDelta(client, {
        order, deltaDecimal: -totalRefund,
        description: `Devolução parcial pedido ${orderId.slice(-6).toUpperCase()} — ${reason}`,
        userName,
      })
    }

    const newTotal = await recalcOrderTotal(client, orderId)

    // Se a devolução parcial deixou TUDO devolvido, escala para cancelamento total
    // (history = devolucao_total, status do pedido = cancelado).
    const { rows: [{ remaining }] } = await client.query(`
      SELECT COALESCE(SUM(qty - qty_returned), 0) AS remaining
      FROM order_items
      WHERE order_id = $1 AND COALESCE(status,'ativo') != 'cancelado'
    `, [orderId])

    if (parseInt(remaining) === 0) {
      await cancelOrderFully(client, order, {
        reason, userName, historyStatus: 'devolucao_total',
      })
      await client.query('COMMIT')
      return res.json({ ok: true, type: 'total_via_parcial', refund: +totalRefund.toFixed(2), newOrderTotal: 0 })
    }

    await client.query(`
      INSERT INTO order_history (order_id, status, note, user_name)
      VALUES ($1, 'devolucao_parcial', $2, $3)
    `, [orderId, `Devolução: ${summaries.join(', ')} — Motivo: ${reason}`, userName])

    await client.query('COMMIT')
    res.json({ ok: true, type: 'parcial', refund: +totalRefund.toFixed(2), newOrderTotal: newTotal })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[orders/return]', err.message)
    const code = err.statusCode || 500
    res.status(code).json({ error: code === 500 ? 'Erro ao processar devolução.' : err.message })
  } finally { client.release() }
})

/* ────────────────────────────────────────────────────────────────────────── */
/* NORMALIZAÇÃO                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

function normalizeOrder(o) {
  return {
    id:               o.id,
    ref:              o.ref ?? null,
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
