/**
 * routes/reports.js — 6 relatórios do ERP
 *
 * GET /api/reports/sales          — resumo de vendas por período
 * GET /api/reports/products       — ranking de produtos/SKU
 * GET /api/reports/stock          — estoque atual
 * GET /api/reports/stock-critical — estoque crítico
 * GET /api/reports/stock-idle     — produtos parados
 * GET /api/reports/movements      — movimentação de estoque
 */

import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize }    from '../middleware/authorize.js'
import { query }        from '../lib/tenantDb.js'

export const reportsRouter = Router()
reportsRouter.use(authenticate)
reportsRouter.use(authorize('admin', 'financeiro', 'estoque'))

/* ── helpers ── */
// Retorna YYYY-MM-DD na TZ America/Sao_Paulo (en-CA produz ISO).
function todayBR() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}
function firstOfMonthBR() {
  return todayBR().slice(0, 8) + '01'
}
function period(req) {
  const start = req.query.start || firstOfMonthBR()
  const end   = req.query.end   || todayBR()
  return { start, end }
}

/* ── 1. Resumo de vendas ── */
reportsRouter.get('/sales', async (req, res) => {
  try {
    const { start, end } = period(req)
    const customerId = req.query.customer_id || null
    const custClause = customerId ? ` AND customer_id = $3` : ''
    const baseParams  = customerId ? [start, end, customerId] : [start, end]

    const [kpi, byDay, byChannel, byStatus] = await Promise.all([
      // KPIs principais
      query(`
        SELECT
          COUNT(*)                                             AS total_pedidos,
          COUNT(*) FILTER (WHERE status = 'entregue')         AS pedidos_entregues,
          COUNT(*) FILTER (WHERE status = 'cancelado')        AS pedidos_cancelados,
          COALESCE(SUM(total) FILTER (WHERE status NOT IN ('cancelado','pendente')), 0) AS faturamento,
          COALESCE(AVG(total) FILTER (WHERE status NOT IN ('cancelado','pendente')), 0) AS ticket_medio
        FROM orders
        WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $1 AND $2${custClause}
      `, baseParams),

      // Por dia
      query(`
        SELECT
          (created_at AT TIME ZONE 'America/Sao_Paulo')::date::text AS dia,
          COUNT(*)         AS pedidos,
          COALESCE(SUM(total) FILTER (WHERE status NOT IN ('cancelado','pendente')), 0) AS faturamento
        FROM orders
        WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $1 AND $2${custClause}
        GROUP BY dia ORDER BY dia
      `, baseParams),

      // Por canal
      query(`
        SELECT
          channel,
          COUNT(*) AS pedidos,
          COALESCE(SUM(total) FILTER (WHERE status NOT IN ('cancelado','pendente')), 0) AS faturamento
        FROM orders
        WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $1 AND $2${custClause}
        GROUP BY channel ORDER BY faturamento DESC
      `, baseParams),

      // Por status
      query(`
        SELECT status, COUNT(*) AS total
        FROM orders
        WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $1 AND $2${custClause}
        GROUP BY status ORDER BY total DESC
      `, baseParams),
    ])

    res.json({
      period:     { start, end },
      customerId: customerId || null,
      kpi:        kpi.rows[0],
      byDay:      byDay.rows,
      byChannel:  byChannel.rows,
      byStatus:   byStatus.rows,
    })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

/* ── 2. Ranking de produtos ── */
reportsRouter.get('/products', async (req, res) => {
  try {
    const { start, end } = period(req)
    const limit = parseInt(req.query.limit) || 50

    const { rows } = await query(`
      SELECT
        p.name                          AS produto,
        oi.sku_code                     AS sku,
        oi.attributes                   AS atributos,
        p.category                      AS categoria,
        SUM(oi.qty)                     AS qtd_vendida,
        SUM(oi.qty * oi.price_unit)     AS valor_vendido,
        AVG(oi.price_unit)              AS preco_medio,
        s.stock                         AS estoque_atual,
        s.stock_min                     AS estoque_minimo,
        CASE
          WHEN s.stock = 0             THEN 'zerado'
          WHEN s.stock < s.stock_min   THEN 'baixo'
          ELSE 'ok'
        END                             AS status_estoque
      FROM order_items oi
      JOIN orders o  ON o.id  = oi.order_id
      JOIN skus   s  ON s.id  = oi.sku_id
      JOIN products p ON p.id = s.product_id
      WHERE (o.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $1 AND $2
        AND o.status NOT IN ('cancelado', 'pendente')
      GROUP BY p.name, oi.sku_code, oi.attributes, p.category, s.stock, s.stock_min
      ORDER BY qtd_vendida DESC
      LIMIT $3
    `, [start, end, limit])

    res.json({ period: { start, end }, rows })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

/* ── 3. Estoque atual ── */
reportsRouter.get('/stock', async (req, res) => {
  try {
    const search   = req.query.search   || ''
    const category = req.query.category || ''

    const { rows } = await query(`
      SELECT
        p.name        AS produto,
        p.code        AS codigo,
        s.code        AS sku,
        s.attributes  AS atributos,
        p.category    AS categoria,
        s.stock       AS estoque,
        s.stock_min   AS estoque_minimo,
        s.price_wholesale AS preco,
        s.stock * s.price_wholesale AS valor_em_estoque,
        CASE
          WHEN s.stock = 0           THEN 'zerado'
          WHEN s.stock < s.stock_min THEN 'baixo'
          ELSE 'ok'
        END AS status
      FROM skus s
      JOIN products p ON p.id = s.product_id
      WHERE ($1 = '' OR p.name ILIKE '%' || $1 || '%' OR s.code ILIKE '%' || $1 || '%')
        AND ($2 = '' OR p.category = $2)
      ORDER BY p.name, s.code
    `, [search, category])

    const total_skus    = rows.length
    const valor_total   = rows.reduce((a, r) => a + parseFloat(r.valor_em_estoque || 0), 0)
    const skus_criticos = rows.filter(r => r.status !== 'ok').length

    res.json({ rows, summary: { total_skus, valor_total, skus_criticos } })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

/* ── 4. Estoque crítico ── */
reportsRouter.get('/stock-critical', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        p.name       AS produto,
        p.category   AS categoria,
        s.code       AS sku,
        s.attributes AS atributos,
        s.stock      AS estoque_atual,
        s.stock_min  AS estoque_minimo,
        s.stock_min - s.stock AS diferenca,
        CASE WHEN s.stock = 0 THEN 'zerado' ELSE 'baixo' END AS status,
        (
          SELECT MAX(o.created_at)::date::text
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          WHERE oi.sku_id = s.id AND o.status NOT IN ('cancelado','pendente')
        ) AS ultima_venda
      FROM skus s
      JOIN products p ON p.id = s.product_id
      WHERE s.stock < s.stock_min
      ORDER BY (s.stock = 0) DESC, diferenca DESC
    `, [])

    res.json({ rows, total: rows.length })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

/* ── 5. Produtos parados ── */
reportsRouter.get('/stock-idle', async (req, res) => {
  try {
    const dias = parseInt(req.query.dias) || 30

    const { rows } = await query(`
      SELECT
        p.name        AS produto,
        p.category    AS categoria,
        s.code        AS sku,
        s.attributes  AS atributos,
        s.stock       AS estoque_atual,
        s.stock * s.price_wholesale AS valor_parado,
        last_sale.ultima_venda::text AS ultima_venda,
        CASE
          WHEN last_sale.ultima_venda IS NULL THEN 9999
          ELSE CURRENT_DATE - last_sale.ultima_venda
        END AS dias_sem_venda
      FROM skus s
      JOIN products p ON p.id = s.product_id
      LEFT JOIN LATERAL (
        SELECT MAX(o.created_at)::date AS ultima_venda
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.sku_id = s.id AND o.status NOT IN ('cancelado','pendente')
      ) last_sale ON true
      WHERE s.stock > 0
        AND (
          last_sale.ultima_venda IS NULL
          OR last_sale.ultima_venda < CURRENT_DATE - ($1::int * INTERVAL '1 day')
        )
      ORDER BY dias_sem_venda DESC, valor_parado DESC
    `, [dias])

    const valor_total = rows.reduce((a, r) => a + parseFloat(r.valor_parado || 0), 0)
    res.json({ rows, total: rows.length, valor_total, dias })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

/* ── 6. Movimentação de estoque ── */
reportsRouter.get('/movements', async (req, res) => {
  try {
    const { start, end } = period(req)
    const limit = parseInt(req.query.limit) || 200

    const { rows } = await query(`
      SELECT
        (sm.created_at AT TIME ZONE 'America/Sao_Paulo')::date::text AS data,
        sm.created_at       AS data_hora,
        p.name              AS produto,
        s.code              AS sku,
        s.attributes        AS atributos,
        p.category          AS categoria,
        sm.type             AS tipo,
        sm.qty              AS quantidade,
        sm.qty_before       AS saldo_anterior,
        sm.qty_after        AS saldo_atual,
        sm.reason           AS motivo,
        sm.user_name        AS usuario,
        sm.order_id         AS pedido_id,
        sm.customer_name    AS cliente,
        o.number            AS pedido_numero
      FROM stock_movements sm
      JOIN skus     s ON s.id  = sm.sku_id
      JOIN products p ON p.id  = s.product_id
      LEFT JOIN orders o ON o.id = sm.order_id
      WHERE (sm.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $1 AND $2
      ORDER BY sm.created_at DESC
      LIMIT $3
    `, [start, end, limit])

    const entradas = rows.filter(r => r.tipo === 'entrada').reduce((a, r) => a + parseInt(r.quantidade), 0)
    const saidas   = rows.filter(r => r.tipo === 'saida').  reduce((a, r) => a + parseInt(r.quantidade), 0)
    const ajustes  = rows.filter(r => r.tipo === 'ajuste'). length

    res.json({ period: { start, end }, rows, summary: { entradas, saidas, ajustes } })
  } catch(e) { res.status(500).json({ error: e.message }) }
})
