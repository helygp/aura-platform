/**
 * mcp-shared/quota.js — Aura Platform
 *
 * Controle de cotas MCP por plano.
 * Importado pelos 3 servidores MCP (manager, store, connect).
 *
 * Fluxo por chamada tool/call:
 *   1. Busca quota do plano no banco master
 *   2. Soma calls_used do mês corrente
 *   3. Se dentro da quota → incrementa calls_used
 *   4. Se excedeu → incrementa calls_billed + registra billing_event
 *   5. Retorna { allowed, used, quota, overage }
 *
 * Preços por plano:
 *   starter: 500 calls/mês incluídos  — excedente R$ 0,30/call
 *   pro:    2000 calls/mês incluídos  — excedente R$ 0,20/call
 *   full:  10000 calls/mês incluídos  — excedente R$ 0,10/call
 *
 * Hard limit: 3× a quota do plano (evitar surpresas na fatura)
 */

import pg from 'pg'
const { Pool } = pg

// O pool é passado como argumento para evitar múltiplas conexões
// Cada MCP server passa o seu próprio masterPool

const OVERAGE_PRICE = {
  starter: 0.30,
  pro:     0.20,
  full:    0.10,
}

const HARD_LIMIT_MULTIPLIER = 3  // bloqueia em 3× a quota

/**
 * checkAndTrack — verifica quota e registra uso
 *
 * @param {pg.Pool} masterPool
 * @param {string}  tenantId
 * @param {string}  tenantSlug
 * @param {string}  planId        ex: 'plan_pro'
 * @param {string}  scope         'manager' | 'store' | 'connect'
 * @returns {{ allowed: boolean, used: number, quota: number, overage: number, blocked: boolean }}
 */
export async function checkAndTrack(masterPool, tenantId, planId, scope = 'manager') {
  const month = new Date().toISOString().slice(0, 7)  // 'YYYY-MM'

  // Buscar quota do plano
  const planRows = await masterPool.query(
    'SELECT name, mcp_quota FROM plans WHERE id=$1',
    [planId]
  ).then(r => r.rows).catch(() => [])

  const planName = planRows[0]?.name?.toLowerCase() ?? 'starter'
  const quota    = planRows[0]?.mcp_quota ?? 500
  const hardLimit = quota * HARD_LIMIT_MULTIPLIER
  const overagePrice = OVERAGE_PRICE[planName] ?? 0.30

  // Buscar uso atual (com lock para evitar race condition)
  const client = await masterPool.connect()
  try {
    await client.query('BEGIN')

    // Upsert row e retornar valores atuais
    const result = await client.query(`
      INSERT INTO mcp_usage (tenant_id, month, calls_used, calls_billed)
      VALUES ($1, $2, 0, 0)
      ON CONFLICT (tenant_id, month) DO NOTHING
      RETURNING calls_used, calls_billed
    `, [tenantId, month])

    const usageRow = await client.query(
      'SELECT calls_used, calls_billed FROM mcp_usage WHERE tenant_id=$1 AND month=$2 FOR UPDATE',
      [tenantId, month]
    ).then(r => r.rows[0])

    const used    = usageRow?.calls_used  ?? 0
    const billed  = usageRow?.calls_billed ?? 0
    const total   = used + billed  // total de calls (incluídos + excedentes)

    // Hard limit — bloquear para evitar fatura absurda
    if (total >= hardLimit) {
      await client.query('ROLLBACK')
      return { allowed: false, blocked: true, used, quota, hardLimit, overage: billed }
    }

    // Incrementar calls_used
    await client.query(`
      UPDATE mcp_usage
      SET calls_used = calls_used + 1
      WHERE tenant_id=$1 AND month=$2
    `, [tenantId, month])

    const newUsed = used + 1
    let overage = billed

    // Se excedeu a quota, registrar excedente
    if (newUsed > quota) {
      overage = newUsed - quota
      const overageAmount = overagePrice  // valor desta chamada específica

      await client.query(`
        UPDATE mcp_usage SET calls_billed = $1 WHERE tenant_id=$2 AND month=$3
      `, [overage, tenantId, month])

      // Registrar billing event de excedente
      await client.query(`
        INSERT INTO billing_events (tenant_id, event_type, amount, status, payload, created_at)
        VALUES ($1, 'mcp_overage', $2, 'pending', $3, now())
      `, [
        tenantId,
        overageAmount,
        JSON.stringify({ month, scope, call_number: newUsed, quota, plan: planName, price_per_call: overagePrice })
      ])
    }

    await client.query('COMMIT')

    return {
      allowed:  true,
      blocked:  false,
      used:     newUsed,
      quota,
      overage,
      plan:     planName,
      is_overage: newUsed > quota,
    }

  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    // Em caso de erro no tracking, permitir a chamada (não bloquear por erro de infra)
    console.error('[quota] tracking error:', e.message)
    return { allowed: true, blocked: false, used: 0, quota, overage: 0, tracking_error: true }
  } finally {
    client.release()
  }
}

/**
 * getUsageSummary — retorna resumo de uso para exibição
 */
export async function getUsageSummary(masterPool, tenantId, planId, months = 3) {
  const planRows = await masterPool.query(
    'SELECT name, mcp_quota FROM plans WHERE id=$1', [planId]
  ).then(r => r.rows).catch(() => [])

  const planName     = planRows[0]?.name?.toLowerCase() ?? 'starter'
  const quota        = planRows[0]?.mcp_quota ?? 500
  const overagePrice = OVERAGE_PRICE[planName] ?? 0.30

  const history = await masterPool.query(`
    SELECT month, calls_used, calls_billed,
           ROUND(calls_billed * $3, 2) AS overage_cost
    FROM mcp_usage
    WHERE tenant_id=$1
    ORDER BY month DESC
    LIMIT $2
  `, [tenantId, months, overagePrice]).then(r => r.rows).catch(() => [])

  const current = history[0]
  const usedThisMonth  = current?.calls_used  ?? 0
  const billedThisMonth = current?.calls_billed ?? 0

  return {
    plano:         planName,
    quota_mensal:  quota,
    hard_limit:    quota * HARD_LIMIT_MULTIPLIER,
    preco_excedente: `R$ ${overagePrice.toFixed(2)}/call`,
    mes_atual: {
      month:       current?.month ?? new Date().toISOString().slice(0, 7),
      calls_used:  usedThisMonth,
      calls_billed: billedThisMonth,
      calls_restantes: Math.max(0, quota - usedThisMonth),
      pct_usado:   Math.min(100, Math.round((usedThisMonth / quota) * 100)),
      custo_excedente: parseFloat(current?.overage_cost ?? 0),
    },
    historico: history,
  }
}

/**
 * buildQuotaHeaders — headers HTTP informativos sobre quota
 */
export function buildQuotaHeaders(quotaResult) {
  return {
    'X-MCP-Quota-Limit':     String(quotaResult.quota),
    'X-MCP-Quota-Used':      String(quotaResult.used),
    'X-MCP-Quota-Remaining': String(Math.max(0, quotaResult.quota - quotaResult.used)),
    'X-MCP-Quota-Overage':   String(quotaResult.overage ?? 0),
  }
}
