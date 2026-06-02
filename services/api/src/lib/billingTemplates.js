/**
 * templates/index.js
 * Templates de notificação por evento e idioma.
 *
 * render(event, lang, data) → { subject, title, body, html?, whatsapp }
 *
 * Interpolação: {{key}} substituído por data[key]
 *
 * Eventos disponíveis:
 *   ERP / loja:
 *     order.created | inventory.low | daily.summary | mcp.quota_80pct
 *
 *   Onboarding (Sprint 4):
 *     onboarding.welcome
 *
 *   Billing (Sprint 4):
 *     billing.payment_success | billing.payment_failed
 *     billing.trial_ending    | billing.suspended
 */

const TEMPLATES = {

  /* ── ERP / loja ──────────────────────────────────────────────────────────── */

  'order.created': {
    pt: {
      subject:  'Novo pedido #{{orderCode}} recebido',
      title:    'Pedido recebido!',
      body:     'O pedido #{{orderCode}} de {{customerName}} no valor de R${{total}} foi recebido e está em análise.',
      whatsapp: '🛒 *Novo pedido recebido!*\n\nPedido: *#{{orderCode}}*\nCliente: {{customerName}}\nValor: *R${{total}}*\nItens: {{itemCount}}\n\nAcesse o ERP para processar.',
    },
    en: {
      subject:  'New order #{{orderCode}} received',
      title:    'Order received!',
      body:     'Order #{{orderCode}} from {{customerName}} totaling ${{total}} has been received and is under review.',
      whatsapp: '🛒 *New order received!*\n\nOrder: *#{{orderCode}}*\nCustomer: {{customerName}}\nTotal: *${{total}}*\nItems: {{itemCount}}\n\nAccess the ERP to process.',
    },
  },

  'inventory.low': {
    pt: {
      subject:  'Estoque baixo: {{productName}}',
      title:    '⚠️ Estoque crítico',
      body:     'O produto "{{productName}}" (SKU: {{sku}}) está com apenas {{quantity}} unidade(s) em estoque. Mínimo configurado: {{minStock}}.',
      whatsapp: '⚠️ *Estoque crítico!*\n\nProduto: *{{productName}}*\nSKU: {{sku}}\nEstoque atual: *{{quantity}} un.*\nMínimo: {{minStock}} un.\n\nAcesse o ERP para repor.',
    },
    en: {
      subject:  'Low stock alert: {{productName}}',
      title:    '⚠️ Critical stock level',
      body:     'Product "{{productName}}" (SKU: {{sku}}) has only {{quantity}} unit(s) in stock. Configured minimum: {{minStock}}.',
      whatsapp: '⚠️ *Low stock alert!*\n\nProduct: *{{productName}}*\nSKU: {{sku}}\nCurrent stock: *{{quantity}} units*\nMinimum: {{minStock}} units\n\nAccess the ERP to reorder.',
    },
  },

  'daily.summary': {
    pt: {
      subject:  'Resumo do dia — {{date}}',
      title:    '📊 Resumo diário',
      body:     'Resumo de {{date}}: {{ordersCount}} pedidos (R${{revenueTotal}}), {{newCustomers}} novos clientes, {{lowStockCount}} produtos com estoque baixo.',
      whatsapp: '📊 *Resumo do dia — {{date}}*\n\n📦 Pedidos: *{{ordersCount}}* (R${{revenueTotal}})\n👤 Novos clientes: {{newCustomers}}\n⚠️ Estoque baixo: {{lowStockCount}} produtos\n\nBom trabalho! 🚀',
    },
    en: {
      subject:  'Daily summary — {{date}}',
      title:    '📊 Daily summary',
      body:     'Summary for {{date}}: {{ordersCount}} orders (${{revenueTotal}}), {{newCustomers}} new customers, {{lowStockCount}} products with low stock.',
      whatsapp: '📊 *Daily summary — {{date}}*\n\n📦 Orders: *{{ordersCount}}* (${{revenueTotal}})\n👤 New customers: {{newCustomers}}\n⚠️ Low stock: {{lowStockCount}} products\n\nGreat work! 🚀',
    },
  },

  'mcp.quota_80pct': {
    pt: {
      subject:  'Atenção: 80% da cota MCP utilizada',
      title:    '🔶 Cota MCP em 80%',
      body:     'Seu plano {{plan}} utilizou {{used}} de {{limit}} chamadas MCP este mês ({{pct}}%). Considere fazer upgrade para evitar interrupções.',
      whatsapp: '🔶 *Alerta de cota MCP!*\n\nPlano: {{plan}}\nUtilizado: *{{used}}/{{limit}}* ({{pct}}%)\nReset em: {{resetDate}}\n\nPara fazer upgrade, acesse Configurações > Plano.',
    },
    en: {
      subject:  'Warning: 80% of MCP quota used',
      title:    '🔶 MCP quota at 80%',
      body:     'Your {{plan}} plan has used {{used}} of {{limit}} MCP calls this month ({{pct}}%). Consider upgrading to avoid disruptions.',
      whatsapp: '🔶 *MCP quota alert!*\n\nPlan: {{plan}}\nUsed: *{{used}}/{{limit}}* ({{pct}}%)\nResets on: {{resetDate}}\n\nTo upgrade, go to Settings > Plan.',
    },
  },

  /* ── Onboarding (Sprint 4) ───────────────────────────────────────────────── */

  /**
   * Dados esperados:
   *   adminName, companyName, slug, planName,
   *   erpUrl, storeUrl, adminEmail, tempPassword,
   *   trialDays (default 14)
   */
  'onboarding.welcome': {
    pt: {
      subject: '🚀 Bem-vindo à Aura Platform, {{companyName}}!',
      title:   'Sua conta está pronta!',
      body: `Olá, {{adminName}}!

Sua empresa {{companyName}} foi provisionada com sucesso na Aura Platform.

📋 SEUS ACESSOS
─────────────────────────────────
ERP (gestão interna):
  {{erpUrl}}

Loja B2B (seus clientes acessam):
  {{storeUrl}}

CREDENCIAIS INICIAIS
─────────────────────────────────
  E-mail:   {{adminEmail}}
  Senha:    {{tempPassword}}

⚠️  Altere sua senha no primeiro acesso.

📦 PLANO CONTRATADO: {{planName}}
Trial: {{trialDays}} dias sem cobrança.

PRÓXIMOS PASSOS
─────────────────────────────────
1. Acesse o ERP e troque sua senha
2. Configure o tema da sua loja (Configurações > Aparência)
3. Cadastre seus produtos
4. Compartilhe o link da loja com seus clientes

Qualquer dúvida, responda este e-mail.

Boas vendas! 🚀
Equipe Aura`,
      whatsapp: `🚀 *Bem-vindo à Aura Platform!*\n\nOlá, {{adminName}}! Sua conta *{{companyName}}* está pronta.\n\n🖥️ *ERP:* {{erpUrl}}\n🛒 *Loja B2B:* {{storeUrl}}\n\n📧 Login: {{adminEmail}}\n🔑 Senha temp: {{tempPassword}}\n\n⚠️ Troque sua senha no primeiro acesso.\n\nQualquer dúvida, fale conosco! 👋`,
    },
    en: {
      subject: '🚀 Welcome to Aura Platform, {{companyName}}!',
      title:   'Your account is ready!',
      body: `Hi {{adminName}},

Your company {{companyName}} has been successfully provisioned on Aura Platform.

📋 YOUR ACCESS LINKS
─────────────────────────────────
ERP (internal management):
  {{erpUrl}}

B2B Store (your customers access):
  {{storeUrl}}

INITIAL CREDENTIALS
─────────────────────────────────
  Email:    {{adminEmail}}
  Password: {{tempPassword}}

⚠️  Please change your password on first login.

📦 PLAN: {{planName}}
Trial: {{trialDays}} days free.

NEXT STEPS
─────────────────────────────────
1. Log in to the ERP and change your password
2. Configure your store theme (Settings > Appearance)
3. Add your products
4. Share your store link with customers

Reply to this email for any questions.

Happy selling! 🚀
Aura Team`,
      whatsapp: `🚀 *Welcome to Aura Platform!*\n\nHi {{adminName}}! Your *{{companyName}}* account is ready.\n\n🖥️ *ERP:* {{erpUrl}}\n🛒 *B2B Store:* {{storeUrl}}\n\n📧 Login: {{adminEmail}}\n🔑 Temp password: {{tempPassword}}\n\n⚠️ Change your password on first login.\n\nAny questions? Just ask! 👋`,
    },
  },

  /* ── Billing (Sprint 4) ──────────────────────────────────────────────────── */

  /**
   * Dados esperados:
   *   adminName, companyName, planName,
   *   amount, period, invoiceRef?
   */
  'billing.payment_success': {
    pt: {
      subject: '✅ Cobrança aprovada — {{period}}',
      title:   '✅ Pagamento confirmado',
      body:    'Olá, {{adminName}}! O pagamento de R${{amount}} referente ao período {{period}} do plano {{planName}} foi aprovado com sucesso. Ref: {{invoiceRef}}.',
      whatsapp: '✅ *Pagamento confirmado!*\n\nOlá, {{adminName}}!\nValor: *R${{amount}}*\nPeríodo: {{period}}\nPlano: {{planName}}\n\nObrigado pela confiança! 🙏',
    },
    en: {
      subject: '✅ Payment confirmed — {{period}}',
      title:   '✅ Payment confirmed',
      body:    'Hi {{adminName}}! Your payment of ${{amount}} for the {{period}} period on the {{planName}} plan was successfully confirmed. Ref: {{invoiceRef}}.',
      whatsapp: '✅ *Payment confirmed!*\n\nHi {{adminName}}!\nAmount: *${{amount}}*\nPeriod: {{period}}\nPlan: {{planName}}\n\nThank you! 🙏',
    },
  },

  /**
   * Dados esperados:
   *   adminName, companyName, planName,
   *   amount, period, failureCount, maxFailures,
   *   updateCardUrl?
   */
  'billing.payment_failed': {
    pt: {
      subject: '⚠️ Falha no pagamento — ação necessária',
      title:   '⚠️ Pagamento não processado',
      body:    'Olá, {{adminName}}, não conseguimos processar o pagamento de R${{amount}} ({{period}}) do plano {{planName}}. Tentativa {{failureCount}} de {{maxFailures}}. Atualize seu método de pagamento para evitar a suspensão da conta.',
      whatsapp: '⚠️ *Falha no pagamento!*\n\nOlá, {{adminName}}!\nNão conseguimos cobrar *R${{amount}}* ({{period}}).\nTentativa {{failureCount}} de {{maxFailures}}.\n\nAtualize seu pagamento para não ter a conta suspensa.',
    },
    en: {
      subject: '⚠️ Payment failed — action required',
      title:   '⚠️ Payment not processed',
      body:    'Hi {{adminName}}, we could not process your payment of ${{amount}} ({{period}}) for the {{planName}} plan. Attempt {{failureCount}} of {{maxFailures}}. Please update your payment method to avoid account suspension.',
      whatsapp: '⚠️ *Payment failed!*\n\nHi {{adminName}}!\nWe could not charge *${{amount}}* ({{period}}).\nAttempt {{failureCount}} of {{maxFailures}}.\n\nPlease update your payment to avoid suspension.',
    },
  },

  /**
   * Dados esperados:
   *   adminName, companyName, planName,
   *   trialEndsAt (data formatada), priceMonthly
   */
  'billing.trial_ending': {
    pt: {
      subject: '⏰ Seu trial termina em 3 dias',
      title:   '⏰ Trial encerrando em breve',
      body:    'Olá, {{adminName}}! Seu período de trial da Aura Platform termina em {{trialEndsAt}}. A partir daí, o plano {{planName}} será cobrado R${{priceMonthly}}/mês. Você não precisa fazer nada — a cobrança ocorre automaticamente.',
      whatsapp: '⏰ *Trial encerrando!*\n\nOlá, {{adminName}}!\nSeu trial termina em *{{trialEndsAt}}*.\n\nApós isso: *R${{priceMonthly}}/mês* ({{planName}}).\nA cobrança é automática. Nenhuma ação necessária.',
    },
    en: {
      subject: '⏰ Your trial ends in 3 days',
      title:   '⏰ Trial ending soon',
      body:    'Hi {{adminName}}! Your Aura Platform trial ends on {{trialEndsAt}}. After that, the {{planName}} plan will be charged ${{priceMonthly}}/month automatically.',
      whatsapp: '⏰ *Trial ending soon!*\n\nHi {{adminName}}!\nYour trial ends on *{{trialEndsAt}}*.\n\nAfter that: *${{priceMonthly}}/month* ({{planName}}).\nBilling is automatic — no action needed.',
    },
  },

  /**
   * Dados esperados:
   *   adminName, companyName, failureCount,
   *   supportEmail (default suporte@aurabr.app)
   */
  'billing.suspended': {
    pt: {
      subject: '🔴 Conta suspensa por inadimplência',
      title:   '🔴 Conta suspensa',
      body:    'Olá, {{adminName}}. A conta {{companyName}} foi suspensa após {{failureCount}} tentativas de cobrança sem sucesso. Para reativar, regularize o pagamento e entre em contato com {{supportEmail}}.',
      whatsapp: '🔴 *Conta suspensa!*\n\nOlá, {{adminName}}.\nA conta *{{companyName}}* foi suspensa após {{failureCount}} falhas de pagamento.\n\nPara reativar, entre em contato:\n📧 {{supportEmail}}',
    },
    en: {
      subject: '🔴 Account suspended due to non-payment',
      title:   '🔴 Account suspended',
      body:    'Hi {{adminName}}. The {{companyName}} account has been suspended after {{failureCount}} failed payment attempts. To reactivate, please settle the payment and contact {{supportEmail}}.',
      whatsapp: '🔴 *Account suspended!*\n\nHi {{adminName}}.\n*{{companyName}}* was suspended after {{failureCount}} failed payments.\n\nTo reactivate, contact:\n📧 {{supportEmail}}',
    },
  },

  /* ── Mudança de plano ─────────────────────────────────── */
  'plan.upgraded': {
    pt: {
      subject:  '🚀 Plano atualizado — {{companyName}}',
      title:    'Upgrade realizado com sucesso!',
      body:     'Olá, {{adminName}}!\n\nSeu plano foi atualizado de {{oldPlan}} para {{newPlan}}.\n\nNovos limites: {{maxUsers}} usuários e {{maxProducts}} produtos. Os recursos já estão disponíveis.',
      whatsapp: '🚀 *{{companyName}}* — upgrade para *{{newPlan}}*! Novos limites já ativos.',
    },
    en: {
      subject:  '🚀 Plan upgraded — {{companyName}}',
      title:    'Upgrade successful!',
      body:     'Hi {{adminName}},\n\nYour plan was upgraded from {{oldPlan}} to {{newPlan}}.\n\nNew limits: {{maxUsers}} users and {{maxProducts}} products.',
      whatsapp: '🚀 *{{companyName}}* — upgraded to *{{newPlan}}*! New limits are active.',
    },
  },
  'plan.downgraded': {
    pt: {
      subject:  'ℹ️ Plano alterado — {{companyName}}',
      title:    'Plano alterado para {{newPlan}}',
      body:     'Olá, {{adminName}}!\n\nSeu plano foi alterado de {{oldPlan}} para {{newPlan}} ({{newPrice}}/mês).\n\nNovos limites: {{maxUsers}} usuários e {{maxProducts}} produtos.',
      whatsapp: 'ℹ️ *{{companyName}}* — plano alterado para *{{newPlan}}* ({{newPrice}}/mês).',
    },
    en: {
      subject:  'ℹ️ Plan changed — {{companyName}}',
      title:    'Plan changed to {{newPlan}}',
      body:     'Hi {{adminName}},\n\nYour plan was changed from {{oldPlan}} to {{newPlan}} ({{newPrice}}/month).\n\nNew limits: {{maxUsers}} users and {{maxProducts}} products.',
      whatsapp: 'ℹ️ *{{companyName}}* — plan changed to *{{newPlan}}* ({{newPrice}}/month).',
    },
  },
}

/* ─── Interpolação ───────────────────────────────────────── */

function interpolate(str, data) {
  if (!str || !data) return str ?? ''
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? `{{${key}}}`)
}

/* ─── API pública ────────────────────────────────────────── */

export function render(event, lang, data) {
  const tmpl = TEMPLATES[event]
  if (!tmpl) throw new Error(`Template não encontrado para evento: ${event}`)

  const t = tmpl[lang] ?? tmpl['pt']  // fallback para PT

  return {
    subject:  interpolate(t.subject,  data),
    title:    interpolate(t.title,    data),
    body:     interpolate(t.body,     data),
    whatsapp: interpolate(t.whatsapp, data),
  }
}

export const KNOWN_EVENTS = Object.keys(TEMPLATES)
