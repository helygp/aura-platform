/**
 * mcp-connect — Aura Platform
 *
 * Servidor MCP HTTP para desenvolvedores e integrações.
 * Permite consultar endpoints, validar payloads, registrar webhooks
 * e testar conectividade via assistente de IA.
 *
 * URL: https://mcp.aurabr.app/connect/{tenant-slug}
 * Auth: Developer API Key (scope=connect na tabela mcp_api_keys)
 *
 * 8 tools:
 *   list_endpoints    — listar todos os endpoints disponíveis
 *   get_schema        — schema JSON de um endpoint específico
 *   validate_payload  — validar body antes de enviar
 *   register_webhook  — registrar URL para eventos
 *   test_connection   — testar conectividade com a API do tenant
 *   get_usage         — uso de API e MCP do período
 *   list_integrations — integrações ativas (webhooks registrados)
 *   get_sandbox_data  — dados de teste prontos para uso
 */

import http   from 'http'
import pg     from 'pg'
import crypto from 'crypto'

const { Pool } = pg

const PORT      = parseInt(process.env.PORT ?? '4004', 10)
const MASTER_DB = process.env.MASTER_DB_URL
const DOMAIN    = process.env.AURA_DOMAIN ?? 'aurabr.app'

const masterPool = new Pool({ connectionString: MASTER_DB, max: 5 })
const tenantPools = new Map()

function getTenantPool(dbUrl) {
  if (tenantPools.has(dbUrl)) return tenantPools.get(dbUrl)
  const pool = new Pool({ connectionString: dbUrl, max: 3, idleTimeoutMillis: 30_000 })
  tenantPools.set(dbUrl, pool)
  return pool
}

async function queryTenant(dbUrl, sql, params = []) {
  const { rows } = await getTenantPool(dbUrl).query(sql, params)
  return rows
}

function log(msg) { console.log(`[mcp-connect] ${new Date().toISOString()} ${msg}`) }

/* ─── Catálogo de endpoints da API Aura ───────────────────── */

const API_ENDPOINTS = [
  // Auth
  { method: 'POST', path: '/auth/login',   group: 'auth',      desc: 'Login do usuário ERP', auth: false,
    body: { email: 'string', password: 'string' },
    response: { user: { tokenId: 'string', email: 'string', role: 'string' } } },
  { method: 'POST', path: '/auth/logout',  group: 'auth',      desc: 'Logout', auth: true, body: {} },
  { method: 'GET',  path: '/auth/me',      group: 'auth',      desc: 'Dados do usuário logado', auth: true },

  // Dashboard
  { method: 'GET',  path: '/api/dashboard/summary', group: 'dashboard', desc: 'KPIs e gráfico de vendas', auth: true,
    response: { revenue: 'number', orders: 'number', chart: 'array' } },

  // Produtos
  { method: 'GET',  path: '/api/products',     group: 'products', desc: 'Listar produtos com SKUs', auth: true,
    query: { page: 'number', limit: 'number', category: 'string', search: 'string' } },
  { method: 'POST', path: '/api/products',     group: 'products', desc: 'Criar produto com SKUs', auth: true,
    body: { name: 'string', code: 'string', category: 'string', type: 'simples|grade',
            skus: [{ code: 'string', price_wholesale: 'number', stock: 'number', attributes: 'object' }] } },
  { method: 'PUT',  path: '/api/products/:id', group: 'products', desc: 'Atualizar produto', auth: true,
    body: { name: 'string?', category: 'string?', image_url: 'string?' } },
  { method: 'DELETE', path: '/api/products/:id', group: 'products', desc: 'Remover produto', auth: true },

  // Pedidos
  { method: 'GET',  path: '/api/orders',            group: 'orders', desc: 'Listar pedidos com filtros', auth: true,
    query: { status: 'string', customer_id: 'string', date_from: 'date', date_to: 'date' } },
  { method: 'POST', path: '/api/orders',            group: 'orders', desc: 'Criar pedido manual', auth: true,
    body: { customer_id: 'string', items: [{ sku_id: 'string', qty: 'number', price_unit: 'number' }], notes: 'string?' } },
  { method: 'PUT',  path: '/api/orders/:id/status', group: 'orders', desc: 'Atualizar status do pedido', auth: true,
    body: { status: 'pendente|confirmado|separando|enviado|entregue|cancelado', notes: 'string?' } },

  // Clientes
  { method: 'GET',  path: '/api/customers',     group: 'customers', desc: 'Listar clientes', auth: true,
    query: { search: 'string', status: 'ativo|inativo' } },
  { method: 'POST', path: '/api/customers',     group: 'customers', desc: 'Criar cliente B2B', auth: true,
    body: { name: 'string', person_type: 'pf|pj', document: 'string?', email: 'string?', whatsapp: 'string?',
            credit_limit: 'number?', address: 'object?' } },
  { method: 'PUT',  path: '/api/customers/:id', group: 'customers', desc: 'Atualizar cliente', auth: true },
  { method: 'DELETE', path: '/api/customers/:id', group: 'customers', desc: 'Remover cliente', auth: true },

  // Estoque
  { method: 'GET',  path: '/api/inventory',                    group: 'inventory', desc: 'Posição de estoque de todos os SKUs', auth: true },
  { method: 'POST', path: '/api/inventory/:skuId/movement',    group: 'inventory', desc: 'Registrar movimentação de estoque', auth: true,
    body: { type: 'entrada|saida|ajuste', qty: 'number', reason: 'string?' } },
  { method: 'GET',  path: '/api/inventory/:skuId/movements',   group: 'inventory', desc: 'Histórico de movimentações de um SKU', auth: true },

  // Store (público)
  { method: 'GET',  path: '/store/catalog',        group: 'store', desc: 'Catálogo público B2B', auth: false,
    query: { category: 'string', search: 'string', page: 'number' } },
  { method: 'POST', path: '/store/auth/register',  group: 'store', desc: 'Cadastro de comprador', auth: false,
    body: { name: 'string', email: 'string', password: 'string', whatsapp: 'string?' } },
  { method: 'POST', path: '/store/auth/login',     group: 'store', desc: 'Login do comprador', auth: false,
    body: { email: 'string', password: 'string' } },
  { method: 'GET',  path: '/store/orders',         group: 'store', desc: 'Pedidos do comprador logado', auth: 'buyer' },
  { method: 'POST', path: '/store/orders',         group: 'store', desc: 'Criar pedido pelo comprador', auth: 'buyer',
    body: { items: [{ sku_id: 'string', qty: 'number' }], notes: 'string?', payment_method: 'string?' } },

  // Webhooks
  { method: 'POST', path: '/api/webhooks',        group: 'webhooks', desc: 'Registrar webhook', auth: true,
    body: { url: 'string', events: ['order.created','order.status_changed','inventory.low','payment.received'], secret: 'string?' } },
  { method: 'GET',  path: '/api/webhooks',        group: 'webhooks', desc: 'Listar webhooks ativos', auth: true },
  { method: 'DELETE', path: '/api/webhooks/:id',  group: 'webhooks', desc: 'Remover webhook', auth: true },
]

/* ─── Schemas de validação ────────────────────────────────── */

const SCHEMAS = {
  'POST /api/products': {
    required: ['name', 'code', 'category'],
    properties: {
      name:     { type: 'string', minLength: 2, maxLength: 120 },
      code:     { type: 'string', minLength: 1, maxLength: 60, description: 'Código único do produto' },
      category: { type: 'string' },
      type:     { type: 'string', enum: ['simples', 'grade'], default: 'simples' },
      image_url:{ type: 'string', format: 'uri', nullable: true },
      skus: {
        type: 'array', minItems: 1,
        items: {
          required: ['code', 'price_wholesale'],
          properties: {
            code:            { type: 'string', description: 'Código único do SKU' },
            price_wholesale: { type: 'number', minimum: 0, description: 'Preço de atacado' },
            stock:           { type: 'integer', minimum: 0, default: 0 },
            stock_min:       { type: 'integer', minimum: 0, default: 0 },
            attributes:      { type: 'object', description: 'Ex: {"Cor":"Azul","Tamanho":"M"}' },
          },
        },
      },
    },
  },
  'POST /api/orders': {
    required: ['items'],
    properties: {
      customer_id: { type: 'string', description: 'ID do cliente (opcional para manual)' },
      notes:       { type: 'string' },
      items: {
        type: 'array', minItems: 1,
        items: {
          required: ['sku_id', 'qty'],
          properties: {
            sku_id:     { type: 'string' },
            qty:        { type: 'integer', minimum: 1 },
            price_unit: { type: 'number', minimum: 0, description: 'Se omitido, usa price_wholesale do SKU' },
          },
        },
      },
    },
  },
  'POST /api/customers': {
    required: ['name', 'person_type'],
    properties: {
      name:         { type: 'string', minLength: 2 },
      person_type:  { type: 'string', enum: ['pf', 'pj'] },
      document:     { type: 'string', description: 'CPF ou CNPJ' },
      email:        { type: 'string', format: 'email' },
      whatsapp:     { type: 'string', description: 'Ex: 11999990000' },
      credit_limit: { type: 'number', minimum: 0, default: 0 },
      address:      { type: 'object', properties: { street: {type:'string'}, city: {type:'string'}, state: {type:'string'}, zip: {type:'string'} } },
    },
  },
  'PUT /api/orders/:id/status': {
    required: ['status'],
    properties: {
      status: { type: 'string', enum: ['pendente','confirmado','separando','enviado','entregue','cancelado'] },
      notes:  { type: 'string' },
    },
  },
  'POST /api/inventory/:skuId/movement': {
    required: ['type', 'qty'],
    properties: {
      type:   { type: 'string', enum: ['entrada', 'saida', 'ajuste'] },
      qty:    { type: 'integer', minimum: 1 },
      reason: { type: 'string' },
    },
  },
  'POST /store/auth/register': {
    required: ['name', 'email', 'password'],
    properties: {
      name:     { type: 'string', minLength: 2 },
      email:    { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8 },
      whatsapp: { type: 'string' },
    },
  },
  'POST /api/webhooks': {
    required: ['url', 'events'],
    properties: {
      url:    { type: 'string', format: 'uri' },
      events: { type: 'array', items: { type: 'string', enum: ['order.created','order.status_changed','inventory.low','payment.received'] } },
      secret: { type: 'string', description: 'Usado para assinar o payload HMAC-SHA256' },
    },
  },
}

/* ─── Autenticação ─────────────────────────────────────────── */

async function resolveAuth(slug, apiKey) {
  if (!slug || !apiKey) return null
  const rows = await masterPool.query(`
    SELECT t.id, t.slug, t.name, t.db_url, t.status, t.plan_id
    FROM tenants t
    JOIN mcp_api_keys mk ON mk.tenant_id = t.id
    WHERE t.slug=$1 AND mk.key_hash=$2 AND mk.active=true AND mk.scope='connect'
  `, [slug, apiKey]).then(r => r.rows).catch(() => [])
  if (!rows.length || !rows[0].db_url) return null
  return rows[0]
}

/* ─── Tools ────────────────────────────────────────────────── */

async function tool_list_endpoints(_tenant, args) {
  const { group, method } = args
  let endpoints = [...API_ENDPOINTS]
  if (group)  endpoints = endpoints.filter(e => e.group === group)
  if (method) endpoints = endpoints.filter(e => e.method === method.toUpperCase())

  const groups = [...new Set(API_ENDPOINTS.map(e => e.group))]
  return {
    endpoints: endpoints.map(e => ({
      method:   e.method,
      path:     e.path,
      group:    e.group,
      desc:     e.desc,
      auth:     e.auth,
      has_body: !!e.body,
      has_query:!!e.query,
    })),
    total:  endpoints.length,
    grupos: groups,
  }
}

async function tool_get_schema(_tenant, args) {
  const { endpoint } = args
  if (!endpoint) throw new Error('endpoint obrigatório. Ex: "POST /api/products"')

  // Normalizar input
  const key = endpoint.trim().toUpperCase().replace(/\s+/, ' ')
    .replace(/^(GET|POST|PUT|PATCH|DELETE) /, m => m)

  // Busca flexível
  const ep = API_ENDPOINTS.find(e => {
    const k = `${e.method} ${e.path}`
    return k === endpoint.trim() ||
           k.toUpperCase() === key ||
           e.path.toLowerCase().includes(endpoint.toLowerCase())
  })

  if (!ep) {
    const available = API_ENDPOINTS.map(e => `${e.method} ${e.path}`)
    throw new Error(`Endpoint não encontrado. Disponíveis:\n${available.join('\n')}`)
  }

  const schemaKey = `${ep.method} ${ep.path}`
  const schema = SCHEMAS[schemaKey]

  return {
    endpoint: `${ep.method} ${ep.path}`,
    group:    ep.group,
    desc:     ep.desc,
    auth:     ep.auth === true ? 'Bearer JWT (ERP)' : ep.auth === 'buyer' ? 'Bearer JWT (Comprador)' : 'Público',
    base_url: `https://api.{tenant-slug}.${DOMAIN}`,
    url_exemplo: `https://api.acme.${DOMAIN}${ep.path}`,
    query_params: ep.query ?? null,
    request_body: ep.body ?? null,
    response_exemplo: ep.response ?? null,
    schema_validacao: schema ?? null,
    curl_exemplo: buildCurlExample(ep),
  }
}

function buildCurlExample(ep) {
  const url = `https://api.acme.${DOMAIN}${ep.path.replace(':id', '{id}').replace(':skuId', '{skuId}')}`
  const authFlag = ep.auth ? `\\\n  -H "Authorization: Bearer {token}" ` : ''
  if (!ep.body) return `curl -X ${ep.method} "${url}" ${authFlag}`.trim()

  const bodyStr = JSON.stringify(ep.body, null, 2)
  return `curl -X ${ep.method} "${url}" \\
  -H "Content-Type: application/json" ${authFlag}\\
  -d '${bodyStr}'`
}

async function tool_validate_payload(_tenant, args) {
  const { endpoint, payload } = args
  if (!endpoint) throw new Error('endpoint obrigatório')
  if (!payload)  throw new Error('payload obrigatório')

  const schemaKey = Object.keys(SCHEMAS).find(k =>
    k === endpoint.trim() ||
    k.toLowerCase().includes(endpoint.toLowerCase().split(' ').pop())
  )
  if (!schemaKey) {
    return {
      valido:   null,
      aviso:    `Schema para "${endpoint}" não disponível. Endpoints com schema: ${Object.keys(SCHEMAS).join(', ')}`,
    }
  }

  const schema = SCHEMAS[schemaKey]
  const erros  = []
  const avisos = []

  // Verificar campos obrigatórios
  for (const req of schema.required ?? []) {
    if (payload[req] === undefined || payload[req] === null) {
      erros.push(`Campo obrigatório ausente: "${req}"`)
    }
  }

  // Verificar tipos
  for (const [key, rule] of Object.entries(schema.properties ?? {})) {
    if (payload[key] === undefined) {
      if (!schema.required?.includes(key)) {
        if (rule.default !== undefined) avisos.push(`"${key}" não informado, padrão: ${JSON.stringify(rule.default)}`)
      }
      continue
    }

    const val = payload[key]
    if (rule.type === 'string' && typeof val !== 'string') erros.push(`"${key}" deve ser string`)
    if (rule.type === 'number' && typeof val !== 'number') erros.push(`"${key}" deve ser number`)
    if (rule.type === 'integer' && (!Number.isInteger(val))) erros.push(`"${key}" deve ser inteiro`)
    if (rule.type === 'array'  && !Array.isArray(val)) erros.push(`"${key}" deve ser array`)
    if (rule.enum && !rule.enum.includes(val)) erros.push(`"${key}" inválido. Valores: ${rule.enum.join(', ')}`)
    if (rule.minLength && typeof val === 'string' && val.length < rule.minLength) erros.push(`"${key}" muito curto (mín ${rule.minLength})`)
    if (rule.minimum   && typeof val === 'number' && val < rule.minimum) erros.push(`"${key}" < mínimo (${rule.minimum})`)
    if (rule.format === 'email' && typeof val === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) erros.push(`"${key}" não é email válido`)
    if (rule.format === 'uri'   && typeof val === 'string' && !/^https?:\/\//.test(val)) erros.push(`"${key}" deve ser URL https://...`)
  }

  return {
    valido:      erros.length === 0,
    erros,
    avisos,
    endpoint:    schemaKey,
    payload_recebido: payload,
    campos_faltando: schema.required?.filter(r => payload[r] === undefined) ?? [],
  }
}

async function tool_register_webhook(tenant, args) {
  const { url, events, secret } = args
  if (!url)    throw new Error('url obrigatória')
  if (!events?.length) throw new Error('events obrigatório. Ex: ["order.created","inventory.low"]')
  if (!/^https?:\/\//.test(url)) throw new Error('url deve começar com http:// ou https://')

  const validEvents = ['order.created','order.status_changed','inventory.low','payment.received']
  const invalid = events.filter(e => !validEvents.includes(e))
  if (invalid.length) throw new Error(`Eventos inválidos: ${invalid.join(', ')}. Válidos: ${validEvents.join(', ')}`)

  const webhookId = 'wh_' + crypto.randomBytes(10).toString('hex')
  const webhookSecret = secret ?? crypto.randomBytes(20).toString('hex')
  const hmacSecret = crypto.createHmac('sha256', webhookSecret).update(url).digest('hex').slice(0,16)

  // Persistir no banco master
  await masterPool.query(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id         TEXT PRIMARY KEY,
      tenant_id  TEXT NOT NULL,
      url        TEXT NOT NULL,
      events     TEXT[] NOT NULL,
      secret     TEXT NOT NULL,
      active     BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await masterPool.query(`
    INSERT INTO webhooks (id, tenant_id, url, events, secret)
    VALUES ($1, $2, $3, $4, $5)
  `, [webhookId, tenant.id, url, events, webhookSecret])

  return {
    webhook_id:   webhookId,
    url,
    events,
    status:       'ativo',
    criado_em:    new Date().toISOString(),
    secret:       webhookSecret,
    como_validar: `Verifique o header X-Aura-Signature: sha256=HMAC-SHA256(secret, body)`,
    exemplo_validacao: `
// Node.js
const sig = crypto.createHmac('sha256', '${webhookSecret}').update(rawBody).digest('hex')
const expected = 'sha256=' + sig
if (req.headers['x-aura-signature'] !== expected) throw new Error('Assinatura inválida')`,
  }
}

async function tool_test_connection(tenant, args) {
  const { endpoint = '/auth/me', token } = args
  const apiBase = `https://api.${tenant.slug}.${DOMAIN}`

  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const start = Date.now()
  let result
  try {
    const resp = await fetch(`${apiBase}${endpoint}`, {
      headers,
      signal: AbortSignal.timeout(8000),
    })
    const latency = Date.now() - start
    const body = await resp.text().catch(() => '')

    result = {
      status:       resp.status,
      latency_ms:   latency,
      ok:           resp.status < 400,
      url_testada:  `${apiBase}${endpoint}`,
      content_type: resp.headers.get('content-type'),
      response_preview: body.slice(0, 200),
    }
  } catch (e) {
    result = {
      ok:          false,
      erro:        e.message,
      url_testada: `${apiBase}${endpoint}`,
      latency_ms:  Date.now() - start,
    }
  }

  // Testar também o health interno
  const internalOk = await fetch(`http://api-${tenant.slug}:3001/health`, {
    signal: AbortSignal.timeout(3000)
  }).then(r => r.ok).catch(() => false)

  return {
    ...result,
    api_interna_ok: internalOk,
    tenant: tenant.name,
    slug:   tenant.slug,
  }
}

async function tool_get_usage(tenant, args) {
  const { meses = 3 } = args

  // Uso MCP do banco master
  const mcpUsage = await masterPool.query(`
    SELECT month, calls_used, calls_billed
    FROM mcp_usage
    WHERE tenant_id=$1
    ORDER BY month DESC
    LIMIT $2
  `, [tenant.id, meses]).then(r => r.rows).catch(() => [])

  // Plano e limites
  const planRow = await masterPool.query(`
    SELECT p.name AS plano, t.status, t.billing_status, t.trial_ends_at
    FROM tenants t
    LEFT JOIN plans p ON p.id = t.plan_id
    WHERE t.id=$1
  `, [tenant.id]).then(r => r.rows[0]).catch(() => null)

  const QUOTAS = { starter: 500, pro: 2500, full: 10000 }
  const planName = planRow?.plano?.toLowerCase() ?? 'starter'
  const quota = QUOTAS[planName] ?? 500
  const usedThisMonth = mcpUsage[0]?.calls_used ?? 0

  return {
    tenant:    tenant.name,
    plano:     planRow?.plano ?? 'starter',
    status:    planRow?.status,
    quota_mes: quota,
    usado_mes: usedThisMonth,
    restante:  Math.max(0, quota - usedThisMonth),
    pct_usado: Math.min(100, Math.round((usedThisMonth / quota) * 100)),
    historico: mcpUsage,
    custo_excedente: 'R$ 0,30 / tool call excedente',
  }
}

async function tool_list_integrations(tenant, _args) {
  // Webhooks
  await masterPool.query(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY, tenant_id TEXT, url TEXT, events TEXT[], secret TEXT,
      active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now()
    )
  `).catch(() => {})

  const webhooks = await masterPool.query(`
    SELECT id, url, events, active, created_at
    FROM webhooks WHERE tenant_id=$1 ORDER BY created_at DESC
  `, [tenant.id]).then(r => r.rows).catch(() => [])

  // API Keys ativas
  const keys = await masterPool.query(`
    SELECT id, scope, label, active, created_at
    FROM mcp_api_keys WHERE tenant_id=$1 AND active=true
    ORDER BY created_at DESC
  `, [tenant.id]).then(r => r.rows).catch(() => [])

  return {
    webhooks: webhooks.map(w => ({
      id:       w.id,
      url:      w.url,
      eventos:  w.events,
      ativo:    w.active,
      criado:   w.created_at,
    })),
    api_keys: keys.map(k => ({
      id:    k.id,
      scope: k.scope,
      label: k.label,
      criado: k.created_at,
    })),
    total_webhooks: webhooks.length,
    total_keys:     keys.length,
    mcps_disponiveis: [
      { nome: 'MCP Manager', url: `https://mcp.${DOMAIN}/manager/${tenant.slug}`, scope: 'manager', desc: 'Gestão do ERP via IA' },
      { nome: 'MCP Store',   url: `https://mcp.${DOMAIN}/store/${tenant.slug}`,   scope: 'store',   desc: 'Pedidos B2B via IA' },
      { nome: 'MCP Connect', url: `https://mcp.${DOMAIN}/connect/${tenant.slug}`, scope: 'connect', desc: 'Integrações e webhooks' },
    ],
  }
}

async function tool_get_sandbox_data(tenant, args) {
  const { recurso = 'all' } = args

  const sandbox = {
    credenciais_teste: {
      api_base:  `https://api.${tenant.slug}.${DOMAIN}`,
      mcp_manager: `https://mcp.${DOMAIN}/manager/${tenant.slug}`,
      mcp_store:   `https://mcp.${DOMAIN}/store/${tenant.slug}`,
      obs: 'Use suas API Keys reais com dados reais — sem ambiente sandbox separado no MVP',
    },
    produto_exemplo: {
      name: 'Produto Teste API',
      code: `TESTE-${Date.now().toString(36).toUpperCase()}`,
      category: 'Teste',
      type: 'simples',
      skus: [{
        code:            `SKU-TESTE-${Date.now().toString(36).toUpperCase()}`,
        price_wholesale: 99.90,
        stock:           100,
        stock_min:       10,
        attributes:      { Cor: 'Azul', Tamanho: 'M' },
      }],
    },
    cliente_exemplo: {
      name:         'Cliente Teste LTDA',
      person_type:  'pj',
      document:     '12.345.678/0001-90',
      email:        `teste${Date.now().toString(36)}@example.com`,
      whatsapp:     '11999990000',
      credit_limit: 5000,
    },
    pedido_exemplo: {
      customer_id: '{id do cliente criado}',
      notes:       'Pedido de teste via API',
      items: [{
        sku_id:     '{id do SKU criado}',
        qty:        2,
        price_unit: 99.90,
      }],
    },
    webhook_teste: {
      url:    'https://webhook.site/{seu-id}',
      events: ['order.created', 'order.status_changed'],
      secret: crypto.randomBytes(16).toString('hex'),
    },
    eventos_webhook: {
      'order.created': {
        event:    'order.created',
        tenant:   tenant.slug,
        order_id: 'uuid-do-pedido',
        payload:  { id: 'uuid', customer_name: 'string', total: 'number', status: 'pendente', items: [] },
      },
      'order.status_changed': {
        event:      'order.status_changed',
        tenant:     tenant.slug,
        order_id:   'uuid-do-pedido',
        old_status: 'pendente',
        new_status: 'confirmado',
      },
      'inventory.low': {
        event:   'inventory.low',
        tenant:  tenant.slug,
        sku_id:  'uuid-do-sku',
        sku_code:'SKU-001',
        stock:   2,
        stock_min: 5,
      },
    },
  }

  if (recurso === 'all') return sandbox
  return sandbox[recurso] ?? { erro: `Recurso '${recurso}' não encontrado. Disponíveis: ${Object.keys(sandbox).join(', ')}` }
}

/* ─── Tools registry ───────────────────────────────────────── */

const TOOLS = {
  list_endpoints:    { fn: tool_list_endpoints },
  get_schema:        { fn: tool_get_schema },
  validate_payload:  { fn: tool_validate_payload },
  register_webhook:  { fn: tool_register_webhook },
  test_connection:   { fn: tool_test_connection },
  get_usage:         { fn: tool_get_usage },
  list_integrations: { fn: tool_list_integrations },
  get_sandbox_data:  { fn: tool_get_sandbox_data },
}

function buildToolsSchema() {
  return [
    { name: 'list_endpoints',    description: 'Listar todos os endpoints REST disponíveis na API Aura.',
      inputSchema: { type: 'object', properties: { group: { type: 'string', description: 'Filtrar por grupo: auth, products, orders, customers, inventory, store, webhooks' }, method: { type: 'string', enum: ['GET','POST','PUT','DELETE'] } } } },
    { name: 'get_schema',        description: 'Schema detalhado de um endpoint: campos, tipos, exemplos e curl.',
      inputSchema: { type: 'object', required: ['endpoint'], properties: { endpoint: { type: 'string', description: 'Ex: "POST /api/products" ou "orders"' } } } },
    { name: 'validate_payload',  description: 'Validar um payload JSON antes de enviar para a API.',
      inputSchema: { type: 'object', required: ['endpoint', 'payload'], properties: { endpoint: { type: 'string' }, payload: { type: 'object' } } } },
    { name: 'register_webhook',  description: 'Registrar uma URL para receber eventos via webhook.',
      inputSchema: { type: 'object', required: ['url', 'events'], properties: { url: { type: 'string', description: 'URL HTTPS para receber eventos' }, events: { type: 'array', items: { type: 'string', enum: ['order.created','order.status_changed','inventory.low','payment.received'] } }, secret: { type: 'string', description: 'Chave para assinar HMAC (gerada automaticamente se omitida)' } } } },
    { name: 'test_connection',   description: 'Testar conectividade com a API do tenant.',
      inputSchema: { type: 'object', properties: { endpoint: { type: 'string', description: 'Endpoint a testar (padrão: /auth/me)' }, token: { type: 'string', description: 'Bearer token para autenticar' } } } },
    { name: 'get_usage',         description: 'Uso de API e MCP do período com quotas do plano.',
      inputSchema: { type: 'object', properties: { meses: { type: 'number', description: 'Histórico em meses (padrão: 3)' } } } },
    { name: 'list_integrations', description: 'Listar webhooks registrados e API Keys ativas.',
      inputSchema: { type: 'object', properties: {} } },
    { name: 'get_sandbox_data',  description: 'Dados de teste prontos: exemplos de payloads, eventos de webhook e credenciais.',
      inputSchema: { type: 'object', properties: { recurso: { type: 'string', description: 'Filtrar: produto_exemplo, cliente_exemplo, pedido_exemplo, webhook_teste, eventos_webhook' } } } },
  ]
}

/* ─── MCP JSON-RPC ─────────────────────────────────────────── */

const sessions = new Map()

function createSession(tenant) {
  const id = crypto.randomBytes(16).toString('hex')
  sessions.set(id, { tenant, createdAt: Date.now() })
  setTimeout(() => sessions.delete(id), 4 * 3600_000)
  return id
}

async function handleMcpRequest(body, tenant) {
  const { method, params, id } = body
  const reply = r => ({ jsonrpc: '2.0', result: r, id })
  const error = (c, m) => ({ jsonrpc: '2.0', error: { code: c, message: m }, id })

  if (method === 'initialize') {
    return reply({ protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'aura-mcp-connect', version: '1.0.0' } })
  }
  if (method === 'tools/list') return reply({ tools: buildToolsSchema() })
  if (method === 'ping') return reply({})

  if (method === 'tools/call') {
    const { name, arguments: args = {} } = params ?? {}
    const tool = TOOLS[name]
    if (!tool) return error(-32601, `Tool '${name}' não encontrada`)
    try {
      const result = await tool.fn(tenant, args)
      return reply({ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], isError: false })
    } catch (e) {
      return reply({ content: [{ type: 'text', text: `Erro: ${e.message}` }], isError: true })
    }
  }
  return error(-32601, `Método '${method}' não suportado`)
}

/* ─── HTTP Server ──────────────────────────────────────────── */

function parseBody(req) {
  return new Promise((res, rej) => {
    let b = ''
    req.on('data', c => b += c)
    req.on('end', () => { try { res(JSON.parse(b || '{}')) } catch { rej(new Error('JSON inválido')) } })
    req.on('error', rej)
  })
}

function respond(res, status, data, headers = {}) {
  const body = JSON.stringify(data)
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers })
  res.end(body)
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0]

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, mcp-session-id')
  res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
  if (req.method === 'GET' && url === '/health') {
    return respond(res, 200, { ok: true, service: 'mcp-connect', uptime: process.uptime() })
  }

  const match = url.match(/^\/connect\/([a-z0-9-]+)$/)
  if (!match) return respond(res, 404, { error: 'Use /connect/{tenant-slug}' })

  const slug   = match[1]
  const apiKey = (req.headers['x-api-key'] ?? req.headers['authorization']?.replace('Bearer ', ''))?.trim()

  if (req.method === 'GET') {
    const rows = await masterPool.query('SELECT name FROM tenants WHERE slug=$1', [slug]).then(r=>r.rows).catch(()=>[])
    if (!rows.length) return respond(res, 404, { error: 'Tenant não encontrado.' })
    return respond(res, 200, {
      name:    `Aura MCP Connect — ${rows[0].name}`,
      version: '1.0.0',
      tools:   buildToolsSchema().map(t => ({ name: t.name, description: t.description })),
    })
  }

  if (req.method === 'DELETE') {
    const sid = req.headers['mcp-session-id']
    if (sid) sessions.delete(sid)
    return respond(res, 200, { ok: true })
  }

  if (req.method === 'POST') {
    let body
    try { body = await parseBody(req) }
    catch { return respond(res, 400, { jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null }) }

    let tenant
    const sessionId = req.headers['mcp-session-id']

    if (sessionId && sessions.has(sessionId)) {
      tenant = sessions.get(sessionId).tenant
    } else {
      if (!apiKey) return respond(res, 401, { error: 'API Key obrigatória. Use header x-api-key.' })
      tenant = await resolveAuth(slug, apiKey)
      if (!tenant) return respond(res, 401, { error: 'API Key inválida ou sem permissão (scope=connect).' })
    }

    if (body.method === 'tools/call') {
      const quota = await checkAndTrack(masterPool, tenant.id, tenant.plan_id ?? 'plan_starter', 'connect').catch(() => ({ allowed: true }))
      if (quota.blocked) {
        return respond(res, 429, { error: `Quota MCP esgotada. Hard limit atingido.` })
      }
    }

    const isInit = body.method === 'initialize'
    const result = await handleMcpRequest(body, tenant)
    const headers = {}
    if (isInit) headers['mcp-session-id'] = createSession(tenant)
    else if (sessionId) headers['mcp-session-id'] = sessionId

    return respond(res, 200, result, headers)
  }

  respond(res, 405, { error: 'Método não permitido' })
})

server.listen(PORT, '0.0.0.0', () => {
  log(`✅ Rodando na porta ${PORT}`)
  masterPool.query(`CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, url TEXT NOT NULL,
    events TEXT[] NOT NULL, secret TEXT NOT NULL, active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
  )`).then(() => log('schema webhooks ok')).catch(e => log('schema warn: ' + e.message))
})
