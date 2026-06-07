/**
 * routes/separationSheet.js
 *
 * GET /api/orders/separation-sheet
 *
 * Query params:
 *   customer_id : UUID do cliente (opcional)
 *   start       : data início YYYY-MM-DD (opcional)
 *   end         : data fim   YYYY-MM-DD (opcional)
 *   status      : status do pedido, pode ser múltiplos separados por vírgula (opcional)
 *
 * Retorna: itens agrupados por SKU, com a lista de pedidos que incluem cada SKU.
 * Usado para gerar a Ficha de Separação.
 */

import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize }    from '../middleware/authorize.js'
import { query }        from '../lib/tenantDb.js'

export const separationSheetRouter = Router()
separationSheetRouter.use(authenticate)
separationSheetRouter.use(authorize('admin', 'estoque', 'financeiro'))

separationSheetRouter.get('/', async (req, res) => {
  try {
    const { customer_id, start, end, status } = req.query

    const params = []
    const where  = ["o.status != 'cancelado'"]

    if (customer_id) {
      params.push(customer_id)
      where.push(`o.customer_id = $${params.length}`)
    }
    if (start) {
      params.push(start)
      where.push(`o.created_at::date >= $${params.length}`)
    }
    if (end) {
      params.push(end)
      where.push(`o.created_at::date <= $${params.length}`)
    }
    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean)
      if (statuses.length) {
        params.push(statuses)
        where.push(`o.status = ANY($${params.length})`)
      }
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : ''

    const { rows } = await query(`
      SELECT
        s.code                    AS sku_code,
        p.name                    AS product_name,
        s.attributes->>'Cor'      AS cor,
        s.attributes->>'Tamanho'  AS tamanho,
        s.stock                   AS stock_qty,
        s.price_wholesale         AS preco,
        oi.qty                    AS qty_pedido,
        o.number                  AS order_number,
        o.id                      AS order_id,
        o.customer_name,
        o.customer_id,
        o.status,
        o.created_at::date        AS order_date
      FROM order_items oi
      JOIN orders   o ON o.id  = oi.order_id
      JOIN skus     s ON s.id  = oi.sku_id
      JOIN products p ON p.id  = s.product_id
      ${whereClause}
      ORDER BY
        p.name,
        s.attributes->>'Cor',
        CASE WHEN (s.attributes->>'Tamanho') ~ '^[0-9]+$'
             THEN (s.attributes->>'Tamanho')::int
             ELSE 99999
        END,
        CASE s.attributes->>'Tamanho'
          WHEN 'PP' THEN 1 WHEN 'P'  THEN 2 WHEN 'M'  THEN 3
          WHEN 'G'  THEN 4 WHEN 'GG' THEN 5 WHEN 'XG' THEN 6
          ELSE 99
        END,
        s.attributes->>'Tamanho',
        s.code,
        o.number
    `, params)

    /* Agrupar por sku_code */
    const grouped = new Map()
    for (const row of rows) {
      if (!grouped.has(row.sku_code)) {
        grouped.set(row.sku_code, {
          skuCode:     row.sku_code,
          productName: row.product_name,
          cor:         row.cor  ?? '',
          tamanho:     row.tamanho ?? '',
          stockQty:    parseInt(row.stock_qty ?? 0),
          preco:       parseFloat(row.preco ?? 0),
          orders: [],
        })
      }
      grouped.get(row.sku_code).orders.push({
        orderNumber:  row.order_number,
        orderId:      row.order_id,
        customerName: row.customer_name,
        status:       row.status,
        orderDate:    row.order_date,
        qty:          parseInt(row.qty_pedido ?? 0),
      })
    }

    /* Metadados: clientes e período */
    const items = [...grouped.values()]
    const uniqueCustomers = [...new Set(rows.map(r => r.customer_name))].filter(Boolean)
    const orderNumbers    = [...new Set(rows.map(r => r.order_number))].filter(Boolean).sort((a,b) => a-b)
    const totalQty        = items.reduce((acc, g) => acc + g.orders.reduce((a,o) => a + o.qty, 0), 0)

    res.json({
      items,
      meta: {
        totalSkus:    items.length,
        totalQty,
        orderNumbers,
        customers:    uniqueCustomers,
        filters:      { customer_id, start, end, status },
      },
    })
  } catch (e) {
    console.error('[separation-sheet]', e.message)
    res.status(500).json({ error: e.message })
  }
})
