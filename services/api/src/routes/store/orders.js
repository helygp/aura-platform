import { Router }  from 'express'
import { optionalBuyerAuth, authenticateBuyer } from '../../middleware/authenticateBuyer.js'
import { query, getClient } from '../../lib/tenantDb.js'
import { prisma }  from '../../lib/prisma.js'

export const storeOrdersRouter = Router()

/* ── POST /store/orders ─────────────────────────────────────────────────────── */
storeOrdersRouter.post('/', optionalBuyerAuth, async (req, res) => {
  const { items, deliveryAddress, notes, paymentMethod } = req.body ?? {}

  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'O carrinho está vazio.' })

  const validMethods = ['pix', 'boleto', 'credito']
  if (!validMethods.includes(paymentMethod))
    return res.status(400).json({ error: 'Forma de pagamento inválida.' })

  // Crédito só para clientes logados
  if (paymentMethod === 'credito' && !req.buyer)
    return res.status(401).json({ error: 'Faça login para usar crédito.' })

  const client = await getClient(req.tenantSlug)
  try {
    await client.query('BEGIN')

    // ── Resolve SKUs ──
    const { rows: skuRows } = await client.query(`
      SELECT id, product_id, code, attributes,
             ROUND(price_wholesale * 100)::int AS price, stock
      FROM skus WHERE id = ANY($1::text[])
    `, [items.map(i => i.skuToken)])

    if (skuRows.length !== items.length) {
      await client.query('ROLLBACK')
      return res.status(422).json({ error: 'Um ou mais produtos não estão disponíveis.' })
    }

    const orderItems = []
    for (const reqItem of items) {
      const sku = skuRows.find(s => s.id === reqItem.skuToken)
      if (!sku) { await client.query('ROLLBACK'); return res.status(422).json({ error: 'SKU não encontrado.' }) }
      if (sku.stock < reqItem.quantity) {
        await client.query('ROLLBACK')
        return res.status(422).json({ error: `Estoque insuficiente para ${sku.code}. Disponível: ${sku.stock}.` })
      }
      orderItems.push({ sku, quantity: reqItem.quantity })
    }

    const totalCents = orderItems.reduce((acc, { sku, quantity }) => acc + sku.price * quantity, 0)
    const total = (totalCents / 100).toFixed(2)

    // ── Valida crédito ──
    if (paymentMethod === 'credito') {
      const available = req.buyer.creditAvailable
      if (available < totalCents) {
        await client.query('ROLLBACK')
        const fmt = v => 'R$ ' + (v / 100).toFixed(2).replace('.', ',')
        return res.status(422).json({
          error: `Crédito insuficiente. Disponível: ${fmt(available)}. Pedido: ${fmt(totalCents)}.`,
          code: 'CREDIT_LIMIT_EXCEEDED',
          available,
          required: totalCents,
        })
      }
    }

    // ── Ref ──
    const { rows: [{ ref }] } = await client.query(
      `SELECT 'ord_' || encode(gen_random_bytes(8), 'hex') AS ref`
    )

    const customerId   = req.buyer?.id ?? null
    const customerName = req.buyer?.name ?? ''

    // ── Insere pedido ──
    const { rows: [order] } = await client.query(`
      INSERT INTO orders (ref, customer_id, customer_name, channel, status, total, delivery_address, notes, payment_method)
      VALUES ($1, $2, $3, 'loja', 'pendente', $4, $5, $6, $7)
      RETURNING id, ref, created_at
    `, [ref, customerId, customerName, total, deliveryAddress ?? null, notes ?? '', paymentMethod])

    // ── Itens + estoque ──
    for (const { sku, quantity } of orderItems) {
      const { rows: [prod] } = await client.query('SELECT name FROM products WHERE id = $1', [sku.product_id])
      await client.query(`
        INSERT INTO order_items (order_id, sku_id, sku_code, product_name, attributes, qty, price_unit)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [order.id, sku.id, sku.code, prod?.name ?? '', sku.attributes, quantity, (sku.price/100).toFixed(2)])
      await client.query('UPDATE skus SET stock = stock - $1, updated_at=NOW() WHERE id=$2', [quantity, sku.id])
    }

    // ── Débito na carteira (pagamento crédito) ──
    if (paymentMethod === 'credito' && customerId) {
      const amountDecimal = total
      await client.query(`
        INSERT INTO wallet_transactions (customer_id, type, amount, description, order_ref, created_by)
        VALUES ($1,'debit',$2,$3,$4,'system')
      `, [customerId, amountDecimal, `Pedido ${ref}`, ref])
      await client.query(
        'UPDATE customers SET credit_balance = credit_balance + $1, updated_at=NOW() WHERE id=$2',
        [amountDecimal, customerId]
      )
    }

    await client.query('COMMIT')

    notifyOwner(req.tenantSlug, ref, total, orderItems).catch(e =>
      console.error('[store/orders] notify:', e.message)
    )

    res.status(201).json({ ref })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[store/orders POST]', err.message)
    res.status(500).json({ error: 'Erro ao criar pedido. Tente novamente.' })
  } finally {
    client.release()
  }
})

/* ── GET /store/orders/:ref ─────────────────────────────────────────────────── */
storeOrdersRouter.get('/:ref', async (req, res) => {
  try {
    const { ref } = req.params
    if (!/^ord_[0-9a-f]{16}$/.test(ref))
      return res.status(404).json({ error: 'Pedido não encontrado.' })

    const { rows: [order] } = await query(
      'SELECT ref, status, total, payment_method AS "paymentMethod", created_at AS "createdAt" FROM orders WHERE ref=$1', [ref]
    )
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' })

    const { rows: items } = await query(`
      SELECT oi.product_name AS name, oi.sku_code AS "skuCode",
             oi.attributes AS variant, oi.qty AS quantity, oi.price_unit AS price,
             s.id AS "skuId", p.code AS "productSlug"
      FROM order_items oi
      LEFT JOIN skus     s ON s.id = oi.sku_id
      LEFT JOIN products p ON p.id = s.product_id
      WHERE oi.order_id = (SELECT id FROM orders WHERE ref=$1)
      ORDER BY oi.id
    `, [ref])

    res.json({
      ref:           order.ref,
      status:        order.status,
      paymentMethod: order.paymentMethod,
      total:         Number(order.total),
      createdAt:     order.createdAt,
      items:         items.map(i => ({
        name:        i.name,
        variant:     formatVariant(i.variant),
        quantity:    i.quantity,
        price:       Number(i.price),
        skuId:       i.skuId ?? null,
        skuCode:     i.skuCode ?? null,
        productSlug: i.productSlug ?? null,
      })),
      timeline: buildTimeline(order.status, order.createdAt),
    })
  } catch (err) {
    console.error('[store/orders GET /:ref]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── GET /store/orders ──────────────────────────────────────────────────────── */
storeOrdersRouter.get('/', authenticateBuyer, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT o.ref, o.status, o.total,
              o.payment_method AS "paymentMethod",
              o.created_at     AS "createdAt",
              COUNT(oi.id)::int AS "itemsCount"
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.customer_id=$1 AND o.channel='loja'
       GROUP BY o.id, o.ref, o.status, o.total, o.payment_method, o.created_at
       ORDER BY o.created_at DESC LIMIT 50`,
      [req.buyer.id]
    )
    res.json(rows.map(r => ({
      ...r,
      total: Number(r.total),
      // items é esperado como array pelo frontend — retorna array vazio com length correto
      items: Array.from({ length: r.itemsCount ?? 0 }, (_, i) => ({ name: `item${i}` })),
      timeline: [],
    })))
  } catch (err) {
    console.error('[store/orders GET /]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── PATCH /store/orders/:ref/cancel ────────────────────────────────────────── */
storeOrdersRouter.patch('/:ref/cancel', async (req, res) => {
  const { ref } = req.params
  if (!/^ord_[0-9a-f]{16}$/.test(ref))
    return res.status(404).json({ error: 'Pedido não encontrado.' })

  const client = await getClient(req.tenantSlug)
  try {
    await client.query('BEGIN')
    const { rows: [order] } = await client.query(
      'SELECT id, status, customer_id, total, payment_method FROM orders WHERE ref=$1 FOR UPDATE', [ref]
    )
    if (!order) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pedido não encontrado.' }) }
    if (order.status !== 'pendente') {
      await client.query('ROLLBACK')
      return res.status(422).json({ error: 'Este pedido não pode mais ser cancelado.' })
    }

    await client.query(`UPDATE orders SET status='cancelado', updated_at=NOW() WHERE id=$1`, [order.id])

    const { rows: itens } = await client.query('SELECT sku_id, qty FROM order_items WHERE order_id=$1', [order.id])
    for (const item of itens)
      await client.query('UPDATE skus SET stock=stock+$1, updated_at=NOW() WHERE id=$2', [item.qty, item.sku_id])

    // Estorna crédito se aplicável
    if (order.payment_method === 'credito' && order.customer_id) {
      const { rows: [wt] } = await client.query(
        'SELECT id FROM wallet_transactions WHERE order_ref=$1 AND type=$2', [ref, 'debit']
      )
      if (wt) {
        const amt = (Number(order.total) / 100).toFixed(2)
        await client.query(
          `INSERT INTO wallet_transactions (customer_id,type,amount,description,order_ref,created_by) VALUES ($1,'credit',$2,$3,$4,'system')`,
          [order.customer_id, amt, `Estorno cancelamento ${ref}`, ref]
        )
        await client.query(
          'UPDATE customers SET credit_balance=GREATEST(0,credit_balance-$1),updated_at=NOW() WHERE id=$2',
          [amt, order.customer_id]
        )
      }
    }

    await client.query('COMMIT')
    res.json({ ref, status: 'cancelado' })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[store/orders PATCH cancel]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  } finally {
    client.release()
  }
})

/* ── GET /store/buyer/wallet ─────────────────────────────────────────────────── */
storeOrdersRouter.get('/buyer/wallet', authenticateBuyer, async (req, res) => {
  try {
    const { rows: transactions } = await query(`
      SELECT type, amount, description, order_ref AS "orderRef", created_at AS "createdAt"
      FROM wallet_transactions WHERE customer_id=$1
      ORDER BY created_at DESC LIMIT 50
    `, [req.buyer.id])

    res.json({
      creditLimit:     req.buyer.creditLimit,
      creditUsed:      req.buyer.creditBalance,
      creditAvailable: req.buyer.creditAvailable,
      transactions:    transactions.map(t => ({ ...t, amount: Math.round(parseFloat(t.amount) * 100) })),
    })
  } catch (err) {
    console.error('[store/buyer/wallet]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── Helpers ─────────────────────────────────────────────────────────────────── */
async function notifyOwner(tenantSlug, ref, total, orderItems) {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { name: true } })
    if (!tenant) return
    const { notify } = await import('../../../notify/src/index.js')
    await notify({
      tenantSlug, channel: 'inapp', template: 'new_store_order',
      data: {
        ref,
        total: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total / 100),
        items: orderItems.map(({ sku, quantity }) => `${quantity}x ${sku.code}`).join(', '),
        storeName: tenant.name,
      },
    })
  } catch { /* não crítico */ }
}

const STATUS_LABELS = {
  pendente:'Pedido recebido', confirmado:'Confirmado',
  separando:'Em separação',   enviado:'Enviado', entregue:'Entregue',
}
function buildTimeline(currentStatus, createdAt) {
  const flow = ['pendente','confirmado','separando','enviado','entregue']
  const idx  = flow.indexOf(currentStatus)
  if (idx === -1) return []
  return flow.slice(0, idx+1).map((s,i) => ({ status: STATUS_LABELS[s]??s, at: i===0?createdAt:null }))
}
function formatVariant(attributes) {
  if (!attributes || typeof attributes !== 'object') return ''
  return Object.entries(attributes).map(([k,v])=>`${k}: ${v}`).join(' · ')
}
