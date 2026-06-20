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

/* ── 1. Resumo de vendas ──
 * Ticket #76 (issue #35): suporte a filtros category + attr_key/attr_value,
 * card "Unidades Vendidas" e toggle valor/unidades no gráfico.
 *
 * Quando há filtro de categoria ou atributo, faturamento e unidades são
 * calculados a partir dos order_items filtrados (SUM qty*price_unit / SUM qty)
 * e "pedidos" passa a ser COUNT DISTINCT order_id desses itens.
 * Sem filtro de item, mantém o comportamento original (SUM orders.total) e
 * adiciona unidades via subquery em order_items, preservando compat.
 */
reportsRouter.get('/sales', async (req, res) => {
  try {
    const { start, end } = period(req)
    const customerId = req.query.customer_id || null
    const category   = req.query.category    || null
    const attrKey    = req.query.attr_key    || null
    const attrValue  = req.query.attr_value  || null
    const hasItemFilter = !!(category || (attrKey && attrValue))

    let kpi, byDay, byChannel, byStatus

    if (!hasItemFilter) {
      // ── caminho rápido: sem filtro de item, queries em orders + subquery unidades
      const custClause = customerId ? ` AND customer_id = $3` : ''
      const itemCustClause = customerId ? ` AND o2.customer_id = $3` : ''
      const baseParams  = customerId ? [start, end, customerId] : [start, end]

      const [kpiR, byDayR, byChannelR, byStatusR] = await Promise.all([
        query(`
          SELECT
            COUNT(*)                                             AS total_pedidos,
            COUNT(*) FILTER (WHERE status = 'entregue')         AS pedidos_entregues,
            COUNT(*) FILTER (WHERE status = 'cancelado')        AS pedidos_cancelados,
            COALESCE(SUM(total) FILTER (WHERE status NOT IN ('cancelado','pendente')), 0) AS faturamento,
            COALESCE(AVG(total) FILTER (WHERE status NOT IN ('cancelado','pendente')), 0) AS ticket_medio,
            COALESCE((
              SELECT SUM(oi.qty)
              FROM order_items oi
              JOIN orders o2 ON o2.id = oi.order_id
              WHERE (o2.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $1 AND $2
                AND o2.status NOT IN ('cancelado','pendente')${itemCustClause}
            ), 0) AS total_unidades
          FROM orders
          WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $1 AND $2${custClause}
        `, baseParams),

        query(`
          SELECT
            d.dia::text AS dia,
            d.pedidos,
            d.faturamento,
            COALESCE(u.unidades, 0) AS unidades
          FROM (
            SELECT
              (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
              COUNT(*) AS pedidos,
              COALESCE(SUM(total) FILTER (WHERE status NOT IN ('cancelado','pendente')), 0) AS faturamento
            FROM orders
            WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $1 AND $2${custClause}
            GROUP BY dia
          ) d
          LEFT JOIN (
            SELECT
              (o2.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
              SUM(oi.qty) AS unidades
            FROM order_items oi
            JOIN orders o2 ON o2.id = oi.order_id
            WHERE (o2.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $1 AND $2
              AND o2.status NOT IN ('cancelado','pendente')${itemCustClause}
            GROUP BY dia
          ) u ON u.dia = d.dia
          ORDER BY d.dia
        `, baseParams),

        query(`
          SELECT
            channel,
            COUNT(*) AS pedidos,
            COALESCE(SUM(total) FILTER (WHERE status NOT IN ('cancelado','pendente')), 0) AS faturamento
          FROM orders
          WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $1 AND $2${custClause}
          GROUP BY channel ORDER BY faturamento DESC
        `, baseParams),

        query(`
          SELECT status, COUNT(*) AS total
          FROM orders
          WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $1 AND $2${custClause}
          GROUP BY status ORDER BY total DESC
        `, baseParams),
      ])
      kpi = kpiR; byDay = byDayR; byChannel = byChannelR; byStatus = byStatusR
    } else {
      // ── caminho com filtro de item: tudo via order_items + skus + products
      const params = [start, end]
      let idx = 3
      const where = []
      if (customerId) { where.push(`o.customer_id = $${idx++}`); params.push(customerId) }
      if (category)   { where.push(`p.category    = $${idx++}`); params.push(category)   }
      if (attrKey && attrValue) {
        // s.attributes->>$k = $v  →  passa key e value como params separados
        where.push(`s.attributes->>$${idx++} = $${idx++}`)
        params.push(attrKey, attrValue)
      }
      const extra = where.length ? ' AND ' + where.join(' AND ') : ''

      // CTE única reusada — todos os agregados saem dos itens filtrados
      const baseSQL = `
        WITH itens AS (
          SELECT
            o.id        AS order_id,
            o.channel   AS channel,
            o.status    AS status,
            (o.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
            oi.qty      AS qty,
            oi.qty * oi.price_unit AS subtotal
          FROM orders o
          JOIN order_items oi ON oi.order_id = o.id
          JOIN skus      s    ON s.id  = oi.sku_id
          JOIN products  p    ON p.id  = s.product_id
          WHERE (o.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $1 AND $2${extra}
        )
      `

      const [kpiR, byDayR, byChannelR, byStatusR] = await Promise.all([
        query(baseSQL + `
          SELECT
            COUNT(DISTINCT order_id)                                    AS total_pedidos,
            COUNT(DISTINCT order_id) FILTER (WHERE status = 'entregue') AS pedidos_entregues,
            COUNT(DISTINCT order_id) FILTER (WHERE status = 'cancelado')AS pedidos_cancelados,
            COALESCE(SUM(subtotal) FILTER (WHERE status NOT IN ('cancelado','pendente')), 0) AS faturamento,
            COALESCE(SUM(qty)      FILTER (WHERE status NOT IN ('cancelado','pendente')), 0) AS total_unidades,
            CASE
              WHEN COUNT(DISTINCT order_id) FILTER (WHERE status NOT IN ('cancelado','pendente')) > 0
              THEN COALESCE(SUM(subtotal) FILTER (WHERE status NOT IN ('cancelado','pendente')), 0)
                 / COUNT(DISTINCT order_id) FILTER (WHERE status NOT IN ('cancelado','pendente'))
              ELSE 0
            END AS ticket_medio
          FROM itens
        `, params),

        query(baseSQL + `
          SELECT
            dia::text AS dia,
            COUNT(DISTINCT order_id) AS pedidos,
            COALESCE(SUM(subtotal) FILTER (WHERE status NOT IN ('cancelado','pendente')), 0) AS faturamento,
            COALESCE(SUM(qty)      FILTER (WHERE status NOT IN ('cancelado','pendente')), 0) AS unidades
          FROM itens
          GROUP BY dia ORDER BY dia
        `, params),

        query(baseSQL + `
          SELECT
            channel,
            COUNT(DISTINCT order_id) AS pedidos,
            COALESCE(SUM(subtotal) FILTER (WHERE status NOT IN ('cancelado','pendente')), 0) AS faturamento
          FROM itens
          GROUP BY channel ORDER BY faturamento DESC
        `, params),

        query(baseSQL + `
          SELECT status, COUNT(DISTINCT order_id) AS total
          FROM itens
          GROUP BY status ORDER BY total DESC
        `, params),
      ])
      kpi = kpiR; byDay = byDayR; byChannel = byChannelR; byStatus = byStatusR
    }

    res.json({
      period:     { start, end },
      customerId: customerId || null,
      filters:    { category: category || null, attr_key: attrKey || null, attr_value: attrValue || null },
      kpi:        kpi.rows[0],
      // Ticket #72: NUMERIC vem como string do pg driver → converte aqui.
      byDay:      byDay.rows.map(r => ({
        dia:         r.dia,
        pedidos:     parseInt(r.pedidos, 10),
        faturamento: parseFloat(r.faturamento) || 0,
        unidades:    parseInt(r.unidades, 10) || 0,
      })),
      byChannel:  byChannel.rows,
      byStatus:   byStatus.rows,
    })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

/* ── 1b. Filtros disponíveis pra tela de Vendas ──
 * Issue #35: lista categorias e atributos (chave:valor) usados, alimenta os
 * dois selects novos no front. Cacheado no client.
 */
reportsRouter.get('/sales/filters', async (req, res) => {
  try {
    const [cats, attrs] = await Promise.all([
      query(`
        SELECT DISTINCT category AS value
        FROM products
        WHERE category IS NOT NULL AND category <> ''
        ORDER BY category
      `, []),
      query(`
        SELECT DISTINCT key, value
        FROM skus s, jsonb_each_text(s.attributes::jsonb)
        WHERE s.attributes IS NOT NULL
          AND jsonb_typeof(s.attributes::jsonb) = 'object'
          AND value IS NOT NULL AND value <> ''
        ORDER BY key, value
      `, []),
    ])
    res.json({
      categories: cats.rows.map(r => r.value),
      attributes: attrs.rows.map(r => ({ key: r.key, value: r.value })),
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
        COALESCE((
          SELECT SUM(oi.qty)
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          WHERE oi.sku_id = s.id
            AND COALESCE(oi.status,'ativo') != 'cancelado'
        ), 0) AS qtd_vendida,
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
    const total_units   = rows.reduce((a, r) => a + parseInt(r.estoque || 0), 0)
    const total_vendido = rows.reduce((a, r) => a + parseInt(r.qtd_vendida || 0), 0)

    res.json({ rows, summary: { total_skus, valor_total, skus_criticos, total_units, total_vendido } })
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
