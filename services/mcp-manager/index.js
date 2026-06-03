/**
 * mcp-manager — Aura Platform
 *
 * Servidor MCP HTTP (Streamable HTTP Transport) para gestores.
 * Permite ao dono do negócio gerenciar o ERP via linguagem natural
 * no Claude, ChatGPT, Copilot, etc.
 *
 * URL: https://mcp.aurabr.app/manager/{tenant-slug}
 * Auth: header x-api-key (API Key por tenant, salva no banco master)
 *
 * 10 tools:
 *   get_dashboard       — KPIs do dia
 *   analyze_margin      — margem por produto/categoria
 *   list_low_stock      — SKUs abaixo do mínimo
 *   create_order        — criar pedido manualmente
 *   update_order_status — mudar status de pedido
 *   get_sales_report    — relatório de vendas por período
 *   list_top_customers  — melhores clientes por volume
 *   send_whatsapp       — enviar mensagem para cliente
 *   list_products       — listar produtos com estoque
 *   get_ai_insights     — insights gerados por IA
 */

import http from 'http'
import pg   from 'pg'
import { checkAndTrack, buildQuotaHeaders, getUsageSummary } from './mcp-shared/quota.js'

const { Pool } = pg

const PORT        = parseInt(process.env.PORT ?? '4002', 10)
const MASTER_DB   = process.env.MASTER_DB_URL
const DOMAIN      = process.env.AURA_DOMAIN ?? 'aurabr.app'
const AI_API_KEY  = process.env.ANTHROPIC_API_KEY ?? ''

// Pool de conexões por tenant (cache)
const tenantPools = new Map()

function getTenantPool(dbUrl) {
  if (tenantPools.has(dbUrl)) return tenantPools.get(dbUrl)
  const pool = new Pool({ connectionString: dbUrl, max: 5, idleTimeoutMillis: 30_000 })
  tenantPools.set(dbUrl, pool)
  return pool
}

// Pool master
const masterPool = new Pool({ connectionString: MASTER_DB, max: 5 })

async function queryMaster(sql, params = []) {
  const { rows } = await masterPool.query(sql, params)
  return rows
}

async function queryTenant(dbUrl, sql, params = []) {
  const { rows } = await getTenantPool(dbUrl).query(sql, params)
  return rows
}

/* ─── Autenticação ─────────────────────────────────────────── */

async function resolveTenant(slug, apiKey) {
  if (!slug || !apiKey) return null
  const rows = await queryMaster(
    `SELECT t.id, t.slug, t.name, t.db_name, t.db_url, t.status, t.plan_id,
            mk.key_hash
     FROM tenants t
     JOIN mcp_api_keys mk ON mk.tenant_id = t.id
     WHERE t.slug = $1 AND mk.active = true AND mk.scope = 'manager'`,
    [slug]
  ).catch(() => [])

  if (!rows.length) return null

  const row = rows.find(r => r.key_hash === apiKey)
  if (!row) return null

  if (!row.db_url) throw new Error('Tenant sem db_url configurada no master.')
  return { ...row, dbUrl: row.db_url }
}

/* ─── Tools ────────────────────────────────────────────────── */

async function tool_get_dashboard(tenant, _args) {
  const rows = await queryTenant(tenant.dbUrl, `
    SELECT
      (SELECT COALESCE(SUM(total),0) FROM orders WHERE status != 'cancelado' AND created_at::date = CURRENT_DATE) AS receita_hoje,
      (SELECT COUNT(*) FROM orders WHERE status = 'pendente') AS pedidos_pendentes,
      (SELECT COUNT(*) FROM skus WHERE stock <= stock_min) AS estoque_critico,
      (SELECT COUNT(*) FROM customers WHERE status = 'ativo') AS clientes_ativos,
      (SELECT COALESCE(SUM(total),0) FROM orders WHERE status != 'cancelado'
        AND created_at >= date_trunc('month', CURRENT_DATE)) AS receita_mes
  `)
  const d = rows[0]
  return {
    receita_hoje:      parseFloat(d.receita_hoje),
    receita_mes:       parseFloat(d.receita_mes),
    pedidos_pendentes: parseInt(d.pedidos_pendentes),
    estoque_critico:   parseInt(d.estoque_critico),
    clientes_ativos:   parseInt(d.clientes_ativos),
    tenant: tenant.name,
    gerado_em: new Date().toISOString(),
  }
}

async function tool_analyze_margin(tenant, args) {
  const { categoria, limite = 20 } = args
  let sql = `
    SELECT
      p.name AS produto,
      p.category AS categoria,
      AVG(s.price_wholesale) AS preco_venda,
      0 AS custo,
      0 AS margem_pct,
      COALESCE(SUM(oi.qty), 0) AS unidades_vendidas
    FROM products p
    LEFT JOIN skus s ON s.product_id = p.id
    LEFT JOIN order_items oi ON oi.sku_id = s.id
    LEFT JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelado'
  `
  const params = []
  if (categoria) { sql += ` WHERE p.category = $1`; params.push(categoria) }
  sql += ` GROUP BY p.id, p.name, p.category ORDER BY unidades_vendidas DESC LIMIT $${params.length + 1}`
  params.push(limite)

  const rows = await queryTenant(tenant.dbUrl, sql, params)
  return { produtos: rows, total: rows.length }
}

async function tool_list_low_stock(tenant, args) {
  const { limite = 50 } = args
  const rows = await queryTenant(tenant.dbUrl, `
    SELECT s.code AS sku, p.name AS produto, s.stock AS estoque, s.stock_min AS minimo,
           s.stock_min - s.stock AS deficit
    FROM skus s
    JOIN products p ON p.id = s.product_id
    WHERE s.stock <= s.stock_min
    ORDER BY deficit DESC
    LIMIT $1
  `, [limite])
  return { skus: rows, total: rows.length }
}

async function tool_create_order(tenant, args) {
  const { customer_id, items, observacao = '' } = args
  if (!customer_id || !items?.length) throw new Error('customer_id e items são obrigatórios')

  const client = await getTenantPool(tenant.dbUrl).connect()
  try {
    await client.query('BEGIN')
    let total = 0
    for (const item of items) {
      const sku = await client.query('SELECT s.id, s.code, s.price_wholesale, p.name FROM skus s JOIN products p ON p.id=s.product_id WHERE s.id=$1 OR s.code=$1', [item.sku_id ?? item.product_id])
      if (!sku.rows.length) throw new Error(`SKU ${item.sku_id ?? item.product_id} não encontrado`)
      total += parseFloat(sku.rows[0].price_wholesale) * item.quantity
    }
    const order = await client.query(
      `INSERT INTO orders (customer_id, customer_name, status, total, notes, created_at, updated_at)
       VALUES ($1, (SELECT name FROM customers WHERE id=$1), 'pendente', $2, $3, now(), now()) RETURNING id, status, total`,
      [customer_id, total, observacao]
    )
    const orderId = order.rows[0].id
    for (const item of items) {
      const sku = await client.query('SELECT s.id, s.code, s.price_wholesale, p.name FROM skus s JOIN products p ON p.id=s.product_id WHERE s.id=$1 OR s.code=$1', [item.sku_id ?? item.product_id])
      await client.query(
        `INSERT INTO order_items (order_id, sku_id, sku_code, product_name, attributes, qty, price_unit)
         VALUES ($1, $2, $3, $4, '{}', $5, $6)`,
        [orderId, sku.rows[0].id, sku.rows[0].code, sku.rows[0].name, item.quantity, sku.rows[0].price_wholesale]
      )
    }
    await client.query('COMMIT')
    return { pedido_id: orderId, status: 'pendente', total, mensagem: 'Pedido criado com sucesso.' }
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

async function tool_update_order_status(tenant, args) {
  const { order_id, status, motivo = '' } = args
  const allowed = ['pendente', 'confirmado', 'separando', 'enviado', 'entregue', 'cancelado']
  if (!allowed.includes(status)) throw new Error(`Status inválido. Use: ${allowed.join(', ')}`)

  const rows = await queryTenant(tenant.dbUrl,
    `UPDATE orders SET status=$1, notes=COALESCE(NULLIF($2,''), notes), updated_at=now()
     WHERE id=$3 RETURNING id, status, total`,
    [status, motivo, order_id]
  )
  if (!rows.length) throw new Error(`Pedido ${order_id} não encontrado`)
  return { pedido_id: order_id, novo_status: status, mensagem: `Status atualizado para '${status}'.` }
}

async function tool_get_sales_report(tenant, args) {
  const { data_inicio, data_fim, agrupar_por = 'dia' } = args
  const inicio = data_inicio ?? new Date(Date.now() - 30*86400000).toISOString().slice(0,10)
  const fim    = data_fim    ?? new Date().toISOString().slice(0,10)

  const trunc = { dia: 'day', semana: 'week', mes: 'month' }[agrupar_por] ?? 'day'

  const rows = await queryTenant(tenant.dbUrl, `
    SELECT
      date_trunc('${trunc}', created_at)::date AS periodo,
      COUNT(*) AS pedidos,
      COALESCE(SUM(total), 0) AS receita
    FROM orders
    WHERE status != 'cancelado'
      AND created_at::date BETWEEN $1 AND $2
    GROUP BY 1 ORDER BY 1
  `, [inicio, fim])

  const totalReceita = rows.reduce((s, r) => s + parseFloat(r.receita), 0)
  const totalPedidos = rows.reduce((s, r) => s + parseInt(r.pedidos), 0)

  return { periodo: { inicio, fim }, agrupado_por: agrupar_por, linhas: rows, total_receita: totalReceita, total_pedidos: totalPedidos }
}

async function tool_list_top_customers(tenant, args) {
  const { limite = 10, periodo_dias = 30 } = args
  const rows = await queryTenant(tenant.dbUrl, `
    SELECT
      c.id, c.name AS nome, c.email, c.whatsapp AS telefone,
      COUNT(o.id) AS pedidos,
      COALESCE(SUM(o.total), 0) AS volume_total,
      MAX(o.created_at)::date AS ultimo_pedido
    FROM customers c
    JOIN orders o ON o.customer_id = c.id AND o.status != 'cancelado'
      AND o.created_at >= CURRENT_DATE - $2::int
    GROUP BY c.id
    ORDER BY volume_total DESC
    LIMIT $1
  `, [limite, periodo_dias])
  return { clientes: rows, total: rows.length, periodo_dias }
}

async function tool_send_whatsapp(tenant, args) {
  const { customer_id, mensagem } = args
  if (!mensagem) throw new Error('mensagem é obrigatória')

  // Buscar telefone do cliente
  const rows = await queryTenant(tenant.dbUrl,
    `SELECT name, whatsapp AS phone FROM customers WHERE id=$1`, [customer_id])
  if (!rows.length) throw new Error(`Cliente ${customer_id} não encontrado`)
  const { name, phone } = rows[0]
  if (!phone) throw new Error(`Cliente ${name} não tem WhatsApp cadastrado`)

  // Chamar WAHA via API interna do tenant
  const wahaUrl  = process.env[`WAHA_URL_${tenant.slug.toUpperCase().replace(/-/g,'_')}`] ?? process.env.WAHA_URL
  const wahaKey  = process.env[`WAHA_API_KEY_${tenant.slug.toUpperCase().replace(/-/g,'_')}`] ?? process.env.WAHA_API_KEY

  const chatId = phone.replace(/\D/g, '') + '@c.us'
  const resp = await fetch(`${wahaUrl}/api/sendText`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': wahaKey },
    body:    JSON.stringify({ chatId, text: mensagem, session: 'default' }),
  })
  if (!resp.ok) throw new Error(`WAHA retornou ${resp.status}`)
  return { enviado: true, cliente: name, telefone: phone, mensagem }
}

async function tool_list_products(tenant, args) {
  const { categoria, com_estoque_apenas = false, limite = 50 } = args
  let sql = `
    SELECT p.id, p.name AS nome, p.category AS categoria,
           COALESCE(AVG(s.price_wholesale), 0) AS preco,
           COALESCE(SUM(s.stock), 0) AS estoque_total
    FROM products p
    LEFT JOIN skus s ON s.product_id = p.id
  `
  const params = []
  const where = []
  if (categoria) { params.push(categoria); where.push(`p.category = $${params.length}`) }
  if (com_estoque_apenas) where.push(`s.stock > 0`)
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`
  sql += ` GROUP BY p.id, p.name, p.category ORDER BY p.name LIMIT $${params.length + 1}`
  params.push(limite)

  const rows = await queryTenant(tenant.dbUrl, sql, params)
  return { produtos: rows, total: rows.length }
}

async function tool_get_ai_insights(tenant, _args) {
  // Coletar dados do tenant
  const [dashboard, lowStock, topCustomers] = await Promise.all([
    tool_get_dashboard(tenant, {}),
    tool_list_low_stock(tenant, { limite: 5 }),
    tool_list_top_customers(tenant, { limite: 5, periodo_dias: 30 }),
  ])

  if (!AI_API_KEY) {
    return {
      insights: [
        `Receita hoje: R$ ${dashboard.receita_hoje.toFixed(2)}`,
        `${dashboard.pedidos_pendentes} pedidos pendentes aguardando confirmação`,
        `${dashboard.estoque_critico} SKUs com estoque crítico`,
      ],
      aviso: 'Insights completos requerem ANTHROPIC_API_KEY configurada.',
    }
  }

  const prompt = `Você é um consultor de negócios analisando os dados do tenant "${tenant.name}".

Dados do dia:
- Receita hoje: R$ ${dashboard.receita_hoje.toFixed(2)}
- Receita do mês: R$ ${dashboard.receita_mes.toFixed(2)}
- Pedidos pendentes: ${dashboard.pedidos_pendentes}
- SKUs com estoque crítico: ${dashboard.estoque_critico}
- Clientes ativos: ${dashboard.clientes_ativos}

Top 5 SKUs com estoque crítico: ${JSON.stringify(lowStock.skus.slice(0,5))}

Top 5 clientes do mês: ${JSON.stringify(topCustomers.clientes.map(c=>({nome:c.nome, volume:c.volume_total})))}

Gere 3-5 insights acionáveis e objetivos. Responda em português, no formato JSON:
{"insights": ["insight 1", "insight 2", ...], "alertas": ["alerta 1", ...]}`

  const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: { 'x-api-key': AI_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body:    JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
  })
  const aiData = await aiResp.json()
  const text = aiData.content?.[0]?.text ?? '{}'
  try {
    return { ...JSON.parse(text.replace(/```json|```/g, '').trim()), gerado_em: new Date().toISOString() }
  } catch {
    return { insights: [text], gerado_em: new Date().toISOString() }
  }
}

/* ─── Tool dispatch ────────────────────────────────────────── */

const TOOLS = {
  get_dashboard:       { fn: tool_get_dashboard,       desc: 'KPIs do dia: receita, pedidos pendentes, estoque crítico, clientes ativos.' },
  analyze_margin:      { fn: tool_analyze_margin,      desc: 'Margem de contribuição por produto ou categoria.' },
  list_low_stock:      { fn: tool_list_low_stock,      desc: 'SKUs abaixo do estoque mínimo.' },
  create_order:        { fn: tool_create_order,        desc: 'Criar pedido manualmente.' },
  update_order_status: { fn: tool_update_order_status, desc: 'Atualizar status de um pedido.' },
  get_sales_report:    { fn: tool_get_sales_report,    desc: 'Relatório de vendas por período.' },
  list_top_customers:  { fn: tool_list_top_customers,  desc: 'Melhores clientes por volume de compras.' },
  send_whatsapp:       { fn: tool_send_whatsapp,       desc: 'Enviar mensagem WhatsApp para um cliente.' },
  list_products:       { fn: tool_list_products,       desc: 'Listar produtos com estoque.' },
  get_ai_insights:     { fn: tool_get_ai_insights,     desc: 'Insights gerados por IA sobre o negócio.' },
}

function buildToolsSchema() {
  return [
    { name: 'get_dashboard',       description: TOOLS.get_dashboard.desc,       inputSchema: { type: 'object', properties: {} } },
    { name: 'analyze_margin',      description: TOOLS.analyze_margin.desc,      inputSchema: { type: 'object', properties: { categoria: { type: 'string', description: 'Filtrar por categoria (opcional)' }, limite: { type: 'number', description: 'Máximo de produtos (padrão 20)' } } } },
    { name: 'list_low_stock',      description: TOOLS.list_low_stock.desc,      inputSchema: { type: 'object', properties: { limite: { type: 'number', description: 'Máximo de SKUs (padrão 50)' } } } },
    { name: 'create_order',        description: TOOLS.create_order.desc,        inputSchema: { type: 'object', required: ['customer_id', 'items'], properties: { customer_id: { type: 'string' }, items: { type: 'array', items: { type: 'object', properties: { product_id: { type: 'string' }, quantity: { type: 'number' } } } }, observacao: { type: 'string' } } } },
    { name: 'update_order_status', description: TOOLS.update_order_status.desc, inputSchema: { type: 'object', required: ['order_id', 'status'], properties: { order_id: { type: 'string' }, status: { type: 'string', enum: ['pendente','confirmado','separando','enviado','entregue','cancelado'] }, motivo: { type: 'string' } } } },
    { name: 'get_sales_report',    description: TOOLS.get_sales_report.desc,    inputSchema: { type: 'object', properties: { data_inicio: { type: 'string', description: 'YYYY-MM-DD' }, data_fim: { type: 'string', description: 'YYYY-MM-DD' }, agrupar_por: { type: 'string', enum: ['dia','semana','mes'] } } } },
    { name: 'list_top_customers',  description: TOOLS.list_top_customers.desc,  inputSchema: { type: 'object', properties: { limite: { type: 'number' }, periodo_dias: { type: 'number', description: 'Dias para trás (padrão 30)' } } } },
    { name: 'send_whatsapp',       description: TOOLS.send_whatsapp.desc,       inputSchema: { type: 'object', required: ['customer_id', 'mensagem'], properties: { customer_id: { type: 'string' }, mensagem: { type: 'string' } } } },
    { name: 'list_products',       description: TOOLS.list_products.desc,       inputSchema: { type: 'object', properties: { categoria: { type: 'string' }, com_estoque_apenas: { type: 'boolean' }, limite: { type: 'number' } } } },
    { name: 'get_ai_insights',     description: TOOLS.get_ai_insights.desc,     inputSchema: { type: 'object', properties: {} } },
  ]
}

/* ─── MCP HTTP Transport (Streamable HTTP) ─────────────────── */

// Sessions em memória (stateful MCP)
const sessions = new Map()

function createSession(tenant) {
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
  sessions.set(id, { tenant, createdAt: Date.now() })
  // Expirar após 1h
  setTimeout(() => sessions.delete(id), 3_600_000)
  return id
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', c => body += c)
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')) } catch { reject(new Error('JSON inválido')) } })
    req.on('error', reject)
  })
}

function respond(res, status, data, headers = {}) {
  const body = JSON.stringify(data)
  const quotaH = res._quotaHeaders ?? {}
  const allHeaders = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...quotaH, ...headers }
  res.writeHead(status, allHeaders)
  res.end(body)
}

function mcpError(code, message) {
  return { jsonrpc: '2.0', error: { code, message }, id: null }
}

async function handleMcpRequest(body, tenant) {
  const { method, params, id } = body

  const reply = (result) => ({ jsonrpc: '2.0', result, id })
  const error = (code, msg) => ({ jsonrpc: '2.0', error: { code, message: msg }, id })

  if (method === 'initialize') {
    return reply({
      protocolVersion: '2024-11-05',
      capabilities:    { tools: {} },
      serverInfo:      { name: 'aura-mcp-manager', version: '1.0.0' },
    })
  }

  if (method === 'tools/list') {
    return reply({ tools: buildToolsSchema() })
  }

  if (method === 'tools/call') {
    const { name, arguments: args = {} } = params ?? {}
    const tool = TOOLS[name]
    if (!tool) return error(-32601, `Tool '${name}' não encontrada`)

    try {
      const result = await tool.fn(tenant, args)
      return reply({
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        isError:  false,
      })
    } catch (e) {
      return reply({
        content: [{ type: 'text', text: `Erro: ${e.message}` }],
        isError:  true,
      })
    }
  }

  if (method === 'ping') return reply({})

  return error(-32601, `Método '${method}' não suportado`)
}

/* ─── HTTP Server ──────────────────────────────────────────── */

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0]

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, mcp-session-id')
  res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  // Health
  if (req.method === 'GET' && url === '/health') {
    return respond(res, 200, { ok: true, service: 'mcp-manager', uptime: process.uptime() })
  }

  // Extrair slug da URL: /manager/{slug}
  const match = url.match(/^\/manager\/([a-z0-9-]+)$/)
  if (!match) return respond(res, 404, { error: 'URL inválida. Use /manager/{tenant-slug}' })

  const slug   = match[1]
  const apiKey = req.headers['x-api-key'] ?? req.headers['authorization']?.replace('Bearer ', '')

  if (!apiKey) return respond(res, 401, { error: 'API Key obrigatória. Use header x-api-key.' })

  // GET → retorna MCP server info (para discovery)
  if (req.method === 'GET') {
    const tenant = await resolveTenant(slug, apiKey)
    if (!tenant) return respond(res, 401, { error: 'API Key inválida.' })

    return respond(res, 200, {
      name:        `Aura MCP Manager — ${tenant.name}`,
      version:     '1.0.0',
      description: 'Gerencie seu negócio via linguagem natural',
      tools:       buildToolsSchema().map(t => ({ name: t.name, description: t.description })),
    })
  }

  // DELETE → encerrar sessão
  if (req.method === 'DELETE') {
    const sessionId = req.headers['mcp-session-id']
    if (sessionId) sessions.delete(sessionId)
    return respond(res, 200, { ok: true })
  }

  // POST → MCP JSON-RPC
  if (req.method === 'POST') {
    let body
    try { body = await parseBody(req) }
    catch { return respond(res, 400, mcpError(-32700, 'Parse error')) }

    // Verificar session ou autenticar novamente
    let tenant
    const sessionId = req.headers['mcp-session-id']

    if (sessionId && sessions.has(sessionId)) {
      tenant = sessions.get(sessionId).tenant
    } else {
      tenant = await resolveTenant(slug, apiKey)
      if (!tenant) return respond(res, 401, { error: 'API Key inválida.' })
    }

    // Verificar e registrar quota MCP
    if (body.method === 'tools/call') {
      const quota = await checkAndTrack(masterPool, tenant.id, tenant.plan_id ?? tenant.planId ?? 'plan_starter', 'manager').catch(() => ({ allowed: true }))
      if (quota.blocked) {
        return respond(res, 429, { error: `Quota MCP esgotada. Hard limit de ${quota.hardLimit} calls/mês atingido. Contate o suporte.` })
      }
      if (!quota.allowed) {
        return respond(res, 429, { error: 'Quota MCP excedida.' })
      }
      // Salvar headers de quota para incluir na resposta final
      res._quotaHeaders = buildQuotaHeaders(quota)
    }

    const isInit = body.method === 'initialize'
    const result = await handleMcpRequest(body, tenant)

    const headers = {}
    if (isInit) {
      const sid = createSession(tenant)
      headers['mcp-session-id'] = sid
    } else if (sessionId) {
      headers['mcp-session-id'] = sessionId
    }

    return respond(res, 200, result, headers)
  }

  respond(res, 405, { error: 'Método não permitido' })
})

/* ─── Quota: implementado em mcp-shared/quota.js ──────────── */

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[mcp-manager] ✅ Rodando na porta ${PORT}`)
  ensureSchema().catch(e => console.error('[mcp-manager] schema error:', e.message))
})

/* ─── Garantir tabelas no master ───────────────────────────── */

async function ensureSchema() {
  await masterPool.query(`
    CREATE TABLE IF NOT EXISTS mcp_api_keys (
      id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      tenant_id  TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      key_hash   TEXT NOT NULL,
      scope      TEXT NOT NULL DEFAULT 'manager',
      label      TEXT,
      active     BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_keys_tenant ON mcp_api_keys(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_mcp_keys_hash   ON mcp_api_keys(key_hash);

    CREATE TABLE IF NOT EXISTS mcp_usage (
      tenant_id    TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      month        TEXT NOT NULL,
      calls_used   INT  NOT NULL DEFAULT 0,
      calls_billed INT  NOT NULL DEFAULT 0,
      PRIMARY KEY (tenant_id, month)
    );
  `)
  console.log('[mcp-manager] schema ok')
}
