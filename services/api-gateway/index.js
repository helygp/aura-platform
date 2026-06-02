/**
 * api-gateway — Aura Platform
 *
 * API pública documentada para integrações de terceiros.
 * Auth: API Key por tenant (header x-api-key ou ?api_key=)
 * Rate limiting: por chave
 * Docs: https://docs.aurabr.app (Scalar)
 *
 * Atua como proxy para o api-[slug] interno,
 * adicionando autenticação por API Key, rate limiting e logs.
 *
 * URL base: https://api.aurabr.app/v1/{tenant-slug}/...
 */

import http   from 'http'
import pg     from 'pg'
import crypto from 'crypto'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
let docsHtml = ''
let mcpLanding = ''
try { docsHtml = readFileSync(join(__dirname, 'docs.html'), 'utf8') } catch {}
try { mcpLanding = readFileSync(join(__dirname, 'mcp-landing.html'), 'utf8') } catch {}



const { Pool } = pg

const PORT       = parseInt(process.env.PORT ?? '4005', 10)
const MASTER_DB  = process.env.MASTER_DB_URL
const DOMAIN     = process.env.AURA_DOMAIN ?? 'aurabr.app'

const masterPool = new Pool({ connectionString: MASTER_DB, max: 5 })

// Rate limit: calls por janela de 1 minuto por API Key
const rateLimitMap = new Map()   // key → { count, resetAt }
const RATE_LIMIT_PER_MIN = 60

function checkRateLimit(apiKey) {
  const now = Date.now()
  let entry = rateLimitMap.get(apiKey)
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + 60_000 }
    rateLimitMap.set(apiKey, entry)
  }
  entry.count++
  return {
    allowed:   entry.count <= RATE_LIMIT_PER_MIN,
    remaining: Math.max(0, RATE_LIMIT_PER_MIN - entry.count),
    resetAt:   entry.resetAt,
  }
}

// Limpar rate limits expirados a cada 5min
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of rateLimitMap) {
    if (now > v.resetAt) rateLimitMap.delete(k)
  }
}, 300_000)

// Cache de API keys (TTL 30s)
const keyCache = new Map()

async function resolveApiKey(apiKey) {
  const cached = keyCache.get(apiKey)
  if (cached && cached.expiresAt > Date.now()) return cached.tenant

  const rows = await masterPool.query(`
    SELECT t.id, t.slug, t.name, t.status, t.plan_id, t.db_url
    FROM tenants t
    JOIN api_keys ak ON ak.tenant_id = t.id
    WHERE ak.key_hash = $1
      AND ak.active = true
      AND t.status IN ('ACTIVE','TRIAL')
  `, [apiKey]).then(r => r.rows).catch(() => [])

  if (!rows.length) return null
  keyCache.set(apiKey, { tenant: rows[0], expiresAt: Date.now() + 30_000 })
  return rows[0]
}

function log(msg) { console.log(`[api-gateway] ${new Date().toISOString()} ${msg}`) }

function respond(res, status, data, headers = {}) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  })
  res.end(body)
}

async function proxyToTenant(req, res, tenant, tenantPath) {
  const targetUrl = `http://api-${tenant.slug}:3001${tenantPath}`

  const proxyReq = await fetch(targetUrl, {
    method:  req.method,
    headers: {
      'Content-Type':    req.headers['content-type'] ?? 'application/json',
      'X-Tenant-Slug':   tenant.slug,
      'X-Gateway':       'aura-public-api',
      'X-Real-IP':       req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? '',
    },
    body:   ['GET','HEAD'].includes(req.method) ? undefined : req,
    signal: AbortSignal.timeout(30_000),
    // @ts-ignore
    duplex: 'half',
  }).catch(e => { throw new Error(`Upstream error: ${e.message}`) })

  res.writeHead(proxyReq.status, {
    'Content-Type': proxyReq.headers.get('content-type') ?? 'application/json',
    'X-Tenant':     tenant.slug,
  })

  // Stream response body
  const reader = proxyReq.body?.getReader()
  if (reader) {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(value)
    }
  }
  res.end()
}

/* ─── HTTP Server ──────────────────────────────────────────── */

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://localhost`)
  const path   = urlObj.pathname

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  // Docs Scalar
  if (path === '/' || path === '/docs') {
    if (!docsHtml) return respond(res, 404, { error: 'Docs não encontrado.' })
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(docsHtml) })
    res.end(docsHtml)
    return
  }

  // MCP Landing page
  if (path === '/mcp' || path === '/mcp-landing') {
    if (!mcpLanding) return respond(res, 404, { error: 'Landing não encontrada.' })
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(mcpLanding) })
    res.end(mcpLanding)
    return
  }

  // Health check
  if (path === '/health') {
    return respond(res, 200, { ok: true, service: 'api-gateway', uptime: process.uptime() })
  }

  // OpenAPI spec — servida diretamente
  if (path === '/openapi.json') {
    const spec = buildOpenApiSpec()
    const body = JSON.stringify(spec)
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) })
    res.end(body)
    return
  }

  // Extrair slug e path: /v1/{slug}/api/...
  const match = path.match(/^\/v1\/([a-z0-9-]+)(\/.*)?$/)
  if (!match) {
    return respond(res, 404, {
      error: 'URL inválida.',
      formato: '/v1/{tenant-slug}/api/...',
      docs: `https://docs.${DOMAIN}`,
    })
  }

  const slug       = match[1]
  const tenantPath = match[2] ?? '/'

  // Autenticação por API Key
  const apiKey = (
    urlObj.searchParams.get('api_key') ??
    req.headers['x-api-key'] ??
    req.headers['authorization']?.replace('Bearer ', '')
  )?.trim()

  if (!apiKey) {
    return respond(res, 401, {
      error: 'API Key obrigatória.',
      como: 'Header x-api-key: sua_chave ou ?api_key=sua_chave',
      docs:  `https://docs.${DOMAIN}`,
    })
  }

  // Resolver tenant pela API Key
  const tenant = await resolveApiKey(apiKey)
  if (!tenant) {
    return respond(res, 401, { error: 'API Key inválida ou expirada.' })
  }

  // Garantir que a key pertence ao tenant do slug
  if (tenant.slug !== slug) {
    return respond(res, 403, { error: 'API Key não pertence a este tenant.' })
  }

  // Rate limiting
  const rl = checkRateLimit(apiKey)
  res.setHeader('X-RateLimit-Limit',     String(RATE_LIMIT_PER_MIN))
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining))
  res.setHeader('X-RateLimit-Reset',     String(Math.ceil(rl.resetAt / 1000)))

  if (!rl.allowed) {
    return respond(res, 429, {
      error:          'Rate limit excedido.',
      limite:         `${RATE_LIMIT_PER_MIN} requests/minuto`,
      retry_after_ms: rl.resetAt - Date.now(),
    })
  }

  // Log de acesso
  log(`${tenant.slug} ${req.method} ${tenantPath}`)

  // Registrar uso (async, não bloqueia)
  masterPool.query(`
    INSERT INTO api_usage (tenant_id, month, calls_used, created_at)
    VALUES ($1, $2, 1, now())
    ON CONFLICT (tenant_id, month) DO UPDATE SET calls_used = api_usage.calls_used + 1
  `, [tenant.id, new Date().toISOString().slice(0, 7)]).catch(() => {})

  // Proxy para api-[slug]
  try {
    await proxyToTenant(req, res, tenant, tenantPath)
  } catch (e) {
    if (!res.headersSent) {
      respond(res, 502, { error: 'Erro ao conectar com o servidor do tenant.', detail: e.message })
    }
  }
})

/* ─── OpenAPI 3.0 spec ─────────────────────────────────────── */

function buildOpenApiSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title:       'Aura Platform — API Pública',
      description: `API REST B2B para integração com o ERP Aura Platform.\n\n## Autenticação\nUse o header **x-api-key** com sua API Key de desenvolvedor.\n\n## Rate Limiting\n${RATE_LIMIT_PER_MIN} requests/minuto por chave. Headers \`X-RateLimit-*\` em toda resposta.\n\n## Base URL\n\`\`\`\nhttps://api.aurabr.app/v1/{tenant-slug}\n\`\`\`\n\n## SDKs e exemplos\nVeja a documentação completa em [docs.aurabr.app](https://docs.aurabr.app)`,
      version:     '1.0.0',
      contact: { name: 'Aura Platform', url: `https://aurabr.app`, email: 'dev@aurabr.app' },
      license: { name: 'Proprietário' },
    },
    servers: [
      { url: `https://api.${DOMAIN}/v1/{slug}`, description: 'Produção', variables: { slug: { default: 'acme', description: 'Slug do tenant' } } },
    ],
    security: [{ ApiKeyAuth: [] }],
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' },
      },
      schemas: {
        Error:    { type: 'object', properties: { error: { type: 'string' } } },
        Product:  {
          type: 'object', properties: {
            id:        { type: 'string' },
            name:      { type: 'string' },
            code:      { type: 'string' },
            category:  { type: 'string' },
            type:      { type: 'string', enum: ['simples','grade'] },
            image_url: { type: 'string', nullable: true },
            skus:      { type: 'array', items: { $ref: '#/components/schemas/Sku' } },
          },
        },
        Sku: {
          type: 'object', properties: {
            id:              { type: 'string' },
            code:            { type: 'string' },
            price_wholesale: { type: 'number' },
            stock:           { type: 'integer' },
            stock_min:       { type: 'integer' },
            attributes:      { type: 'object' },
          },
        },
        Order: {
          type: 'object', properties: {
            id:            { type: 'string' },
            customer_name: { type: 'string' },
            status:        { type: 'string', enum: ['pendente','confirmado','separando','enviado','entregue','cancelado'] },
            total:         { type: 'number' },
            channel:       { type: 'string' },
            created_at:    { type: 'string', format: 'date-time' },
          },
        },
        Customer: {
          type: 'object', properties: {
            id:           { type: 'string' },
            name:         { type: 'string' },
            person_type:  { type: 'string', enum: ['pf','pj'] },
            document:     { type: 'string', nullable: true },
            email:        { type: 'string', nullable: true },
            whatsapp:     { type: 'string', nullable: true },
            credit_limit: { type: 'number' },
            status:       { type: 'string' },
          },
        },
      },
    },
    paths: {
      '/api/products': {
        get:  { summary: 'Listar produtos', tags: ['Produtos'], parameters: [{ name: 'search', in: 'query', schema: { type: 'string' } }, { name: 'category', in: 'query', schema: { type: 'string' } }, { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }], responses: { 200: { description: 'Lista de produtos', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Product' } }, total: { type: 'integer' }, page: { type: 'integer' } } } } } }, 401: { $ref: '#/components/responses/Unauthorized' } } },
        post: { summary: 'Criar produto', tags: ['Produtos'], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name','code','category'], properties: { name: { type: 'string' }, code: { type: 'string' }, category: { type: 'string' }, type: { type: 'string', enum: ['simples','grade'], default: 'simples' }, skus: { type: 'array', items: { $ref: '#/components/schemas/Sku' } } } } } } }, responses: { 201: { description: 'Produto criado' }, 400: { description: 'Dados inválidos' }, 401: { $ref: '#/components/responses/Unauthorized' } } },
      },
      '/api/products/{id}': {
        put:    { summary: 'Atualizar produto', tags: ['Produtos'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Product' } } } }, responses: { 200: { description: 'Produto atualizado' }, 401: { $ref: '#/components/responses/Unauthorized' } } },
        delete: { summary: 'Remover produto', tags: ['Produtos'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Produto removido' }, 401: { $ref: '#/components/responses/Unauthorized' } } },
      },
      '/api/orders': {
        get:  { summary: 'Listar pedidos', tags: ['Pedidos'], parameters: [{ name: 'status', in: 'query', schema: { type: 'string', enum: ['pendente','confirmado','separando','enviado','entregue','cancelado'] } }, { name: 'date_from', in: 'query', schema: { type: 'string', format: 'date' } }, { name: 'date_to', in: 'query', schema: { type: 'string', format: 'date' } }], responses: { 200: { description: 'Lista de pedidos', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Order' } }, total: { type: 'integer' } } } } } }, 401: { $ref: '#/components/responses/Unauthorized' } } },
        post: { summary: 'Criar pedido', tags: ['Pedidos'], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['items'], properties: { customer_id: { type: 'string' }, notes: { type: 'string' }, items: { type: 'array', items: { type: 'object', required: ['sku_id','qty'], properties: { sku_id: { type: 'string' }, qty: { type: 'integer', minimum: 1 }, price_unit: { type: 'number' } } } } } } } } }, responses: { 201: { description: 'Pedido criado' }, 401: { $ref: '#/components/responses/Unauthorized' } } },
      },
      '/api/orders/{id}/status': {
        put: { summary: 'Atualizar status', tags: ['Pedidos'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['pendente','confirmado','separando','enviado','entregue','cancelado'] }, notes: { type: 'string' } } } } } }, responses: { 200: { description: 'Status atualizado' }, 401: { $ref: '#/components/responses/Unauthorized' } } },
      },
      '/api/customers': {
        get:  { summary: 'Listar clientes', tags: ['Clientes'], parameters: [{ name: 'search', in: 'query', schema: { type: 'string' } }, { name: 'status', in: 'query', schema: { type: 'string', enum: ['ativo','inativo'] } }], responses: { 200: { description: 'Lista de clientes', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Customer' } }, total: { type: 'integer' } } } } } }, 401: { $ref: '#/components/responses/Unauthorized' } } },
        post: { summary: 'Criar cliente', tags: ['Clientes'], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name','person_type'], properties: { name: { type: 'string' }, person_type: { type: 'string', enum: ['pf','pj'] }, document: { type: 'string' }, email: { type: 'string', format: 'email' }, whatsapp: { type: 'string' }, credit_limit: { type: 'number', default: 0 } } } } } }, responses: { 201: { description: 'Cliente criado' }, 401: { $ref: '#/components/responses/Unauthorized' } } },
      },
      '/api/customers/{id}': {
        put:    { summary: 'Atualizar cliente', tags: ['Clientes'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Cliente atualizado' }, 401: { $ref: '#/components/responses/Unauthorized' } } },
        delete: { summary: 'Remover cliente', tags: ['Clientes'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Cliente removido' }, 401: { $ref: '#/components/responses/Unauthorized' } } },
      },
      '/api/inventory': {
        get: { summary: 'Posição de estoque', tags: ['Estoque'], responses: { 200: { description: 'Estoque atual de todos os SKUs' }, 401: { $ref: '#/components/responses/Unauthorized' } } },
      },
      '/api/inventory/{skuId}/movement': {
        post: { summary: 'Registrar movimentação', tags: ['Estoque'], parameters: [{ name: 'skuId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['type','qty'], properties: { type: { type: 'string', enum: ['entrada','saida','ajuste'] }, qty: { type: 'integer', minimum: 1 }, reason: { type: 'string' } } } } } }, responses: { 200: { description: 'Movimentação registrada' }, 401: { $ref: '#/components/responses/Unauthorized' } } },
      },
      '/api/dashboard/summary': {
        get: { summary: 'Dashboard KPIs', tags: ['Dashboard'], responses: { 200: { description: 'KPIs e gráfico de vendas' }, 401: { $ref: '#/components/responses/Unauthorized' } } },
      },
    },
    'x-components-responses': {
      Unauthorized: { description: 'API Key inválida', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
    },
  }
}

/* ─── Garantir tabelas ─────────────────────────────────────── */

async function ensureSchema() {
  await masterPool.query(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      tenant_id  TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      key_hash   TEXT NOT NULL UNIQUE,
      label      TEXT,
      active     BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_used  TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_api_keys_hash   ON api_keys(key_hash);
    CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);

    CREATE TABLE IF NOT EXISTS api_usage (
      tenant_id  TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      month      TEXT NOT NULL,
      calls_used INT  NOT NULL DEFAULT 0,
      PRIMARY KEY (tenant_id, month)
    );
  `)
  log('schema ok')
}

server.listen(PORT, '0.0.0.0', () => {
  log(`✅ Rodando na porta ${PORT}`)
  ensureSchema().catch(e => log('schema warn: ' + e.message))
})
