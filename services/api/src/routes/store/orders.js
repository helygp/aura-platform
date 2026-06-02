/**
 * routes/store/orders.js
 * Pedidos B2B da loja pública.
 *
 * POST /store/orders        — cria pedido, notifica dono
 * GET  /store/orders        — histórico do comprador (requer auth)
 * GET  /store/orders/:ref   — status público por token opaco
 *
 * Segurança:
 *   - IDs internos NUNCA na resposta — só ref = token opaco (ord_<nanoid>)
 *   - Tenant isolation via X-Tenant-Slug
 *   - Rate limiting configurado no index.js
 */

import { Router }  from 'express'
import { optionalBuyerAuth, authenticateBuyer } from '../../middleware/authenticateBuyer.js'
import { query, getClient } from '../../lib/tenantDb.js'
import { prisma }  from '../../lib/prisma.js'

export const storeOrdersRouter = Router()


/* ─────────────────────────────────────────────────────────────────────────────
 * POST /store/orders — cria pedido B2B
 * ───────────────────────────────────────────────────────────────────────────── */
storeOrdersRouter.post('/', optionalBuyerAuth, async (req, res) => {
  const { items, deliveryAddress, notes, paymentMethod } = req.body ?? {}

  // ── Validação básica ──
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'O carrinho está vazio.' })
  }
  if (!['pix', 'boleto', 'a_combinar'].includes(paymentMethod)) {
    return res.status(400).json({ error: 'Forma de pagamento inválida.' })
  }

  const client = await getClient(req.tenantSlug)

  try {
    await client.query('BEGIN')

    // ── Resolve SKUs pelos tokens opacos ──
    // token = encode(sha256(id::text::bytea), 'hex') — gerado em catalog/:slug
    const tokens = items.map(i => i.skuToken)
    const { rows: skuRows } = await client.query(`
      SELECT
        id,
        encode(sha256(id::text::bytea), 'hex') AS token,
        product_id,
        codigo AS code,
        atributos AS attributes,
        preco_atacado AS price,
        estoque AS stock
      FROM skus
      WHERE encode(sha256(id::text::bytea), 'hex') = ANY($1::text[])
        AND ativo = true
    `, [tokens])

    if (skuRows.length !== items.length) {
      await client.query('ROLLBACK')
      return res.status(422).json({ error: 'Um ou mais produtos não estão disponíveis.' })
    }

    // ── Verifica estoque e monta itens ──
    const orderItems = []
    for (const reqItem of items) {
      const sku = skuRows.find(s => s.token === reqItem.skuToken)
      if (!sku) {
        await client.query('ROLLBACK')
        return res.status(422).json({ error: `SKU não encontrado: ${reqItem.skuToken}` })
      }
      if (sku.stock < reqItem.quantity) {
        await client.query('ROLLBACK')
        return res.status(422).json({
          error: `Estoque insuficiente para o produto (ref: ${sku.code}). Disponível: ${sku.stock}.`,
        })
      }
      orderItems.push({ sku, quantity: reqItem.quantity })
    }

    // ── Calcula total ──
    const total = orderItems.reduce((acc, { sku, quantity }) => acc + sku.price * quantity, 0)

    // ── Gera ref opaco: ord_<8 bytes hex> ──
    const { rows: [{ ref }] } = await client.query(
      `SELECT 'ord_' || encode(gen_random_bytes(8), 'hex') AS ref`
    )

    // ── Busca comprador (se logado) ──
    const buyerId = req.buyer?.id ?? null  // injetado pelo middleware de auth do comprador (Tarefa 9)

    // ── Insere pedido ──
    const { rows: [order] } = await client.query(`
      INSERT INTO orders (
        ref, buyer_id, status, total,
        delivery_address, notes, payment_method,
        created_at, updated_at
      ) VALUES (
        $1, $2, 'aguardando_confirmacao', $3,
        $4, $5, $6,
        NOW(), NOW()
      )
      RETURNING id, ref, created_at
    `, [ref, buyerId, total, deliveryAddress ?? null, notes ?? null, paymentMethod])

    // ── Insere itens e baixa estoque ──
    for (const { sku, quantity } of orderItems) {
      // Busca nome do produto
      const { rows: [prod] } = await client.query(
        'SELECT name FROM products WHERE id = $1', [sku.product_id]
      )

      await client.query(`
        INSERT INTO order_items (order_id, sku_id, product_name, sku_code, attributes, price, quantity)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [order.id, sku.id, prod?.name ?? '', sku.code, sku.attributes, sku.price, quantity])

      // Reserva estoque (decrementa)
      await client.query(
        'UPDATE skus SET estoque = estoque - $1, updated_at = NOW() WHERE id = $2',
        [quantity, sku.id]
      )
    }

    await client.query('COMMIT')

    // ── Notifica dono via Notification Engine (fogo-e-esquece) ──
    notifyOwner(req.tenantSlug, ref, total, orderItems).catch(err =>
      console.error('[store/orders] notify error:', err.message)
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

/* ─────────────────────────────────────────────────────────────────────────────
 * GET /store/orders/:ref — status público por token opaco
 * ───────────────────────────────────────────────────────────────────────────── */
storeOrdersRouter.get('/:ref', async (req, res) => {
  try {
    const { ref } = req.params

    // Valida formato do ref para evitar injection
    if (!/^ord_[0-9a-f]{16}$/.test(ref)) {
      return res.status(404).json({ error: 'Pedido não encontrado.' })
    }

    const { rows: [order] } = await query(`
      SELECT
        o.ref,
        o.status,
        o.total,
        o.created_at AS "createdAt",
        o.updated_at AS "updatedAt"
      FROM orders o
      WHERE o.ref = $1
    `, [ref])

    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' })

    const { rows: items } = await query(`
      SELECT
        oi.product_name  AS name,
        oi.sku_code      AS "skuCode",
        oi.attributes    AS variant,
        oi.quantity,
        oi.price,
        encode(sha256(s.id::text::bytea), 'hex') AS "skuId",
        p.slug           AS "productSlug",
        oi.attributes    AS attributes
      FROM order_items oi
      LEFT JOIN skus     s ON s.id = oi.sku_id
      LEFT JOIN products p ON p.id = s.product_id
      WHERE oi.order_id = (SELECT id FROM orders WHERE ref = $1)
      ORDER BY oi.id ASC
    `, [ref])

    // Timeline sintética a partir do status atual
    const timeline = buildTimeline(order.status, order.createdAt)

    res.json({
      ref:       order.ref,
      status:    order.status,
      total:     Number(order.total),
      createdAt: order.createdAt,
      items:     items.map(i => ({
        name:        i.name,
        variant:     formatVariant(i.variant),
        quantity:    i.quantity,
        price:       Number(i.price),
        skuId:       i.skuId ?? null,
        skuCode:     i.skuCode ?? null,
        productSlug: i.productSlug ?? null,
        attributes:  i.attributes ?? {},
      })),
      timeline,
    })

  } catch (err) {
    console.error('[store/orders GET /:ref]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ─────────────────────────────────────────────────────────────────────────────
 * GET /store/orders — histórico (requer auth do comprador — Tarefa 9)
 * ───────────────────────────────────────────────────────────────────────────── */
storeOrdersRouter.get('/', authenticateBuyer, async (req, res) => {
  // Auth do comprador implementada na Tarefa 9
  // Por ora retorna 401 se não logado
  if (!req.buyer?.id) {
    return res.status(401).json({ error: 'Autenticação necessária.' })
  }

  try {
    const { rows } = await query(`
      SELECT ref, status, total, created_at AS "createdAt"
      FROM orders
      WHERE buyer_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [req.buyer.id])

    res.json(rows.map(r => ({ ...r, total: Number(r.total) })))
  } catch (err) {
    console.error('[store/orders GET /]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ─────────────────────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────────────────────── */

async function notifyOwner(tenantSlug, ref, total, orderItems) {
  // Busca email/whatsapp do dono no banco master
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { ownerEmail: true, ownerPhone: true, name: true },
  })
  if (!tenant) return

  const itemsSummary = orderItems
    .map(({ sku, quantity }) => `${quantity}x ${sku.code}`)
    .join(', ')

  const totalFmt = new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
  }).format(total / 100)

  // Importação dinâmica para não acumular no bundle se notify não estiver disponível
  try {
    const { notify } = await import('../../../notify/src/index.js')
    await notify({
      tenantSlug,
      channel: 'inapp',
      template: 'new_store_order',
      to: tenant.ownerEmail,
      data: { ref, total: totalFmt, items: itemsSummary, storeName: tenant.name },
    })
  } catch {
    // Notify não crítico — pedido já foi criado
  }
}

const STATUS_LABELS = {
  aguardando_confirmacao: 'Aguardando confirmação',
  confirmado:             'Confirmado',
  em_separacao:           'Em separação',
  enviado:                'Enviado',
  entregue:               'Entregue',
  cancelado:              'Cancelado',
}

function buildTimeline(currentStatus, createdAt) {
  const flow = ['aguardando_confirmacao', 'confirmado', 'em_separacao', 'enviado', 'entregue']
  const idx  = flow.indexOf(currentStatus)

  return flow
    .slice(0, idx + 1)
    .map((s, i) => ({
      status: STATUS_LABELS[s] ?? s,
      at: i === 0 ? createdAt : null,  // só o criado_at é real; os demais serão preenchidos na Tarefa 8
    }))
}

function formatVariant(attributes) {
  if (!attributes || typeof attributes !== 'object') return ''
  return Object.entries(attributes).map(([k, v]) => `${k}: ${v}`).join(' · ')
}

/* ─────────────────────────────────────────────────────────────────────────────
 * PATCH /store/orders/:ref/cancel — cancelamento pelo comprador
 * Só permitido se status ainda for 'aguardando_confirmacao'.
 * ───────────────────────────────────────────────────────────────────────────── */
storeOrdersRouter.patch('/:ref/cancel', async (req, res) => {
  const { ref } = req.params

  if (!/^ord_[0-9a-f]{16}$/.test(ref)) {
    return res.status(404).json({ error: 'Pedido não encontrado.' })
  }

  const client = await getClient(req.tenantSlug)
  try {
    await client.query('BEGIN')

    // Busca o pedido com lock para evitar race condition
    const { rows: [order] } = await client.query(`
      SELECT id, status FROM orders WHERE ref = $1 FOR UPDATE
    `, [ref])

    if (!order) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Pedido não encontrado.' })
    }

    if (order.status !== 'aguardando_confirmacao') {
      await client.query('ROLLBACK')
      return res.status(422).json({
        error: 'Este pedido não pode mais ser cancelado.',
        status: order.status,
      })
    }

    // Atualiza status
    await client.query(`
      UPDATE orders SET status = 'cancelado', updated_at = NOW() WHERE id = $1
    `, [order.id])

    // Devolve estoque
    const { rows: items } = await client.query(`
      SELECT sku_id, quantity FROM order_items WHERE order_id = $1
    `, [order.id])

    for (const item of items) {
      await client.query(
        'UPDATE skus SET estoque = estoque + $1, updated_at = NOW() WHERE id = $2',
        [item.quantity, item.sku_id]
      )
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
