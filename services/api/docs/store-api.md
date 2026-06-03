# API Bridge — ERP ↔ Loja B2B

> Sprint 3 — Tarefa 10  
> Base URL: `https://api.aurabr.app`  
> Todos os endpoints `/store/*` requerem o header `X-Tenant-Slug: <slug>`.

---

## Autenticação

Compradores usam cookies httpOnly **separados** do ERP:
- `store_access` — JWT 2h
- `store_refresh` — JWT 30d

ERP usa `aura_access` / `aura_refresh` — nunca se misturam.

---

## Tenant

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/store/tenant/theme` | — | Tema e configurações da loja |

**Cache:** `public, max-age=60, stale-while-revalidate=30`

---

## Catálogo

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/store/catalog` | — | Listagem com filtros e paginação cursor |
| GET | `/store/catalog/featured` | — | Produtos em destaque (home) |
| GET | `/store/catalog/categories` | — | Categorias disponíveis |
| GET | `/store/catalog/:slug` | — | Detalhe do produto com SKUs |
| GET | `/store/catalog/sku-stock/:token` | — | Estoque em tempo real |

**Query params do GET /store/catalog:**
`search`, `category`, `attributes` (JSON), `sort` (relevance/price_asc/price_desc/name_asc), `cursor`, `limit` (padrão 24, máx 100)

**Segurança:** `sku.id` é `sha256(internal_id)` — nunca o ID do banco.

---

## Pedidos

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/store/orders` | Opcional | Cria pedido B2B |
| GET | `/store/orders` | Comprador | Histórico |
| GET | `/store/orders/:ref` | — | Status por token opaco |
| PATCH | `/store/orders/:ref/cancel` | — | Cancela se aguardando |

**Ref format:** `ord_[0-9a-f]{16}`  
**Status:** `aguardando_confirmacao` → `confirmado` → `em_separacao` → `enviado` → `entregue` | `cancelado`

---

## Auth do Comprador

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/store/auth/register` | Cadastro |
| POST | `/store/auth/login` | Login → seta cookies |
| POST | `/store/auth/logout` | Limpa cookies |
| GET | `/store/auth/me` | Dados da sessão |
| POST | `/store/auth/refresh` | Renova access token |

---

## Rate Limits

| Rota | Limite | Janela | Key |
|------|--------|--------|-----|
| `/store/catalog/*` | 300 | 1 min | IP+tenant |
| `POST /store/orders` | 10 | 1 min | IP+tenant |
| `/store/auth/login` | 15 | 15 min | IP+tenant |
| Global | 120 | 1 min | IP |

---

## Segurança — Garantias

| Garantia | Implementação |
|----------|---------------|
| IDs internos nunca expostos | SKUs: `sha256(id)` · Pedidos: `ord_<random_bytes>` |
| Tenant isolation | `storeTenantMiddleware` — valida tenant ativo em toda rota `/store/*`, cache 60s |
| Auth separada ERP/loja | Cookies diferentes, JWT secrets diferentes, tabela diferente |
| Estoque atômico | Transação + `FOR UPDATE` no cancelamento |
| CORS da loja | Apenas `loja.*.aurabr.app` em produção |

---

## Variáveis de Ambiente

```bash
BUYER_JWT_SECRET=<64 bytes hex>   # obrigatório em produção
TENANT_DB_URL=postgresql://...    # banco do tenant
JWT_SECRET=...                    # ERP (já existia)
JWT_REFRESH_SECRET=...            # ERP (já existia)
CORS_ORIGINS=https://app.aurabr.app
```
