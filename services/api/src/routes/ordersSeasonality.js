/**
 * routes/ordersSeasonality.js
 *
 * Ticket #121 (issue #95) — Relatórios de sazonalidade de pedidos.
 *
 * GET /api/orders/seasonality
 *
 * Query params:
 *   dimension : 'dow' | 'hour'        (obrigatório)
 *   metric    : 'count' | 'qty' | 'value' (obrigatório)
 *   days      : 30 | 90 | 180         (opcional, default 90)
 *
 * Resposta:
 *   {
 *     dimension, metric, days,
 *     sample_size,                 // total de pedidos no período (após exclusões)
 *     insufficient_sample,         // true se sample_size < MIN_SAMPLE
 *     buckets: [
 *       { label, value }           // dow: 0..6 (PG: 0=dom..6=sab); hour: 0..23
 *     ]
 *   }
 *
 * Cuidados aplicados (não-negociáveis):
 *   1. EXTRACT executado em (created_at AT TIME ZONE 'America/Sao_Paulo'),
 *      sem isso o "pico" aparece em UTC e mente em BRT.
 *   2. status != 'cancelado' sempre excluído.
 *   3. Volume líquido de itens = qty - COALESCE(qty_returned, 0).
 *   4. PG retorna DOW como 0=dom..6=sáb. O frontend reordena para seg→dom.
 *   5. Cache em memória 1h por (tenantSlug, dimension, metric, days).
 *   6. Se sample_size < 30, devolve insufficient_sample=true (o frontend mostra aviso).
 *   7. created_at é o sinal de demanda (NÃO confirmed_at).
 */

import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize }    from '../middleware/authorize.js'
import { query }        from '../lib/tenantDb.js'

const ALLOWED_DIMENSIONS = new Set(['dow', 'hour'])
const ALLOWED_METRICS    = new Set(['count', 'qty', 'value'])
const ALLOWED_DAYS       = new Set([30, 90, 180])
const MIN_SAMPLE         = 30
const CACHE_TTL_MS       = 60 * 60 * 1000 // 1h

// Cache em memória por processo. Key = `${tenantSlug}|${dim}|${metric}|${days}`.
// Last-writer-wins é seguro: payload é determinístico por janela.
const cache = new Map()

function cacheGet(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  return entry.payload
}

function cacheSet(key, payload) {
  cache.set(key, { ts: Date.now(), payload })
}

export const ordersSeasonalityRouter = Router()
ordersSeasonalityRouter.use(authenticate)
ordersSeasonalityRouter.use(authorize('admin', 'financeiro', 'estoque'))

ordersSeasonalityRouter.get('/', async (req, res) => {
  try {
    const dimension = String(req.query.dimension || '').trim()
    const metric    = String(req.query.metric    || '').trim()
    const days      = parseInt(req.query.days, 10) || 90

    if (!ALLOWED_DIMENSIONS.has(dimension)) {
      return res.status(400).json({ error: "dimension deve ser 'dow' ou 'hour'." })
    }
    if (!ALLOWED_METRICS.has(metric)) {
      return res.status(400).json({ error: "metric deve ser 'count', 'qty' ou 'value'." })
    }
    if (!ALLOWED_DAYS.has(days)) {
      return res.status(400).json({ error: 'days deve ser 30, 90 ou 180.' })
    }

    const tenantSlug = req.tenantSlug || req.user?.tenantSlug || 'default'
    const cacheKey   = `${tenantSlug}|${dimension}|${metric}|${days}`
    const cached     = cacheGet(cacheKey)
    if (cached) return res.json(cached)

    const extractExpr = dimension === 'dow'
      ? `EXTRACT(DOW  FROM (o.created_at AT TIME ZONE 'America/Sao_Paulo'))::int`
      : `EXTRACT(HOUR FROM (o.created_at AT TIME ZONE 'America/Sao_Paulo'))::int`

    // Uma única query devolve as 3 métricas. Filtragem por metric acontece no JS
    // para manter o cache key estável por (dim, metric) ao mesmo custo de query.
    const sql = `
      WITH items_per_order AS (
        SELECT order_id,
               SUM(GREATEST(qty - COALESCE(qty_returned, 0), 0)) AS qty_net
        FROM order_items
        GROUP BY order_id
      )
      SELECT
        ${extractExpr}                       AS bucket,
        COUNT(*)                              AS qtd_pedidos,
        COALESCE(SUM(items.qty_net), 0)::bigint AS qtd_itens,
        COALESCE(SUM(o.total), 0)::numeric    AS valor_total
      FROM orders o
      LEFT JOIN items_per_order items ON items.order_id = o.id
      WHERE o.status::text != 'cancelado'
        AND o.created_at >= NOW() - ($1 || ' days')::interval
      GROUP BY bucket
      ORDER BY bucket
    `

    const { rows } = await query(sql, [String(days)])

    const allBuckets = dimension === 'dow'
      ? [0, 1, 2, 3, 4, 5, 6]
      : Array.from({ length: 24 }, (_, i) => i)

    const byBucket = new Map(rows.map(r => [Number(r.bucket), r]))

    const buckets = allBuckets.map(b => {
      const r = byBucket.get(b)
      let value = 0
      if (r) {
        if (metric === 'count')      value = Number(r.qtd_pedidos) || 0
        else if (metric === 'qty')   value = Number(r.qtd_itens) || 0
        else                         value = parseFloat(r.valor_total) || 0
      }
      return { label: b, value }
    })

    const sampleSize = rows.reduce((acc, r) => acc + Number(r.qtd_pedidos || 0), 0)

    const payload = {
      dimension,
      metric,
      days,
      sample_size:         sampleSize,
      insufficient_sample: sampleSize < MIN_SAMPLE,
      buckets,
    }

    cacheSet(cacheKey, payload)
    res.json(payload)
  } catch (err) {
    console.error('[ordersSeasonality] err', err)
    res.status(500).json({ error: 'Erro ao calcular sazonalidade.' })
  }
})
