/**
 * mcp-billing-job.js — Aura Platform
 *
 * Job mensal de billing de excedentes MCP.
 * Consolida calls_billed do mês anterior e cria cobranças no Pagar.me.
 *
 * Roda no dia 1 de cada mês às 06:00 BRT.
 * Executado pelo provision-agent via setInterval ou cron externo.
 *
 * Uso: node mcp-billing-job.js [--dry-run]
 */

import pg     from 'pg'
import crypto from 'crypto'

const { Pool } = pg

const MASTER_DB    = process.env.MASTER_DB_URL
const PAGARME_KEY  = process.env.PAGARME_API_KEY
const DRY_RUN      = process.argv.includes('--dry-run')

const OVERAGE_PRICE = { starter: 0.30, pro: 0.20, full: 0.10 }
const MIN_CHARGE    = 1.00  // não cobrar menos de R$ 1,00

const pool = new Pool({ connectionString: MASTER_DB, max: 3 })

function log(msg) { console.log(`[billing-job] ${new Date().toISOString()} ${msg}`) }

async function run() {
  const now      = new Date()
  // Mês anterior
  const year     = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const month    = now.getMonth() === 0 ? 12 : now.getMonth()
  const monthStr = `${year}-${String(month).padStart(2, '0')}`

  log(`Iniciando billing para ${monthStr} ${DRY_RUN ? '[DRY-RUN]' : ''}`)

  // Buscar todos os tenants com excedente no mês
  const rows = await pool.query(`
    SELECT
      u.tenant_id,
      u.calls_used,
      u.calls_billed,
      t.slug,
      t.name,
      t.plan_id,
      t.pagarme_customer_id,
      t.billing_status,
      p.name  AS plan_name,
      p.mcp_quota
    FROM mcp_usage u
    JOIN tenants t ON t.id = u.tenant_id
    JOIN plans p   ON p.id = t.plan_id
    WHERE u.month = $1
      AND u.calls_billed > 0
      AND t.billing_status NOT IN ('suspended', 'cancelled')
    ORDER BY u.calls_billed DESC
  `, [monthStr]).then(r => r.rows)

  log(`${rows.length} tenant(s) com excedente em ${monthStr}`)

  for (const row of rows) {
    const planName     = row.plan_name?.toLowerCase() ?? 'starter'
    const pricePerCall = OVERAGE_PRICE[planName] ?? 0.30
    const totalAmount  = parseFloat((row.calls_billed * pricePerCall).toFixed(2))

    log(`  ${row.slug}: ${row.calls_billed} calls excedentes × R$ ${pricePerCall} = R$ ${totalAmount}`)

    if (totalAmount < MIN_CHARGE) {
      log(`  → Skipping (abaixo do mínimo R$ ${MIN_CHARGE})`)
      continue
    }

    if (DRY_RUN) {
      log(`  → [DRY-RUN] Cobrança de R$ ${totalAmount} não processada`)
      continue
    }

    // Registrar evento de billing pendente
    await pool.query(`
      INSERT INTO billing_events (tenant_id, event_type, amount, status, payload, created_at)
      VALUES ($1, 'mcp_overage_monthly', $2, 'pending', $3, now())
      ON CONFLICT DO NOTHING
    `, [
      row.tenant_id,
      totalAmount,
      JSON.stringify({
        month:         monthStr,
        calls_billed:  row.calls_billed,
        plan:          planName,
        price_per_call: pricePerCall,
      })
    ])

    // Cobrar via Pagar.me se customer_id existir
    if (row.pagarme_customer_id && PAGARME_KEY) {
      try {
        const charge = await createPagarmeCharge({
          customerId: row.pagarme_customer_id,
          amount:     Math.round(totalAmount * 100), // centavos
          description: `Excedente MCP ${monthStr} — ${row.calls_billed} calls`,
          tenantSlug:  row.slug,
        })
        log(`  → Pagar.me charge: ${charge.id} status: ${charge.status}`)

        await pool.query(`
          UPDATE billing_events
          SET status = $1, pagarme_charge_id = $2
          WHERE tenant_id = $3
            AND event_type = 'mcp_overage_monthly'
            AND payload->>'month' = $4
        `, [charge.status, charge.id, row.tenant_id, monthStr])

      } catch (e) {
        log(`  → ❌ Erro Pagar.me para ${row.slug}: ${e.message}`)

        await pool.query(`
          UPDATE billing_events SET status = 'error'
          WHERE tenant_id=$1 AND event_type='mcp_overage_monthly'
            AND payload->>'month'=$2
        `, [row.tenant_id, monthStr])
      }
    } else {
      log(`  → Sem Pagar.me customer_id — billing registrado como pending`)
    }
  }

  // Relatório final
  const summary = await pool.query(`
    SELECT
      COUNT(*) AS total_tenants,
      SUM(u.calls_billed) AS total_calls_billed,
      SUM(u.calls_billed *
        CASE p.name
          WHEN 'starter' THEN 0.30
          WHEN 'pro'     THEN 0.20
          WHEN 'full'    THEN 0.10
          ELSE 0.30
        END
      ) AS total_receita
    FROM mcp_usage u
    JOIN tenants t ON t.id = u.tenant_id
    JOIN plans p   ON p.id = t.plan_id
    WHERE u.month=$1 AND u.calls_billed > 0
  `, [monthStr]).then(r => r.rows[0])

  log(`\n📊 Resumo ${monthStr}:`)
  log(`   Tenants com excedente: ${summary.total_tenants}`)
  log(`   Total calls excedentes: ${summary.total_calls_billed ?? 0}`)
  log(`   Receita excedente: R$ ${parseFloat(summary.total_receita ?? 0).toFixed(2)}`)
  log(`Billing job concluído.`)

  await pool.end()
}

async function createPagarmeCharge({ customerId, amount, description, tenantSlug }) {
  const resp = await fetch('https://api.pagar.me/core/v5/charges', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': 'Basic ' + Buffer.from(PAGARME_KEY + ':').toString('base64'),
    },
    body: JSON.stringify({
      customer_id: customerId,
      payment:     {
        payment_method: 'boleto',
        boleto: {
          due_at:       new Date(Date.now() + 5 * 86400_000).toISOString(),
          instructions: `Cobrança de excedente MCP Aura Platform — Tenant: ${tenantSlug}`,
        },
      },
      amount,
      description,
      metadata: { tenant: tenantSlug, type: 'mcp_overage' },
    }),
  })
  if (!resp.ok) throw new Error(`Pagar.me ${resp.status}: ${await resp.text()}`)
  return resp.json()
}

run().catch(e => { log(`FATAL: ${e.message}`); process.exit(1) })
