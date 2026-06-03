/**
 * lib/welcomeEmail.js
 *
 * Dispara o e-mail de boas-vindas (onboarding.welcome) para o admin
 * de um tenant recém-provisionado.
 *
 * Chamado pelo POST /master/tenants após o provisionamento.
 * Execução assíncrona — erros não bloqueiam a resposta da API.
 */

import { sendMail } from './mailer.js'

const DOMAIN    = process.env.AURA_DOMAIN      ?? 'aurabr.app'
const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS ?? '14', 10)

/**
 * @param {object} params
 * @param {string} params.adminName
 * @param {string} params.adminEmail
 * @param {string} params.adminPassword  — senha temporária
 * @param {string} params.companyName
 * @param {string} params.slug
 * @param {string} params.planName
 * @param {string} [params.lang]         — 'pt' (default) | 'en'
 */
export async function sendWelcomeEmail({
  adminName,
  adminEmail,
  adminPassword,
  companyName,
  slug,
  planName,
  lang = 'pt',
}) {
  const erpUrl   = `https://${slug}.${DOMAIN}`
  const storeUrl = `https://loja.${slug}.${DOMAIN}`

  const data = {
    adminName,
    adminEmail,
    tempPassword: adminPassword,
    companyName,
    slug,
    planName,
    erpUrl,
    storeUrl,
    trialDays: TRIAL_DAYS,
  }

  const rendered = renderWelcome(lang, data)

  await sendMail(adminEmail, rendered)
  console.log(`[welcomeEmail] Boas-vindas enviado para ${adminEmail} | tenant: ${slug}`)
}

/* ── Template embutido (não depende do serviço notify) ────── */

function interpolate(str, data) {
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => data[k] ?? `{{${k}}}`)
}

const WELCOME = {
  pt: {
    subject: '🚀 Bem-vindo à Aura Platform, {{companyName}}!',
    title:   'Sua conta está pronta!',
    body: `Olá, {{adminName}}!

Sua empresa {{companyName}} foi provisionada com sucesso na Aura Platform.

SEUS ACESSOS
────────────────────────────────
ERP (gestão interna):
  {{erpUrl}}

Loja B2B (seus clientes):
  {{storeUrl}}

CREDENCIAIS INICIAIS
────────────────────────────────
  E-mail: {{adminEmail}}
  Senha:  {{tempPassword}}

⚠️  Altere sua senha no primeiro acesso.

PLANO: {{planName}}
Trial: {{trialDays}} dias sem cobrança.

PRÓXIMOS PASSOS
────────────────────────────────
1. Acesse o ERP e troque sua senha
2. Configure o tema da loja (Configurações > Aparência)
3. Cadastre seus produtos
4. Compartilhe o link da loja com seus clientes

Dúvidas? Responda este e-mail.
Boas vendas! 🚀 — Equipe Aura`,
  },
  en: {
    subject: '🚀 Welcome to Aura Platform, {{companyName}}!',
    title:   'Your account is ready!',
    body: `Hi {{adminName}},

Your company {{companyName}} has been successfully provisioned on Aura Platform.

YOUR ACCESS LINKS
────────────────────────────────
ERP (internal management):
  {{erpUrl}}

B2B Store (your customers):
  {{storeUrl}}

INITIAL CREDENTIALS
────────────────────────────────
  Email:    {{adminEmail}}
  Password: {{tempPassword}}

⚠️  Please change your password on first login.

PLAN: {{planName}}
Trial: {{trialDays}} days free.

NEXT STEPS
────────────────────────────────
1. Log in to the ERP and change your password
2. Configure your store theme (Settings > Appearance)
3. Add your products
4. Share your store link with customers

Questions? Reply to this email.
Happy selling! 🚀 — Aura Team`,
  },
}

function renderWelcome(lang, data) {
  const t = WELCOME[lang] ?? WELCOME.pt
  return {
    subject: interpolate(t.subject, data),
    title:   interpolate(t.title,   data),
    body:    interpolate(t.body,    data),
  }
}
