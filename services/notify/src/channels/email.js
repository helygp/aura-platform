import nodemailer from 'nodemailer'
import { ENV } from '../lib/env.js'

let _transport = null

function transport() {
  if (_transport) return _transport
  _transport = nodemailer.createTransport({
    host:   ENV.SMTP_HOST,
    port:   ENV.SMTP_PORT,
    secure: ENV.SMTP_PORT === 465,
    auth:   { user: ENV.SMTP_USER, pass: ENV.SMTP_PASS },
    tls:    { rejectUnauthorized: ENV.NODE_ENV === 'production' },
  })
  return _transport
}

/**
 * @param {string} to
 * @param {{ subject, title, body }} rendered
 */
export async function sendEmail(to, { subject, title, body }) {
  await transport().sendMail({
    from:    `"${ENV.SMTP_FROM_NAME}" <${ENV.SMTP_FROM}>`,
    to,
    subject,
    text:    body,
    html:    `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><style>
  body{font-family:Inter,sans-serif;background:#f8fafc;margin:0;padding:0}
  .wrap{max-width:560px;margin:40px auto;background:#fff;border-radius:12px;
        border:1px solid #e2e8f0;overflow:hidden}
  .bar{height:4px;background:#0284C7}
  .body{padding:32px}
  h2{margin:0 0 12px;font-size:18px;color:#0f172a}
  p{margin:0;color:#475569;line-height:1.6;font-size:14px}
  .foot{padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;
        font-size:12px;color:#94a3b8;text-align:center}
</style></head>
<body>
  <div class="wrap">
    <div class="bar"></div>
    <div class="body">
      <h2>${title}</h2>
      <p>${body.replace(/\n/g, '<br>')}</p>
    </div>
    <div class="foot">Aura Platform · Esta é uma mensagem automática</div>
  </div>
</body></html>`,
  })
}
