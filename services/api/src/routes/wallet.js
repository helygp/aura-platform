/**
 * routes/wallet.js
 * Carteira de compradores B2B — Contas a Receber.
 *
 * GET  /api/wallet/receivables              — lista compradores com saldo devedor
 * GET  /api/wallet/buyers/:id              — extrato (suporta ?dateFrom=&dateTo=) — inclui itens dos pedidos
 * PATCH /api/wallet/buyers/:id/limit       — define limite de crédito
 * POST  /api/wallet/buyers/:id/payment     — registra pagamento (com forma + comprovante)
 *
 * Ticket #118:
 *  - Pedidos retornam com items[] (LEFT JOIN order_items) p/ drilldown na UI.
 *  - POST /payment rejeita amount > credit_balance (HTTP 422).
 */

import { Router }   from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize }    from '../middleware/authorize.js'
import { query, getClient } from '../lib/tenantDb.js'

export const walletRouter = Router()
walletRouter.use(authenticate)

/* ── GET /api/wallet/receivables ─────────────────────────────────────────────
 * Lista todos os compradores com saldo devedor ou limite configurado.
 */
walletRouter.get('/receivables', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        c.id,
        c.name,
        c.email,
        c.name            AS "companyName",
        c.whatsapp AS phone,
        c.credit_limit     AS "creditLimit",
        c.credit_balance   AS "creditBalance",
        c.credit_limit - c.credit_balance AS "creditAvailable",
        c.created_at       AS "createdAt",
        COUNT(o.id) FILTER (WHERE o.status IN ('pendente','confirmado','separando','enviado'))
                            AS "openOrdersCount",
        COALESCE(SUM(o.total) FILTER (WHERE o.status IN ('pendente','confirmado','separando','enviado')), 0)
                            AS "openOrdersTotal"
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      WHERE c.status = 'ativo' AND (c.credit_limit > 0 OR c.credit_balance > 0)
      GROUP BY c.id
      ORDER BY c.credit_balance DESC, c.name ASC
    `)

    res.json({
      buyers: rows.map(r => ({
        id:               r.id,
        name:             r.name,
        email:            r.email,
        companyName:      r.companyName,
        phone:            r.phone,
        creditLimit:      Math.round(parseFloat(r.creditLimit)     * 100),
        creditBalance:    Math.round(parseFloat(r.creditBalance)   * 100),
        creditAvailable:  Math.round(parseFloat(r.creditAvailable) * 100),
        openOrdersCount:  parseInt(r.openOrdersCount) || 0,
        openOrdersTotal:  Math.round(parseFloat(r.openOrdersTotal) * 100),
        createdAt:        r.createdAt,
      })),
    })
  } catch (err) {
    console.error('[wallet/receivables]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── GET /api/wallet/buyers/:id ──────────────────────────────────────────────
 * Extrato completo de um comprador: saldo + movimentações + pedidos.
 * Suporta ?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD para filtrar por período.
 * Quando filtrado, retorna também o saldo de abertura (recomposição).
 */
walletRouter.get('/buyers/:id', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query
    const filtered = !!(dateFrom || dateTo)

    const { rows: [buyer] } = await query(`
      SELECT id, name, email, name AS "companyName", whatsapp AS phone,
             credit_limit AS "creditLimit", credit_balance AS "creditBalance",
             credit_limit - credit_balance AS "creditAvailable"
      FROM customers WHERE id = $1
    `, [req.params.id])

    if (!buyer) return res.status(404).json({ error: 'Comprador não encontrado.' })

    // ── Saldo de abertura: soma de débitos - créditos ANTES do período ──
    let openingBalance = 0
    if (filtered && dateFrom) {
      const { rows: [ob] } = await query(`
        SELECT COALESCE(
          SUM(CASE WHEN type='debit' THEN amount ELSE -amount END), 0
        ) AS opening
        FROM wallet_transactions
        WHERE customer_id = $1 AND created_at::date < $2::date
      `, [req.params.id, dateFrom])
      openingBalance = Math.round(parseFloat(ob.opening) * 100)
    }

    // ── Transações do período ──
    const txParams = [req.params.id]
    const txWhere  = ['customer_id = $1']
    if (dateFrom) { txParams.push(dateFrom); txWhere.push(`created_at::date >= $${txParams.length}::date`) }
    if (dateTo)   { txParams.push(dateTo);   txWhere.push(`created_at::date <= $${txParams.length}::date`) }
    txParams.push(200)

    const { rows: transactions } = await query(`
      SELECT id, type, amount, description, order_ref AS "orderRef",
             created_by AS "createdBy", created_at AS "createdAt",
             payment_method AS "paymentMethod",
             CASE WHEN receipt_data IS NOT NULL THEN true ELSE false END AS "hasReceipt"
      FROM wallet_transactions
      WHERE ${txWhere.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${txParams.length}
    `, txParams)

    // ── Pedidos do período (com itens — ticket #118) ──
    const ordParams = [req.params.id]
    const ordWhere  = ['o.customer_id = $1']
    if (dateFrom) { ordParams.push(dateFrom); ordWhere.push(`o.created_at::date >= $${ordParams.length}::date`) }
    if (dateTo)   { ordParams.push(dateTo);   ordWhere.push(`o.created_at::date <= $${ordParams.length}::date`) }
    ordParams.push(50)

    const { rows: orders } = await query(`
      SELECT o.ref, o.id, o.number, o.status, o.total,
             o.payment_method AS "paymentMethod", o.created_at AS "createdAt",
             COALESCE(json_agg(
               json_build_object(
                 'id',          oi.id,
                 'productName', oi.product_name,
                 'skuCode',     oi.sku_code,
                 'attributes',  oi.attributes,
                 'qty',         oi.qty,
                 'qtyReturned', COALESCE(oi.qty_returned, 0),
                 'priceUnit',   oi.price_unit,
                 'status',      COALESCE(oi.status, 'ativo')
               )
               ORDER BY oi.created_at, oi.id
             ) FILTER (WHERE oi.id IS NOT NULL), '[]'::json) AS items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE ${ordWhere.join(' AND ')}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT $${ordParams.length}
    `, ordParams)

    res.json({
      buyer: {
        ...buyer,
        creditLimit:     Math.round(parseFloat(buyer.creditLimit)     * 100),
        creditBalance:   Math.round(parseFloat(buyer.creditBalance)   * 100),
        creditAvailable: Math.round(parseFloat(buyer.creditAvailable) * 100),
      },
      openingBalance,  // centavos — saldo devedor antes do período (0 se sem filtro)
      filtered,
      dateFrom: dateFrom ?? null,
      dateTo:   dateTo   ?? null,
      transactions: transactions.map(t => ({
        ...t,
        amount: Math.round(parseFloat(t.amount) * 100),
      })),
      orders: orders.map(o => ({
        ...o,
        ref:   o.ref || (o.number ? `#${o.number}` : o.id?.slice(-6).toUpperCase()),
        total: Math.round(parseFloat(o.total) * 100),
        items: (o.items ?? []).map(it => ({
          ...it,
          priceUnit: Math.round(parseFloat(it.priceUnit) * 100),
        })),
      })),
    })
  } catch (err) {
    console.error('[wallet/buyers/:id]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── GET /api/wallet/transactions/:txId/receipt ─────────────────────────────
 * Retorna o arquivo de comprovante de uma transação.
 */
walletRouter.get('/transactions/:txId/receipt', async (req, res) => {
  try {
    const { rows: [tx] } = await query(
      'SELECT receipt_data FROM wallet_transactions WHERE id = $1',
      [req.params.txId]
    )
    if (!tx || !tx.receipt_data) return res.status(404).json({ error: 'Comprovante não encontrado.' })

    // receipt_data = "data:image/jpeg;base64,..." ou "data:application/pdf;base64,..."
    const match = tx.receipt_data.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) return res.status(400).json({ error: 'Formato inválido.' })

    const mime   = match[1]
    const buffer = Buffer.from(match[2], 'base64')
    res.setHeader('Content-Type', mime)
    res.setHeader('Content-Disposition', `inline; filename="comprovante-${req.params.txId}"`)
    res.send(buffer)
  } catch (err) {
    console.error('[wallet/receipt]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── PATCH /api/wallet/buyers/:id/limit ─────────────────────────────────────
 * Define ou altera o limite de crédito de um comprador.
 */
walletRouter.patch('/buyers/:id/limit', authorize('admin', 'financeiro'), async (req, res) => {
  const { creditLimit } = req.body
  const limit = parseFloat(creditLimit)

  if (isNaN(limit) || limit < 0)
    return res.status(400).json({ error: 'Limite inválido.' })

  try {
    const { rows: [buyer] } = await query(`
      UPDATE customers
      SET credit_limit = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, name, credit_limit AS "creditLimit", credit_balance AS "creditBalance"
    `, [limit, req.params.id])

    if (!buyer) return res.status(404).json({ error: 'Comprador não encontrado.' })

    res.json({
      id:              buyer.id,
      name:            buyer.name,
      creditLimit:     Math.round(parseFloat(buyer.creditLimit)   * 100),
      creditBalance:   Math.round(parseFloat(buyer.creditBalance) * 100),
      creditAvailable: Math.round((parseFloat(buyer.creditLimit) - parseFloat(buyer.creditBalance)) * 100),
    })
  } catch (err) {
    console.error('[wallet/limit]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── POST /api/wallet/buyers/:id/payment ────────────────────────────────────
 * Registra pagamento recebido.
 * Body: { amount (centavos), description, paymentMethod, receiptData (base64 opcional) }
 */
walletRouter.post('/buyers/:id/payment', authorize('admin', 'financeiro'), async (req, res) => {
  const {
    amount,
    description   = 'Pagamento recebido',
    paymentMethod = null,
    receiptData   = null,
  } = req.body

  const amountCents = parseInt(amount)
  if (!amountCents || amountCents <= 0)
    return res.status(400).json({ error: 'Valor inválido.' })

  // Valida tamanho do comprovante (max 5 MB em base64 ≈ ~6.7 MB base64)
  if (receiptData && receiptData.length > 7_000_000)
    return res.status(400).json({ error: 'Comprovante muito grande (máx 5 MB).' })

  const amountDecimal = (amountCents / 100).toFixed(2)
  const client = await getClient(req.tenantSlug)

  try {
    await client.query('BEGIN')

    const { rows: [buyer] } = await client.query(
      'SELECT id, name, credit_balance FROM customers WHERE id = $1 FOR UPDATE',
      [req.params.id]
    )
    if (!buyer) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Comprador não encontrado.' }) }

    // Ticket #118: pagamento não pode exceder saldo devedor
    const balanceCents = Math.round(parseFloat(buyer.credit_balance) * 100)
    if (amountCents > balanceCents) {
      await client.query('ROLLBACK')
      const balanceStr = (balanceCents / 100).toFixed(2).replace('.', ',')
      return res.status(422).json({
        error: `Valor excede o saldo devedor (máx: R$ ${balanceStr}).`,
      })
    }

    await client.query(`
      INSERT INTO wallet_transactions
        (customer_id, type, amount, description, created_by, payment_method, receipt_data)
      VALUES ($1, 'credit', $2, $3, $4, $5, $6)
    `, [req.params.id, amountDecimal, description, req.user.id, paymentMethod ?? null, receiptData ?? null])

    const { rows: [updated] } = await client.query(`
      UPDATE customers
      SET credit_balance = GREATEST(0, credit_balance - $1), updated_at = NOW()
      WHERE id = $2
      RETURNING credit_limit AS "creditLimit", credit_balance AS "creditBalance"
    `, [amountDecimal, req.params.id])

    await client.query('COMMIT')

    res.status(201).json({
      ok:              true,
      buyerName:       buyer.name,
      amountPaid:      amountCents,
      paymentMethod,
      hasReceipt:      !!receiptData,
      creditLimit:     Math.round(parseFloat(updated.creditLimit)   * 100),
      creditBalance:   Math.round(parseFloat(updated.creditBalance) * 100),
      creditAvailable: Math.round((parseFloat(updated.creditLimit) - parseFloat(updated.creditBalance)) * 100),
    })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[wallet/payment]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  } finally {
    client.release()
  }
})
