/**
 * provision-agent — Aura Platform
 *
 * Roda no HOST (acesso ao Docker CLI).
 * Expõe porta 4001 internamente.
 * Chamado pelo api-[slug] via HTTP para provisionar novos tenants.
 *
 * POST /provision   — provisiona tenant completo
 * GET  /health      — healthcheck
 * GET  /status/:slug — status do provisionamento
 */

import http from 'http'
import { execFile, exec } from 'child_process'
import { promisify } from 'util'
import { createHash, randomBytes } from 'crypto'

const execAsync  = promisify(exec)
const execFileAsync = promisify(execFile)

const PORT          = parseInt(process.env.PORT ?? '4001', 10)
const AGENT_SECRET  = process.env.AGENT_SECRET ?? 'aura-provision-secret-2024'
const DOMAIN        = process.env.AURA_DOMAIN  ?? 'aurabr.app'
const DB_CONTAINER  = process.env.AURA_DB_CONTAINER ?? 'supabase-db'
const DB_SUPERUSER  = process.env.AURA_DB_SUPERUSER ?? 'postgres'
const MASTER_DB_URL = process.env.MASTER_DB_URL
const PAGARME_KEY   = process.env.PAGARME_API_KEY ?? ''
const MASTER_SECRET = process.env.MASTER_SECRET   ?? ''
const SMTP_HOST     = process.env.SMTP_HOST ?? 'mail.aurabr.app'
const SMTP_PORT     = process.env.SMTP_PORT ?? '587'
const SMTP_USER     = process.env.SMTP_USER ?? 'noreply@aurabr.app'
const SMTP_PASS     = process.env.SMTP_PASS ?? ''
const WAHA_IMAGE    = 'devlikeapro/waha:latest'
const API_IMAGE     = 'api-aura:latest'
const ERP_IMAGE     = 'erp-aura:latest'
const STORE_IMAGE   = 'store-aura:latest'

// Estado em memória dos provisionamentos em andamento
const provisionStatus = new Map()

/* ─── Helpers ─────────────────────────────────────────────── */

function log(msg)  { console.log(`[provision-agent] ${new Date().toISOString()} ${msg}`) }
function err(msg)  { console.error(`[provision-agent] ❌ ${msg}`) }

function randomPassword(len = 24) {
  return randomBytes(len).toString('base64url').slice(0, len)
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')) }
      catch { reject(new Error('JSON inválido')) }
    })
    req.on('error', reject)
  })
}

function respond(res, status, data) {
  const body = JSON.stringify(data)
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) })
  res.end(body)
}

async function run(cmd, opts = {}) {
  log(`  $ ${cmd.slice(0, 120)}`)
  return execAsync(cmd, { timeout: 120_000, ...opts })
}

/* ─── Provisionamento principal ───────────────────────────── */

async function provision(params) {
  const {
    slug, tenantId, tenantName, planId,
    adminEmail, adminPassword,
    adminName, segment, seedDemo,
  } = params

  const safeSlug   = slug.replace(/-/g, '_')
  const dbName     = `aura_${safeSlug}`
  const dbUser     = `aura_${safeSlug}`
  const dbPass     = randomPassword(28)
  const wahaUUID   = randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
  const wahaName   = `waha_${wahaUUID}`
  const wahaKey    = randomBytes(20).toString('hex')
  const tenantNet  = `tenant_${safeSlug}_net`

  const setStep = (step, detail = '') => {
    provisionStatus.set(slug, { step, detail, updatedAt: new Date().toISOString() })
    log(`[${slug}] ${step} ${detail}`)
  }

  try {
    setStep('BANCO_CRIANDO')

    // 1. Criar usuário e banco PostgreSQL isolado
    // Criar usuário e banco (idempotente)
    await run(`docker exec ${DB_CONTAINER} psql -U ${DB_SUPERUSER} -c "DO \\$x\\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${dbUser}') THEN CREATE USER \\\"${dbUser}\\\" WITH PASSWORD '${dbPass}'; END IF; END \\$x\\$;" 2>/dev/null || true`)
    await run(`sh -c "docker exec ${DB_CONTAINER} psql -U ${DB_SUPERUSER} -tc \\"SELECT 1 FROM pg_database WHERE datname='${dbName}'\\" | grep -q 1 || docker exec ${DB_CONTAINER} psql -U ${DB_SUPERUSER} -c \\"CREATE DATABASE \\\\\\"${dbName}\\\\\\";\\"" 2>/dev/null || true`)
    await run(`docker exec ${DB_CONTAINER} psql -U ${DB_SUPERUSER} -c "GRANT ALL PRIVILEGES ON DATABASE \\"${dbName}\\" TO \\"${dbUser}\\";"`);
    // GRANT permissoes nas tabelas apos migrations
    await run(`docker exec ${DB_CONTAINER} psql -U ${DB_SUPERUSER} -d ${dbName} -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO \"${dbUser}\"; GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO \"${dbUser}\"; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO \"${dbUser}\"; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO \"${dbUser}\";"`);

    setStep('MIGRATIONS')

    // 2. Migrations — extensões e tabelas base do tenant
    const migrationSQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_token TEXT        NOT NULL,
  event      TEXT        NOT NULL,
  title      TEXT        NOT NULL,
  body       TEXT,
  read       BOOLEAN     NOT NULL DEFAULT false,
  payload    JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_user  ON notifications(user_token);
CREATE INDEX IF NOT EXISTS idx_notif_read  ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notif_event ON notifications(event);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      JSONB        NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
INSERT INTO settings (key, value) VALUES
  ('whatsapp', '{"enabled":false,"session":null}'),
  ('store',    '{"enabled":false,"min_order":0}'),
  ('notify',   '{"email":true,"whatsapp":false}')
ON CONFLICT (key) DO NOTHING;
`
    // Escrever migration num arquivo temporário e executar
    const tmpFile = `/writable/migration_${slug}_${Date.now()}.sql`
    await run(`cat > ${tmpFile} << 'SQLEOF'\n${migrationSQL}\nSQLEOF`)
    await run(`docker exec -i ${DB_CONTAINER} psql -h localhost -U ${DB_SUPERUSER} -d ${dbName} < ${tmpFile}`)
    await run(`rm -f ${tmpFile}`)


    // Salvar db_url no banco master para uso dos MCPs
    try {
      const mpg = await import('pg')
      const mp = new mpg.default.Pool({ connectionString: MASTER_DB_URL, max: 1 })
      await mp.query(
        "UPDATE tenants SET db_url = $1 WHERE slug = $2",
        [`postgresql://${dbUser}:${dbPass}@${DB_CONTAINER}:5432/${dbName}`, slug]
      )
      await mp.end()
    } catch(e) { log(`[warn] db_url update: ${e.message}`) }

    // 2b. Criar admin no banco master via bcrypt + psql
    try {
      const { default: bcryptjs } = await import('bcryptjs')
      const hash = await bcryptjs.hash(adminPassword || 'Aura@2024', 10)
      // Usar heredoc para evitar problemas com caracteres especiais no SQL
      // Escrever SQL via Node fs para preservar $ do bcrypt
      const tmpSql = '/writable/admin_' + slug + '_' + Date.now() + '.sql'
      const insertSql = "INSERT INTO users (id, token_id, tenant_id, email, password_hash, role, name, active) VALUES (gen_random_uuid()::text, gen_random_uuid()::text, '" + tenantId + "', '" + adminEmail + "', '" + hash.replace(/'/g, "''") + "', 'ADMIN', '" + (adminName || 'Admin').replace(/'/g, "''") + "', true) ON CONFLICT (tenant_id, email) DO UPDATE SET password_hash = EXCLUDED.password_hash;"
      const { writeFileSync, unlinkSync } = await import('fs')
      writeFileSync(tmpSql, insertSql)
      await run('docker exec -i ' + DB_CONTAINER + ' psql -U ' + DB_SUPERUSER + ' -d aura_master < ' + tmpSql)
      try { unlinkSync(tmpSql) } catch(_) {}
      log('[' + slug + '] ✅ Admin criado: ' + adminEmail)
    } catch(e) { log('[warn] admin create: ' + e.message) }

        setStep('REDE_DOCKER')

    // 3. Criar rede Docker do tenant
    await run(`docker network create ${tenantNet} 2>/dev/null || true`)

    setStep('WAHA_SUBINDO')

    // 4. Subir WAHA isolado para o tenant
    await run(`docker run -d \\
      --name ${wahaName} \\
      --restart unless-stopped \\
      --network prod_default \\
      -e WHATSAPP_API_KEY=${wahaKey} \\
      -e WHATSAPP_DEFAULT_ENGINE=NOWEB \\
      -e WHATSAPP_START_SESSION=default \\
      -e PUPPETEER_SKIP_DOWNLOAD=True \\
      ${WAHA_IMAGE}`)

    setStep('API_SUBINDO')

    // 5. Subir api-[slug]
    const jwtSecret = randomBytes(40).toString('hex')
    const jwtRefreshSecret = randomBytes(40).toString('hex')
    const corsOrigins = `https://${slug}.${DOMAIN}\nhttps://loja.${slug}.${DOMAIN}\nhttps://master.${DOMAIN}\nhttps://${DOMAIN}`
    const dbUrl = `postgresql://${dbUser}:${dbPass}@${DB_CONTAINER}:5432/${dbName}`

    await run(`docker run -d \\
      --name api-${slug} \\
      --restart unless-stopped \\
      --network prod_default \\
      -e NODE_ENV=production \\
      -e PORT=3001 \\
      -e TENANT_SLUG=${slug} \\
      -e DATABASE_URL="${dbUrl}" \\
      -e TENANT_DB_URL="${dbUrl}" \\
      -e MASTER_DB_URL="${MASTER_DB_URL}" \\
      -e REDIS_URL=redis://redis-prod:6379 \\
      -e COOKIE_DOMAIN=.${DOMAIN} \\
      -e CORS_ORIGINS="${corsOrigins}" \\
      -e MASTER_SECRET=${MASTER_SECRET} \\
      -e PAGARME_API_KEY=${PAGARME_KEY} \\
      -e WAHA_URL=http://${wahaName}:3000 \\
      -e WAHA_API_KEY=${wahaKey} \\
      -e WAHA_SESSION=default \\
      -e WAHA_INSTANCE_ID=${slug} \\
      -e SMTP_HOST=${SMTP_HOST} \\
      -e SMTP_PORT=${SMTP_PORT} \\
      -e SMTP_USER=${SMTP_USER} \\
      -e SMTP_PASS=${SMTP_PASS} \\
      -e PROVISIONAR_SCRIPT=/app/scripts/provisionar.sh \\
      -e JWT_SECRET=${jwtSecret} \\
      -e JWT_REFRESH_SECRET=${jwtRefreshSecret} \\
      -e BUYER_JWT_SECRET=buyer_secret_${slug}_2024 \\
      -e PAGARME_WEBHOOK_SECRET=aura_webhook_2024 \\
      -e PROVISION_AGENT_URL=http://provision-agent:4001 \\
      -e AGENT_SECRET=${AGENT_SECRET} \\
      ${API_IMAGE}`)

    // Conectar api nas redes necessárias
    await run(`docker network connect supabase_supabase_net api-${slug} 2>/dev/null || true`)
    await run(`docker network connect ${tenantNet} api-${slug} 2>/dev/null || true`)
    // Conectar WAHA na rede do tenant
    await run(`docker network connect ${tenantNet} ${wahaName} 2>/dev/null || true`)

    setStep('ERP_SUBINDO')

    // 6. Nginx config para o ERP
    const nginxConf = `server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location = /index.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate";
        expires 0;
    }

    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location ~ ^/(auth|api|store|master|onboarding|billing)/ {
        proxy_pass http://api-${slug}:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Cookie $http_cookie;
        proxy_pass_header Set-Cookie;
        proxy_cookie_domain api-${slug} $host;
        proxy_cookie_path / /;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}`

    const nginxTmp = `/writable/nginx_${slug}.conf`
    await run(`cat > ${nginxTmp} << 'NGINXEOF'\n${nginxConf}\nNGINXEOF`)

    // 7. Subir erp-[slug]
    await run(`docker run -d \\
      --name erp-${slug} \\
      --restart unless-stopped \\
      --network prod_default \\
      -e VITE_API_URL=https://api.${slug}.${DOMAIN} \\
      --label "traefik.enable=true" \\
      --label "traefik.http.routers.erp-${slug}.rule=Host(\`${slug}.${DOMAIN}\`)" \\
      --label "traefik.http.routers.erp-${slug}.entrypoints=websecure" \\
      --label "traefik.http.routers.erp-${slug}.tls.certresolver=mytlschallenge" \\
      --label "traefik.http.services.erp-${slug}.loadbalancer.server.port=80" \\
      ${ERP_IMAGE}`)

    // Copiar nginx config e recarregar
    await run(`docker cp ${nginxTmp} erp-${slug}:/etc/nginx/conf.d/default.conf`)
    await run(`docker exec erp-${slug} nginx -s reload 2>/dev/null || docker exec erp-${slug} nginx`)
    await run(`docker network connect ${tenantNet} erp-${slug} 2>/dev/null || true`)
    await run(`rm -f ${nginxTmp}`)

    setStep('STORE_SUBINDO')

    // 8. Subir store-[slug]
    await run(`docker run -d \\
      --name store-${slug} \\
      --restart unless-stopped \\
      --network prod_default \\
      --label "traefik.enable=true" \\
      --label "traefik.http.routers.store-${slug}.rule=Host(\`loja.${slug}.${DOMAIN}\`)" \\
      --label "traefik.http.routers.store-${slug}.entrypoints=websecure" \\
      --label "traefik.http.routers.store-${slug}.tls.certresolver=mytlschallenge" \\
      --label "traefik.http.services.store-${slug}.loadbalancer.server.port=3000" \\
      ${STORE_IMAGE}`)

    await run(`docker network connect supabase_supabase_net store-${slug} 2>/dev/null || true`)
    await run(`docker network connect ${tenantNet} store-${slug} 2>/dev/null || true`)

    setStep('AGUARDANDO_HEALTHCHECK')

    // 9. Aguardar api ficar healthy (até 60s)
    let healthy = false
    for (let i = 0; i < 12; i++) {
      await new Promise(r => setTimeout(r, 5000))
      const { stdout } = await run(`docker inspect api-${slug} --format '{{.State.Health.Status}}' 2>/dev/null || echo starting`)
      if (stdout.trim() === 'healthy') { healthy = true; break }
    }
    if (!healthy) log(`[${slug}] ⚠️  api-${slug} ainda não está healthy após 60s — prosseguindo`)


    // Seed de dados de demonstração (opcional)
    if (seedDemo) {
      log(`[${slug}] 🌱 Inserindo dados de demonstração...`)
      try {
        const demoSQL = `
-- Clientes demo
INSERT INTO customers (id, name, document, whatsapp, email, person_type, active, created_at)
VALUES
  (gen_random_uuid()::text, 'Distribuidora São Paulo', '12.345.678/0001-99', '11999990001', 'compras@distsaopaulo.com', 'PJ', true, now()),
  (gen_random_uuid()::text, 'Moda Rápida Ltda', '98.765.432/0001-11', '11999990002', 'pedidos@modarapida.com.br', 'PJ', true, now()),
  (gen_random_uuid()::text, 'Boutique Elegance', '45.678.901/0001-55', '11999990003', 'contato@elegance.com', 'PJ', true, now())
ON CONFLICT DO NOTHING;

-- Produtos demo
INSERT INTO products (id, name, sku_code, type, category, active, public, created_at)
VALUES
  (gen_random_uuid()::text, 'Camiseta Básica', 'CAM-001', 'simple', 'Camisetas', true, true, now()),
  (gen_random_uuid()::text, 'Calça Jeans Slim', 'CAL-001', 'simple', 'Calças', true, true, now()),
  (gen_random_uuid()::text, 'Tênis Runner Pro', 'TEN-001', 'variant', 'Calçados', true, true, now())
ON CONFLICT DO NOTHING;
`
        const tmpDemo = '/writable/demo_' + slug + '_' + Date.now() + '.sql'
        const { writeFileSync, unlinkSync } = await import('fs')
        writeFileSync(tmpDemo, demoSQL)
        await run('docker exec -i ' + DB_CONTAINER + ' psql -U ' + DB_SUPERUSER + ' -d ' + dbName + ' < ' + tmpDemo)
        try { unlinkSync(tmpDemo) } catch(_) {}
        log(`[${slug}] ✅ Dados de demo inseridos`)
      } catch(e) { log(`[${slug}] [warn] seed demo: ${e.message}`) }
    }

        setStep('CONCLUIDO')
    log(`[${slug}] ✅ Tenant provisionado com sucesso!`)

    return {
      ok: true,
      slug,
      dbName,
      dbUser,
      dbPass,
      wahaName,
      wahaKey,
      erpUrl:   `https://${slug}.${DOMAIN}`,
      storeUrl: `https://loja.${slug}.${DOMAIN}`,
      apiUrl:   `https://api.${slug}.${DOMAIN}`,
    }

  } catch (e) {
    setStep('ERRO', e.message)
    err(`[${slug}] ${e.message}`)
    throw e
  }
}

/* ─── HTTP Server ──────────────────────────────────────────── */

const server = http.createServer(async (req, res) => {
  // Auth
  const auth = req.headers['x-agent-secret']
  if (auth !== AGENT_SECRET) {
    return respond(res, 401, { error: 'Não autorizado.' })
  }

  const url = req.url.split('?')[0]

  // GET /health
  if (req.method === 'GET' && url === '/health') {
    return respond(res, 200, { ok: true, uptime: process.uptime() })
  }

  // GET /status/:slug
  if (req.method === 'GET' && url.startsWith('/status/')) {
    const slug = url.replace('/status/', '')
    const status = provisionStatus.get(slug) ?? { step: 'DESCONHECIDO' }
    return respond(res, 200, status)
  }

  // POST /provision
  if (req.method === 'POST' && url === '/provision') {
    let body
    try { body = await parseBody(req) }
    catch { return respond(res, 400, { error: 'Body inválido.' }) }

    const { slug, tenantId, tenantName, planId, adminEmail, adminPassword, adminName, segment, seedDemo } = body

    if (!slug || !tenantId || !adminEmail) {
      return respond(res, 400, { error: 'slug, tenantId e adminEmail são obrigatórios.' })
    }

    // Responde imediatamente, provisiona em background
    respond(res, 202, { message: 'Provisionamento iniciado.', slug })

    provision({ slug, tenantId, tenantName, planId, adminEmail, adminPassword, adminName, segment, seedDemo: !!seedDemo })
      .catch(e => err(`Falha no provision de ${slug}: ${e.message}`))

    return
  }

  respond(res, 404, { error: 'Rota não encontrada.' })
})


/* ─── Billing MCP — job mensal ────────────────────────────── */
// Verifica todo dia 1 às 06:00 (BRT = UTC-3 → 09:00 UTC)
function scheduleBillingJob() {
  const check = () => {
    const now = new Date()
    if (now.getUTCDate() === 1 && now.getUTCHours() === 9 && now.getUTCMinutes() < 5) {
      log('[billing] Executando job mensal MCP...')
      import('child_process').then(({ execFile }) => {
        execFile('node', ['/projetos/aura-platform/services/mcp-shared/billing-job.js'], {
          env: { ...process.env, PATH: process.env.PATH },
          timeout: 120_000,
        }, (err, stdout, stderr) => {
          if (err) log('[billing] Erro: ' + err.message)
          if (stdout) stdout.split('\n').forEach(l => l && log(l))
        })
      })
    }
  }
  setInterval(check, 60_000) // checar a cada minuto
  log('[billing] Job agendado (executa dia 1 de cada mês às 06:00 BRT)')
}
scheduleBillingJob()

server.listen(PORT, '0.0.0.0', () => {
  log(`✅ Provision agent rodando na porta ${PORT}`)
})

server.on('error', e => {
  err(`Server error: ${e.message}`)
  process.exit(1)
})
