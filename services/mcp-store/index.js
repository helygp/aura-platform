/**
 * mcp-store — Aura Platform
 *
 * Servidor MCP HTTP para compradores B2B.
 * Permite fazer pedidos via assistente de IA (Claude, ChatGPT, etc).
 *
 * URL: https://mcp.aurabr.app/store/{tenant-slug}
 * Auth: Bearer token (JWT comprador, emitido pelo /store/auth/login do tenant)
 *       OU API Key de integração (scope=store na tabela mcp_api_keys)
 *
 * 8 tools:
 *   browse_catalog     — ver produtos com filtros
 *   check_availability — verificar estoque de SKU específico
 *   create_cart        — criar carrinho (sessão em memória)
 *   add_to_cart        — adicionar item ao carrinho
 *   get_cart           — ver carrinho atual
 *   checkout           — finalizar pedido
 *   get_order_status   — status de pedido por referência
 *   list_my_orders     — histórico do comprador
 */

import http   from 'http'
import pg     from 'pg'
import crypto from 'crypto'

const { Pool } = pg

const PORT       = parseInt(process.env.PORT ?? '4003', 10)
const MASTER_DB  = process.env.MASTER_DB_URL
const DOMAIN     = process.env.AURA_DOMAIN ?? 'aurabr.app'

const masterPool = new Pool({ connectionString: MASTER_DB, max: 5 })
const tenantPools = new Map()

function getTenantPool(dbUrl) {
  if (tenantPools.has(dbUrl)) return tenantPools.get(dbUrl)
  const pool = new Pool({ connectionString: dbUrl, max: 5, idleTimeoutMillis: 30_000 })
  tenantPools.set(dbUrl, pool)
  return pool
}

async function queryTenant(dbUrl, sql, params = []) {
  const { rows } = await getTenantPool(dbUrl).query(sql, params)
  return rows
}

function log(msg) { console.log(`[mcp-store] ${new Date().toISOString()} ${msg}`) }

/* ─── Carrinhos em memória ─────────────────────────────────── */
// { cartId → { tenantSlug, buyerId, items: [{skuId, skuCode, productName, qty, price}], createdAt } }
const carts = new Map()

function createCartId() {
  return 'cart_' + crypto.randomBytes(12).toString('hex')
}

function getOrCreateCart(cartId, tenantSlug, buyerId) {
  if (cartId && carts.has(cartId)) return carts.get(cartId)
  const id = createCartId()
  const cart = { id, tenantSlug, buyerId, items: [], createdAt: Date.now() }
  carts.set(id, cart)
  // Expirar após 4h
  setTimeout(() => carts.delete(id), 4 * 3600_000)
  return cart
}

/* ─── Autenticação ─────────────────────────────────────────── */

async function resolveTenant(slug) {
  if (!slug) return null
  const rows = await masterPool.query(
    `SELECT id, slug, name, db_url, status FROM tenants WHERE slug=$1 AND status IN ('TRIAL','ACTIVE')`,
    [slug]
  ).then(r => r.rows).catch(() => [])
  if (!rows.length || !rows[0].db_url) return null
  return rows[0]
}

// Auth por API Key (integração B2B machine-to-machine)
async function authByApiKey(slug, apiKey) {
  const tenant = await resolveTenant(slug)
  if (!tenant) return null
  const rows = await masterPool.query(
    `SELECT id FROM mcp_api_keys WHERE tenant_id=$1 AND key_hash=$2 AND active=true AND scope='store'`,
    [tenant.id, apiKey]
  ).then(r => r.rows).catch(() => [])
  if (!rows.length) return null
  return { tenant, buyer: { id: 'api-integration', name: 'Integração B2B', isApi: true } }
}

// Auth por Bearer JWT do comprador (emitido pelo api-[slug])
async function authByBuyerToken(slug, bearerToken) {
  const tenant = await resolveTenant(slug)
  if (!tenant) return null

  // Buscar buyer_account no banco do tenant via tokenId no JWT (sem verificar sig aqui — confiar na API)
  // Decodificar payload sem verificar assinatura (o token já foi emitido pelo api-[slug])
  try {
    const [, payloadB64] = bearerToken.split('.')
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString())
    if (payload.type !== 'buyer') return null
    if (payload.exp && payload.exp < Date.now() / 1000) return null

    const tokenId = payload.sub
    const rows = await queryTenant(tenant.db_url,
      `SELECT id, name, email, whatsapp FROM buyer_accounts WHERE token_id=$1 AND active=true`,
      [tokenId]
    ).catch(() => [])

    if (!rows.length) return null
    return { tenant, buyer: rows[0] }
  } catch {
    return null
  }
}

async function resolveAuth(slug, authHeader) {
  if (!authHeader) return null
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader

  // Tentar API Key primeiro (mais simples)
  const byKey = await authByApiKey(slug, token)
  if (byKey) return byKey

  // Tentar JWT do comprador
  const byJwt = await authByBuyerToken(slug, token)
  return byJwt
}

/* ─── Tools ────────────────────────────────────────────────── */

async function tool_browse_catalog(ctx, args) {
  const { categoria, busca, pagina = 1, por_pagina = 20 } = args
  const offset = (pagina - 1) * por_pagina
  const params = []
  const where  = []

  if (categoria) { params.push(categoria); where.push(`p.category = $${params.length}`) }
  if (busca)     { params.push(`%${busca}%`); where.push(`p.name ILIKE $${params.length}`) }

  // Só mostrar produtos com pelo menos um SKU com estoque > 0
  where.push(`EXISTS (SELECT 1 FROM skus s WHERE s.product_id = p.id AND s.stock > 0)`)

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  params.push(por_pagina, offset)

  const sql = `
    SELECT
      p.id, p.name AS nome, p.code AS codigo, p.category AS categoria,
      p.image_url AS imagem,
      MIN(s.price_wholesale) AS preco_min,
      MAX(s.price_wholesale) AS preco_max,
      SUM(s.stock) AS estoque_total,
      COUNT(s.id) AS total_skus
    FROM products p
    LEFT JOIN skus s ON s.product_id = p.id
    ${whereClause}
    GROUP BY p.id
    ORDER BY p.name
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `
  const rows = await queryTenant(ctx.tenant.db_url, sql, params)

  // Total
  const countSql = `SELECT COUNT(DISTINCT p.id) AS total FROM products p LEFT JOIN skus s ON s.product_id = p.id ${whereClause}`
  const countRows = await queryTenant(ctx.tenant.db_url, countSql, params.slice(0, -2))
  const total = parseInt(countRows[0]?.total ?? 0)

  return {
    produtos: rows.map(r => ({
      id:           r.id,
      nome:         r.nome,
      codigo:       r.codigo,
      categoria:    r.categoria,
      imagem:       r.imagem,
      preco_min:    parseFloat(r.preco_min ?? 0),
      preco_max:    parseFloat(r.preco_max ?? 0),
      estoque_total: parseInt(r.estoque_total ?? 0),
      variantes:    parseInt(r.total_skus ?? 0),
    })),
    paginacao: { pagina, por_pagina, total, paginas: Math.ceil(total / por_pagina) },
  }
}

async function tool_check_availability(ctx, args) {
  const { sku_code, product_id } = args
  if (!sku_code && !product_id) throw new Error('Informe sku_code ou product_id')

  let sql, params
  if (sku_code) {
    sql    = `SELECT s.id, s.code, s.price_wholesale, s.stock, s.stock_min, s.attributes, p.name AS produto FROM skus s JOIN products p ON p.id=s.product_id WHERE s.code=$1`
    params = [sku_code]
  } else {
    sql    = `SELECT s.id, s.code, s.price_wholesale, s.stock, s.stock_min, s.attributes, p.name AS produto FROM skus s JOIN products p ON p.id=s.product_id WHERE s.product_id=$1 ORDER BY s.code`
    params = [product_id]
  }

  const rows = await queryTenant(ctx.tenant.db_url, sql, params)
  if (!rows.length) throw new Error(`SKU não encontrado.`)

  return {
    skus: rows.map(r => ({
      id:         r.id,
      codigo:     r.code,
      produto:    r.produto,
      preco:      parseFloat(r.price_wholesale),
      estoque:    r.stock,
      disponivel: r.stock > 0,
      atributos:  r.attributes,
    }))
  }
}

async function tool_create_cart(ctx, _args) {
  const cart = getOrCreateCart(null, ctx.tenant.slug, ctx.buyer.id)
  return {
    cart_id:   cart.id,
    itens:     0,
    total:     0,
    mensagem:  'Carrinho criado. Use add_to_cart para adicionar produtos.',
    expira_em: '4 horas',
  }
}

async function tool_add_to_cart(ctx, args) {
  const { cart_id, sku_code, quantidade = 1 } = args
  if (!cart_id)  throw new Error('cart_id obrigatório')
  if (!sku_code) throw new Error('sku_code obrigatório')
  if (quantidade < 1) throw new Error('quantidade deve ser >= 1')

  if (!carts.has(cart_id)) throw new Error(`Carrinho ${cart_id} não encontrado ou expirado. Crie um novo com create_cart.`)
  const cart = carts.get(cart_id)

  // Verificar SKU e estoque
  const rows = await queryTenant(ctx.tenant.db_url,
    `SELECT s.id, s.code, s.price_wholesale, s.stock, p.name AS produto FROM skus s JOIN products p ON p.id=s.product_id WHERE s.code=$1`,
    [sku_code]
  )
  if (!rows.length) throw new Error(`SKU '${sku_code}' não encontrado.`)
  const sku = rows[0]
  if (sku.stock < quantidade) throw new Error(`Estoque insuficiente. Disponível: ${sku.stock} unidades.`)

  // Adicionar ou atualizar item
  const existing = cart.items.find(i => i.skuCode === sku_code)
  if (existing) {
    existing.qty += quantidade
  } else {
    cart.items.push({
      skuId:       sku.id,
      skuCode:     sku.code,
      productName: sku.produto,
      qty:         quantidade,
      price:       parseFloat(sku.price_wholesale),
    })
  }

  const total = cart.items.reduce((s, i) => s + i.price * i.qty, 0)
  return {
    cart_id,
    itens: cart.items.length,
    total: parseFloat(total.toFixed(2)),
    adicionado: { sku: sku_code, produto: sku.produto, quantidade, preco_unit: sku.price_wholesale },
  }
}

async function tool_get_cart(ctx, args) {
  const { cart_id } = args
  if (!cart_id) throw new Error('cart_id obrigatório')
  if (!carts.has(cart_id)) throw new Error(`Carrinho não encontrado ou expirado.`)

  const cart = carts.get(cart_id)
  const total = cart.items.reduce((s, i) => s + i.price * i.qty, 0)
  return {
    cart_id,
    itens: cart.items.map(i => ({
      sku:      i.skuCode,
      produto:  i.productName,
      qtd:      i.qty,
      preco:    i.price,
      subtotal: parseFloat((i.price * i.qty).toFixed(2)),
    })),
    total:        parseFloat(total.toFixed(2)),
    total_itens:  cart.items.length,
  }
}

async function tool_checkout(ctx, args) {
  const { cart_id, observacao = '', forma_pagamento = 'boleto' } = args
  if (!cart_id) throw new Error('cart_id obrigatório')
  if (!carts.has(cart_id)) throw new Error(`Carrinho não encontrado ou expirado.`)

  const cart = carts.get(cart_id)
  if (!cart.items.length) throw new Error('Carrinho vazio.')

  // Verificar estoques em transação
  const client = await getTenantPool(ctx.tenant.db_url).connect()
  try {
    await client.query('BEGIN')

    let total = 0
    for (const item of cart.items) {
      const { rows } = await client.query(
        `SELECT stock FROM skus WHERE id=$1 FOR UPDATE`, [item.skuId]
      )
      if (!rows.length) throw new Error(`SKU ${item.skuCode} não encontrado.`)
      if (rows[0].stock < item.qty) throw new Error(`Estoque insuficiente para ${item.productName}: ${rows[0].stock} disponível.`)
      total += item.price * item.qty
    }

    // Resolver customer_id — se for API, usar ou criar cliente genérico
    let customerId = null
    let customerName = ctx.buyer.name ?? 'Comprador via IA'

    if (!ctx.buyer.isApi) {
      const custRows = await client.query(
        `SELECT id, name FROM customers WHERE email=$1 OR whatsapp=$2 LIMIT 1`,
        [ctx.buyer.email ?? '', ctx.buyer.whatsapp ?? '']
      )
      if (custRows.rows.length) {
        customerId = custRows.rows[0].id
        customerName = custRows.rows[0].name
      }
    }

    // Criar pedido
    const orderRef = 'MCP-' + Date.now().toString(36).toUpperCase()
    const order = await client.query(
      `INSERT INTO orders (customer_id, customer_name, channel, status, total, notes, created_at, updated_at)
       VALUES ($1, $2, 'loja', 'pendente', $3, $4, now(), now()) RETURNING id`,
      [customerId, customerName, total.toFixed(2), observacao]
    )
    const orderId = order.rows[0].id

    // Inserir itens e debitar estoque
    for (const item of cart.items) {
      await client.query(
        `INSERT INTO order_items (order_id, sku_id, sku_code, product_name, attributes, qty, price_unit)
         VALUES ($1, $2, $3, $4, '{}', $5, $6)`,
        [orderId, item.skuId, item.skuCode, item.productName, item.qty, item.price]
      )
      await client.query(
        `UPDATE skus SET stock = stock - $1 WHERE id=$2`,
        [item.qty, item.skuId]
      )
    }

    await client.query('COMMIT')

    // Limpar carrinho
    carts.delete(cart_id)

    return {
      pedido_id:       orderId,
      referencia:      orderRef,
      status:          'pendente',
      total:           parseFloat(total.toFixed(2)),
      itens:           cart.items.length,
      forma_pagamento,
      mensagem:        `Pedido criado com sucesso! Referência: ${orderRef}`,
      acompanhar:      `Use get_order_status com pedido_id: "${orderId}"`,
    }
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

async function tool_get_order_status(ctx, args) {
  const { pedido_id } = args
  if (!pedido_id) throw new Error('pedido_id obrigatório')

  const rows = await queryTenant(ctx.tenant.db_url, `
    SELECT
      o.id, o.customer_name, o.status, o.total, o.notes, o.channel,
      o.created_at, o.updated_at,
      json_agg(json_build_object(
        'produto', oi.product_name,
        'sku', oi.sku_code,
        'qty', oi.qty,
        'preco', oi.price_unit
      )) AS itens
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.id = $1
    GROUP BY o.id
  `, [pedido_id])

  if (!rows.length) throw new Error(`Pedido ${pedido_id} não encontrado.`)
  const o = rows[0]

  const statusLabels = {
    pendente: '⏳ Pendente',
    confirmado: '✅ Confirmado',
    separando: '�� Em separação',
    enviado: '🚚 Enviado',
    entregue: '✅ Entregue',
    cancelado: '❌ Cancelado',
  }

  return {
    pedido_id:    o.id,
    cliente:      o.customer_name,
    status:       o.status,
    status_label: statusLabels[o.status] ?? o.status,
    total:        parseFloat(o.total),
    canal:        o.channel,
    criado_em:    o.created_at,
    atualizado_em:o.updated_at,
    itens:        o.itens ?? [],
    observacoes:  o.notes,
  }
}

async function tool_list_my_orders(ctx, args) {
  const { limite = 10, status } = args

  let sql = `
    SELECT o.id, o.status, o.total, o.channel, o.created_at,
           COUNT(oi.id) AS total_itens
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.customer_name = $1
  `
  const params = [ctx.buyer.name ?? '']
  if (status) { params.push(status); sql += ` AND o.status = $${params.length}` }
  params.push(limite)
  sql += ` GROUP BY o.id ORDER BY o.created_at DESC LIMIT $${params.length}`

  const rows = await queryTenant(ctx.tenant.db_url, sql, params)
  return {
    pedidos: rows.map(r => ({
      id:         r.id,
      status:     r.status,
      total:      parseFloat(r.total),
      canal:      r.channel,
      itens:      parseInt(r.total_itens),
      criado_em:  r.created_at,
    })),
    total: rows.length,
  }
}

/* ─── Tools registry ───────────────────────────────────────── */

const TOOLS = {
  browse_catalog:     { fn: tool_browse_catalog },
  check_availability: { fn: tool_check_availability },
  create_cart:        { fn: tool_create_cart },
  add_to_cart:        { fn: tool_add_to_cart },
  get_cart:           { fn: tool_get_cart },
  checkout:           { fn: tool_checkout },
  get_order_status:   { fn: tool_get_order_status },
  list_my_orders:     { fn: tool_list_my_orders },
}

function buildToolsSchema() {
  return [
    {
      name: 'browse_catalog',
      description: 'Navegar pelo catálogo de produtos com filtros por categoria ou busca.',
      inputSchema: { type: 'object', properties: {
        categoria:   { type: 'string', description: 'Filtrar por categoria' },
        busca:       { type: 'string', description: 'Busca por nome do produto' },
        pagina:      { type: 'number', description: 'Número da página (padrão: 1)' },
        por_pagina:  { type: 'number', description: 'Itens por página (padrão: 20)' },
      }},
    },
    {
      name: 'check_availability',
      description: 'Verificar estoque e preço de um SKU específico.',
      inputSchema: { type: 'object', properties: {
        sku_code:   { type: 'string', description: 'Código do SKU' },
        product_id: { type: 'string', description: 'ID do produto (retorna todos os SKUs)' },
      }},
    },
    {
      name: 'create_cart',
      description: 'Criar um novo carrinho de compras. Retorna cart_id.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'add_to_cart',
      description: 'Adicionar um produto ao carrinho.',
      inputSchema: { type: 'object', required: ['cart_id', 'sku_code'], properties: {
        cart_id:    { type: 'string', description: 'ID do carrinho (de create_cart)' },
        sku_code:   { type: 'string', description: 'Código do SKU' },
        quantidade: { type: 'number', description: 'Quantidade (padrão: 1)' },
      }},
    },
    {
      name: 'get_cart',
      description: 'Ver o conteúdo atual do carrinho com totais.',
      inputSchema: { type: 'object', required: ['cart_id'], properties: {
        cart_id: { type: 'string' },
      }},
    },
    {
      name: 'checkout',
      description: 'Finalizar o pedido. Debita estoque e cria o pedido no ERP.',
      inputSchema: { type: 'object', required: ['cart_id'], properties: {
        cart_id:          { type: 'string' },
        observacao:       { type: 'string', description: 'Observações para o pedido' },
        forma_pagamento:  { type: 'string', enum: ['boleto', 'pix', 'credito', 'prazo'], description: 'Forma de pagamento' },
      }},
    },
    {
      name: 'get_order_status',
      description: 'Verificar status de um pedido pelo ID.',
      inputSchema: { type: 'object', required: ['pedido_id'], properties: {
        pedido_id: { type: 'string', description: 'ID do pedido' },
      }},
    },
    {
      name: 'list_my_orders',
      description: 'Histórico de pedidos do comprador.',
      inputSchema: { type: 'object', properties: {
        limite: { type: 'number', description: 'Máximo de pedidos (padrão: 10)' },
        status: { type: 'string', enum: ['pendente','confirmado','separando','enviado','entregue','cancelado'] },
      }},
    },
  ]
}

/* ─── MCP JSON-RPC ─────────────────────────────────────────── */

const sessions = new Map()

function createSession(ctx) {
  const id = crypto.randomBytes(16).toString('hex')
  sessions.set(id, { ctx, createdAt: Date.now() })
  setTimeout(() => sessions.delete(id), 4 * 3600_000)
  return id
}

async function handleMcpRequest(body, ctx) {
  const { method, params, id } = body
  const reply = r => ({ jsonrpc: '2.0', result: r, id })
  const error = (c, m) => ({ jsonrpc: '2.0', error: { code: c, message: m }, id })

  if (method === 'initialize') {
    return reply({
      protocolVersion: '2024-11-05',
      capabilities:    { tools: {} },
      serverInfo:      { name: 'aura-mcp-store', version: '1.0.0' },
    })
  }
  if (method === 'tools/list') return reply({ tools: buildToolsSchema() })
  if (method === 'ping') return reply({})

  if (method === 'tools/call') {
    const { name, arguments: args = {} } = params ?? {}
    const tool = TOOLS[name]
    if (!tool) return error(-32601, `Tool '${name}' não encontrada`)
    try {
      const result = await tool.fn(ctx, args)
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id')
  res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  if (req.method === 'GET' && url === '/health') {
    return respond(res, 200, { ok: true, service: 'mcp-store', uptime: process.uptime(), carts: carts.size })
  }

  const match = url.match(/^\/store\/([a-z0-9-]+)$/)
  if (!match) return respond(res, 404, { error: 'Use /store/{tenant-slug}' })

  const slug      = match[1]
  const authHeader = req.headers['authorization'] ?? req.headers['x-api-key'] ?? ''

  if (req.method === 'GET') {
    const tenant = await resolveTenant(slug)
    if (!tenant) return respond(res, 404, { error: 'Tenant não encontrado.' })
    return respond(res, 200, {
      name:        `Aura MCP Store — ${tenant.name}`,
      version:     '1.0.0',
      description: 'Faça pedidos B2B via assistente de IA',
      auth_hint:   'Passe Bearer token do comprador ou API Key no header Authorization',
      tools:       buildToolsSchema().map(t => ({ name: t.name, description: t.description })),
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

    let ctx
    const sessionId = req.headers['mcp-session-id']

    if (sessionId && sessions.has(sessionId)) {
      ctx = sessions.get(sessionId).ctx
    } else {
      // Para browse_catalog e check_availability sem auth — permitir tenant público
      if (body.method === 'tools/call' && ['browse_catalog','check_availability'].includes(body.params?.name) && !authHeader) {
        const tenant = await resolveTenant(slug)
        if (!tenant) return respond(res, 404, { error: 'Tenant não encontrado.' })
        ctx = { tenant, buyer: { id: 'anonymous', name: 'Anônimo', isAnonymous: true } }
      } else {
        ctx = await resolveAuth(slug, authHeader)
        if (!ctx) return respond(res, 401, { error: 'Não autenticado. Passe Bearer token ou API Key.' })
      }
    }

    if (body.method === 'tools/call') {
      const quota = await checkAndTrack(masterPool, ctx.tenant.id, ctx.tenant.plan_id ?? 'plan_starter', 'store').catch(() => ({ allowed: true }))
      if (quota.blocked) {
        return respond(res, 429, { error: `Quota MCP esgotada. Hard limit atingido.` })
      }
    }

    const isInit = body.method === 'initialize'
    const result = await handleMcpRequest(body, ctx)

    const headers = {}
    if (isInit) {
      headers['mcp-session-id'] = createSession(ctx)
    } else if (sessionId) {
      headers['mcp-session-id'] = sessionId
    }

    return respond(res, 200, result, headers)
  }

  respond(res, 405, { error: 'Método não permitido' })
})

/* ─── Quota tracking ───────────────────────────────────────── */

async function trackMcpUsage(tenantId, scope = 'store') {
  const month = new Date().toISOString().slice(0, 7)
  await masterPool.query(`
    INSERT INTO mcp_usage (tenant_id, month, calls_used, calls_billed)
    VALUES ($1, $2, 1, 0)
    ON CONFLICT (tenant_id, month)
    DO UPDATE SET calls_used = mcp_usage.calls_used + 1
  `, [tenantId, month])
}

server.listen(PORT, '0.0.0.0', () => {
  log(`✅ Rodando na porta ${PORT}`)
})
