# Aura Platform MCP — Submission para Diretórios de IA

## Informações do servidor MCP

**Nome:** Aura Platform ERP
**Versão:** 1.0.0
**Domínio:** aurabr.app
**País:** Brasil 🇧🇷

---

## MCP Manager — Para gestores de negócio

**URL:** `https://mcp.aurabr.app/manager/{tenant-slug}`
**Descrição:** Gerencie seu ERP B2B via linguagem natural. Consulte KPIs, analise margens, controle estoque, crie pedidos e envie mensagens WhatsApp diretamente pelo assistente de IA.

**Autenticação:** API Key (`x-api-key` header)

**10 tools disponíveis:**
| Tool | Descrição |
|------|-----------|
| `get_dashboard` | KPIs do dia: receita, pedidos, estoque crítico |
| `analyze_margin` | Margem de contribuição por produto ou categoria |
| `list_low_stock` | SKUs abaixo do estoque mínimo |
| `create_order` | Criar pedido manualmente |
| `update_order_status` | Atualizar status de pedido |
| `get_sales_report` | Relatório de vendas por período |
| `list_top_customers` | Melhores clientes por volume |
| `send_whatsapp` | Enviar mensagem WhatsApp para cliente |
| `list_products` | Listar produtos com estoque |
| `get_ai_insights` | Insights gerados por IA |

**Exemplo de uso:**
> "Quais são as margens dos produtos da categoria Roupas?"
> "Envie uma mensagem WhatsApp para a Distribuidora São Paulo dizendo que o pedido foi aprovado"
> "Mostre os KPIs de vendas desta semana"

---

## MCP Store — Para compradores B2B

**URL:** `https://mcp.aurabr.app/store/{tenant-slug}`
**Descrição:** Faça pedidos B2B via assistente de IA. Navegue pelo catálogo, adicione ao carrinho e finalize compras sem sair do chat.

**Autenticação:** Bearer JWT (comprador) ou API Key de integração

**8 tools disponíveis:**
| Tool | Descrição |
|------|-----------|
| `browse_catalog` | Navegar produtos com filtros |
| `check_availability` | Verificar estoque de SKU |
| `create_cart` | Criar carrinho |
| `add_to_cart` | Adicionar produto |
| `get_cart` | Ver carrinho atual |
| `checkout` | Finalizar pedido |
| `get_order_status` | Status do pedido |
| `list_my_orders` | Histórico de pedidos |

---

## MCP Connect — Para desenvolvedores

**URL:** `https://mcp.aurabr.app/connect/{tenant-slug}`
**Descrição:** Integre sua aplicação via IA. Consulte endpoints, valide payloads, registre webhooks e monitore uso da API sem abrir documentação.

**Autenticação:** API Key de desenvolvedor (`scope=connect`)

**8 tools disponíveis:**
| Tool | Descrição |
|------|-----------|
| `list_endpoints` | Listar endpoints da API REST |
| `get_schema` | Schema e curl de um endpoint |
| `validate_payload` | Validar JSON antes de enviar |
| `register_webhook` | Registrar URL para eventos |
| `test_connection` | Testar conectividade |
| `get_usage` | Uso de API e quotas |
| `list_integrations` | Webhooks e API Keys ativas |
| `get_sandbox_data` | Dados de teste prontos |

---

## Transporte e protocolo

- **Protocolo:** MCP Streamable HTTP Transport (2024-11-05)
- **Método:** POST
- **Session management:** `mcp-session-id` header
- **CORS:** Habilitado para todos os origens

## Teste sem conta

```bash
# Verificar disponibilidade (não requer auth)
curl https://mcp.aurabr.app/manager/acme

# Testar com API Key de demonstração
curl -X POST https://mcp.aurabr.app/manager/acme \
  -H "Content-Type: application/json" \
  -H "x-api-key: DEMO_KEY" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}},"id":1}'
```

## Links

- **Landing page:** https://aurabr.app
- **Documentação API:** https://docs.aurabr.app
- **Cadastro trial:** https://aurabr.app/cadastro
- **Suporte:** dev@aurabr.app
