/**
 * lib/mailer.js
 *
 * Envio de email transacional via SMTP (Stalwart ou qualquer relay).
 * Fail-gracioso: se SMTP não estiver configurado, loga o email no console.
 *
 * Env vars:
 *   SMTP_HOST        — hostname do servidor SMTP (default: stalwart-mail)
 *   SMTP_PORT        — porta (default: 587)
 *   SMTP_USER        — usuário SMTP
 *   SMTP_PASS        — senha SMTP
 *   SMTP_FROM        — remetente (default: noreply@aurabr.app)
 *   SMTP_FROM_NAME   — nome do remetente (default: Aura Platform)
 *   SMTP_SECURE      — 'true' para SSL na porta 465
 */

import nodemailer from 'nodemailer'

let _transport = null

function getTransport() {
  if (_transport) return _transport

  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) return null  // SMTP não configurado

  const port   = parseInt(process.env.SMTP_PORT ?? '587', 10)
  const secure = process.env.SMTP_SECURE === 'true' || port === 465

  _transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls:  { rejectUnauthorized: false } // Stalwart usa cert auto-assinado internamente,
  })

  return _transport
}

/**
 * Envia email transacional.
 * Se SMTP não estiver configurado, loga no console e retorna { skipped: true }.
 *
 * @param {string}   to
 * @param {object}   opts
 * @param {string}   opts.subject
 * @param {string}   opts.text      — texto plano
 * @param {string}   [opts.html]    — HTML (opcional)
 */
export async function sendEmail(to, { subject, text, html }) {
  const transport = getTransport()
  const from = `"${process.env.SMTP_FROM_NAME ?? 'Aura Platform'}" <${process.env.SMTP_FROM ?? 'noreply@aurabr.app'}>`

  if (!transport) {
    console.warn('[mailer] SMTP não configurado — email não enviado.')
    console.info('[mailer] ---- EMAIL (console fallback) ----')
    console.info(`[mailer] Para: ${to}`)
    console.info(`[mailer] Assunto: ${subject}`)
    console.info(`[mailer] Body:\n${text}`)
    console.info('[mailer] ------------------------------------------')
    return { skipped: true, reason: 'SMTP não configurado' }
  }

  try {
    const info = await transport.sendMail({ from, to, subject, text, html })
    console.log(`[mailer] ✓ Email enviado para ${to} | msgId: ${info.messageId}`)
    return { sent: true, messageId: info.messageId }
  } catch (err) {
    console.error(`[mailer] ✗ Falha ao enviar para ${to}:`, err.message)
    // Não relança — email nunca deve bloquear o onboarding
    return { sent: false, error: err.message }
  }
}

/**
 * Renderiza e envia o email de boas-vindas do onboarding.
 *
 * @param {object} data
 *   adminName, adminEmail, companyName, slug, planName,
 *   erpUrl, storeUrl, tempPassword, trialDays
 */
export async function sendWelcomeEmail(data) {
  const {
    adminName, adminEmail, companyName, slug,
    planName, erpUrl, storeUrl, tempPassword,
    trialDays = parseInt(process.env.TRIAL_DAYS ?? '14', 10),
  } = data

  const subject = `🚀 Bem-vindo à Aura Platform, ${companyName}!`

  const text = `Olá, ${adminName}!

Sua empresa ${companyName} foi provisionada com sucesso na Aura Platform.

📋 SEUS ACESSOS
─────────────────────────────────
ERP (gestão interna):
  ${erpUrl}

Loja B2B (seus clientes acessam):
  ${storeUrl}

CREDENCIAIS INICIAIS
─────────────────────────────────
  E-mail:   ${adminEmail}
  Senha:    ${tempPassword}

⚠️  Altere sua senha no primeiro acesso.

📦 PLANO CONTRATADO: ${planName}
Trial: ${trialDays} dias sem cobrança.

PRÓXIMOS PASSOS
─────────────────────────────────
1. Acesse o ERP e troque sua senha
2. Configure o tema da sua loja (Configurações > Aparência)
3. Cadastre seus produtos
4. Compartilhe o link da loja com seus clientes

Qualquer dúvida, responda este e-mail.

Boas vendas! 🚀
Equipe Aura`

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font-family: Inter, -apple-system, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
  .wrap { max-width: 580px; margin: 40px auto; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
  .bar  { height: 4px; background: linear-gradient(90deg, #0284C7, #0EA5E9); }
  .head { padding: 32px 32px 0; }
  .logo { font-size: 20px; font-weight: 700; color: #0284C7; letter-spacing: -0.5px; }
  .body { padding: 24px 32px 32px; }
  h1    { margin: 0 0 8px; font-size: 22px; color: #0f172a; font-weight: 700; }
  .sub  { margin: 0 0 24px; color: #64748b; font-size: 14px; }
  .card { background: #f1f5f9; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
  .card-title { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 10px; }
  .row  { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #e2e8f0; }
  .row:last-child { border-bottom: none; }
  .row-label { font-size: 13px; color: #64748b; }
  .row-value { font-size: 13px; color: #0f172a; font-weight: 500; }
  .btn  { display: inline-block; background: #0284C7; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; margin: 8px 8px 0 0; }
  .btn-sec { background: #f1f5f9; color: #0f172a; }
  .warn { background: #fef9c3; border: 1px solid #fde047; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #713f12; margin: 20px 0; }
  .steps { margin: 20px 0; }
  .step { display: flex; gap: 12px; margin-bottom: 12px; align-items: flex-start; }
  .step-n { width: 22px; height: 22px; border-radius: 50%; background: #0284C7; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .step-t { font-size: 13px; color: #475569; line-height: 1.5; }
  .foot { padding: 16px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
<div class="wrap">
  <div class="bar"></div>
  <div class="head"><div class="logo">Aura Platform</div></div>
  <div class="body">
    <h1>🚀 Sua conta está pronta, ${adminName}!</h1>
    <p class="sub">A empresa <strong>${companyName}</strong> foi provisionada com sucesso. Veja abaixo tudo o que você precisa para começar.</p>

    <div class="card">
      <div class="card-title">Seus acessos</div>
      <div class="row">
        <span class="row-label">ERP (gestão interna)</span>
        <a href="${erpUrl}" class="row-value">${erpUrl.replace('https://', '')}</a>
      </div>
      <div class="row">
        <span class="row-label">Loja B2B</span>
        <a href="${storeUrl}" class="row-value">${storeUrl.replace('https://', '')}</a>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Credenciais iniciais</div>
      <div class="row">
        <span class="row-label">E-mail</span>
        <span class="row-value">${adminEmail}</span>
      </div>
      <div class="row">
        <span class="row-label">Senha temporária</span>
        <span class="row-value" style="font-family:monospace;background:#e2e8f0;padding:2px 6px;border-radius:4px">${tempPassword}</span>
      </div>
      <div class="row">
        <span class="row-label">Plano</span>
        <span class="row-value">${planName}</span>
      </div>
    </div>

    <div class="warn">⚠️ <strong>Altere sua senha no primeiro acesso</strong> — a senha temporária expira em 7 dias.</div>

    <a href="${erpUrl}" class="btn">Acessar o ERP</a>
    <a href="${storeUrl}" class="btn btn-sec">Ver minha loja</a>

    <p style="margin:24px 0 8px;font-size:13px;font-weight:600;color:#0f172a;">Próximos passos</p>
    <div class="steps">
      <div class="step"><div class="step-n">1</div><div class="step-t">Acesse o ERP e troque sua senha em <strong>Perfil > Alterar senha</strong></div></div>
      <div class="step"><div class="step-n">2</div><div class="step-t">Configure o tema da sua loja em <strong>Configurações > Aparência</strong></div></div>
      <div class="step"><div class="step-n">3</div><div class="step-t">Cadastre seus produtos e categorias</div></div>
      <div class="step"><div class="step-n">4</div><div class="step-t">Compartilhe o link da loja com seus clientes: <strong>${storeUrl}</strong></div></div>
    </div>

    <p style="margin:24px 0 0;font-size:13px;color:#64748b;">Trial de <strong>${trialDays} dias</strong> sem cobrança. Qualquer dúvida, responda este e-mail.<br><br>Boas vendas! 🚀<br><strong>Equipe Aura</strong></p>
  </div>
  <div class="foot">Aura Platform · aurabr.app · Esta é uma mensagem automática</div>
</div>
</body>
</html>`

  return sendEmail(adminEmail, { subject, text, html })
}
// Appended to mailer.js
/**
 * Envia email de redefinição de senha.
 *
 * @param {object} opts
 * @param {string} opts.to                 e-mail destinatário
 * @param {string} opts.name               nome do usuário
 * @param {string} opts.resetUrl           URL completa com token
 * @param {number} opts.expiresInMinutes   tempo de expiração em minutos (default 60)
 */
export async function sendPasswordResetEmail({ to, name, resetUrl, expiresInMinutes = 60 }) {
  const subject = '🔑 Redefinir sua senha — Aura Platform'

  const text = `Olá, ${name}!

Recebemos uma solicitação para redefinir sua senha na Aura Platform.

Clique no link abaixo para criar uma nova senha:
${resetUrl}

⏰  Este link expira em ${expiresInMinutes} minutos e só pode ser usado uma vez.

Se você não solicitou esta redefinição, ignore este e-mail — sua senha permanecerá a mesma.

Equipe Aura`

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font-family: Inter, -apple-system, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
  .wrap { max-width: 540px; margin: 40px auto; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
  .bar  { height: 4px; background: linear-gradient(90deg, #0284C7, #0EA5E9); }
  .head { padding: 32px 32px 0; }
  .logo { font-size: 20px; font-weight: 700; color: #0284C7; letter-spacing: -0.5px; }
  .body { padding: 24px 32px 32px; }
  h1    { margin: 0 0 8px; font-size: 22px; color: #0f172a; font-weight: 700; }
  .sub  { margin: 0 0 24px; color: #64748b; font-size: 14px; line-height: 1.6; }
  .btn  { display: inline-block; background: #0284C7; color: #fff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; }
  .alt  { margin: 20px 0 0; font-size: 12px; color: #64748b; word-break: break-all; }
  .alt code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 11px; }
  .warn { background: #fef9c3; border: 1px solid #fde047; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #713f12; margin: 20px 0; }
  .foot { padding: 16px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
<div class="wrap">
  <div class="bar"></div>
  <div class="head"><div class="logo">Aura Platform</div></div>
  <div class="body">
    <h1>🔑 Redefinir sua senha</h1>
    <p class="sub">Olá, <strong>${name}</strong>!<br>Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha.</p>

    <a href="${resetUrl}" class="btn">Redefinir minha senha</a>

    <p class="alt">Ou copie e cole este link no navegador:<br><code>${resetUrl}</code></p>

    <div class="warn">⏰  Este link expira em <strong>${expiresInMinutes} minutos</strong> e só pode ser usado uma vez.</div>

    <p style="margin:24px 0 0;font-size:13px;color:#64748b;line-height:1.6;">
      <strong>Não solicitou esta redefinição?</strong><br>
      Pode ignorar este e-mail com tranquilidade — sua senha permanecerá a mesma.
    </p>
  </div>
  <div class="foot">Aura Platform · aurabr.app · Mensagem automática</div>
</div>
</body>
</html>`

  return sendEmail(to, { subject, text, html })
}
