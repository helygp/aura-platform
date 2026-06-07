# CLAUDE.md — Aura Platform

## Projeto

**Aura Platform** — SaaS B2B white-label multi-tenant para atacado brasileiro.
Módulos: ERP web, loja B2B (store), automação WhatsApp, MCPs com IA.
Solo founder: Hely Pasqual | Repo: `helygp/aura-platform`

---

## Infraestrutura

| Componente | Detalhe |
|---|---|
| VPS | `31.97.151.162` (srv885928.hstgr.cloud) |
| CI/CD | GitHub Actions: branch `staging` → `staging.aurabr.app` (auto); `main` → prod (auto) |
| Reverse proxy | Traefik (labels no Docker) |
| Banco | PostgreSQL via Supabase self-hosted, hostname `supabase-db`, rede `supabase_supabase_net` |
| ERP | React/Vite, build via container Docker isolado |
| Store | Next.js 14 |
| API | Node.js/Express por tenant |
| Email | Stalwart SMTP (`noreply@aurabr.app`, porta 465) |

**Tenants ativos:** `fastmalhas`, `acme`, `forroplastic`, `staging`

---

## Path Mappings (CRÍTICO)

```
VPS MCP path       →  Path real na VPS
/projetos/...      →  /home/helygp/projetos/...
/writable/...      →  /opt/vps-mcp/writable/...
```

Atenção ao usar `docker run -v` com bind mounts — usar path real `/home/helygp/projetos/`.

---

## Regras Críticas de Deploy

### Docker

```
CORRETO:   docker stop → docker cp → docker start
ERRADO:    docker restart  ← NÃO troca imagem, NÃO usar

Para nova imagem: stop → rm → recreate (nunca só restart)
Novo arquivo de rota: rebuild completo da imagem (não apenas docker cp)
Após build ERP: docker cp dist/. inteiro, nunca só index.html
```

### Traefik

**OBRIGATÓRIO** antes de recriar qualquer container com rota:
1. Avisar riscos explicitamente
2. Listar domínios afetados
3. Aguardar confirmação do Hely

**Ao recriar container com rota — sempre incluir:**
```
--label "traefik.docker.network=prod_default"
```
Sem essa label: Traefik pega IP da rede errada → site cai silenciosamente.

**Conflito `@docker` vs `@file`:** não definir rota para o mesmo hostname nos dois providers — causa 409.

---

## Regras de Navegação (ERP) — CRÍTICO

Ao adicionar qualquer item em `navItems.js`:
1. Adicionar import do ícone Lucide em `Sidebar.jsx`
2. Adicionar no map `ICONS` em `Sidebar.jsx`
3. Adicionar no map `ICONS` em `BottomNav.jsx`

**Faltar qualquer um dos 3 → React error #130 (tela branca).**

---

## Padrão de Build ERP

```bash
docker run --rm --privileged --pid=host alpine:3 \
  nsenter -t 1 -m -- \
  docker run --rm \
    -v /home/helygp/projetos/aura-platform:/workspace \
    -w /workspace/apps/erp \
    node:22-bookworm-slim \
    sh -c "npm install --silent 2>/dev/null; npx vite@5.4.21 build"
```

`node_modules/.bin/vite` fica na raiz do monorepo, não dentro de `apps/erp`.

---

## Padrão de Edição de Arquivos

```
Arquivo existente (sem novo import):
  write_file → docker cp → docker start

Arquivo novo ou com novo import:
  rebuild completo da imagem

Script complexo na VPS:
  write_file /tmp/script.js → docker cp → docker exec node /tmp/script.js
  (evitar heredoc para scripts complexos)
```

---

## Arquitetura — Decisões Tomadas

### Auth Model
- `buyer_accounts` foi **eliminado** — era modelo errado
- Usuários da store são `customers` (mesma tabela do ERP)
- `customers` tem: `password_hash`, `portal_active`, `token_id`
- Email é a chave de ligação ERP ↔ store
- Auto-registro e pré-cadastro pelo ERP ambos suportados

### Wallet / Crédito
- Sistema transacional: `credit_limit` / `credit_balance` em `customers`
- Tabela `wallet_transactions` para ledger
- API: `wallet.js` no ERP
- Validação/débito/estorno em `orders.js`

### Sessão / JWT
- Cookie com `Domain=.aurabr.app` causava cross-tenant contamination
- Fix: validar `tenantSlug` do JWT contra `TENANT_SLUG` env var do container

### Next.js / SSR
- Hydration race condition: SSR inicializa estado com `[]`/default
- Guards com flag `isLoaded` necessários antes de agir em cart/auth state

---

## Banco de Dados

```
Hostname:  supabase-db   (NÃO usar IP fixo — muda após restart)
Rede:      supabase_supabase_net
Backups:   /home/helygp/backups/postgres/ (a cada 6h, retenção 7 dias)
```

---

## Recursos / Limites de Container API

```
--memory 384m --memory-swap 384m --cpus 0.75
```

---

## Billing

Pagar.me integrado (código completo) — aguardando API key para ativar.

---

## DNS

- Sempre verificar IP destino antes de criar/atualizar registro GoDaddy
- IP errado (ex: Cloudflare) causa falha silenciosa de roteamento
- Usar `update_dns_record` (não `add`) quando registro já existe

---

## Estilo de Trabalho

- Direcionamento terse ("Tarefa N", "Continuar") — escopo autônomo end-to-end
- Validar em staging antes de produção
- Checar estado existente antes de implementar
- Confirmar zero erros de build antes de declarar tarefa concluída
- Nunca quebrar tenants ativos
