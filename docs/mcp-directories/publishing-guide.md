# Aura Platform — Guia de Publicação nos Diretórios de IA

> Sprint 6, Tarefa 7 — Publicação nos directories Claude, ChatGPT, Copilot e Gemini.
> Custo: zero. Tráfego orgânico de usuários de IA.

---

## 1. Claude (Anthropic MCP Directory)

**URL para submissão:** https://modelcontextprotocol.io/directory
**Tipo:** Streamable HTTP MCP Server
**Status:** ✅ Pronto para submeter

### Dados para preencher:

| Campo | Valor |
|-------|-------|
| Server Name | Aura Platform ERP |
| Description | Brazilian B2B ERP — manage inventory, orders and customers via AI |
| Category | Business / ERP / Commerce |
| URL (Manager) | `https://mcp.aurabr.app/manager/{tenant-slug}` |
| URL (Store) | `https://mcp.aurabr.app/store/{tenant-slug}` |
| URL (Connect) | `https://mcp.aurabr.app/connect/{tenant-slug}` |
| Auth Type | API Key (header: x-api-key) |
| Transport | Streamable HTTP |
| Protocol Version | 2024-11-05 |
| Homepage | https://aurabr.app |
| Docs | https://docs.aurabr.app |
| Contact | dev@aurabr.app |

### Descrição longa (en):
> Aura Platform is the first Brazilian B2B ERP with native MCP support. Connect your Claude assistant to manage inventory, create orders, analyze sales margins, send WhatsApp messages to customers, and get AI-powered business insights — all in natural language.
>
> Perfect for wholesale distributors, manufacturers and B2B retailers who want to manage their business through conversational AI.

### Tags para SEO no diretório:
`erp`, `inventory-management`, `b2b-orders`, `whatsapp`, `brazil`, `wholesale`, `sales-analytics`, `business-intelligence`

### Passo a passo:
1. Acessar https://modelcontextprotocol.io/directory
2. Clicar em "Submit Server"
3. Preencher os dados acima
4. Copiar o conteúdo de `mcp-submission.md` para o campo de descrição
5. Submeter e aguardar aprovação (normalmente 3-7 dias úteis)

---

## 2. ChatGPT (GPT Action / Plugin)

**URL:** https://platform.openai.com/
**Tipo:** Custom GPT com Actions
**Arquivo:** `chatgpt-action.yaml` (neste diretório)
**Status:** ✅ Pronto para criar

### Passo a passo — Criar GPT Público:

1. Acessar https://chat.openai.com/gpts/editor
2. Clicar em **"Create a GPT"**
3. Na aba **Configure**:
   - **Name:** Aura ERP Assistant
   - **Description:** Gerencie seu ERP B2B brasileiro via ChatGPT. Consulte estoque, crie pedidos, analise vendas e muito mais.
   - **Instructions:** (copiar o prompt abaixo)
   - **Conversation starters:** (copiar os exemplos abaixo)

4. Na aba **Actions** → **"Create new action"**:
   - Colar o conteúdo de `chatgpt-action.yaml`
   - Authentication: API Key → Header → `x-api-key`
   - Privacy Policy URL: `https://aurabr.app/privacidade`

5. **Visibilidade:** "Anyone with a link" → depois "Public"
6. Publicar e copiar o link para marketing

### System Prompt para o GPT:
```
Você é o assistente de gestão do ERP Aura Platform.
Seu tenant slug padrão é definido pelo usuário na primeira mensagem.

Fluxo:
1. Na primeira mensagem, chame 'initialize' para iniciar a sessão MCP
2. Salve o 'mcp-session-id' retornado
3. Use 'tools/list' para listar tools disponíveis se necessário
4. Execute as tools conforme solicitado pelo usuário

Sempre:
- Apresente números financeiros em R$ formatado (R$ 1.234,56)
- Use emojis para tornar respostas mais visuais (📦 estoque, 💰 receita, 📊 relatórios)
- Após executar uma ação, confirme o que foi feito
- Se houver erro, explique de forma amigável e sugira alternativas

Responda sempre em português brasileiro.
```

### Conversation Starters:
- "Qual é a situação do estoque hoje?"
- "Mostre os KPIs de vendas desta semana"
- "Quais produtos estão com estoque crítico?"
- "Crie um pedido para o cliente ID cust-1"

---

## 3. Microsoft Copilot (Copilot Plugin / Connector)

**URL:** https://developer.microsoft.com/en-us/microsoft-365/dev-program
**Tipo:** Copilot Plugin (Teams + Microsoft 365)
**Status:** 🔄 Requer conta Microsoft 365 Developer

### Passo a passo:

1. Acessar https://aka.ms/copilot-plugins
2. Criar conta no **Microsoft 365 Developer Program** (gratuito)
3. Acessar **Teams Developer Portal** → https://dev.teams.microsoft.com
4. Criar novo App:
   - App Name: Aura ERP
   - Description: ERP B2B com controle de estoque, pedidos e clientes
   - Developer: Aura Cloud Solutions
5. Adicionar **Copilot Plugin**:
   - Plugin type: API
   - OpenAPI spec URL: `https://api.aurabr.app/openapi.json`
   - Auth: API Key (x-api-key header)
6. Preencher **Plugin Manifest** (ver seção abaixo)
7. Publicar no AppSource → https://appsource.microsoft.com

### Plugin Manifest (teams-app-manifest.json):
```json
{
  "manifestVersion": "1.17",
  "id": "aura-erp-plugin",
  "name": { "short": "Aura ERP", "full": "Aura Platform ERP" },
  "description": {
    "short": "ERP B2B com IA nativa",
    "full": "Gerencie estoque, pedidos e clientes do seu ERP B2B diretamente no Microsoft Copilot"
  },
  "developer": {
    "name": "Aura Cloud Solutions",
    "websiteUrl": "https://aurabr.app",
    "privacyUrl": "https://aurabr.app/privacidade",
    "termsOfUseUrl": "https://aurabr.app/termos"
  },
  "plugins": [{
    "pluginFile": "aura-plugin.json"
  }]
}
```

---

## 4. Google Gemini (Gemini Extensions / Workspace Add-on)

**URL:** https://developers.google.com/workspace/add-ons
**Tipo:** Google Workspace Add-on + Gemini Extension
**Status:** 🔄 Requer Google Cloud Project

### Passo a passo:

1. Criar projeto no **Google Cloud Console** → https://console.cloud.google.com
2. Habilitar **Google Workspace Add-ons API**
3. Criar deployment no **Apps Script**:
   - Acessar https://script.google.com
   - Novo projeto: "Aura ERP for Gemini"
4. Publicar como **Google Workspace Marketplace**:
   - https://workspace.google.com/marketplace/
   - Categoria: Business Tools → ERP
5. Configurar **Gemini Extension** (requer Google One AI Premium):
   - Ver https://developers.google.com/workspace/gemini/extensions
   - Usar o openapi.json como spec da extensão

### Alternativa mais rápida — Gemini App (Gems):
1. Acessar https://gemini.google.com
2. Criar um "Gem" personalizado:
   - Nome: Aura ERP Assistant
   - Instructions: (mesmo prompt do ChatGPT acima, adaptado)
   - Tools: adicionar via URL do openapi.json quando disponível

---

## 5. Meta AI / Llama (Bonus)

**URL:** https://developers.facebook.com/docs/meta-ai
**Status:** Em desenvolvimento — API ainda em beta fechado

---

## Estratégia de SEO nos Diretórios

### Keywords prioritárias:
- `mcp erp estoque` (PT-BR)
- `mcp inventory management brazil`
- `mcp b2b orders portuguese`
- `erp whatsapp integration`
- `mcp wholesale distributor`

### Descrição curta (max 160 chars) para todos os diretórios:
> Brazilian B2B ERP with native MCP support. Manage inventory, orders, customers and WhatsApp via AI. #ERP #B2B #inventory

### Quando publicar:
1. **Imediato:** Claude MCP Directory (mais rápido e mais relevante para o produto)
2. **Esta semana:** ChatGPT GPT Store (maior volume de usuários)
3. **Próximo mês:** Microsoft Copilot (processo mais longo)
4. **Q3 2026:** Google Gemini Extensions (API ainda maturando)

---

## Monitoramento pós-publicação

Criar alertas para:
- Novas instalações via `api_usage` no banco master
- Picos de chamadas MCP (`mcp_usage`)
- Erros 429 (quota) → oportunidade de upsell

Métricas-alvo (30 dias após publicação):
- Claude Directory: 50+ tenants novos via busca orgânica
- ChatGPT GPT Store: 200+ conversas/semana
- Taxa de conversão trial→pago: >15%

---

## Checklist antes de publicar

- [x] `mcp.aurabr.app/manager` respondendo com 401 (auth correta)
- [x] `mcp.aurabr.app/store` respondendo com 401
- [x] `mcp.aurabr.app/connect` respondendo com 401
- [x] `docs.aurabr.app` com Scalar funcionando
- [x] `api.aurabr.app/openapi.json` retornando spec válida
- [x] DNS propagado para todos os subdomínios
- [x] Certificados TLS válidos (via Traefik + Let's Encrypt)
- [x] Rate limiting funcionando (headers X-RateLimit-*)
- [x] Quota por plano funcionando (headers X-MCP-Quota-*)
- [x] Página de cadastro `aurabr.app/cadastro` funcionando
- [ ] Página de privacidade `aurabr.app/privacidade` (criar)
- [ ] Página de termos `aurabr.app/termos` (criar)
- [ ] Email `dev@aurabr.app` configurado no Stalwart
