# CLAUDE.md — Aura Platform

> Sprint 6 concluída — MCPs nativos em produção
> Cole no início da conversa nova.

-----

## Quem sou eu

Hely Pasqual — Aura Cloud Solutions. Aura Platform — SaaS white-label multi-tenant ERP + e-commerce B2B. Comunico em português.

-----

## VPS e acesso — REGRAS CRÍTICAS

**MCP correto: VPS MCP** (`VPS MCP:run_command`, `VPS MCP:write_file`)
**NUNCA usar VPS Aoop MCP** — outra VPS (2.24.222.211), sem relação com este projeto.

### Paths

```
/projetos/aura-platform/   ← raiz do projeto
/writable/                 ← builds longos e scripts temporários
/home/helygp/projetos/     ← path real no host (= /projetos/ via bind mount)
/opt/vps-mcp/writable/     ← path real no host (= /writable/ via bind mount)
```

### Ambiente

- Node.js v22.22.2 | PostgreSQL 15 (hostname: supabase-db) | Redis (hostname: redis-prod)
- Traefik + HTTPS | Docker socket: `/var/run/docker.sock`

### Lições críticas

- **Nunca usar IP fixo** nas connection strings — usar hostname (supabase-db, redis-prod)
- **Editar no host** e `docker cp` para o container — nunca `docker exec node -e`
- **Builds longos**: `nohup npm run build > /writable/build.log 2>&1 &` + `tail -f /writable/build.log`
- **Redes Docker** por container: api-[slug] precisa de prod_default + supabase_supabase_net + tenant_[slug]_net
- **docker restart** não troca imagem — sempre `docker stop && docker rm && docker run`
- **provision-agent** roda como container `restart=always`, montando `/var/run/docker.sock`
- **TLS Traefik**: router e service precisam ter o **mesmo nome** nos labels, sem `.service` explícito

-----

## Containers em produção

| Container | Status | URL | Login |
|-----------|--------|-----|-------|
| erp-acme | ✅ Up healthy | https://acme.aurabr.app | admin@acme.aurabr.app / Aura@acme2024 |
| api-acme | ✅ Up healthy | https://api.acme.aurabr.app | — |
| store-acme | ✅ Up healthy | https://loja.acme.aurabr.app | comprador cria conta |
| erp-forroplastic | ✅ Up | https://forroplastic.aurabr.app | admin@forroplastic.aurabr.app / Aura@forro2024 |
| api-forroplastic | ✅ Up healthy | https://api.forroplastic.aurabr.app | — |
| store-forroplastic | ✅ Up healthy | https://loja.forroplastic.aurabr.app | — |
| master-panel | ✅ Up | https://master.aurabr.app | hely / AuraMaster@2024 (Basic Auth) |
| landing-aura | ✅ Up | https://aurabr.app | — |
| mcp-manager | ✅ Up | https://mcp.aurabr.app/manager/{slug} | x-api-key |
| mcp-store | ✅ Up | https://mcp.aurabr.app/store/{slug} | Authorization: Bearer |
| mcp-connect | ✅ Up | https://mcp.aurabr.app/connect/{slug} | x-api-key |
| api-gateway | ✅ Up | https://api.aurabr.app | x-api-key |
| aura-docs | ✅ Up | https://docs.aurabr.app | — |
| provision-agent | ✅ Up | interno:4001 | x-agent-secret |

-----

## Envs críticas (referência para novos tenants)

```
DATABASE_URL=postgresql://aura_[slug]:[PASS]@supabase-db:5432/aura_[slug]
MASTER_DB_URL=postgresql://postgres:pD5MouDfpF2b0ThSrnI6IQIcn7j5ZKFfnrxmPBeOgvs7JTl5WhWLQANAZCH7ztMe@supabase-db:5432/aura_master
COOKIE_DOMAIN=.aurabr.app          ← CRÍTICO com ponto
PROVISION_AGENT_URL=http://provision-agent:4001
AGENT_SECRET=aura-provision-secret-2024
PAGARME_API_KEY=b518a03b-2140-4042-9d13-334607390d29
MASTER_SECRET=e04f913bd51a8cb66e5b0c6d37487ba3d0249237fa6fd3900c2b6c9194d8c49e
```

-----

## Auth — como funciona

- Login retorna `accessToken` no body JSON + cookie httpOnly
- Frontend usa `Authorization: Bearer <token>` em toda chamada
- Middleware `authenticate.js` aceita cookie OU Bearer
- **provision-agent** chama api-[slug] via HTTP interno na rede prod_default

-----

## WAHA — por tenant

Cada tenant tem sua própria instância WAHA isolada.
O `provisionar.sh` cria automaticamente: `waha_[uuid]` container.

```
GET  /api/sessions/{session}
POST /api/sessions/{session}/restart
GET  /api/{session}/auth/qr
POST /api/sendText {chatId, text, session}
GET  /api/{session}/chats?limit=30
```

-----

## Banco master — schema

```sql
tenants: id (cuid), slug, name, plan_id, status, db_name, db_url,
         pagarme_customer_id, pagarme_subscription_id, billing_status,
         trial_ends_at, next_billing_date, theme_config
users: id, tenant_id (FK → tenants.id), email, password_hash, role, name, active
plans: id, name, price_setup, price_monthly, mcp_quota, max_users, max_products, features, active
mcp_api_keys: id, tenant_id, key_hash, scope (manager|store|connect), label, active
mcp_usage: tenant_id, month (YYYY-MM), calls_used, calls_billed
api_keys: id, tenant_id, key_hash, label, active, last_used  ← API pública
api_usage: tenant_id, month, calls_used
webhooks: id, tenant_id, url, events[], secret, active
billing_events: id, tenant_id, event_type, amount, status, pagarme_charge_id, payload
```

**ATENÇÃO:** `users.tenant_id` é FK para `tenants.id` (cuid), não o slug.
`db_url` deve ser salvo ao provisionar novo tenant (usado pelos MCPs).

-----

## Sprint 6 — MCPs em produção

### MCP Manager (para gestores)

**URL:** `https://mcp.aurabr.app/manager/{tenant-slug}`
**Auth:** `x-api-key: aura_mgr_...`
**10 tools:** get_dashboard, analyze_margin, list_low_stock, create_order, update_order_status, get_sales_report, list_top_customers, send_whatsapp, list_products, get_ai_insights

### MCP Store (para compradores B2B)

**URL:** `https://mcp.aurabr.app/store/{tenant-slug}`
**Auth:** `Authorization: Bearer <jwt-comprador>` ou API Key scope=store
**8 tools:** browse_catalog, check_availability, create_cart, add_to_cart, get_cart, checkout, get_order_status, list_my_orders

### MCP Connect (para desenvolvedores)

**URL:** `https://mcp.aurabr.app/connect/{tenant-slug}`
**Auth:** `x-api-key: aura_connect_...`
**8 tools:** list_endpoints, get_schema, validate_payload, register_webhook, test_connection, get_usage, list_integrations, get_sandbox_data

### API Gateway + Docs

**API pública:** `https://api.aurabr.app/v1/{slug}/...`
**Auth:** `x-api-key: aura_pub_...`
**Rate limit:** 60 req/min por chave | Headers: `X-RateLimit-Remaining`
**OpenAPI spec:** `https://api.aurabr.app/openapi.json`
**Docs Scalar:** `https://docs.aurabr.app`
**Landing MCP:** `https://docs.aurabr.app/mcp`

### Quota MCP por plano

| Plano | Calls/mês | Excedente | Hard limit |
|-------|-----------|-----------|------------|
| Starter | 500 | R$ 0,30/call | 1.500 |
| Pro | 2.000 | R$ 0,20/call | 6.000 |
| Full | 10.000 | R$ 0,10/call | 30.000 |

Headers em toda resposta `tools/call`:
```
X-MCP-Quota-Limit / X-MCP-Quota-Used / X-MCP-Quota-Remaining / X-MCP-Quota-Overage
```

Billing mensal: `provision-agent` executa `mcp-shared/billing-job.js` no dia 1 de cada mês às 06:00 BRT.

### API Keys acme (produção)

```
Manager: aura_mgr_0e6c973f1cf7ade881d9f5911bd4bd4aa9a1ee24c36258c8
Store:   aura_store_220678d120f0579cf84a8e21b18b0ee9353bbef0
Connect: aura_connect_8754aef267ce2e8be1e98d133106bad22f1be459
Public:  aura_pub_7254788b705deab56e32f6b370e41132c81638a7
```

-----

## Serviços MCP — onde estão

```
/projetos/aura-platform/services/
  mcp-manager/     ← porta 4002 | imagem mcp-manager:latest
  mcp-store/       ← porta 4003 | imagem mcp-store:latest
  mcp-connect/     ← porta 4004 | imagem mcp-connect:latest
  mcp-shared/      ← quota.js + billing-job.js (copiado para cada serviço no build)
  api-gateway/     ← porta 4005 | imagem api-gateway:latest
  provision-agent/ ← porta 4001 | imagem provision-agent:latest
```

### Rebuild de qualquer MCP (sempre após editar index.js):

```bash
# 1. Copiar quota.js atualizado
cp /projetos/aura-platform/services/mcp-shared/quota.js \
   /projetos/aura-platform/services/mcp-manager/mcp-shared/quota.js

# 2. Build
cd /projetos/aura-platform/services/mcp-manager
docker build -t mcp-manager:latest .

# 3. Recriar container (restart não troca imagem!)
docker stop mcp-manager && docker rm mcp-manager
docker run -d --name mcp-manager --restart always --network prod_default \
  -e PORT=4002 \
  -e MASTER_DB_URL="..." \
  -e AURA_DOMAIN="aurabr.app" \
  --label "traefik.enable=true" \
  --label "traefik.http.routers.mcp-manager.rule=Host(\`mcp.aurabr.app\`) && PathPrefix(\`/manager\`)" \
  --label "traefik.http.routers.mcp-manager.entrypoints=websecure" \
  --label "traefik.http.routers.mcp-manager.tls.certresolver=mytlschallenge" \
  --label "traefik.http.services.mcp-manager.loadbalancer.server.port=4002" \
  mcp-manager:latest
docker network connect supabase_supabase_net mcp-manager
```

-----

## Provisionamento de novo tenant

O `provision-agent` (container, porta 4001) executa automaticamente quando
o `onboarding.js` do `api-acme` chama `POST /provision`.

**O que ele faz:**
1. Cria usuário + banco PostgreSQL isolado `aura_[slug]`
2. Salva `db_url` na tabela `tenants` do master (usado pelos MCPs)
3. Executa migrations (extensões + tabelas base)
4. Cria rede Docker `tenant_[slug]_net`
5. Sobe WAHA isolado `waha_[uuid]`
6. Sobe `api-[slug]` com todas as envs + JWT únicos
7. Sobe `erp-[slug]` com nginx proxy + labels Traefik
8. Sobe `store-[slug]`
9. Aguarda healthcheck da api

**Monitorar provisionamento:**
```bash
node -e "
fetch('http://provision-agent:4001/status/[slug]', {
  headers: {'x-agent-secret': 'aura-provision-secret-2024'}
}).then(r=>r.json()).then(console.log)
"
```

-----

## Publicação MCPs nos diretórios de IA

Arquivos em `/projetos/aura-platform/docs/mcp-directories/`:
- `publishing-guide.md` — guia completo com passo a passo para cada diretório
- `mcp-submission.md` — texto pronto para Claude MCP Directory
- `chatgpt-action.yaml` — schema para GPT Action no ChatGPT

**Próximo passo:** submeter em https://modelcontextprotocol.io/directory

-----

## Decisões de produto — não revisitar

| Decisão | Escolha |
|---------|---------|
| WAHA por tenant | Instância isolada — performance + segurança |
| Auth proxy | Bearer token no header (além de cookie) |
| IDs na URL | Proibido — slugs e tokens opacos |
| Banco por tenant | PostgreSQL isolado — aura_[slug] |
| db_url no master | Salvo ao provisionar — usado pelos MCPs |
| tenant_id no banco master | cuid (ex: cmplltdqm0001…) não slug |
| Cotas MCP | Só tool calls — não chamadas HTTP da API pública |
| MCP gateway | mcp.aurabr.app/{manager\|store\|connect}/{slug} |
| Billing excedente | Dia 1 de cada mês via provision-agent |
| Hard limit MCP | 3× quota do plano — bloqueia com 429 |
| TLS Traefik | Router e service com mesmo nome, sem .service explícito |

-----

## Como usar este arquivo

### Próxima conversa — continuar Sprint 6 ou nova feature:

```
[CLAUDE.md colado aqui]

Tarefa: [descrever o que precisa]
```

### Verificação rápida de saúde:

```bash
docker ps --format "{{.Names}}\t{{.Status}}" | grep -E "mcp-|api-gateway|aura-docs|provision"
```

### API Keys forroplastic (produção)

```
Manager: aura_mgr_50f267e321328e3c4bf7c385012636a948fcc82c1b21bd01
Store:   aura_store_805e309a7b9a2db59723ccd1c985edb2bceba7e2
Connect: aura_connect_268671d60687617cd3b7702e3b0223d0e8891e82
Public:  aura_pub_2c4a4354b06b637cf1935b541624e2d46e470b00
```
