/**
 * channels/whatsapp.js
 * Envia mensagem via instância WAHA do tenant.
 * Se waha_session (apiKey) não estiver provisionado, retorna sem erro.
 */

/**
 * @param {object} tenant  — { slug, waha_session, theme_config }
 * @param {string} phone   — número com DDI, ex: '5541999990000'
 * @param {string} text    — mensagem renderizada
 */
export async function sendWhatsApp(tenant, phone, text) {
  const apiKey = tenant?.waha_session
  if (!apiKey) return { skipped: true, reason: 'waha_not_provisioned' }

  // URL da instância: waha-[slug].srv885928.hstgr.cloud
  const wahaUrl = tenant?.theme_config?.wahaUrl
    ?? `https://waha-${tenant.slug}.srv885928.hstgr.cloud`

  // Normaliza número: remove tudo que não é dígito, garante @c.us
  const chatId = phone.replace(/\D/g, '') + '@c.us'

  const res = await fetch(`${wahaUrl}/api/sendText`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key':    apiKey,
    },
    body: JSON.stringify({
      session: 'default',
      chatId,
      text,
    }),
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.status)
    throw new Error(`WAHA error ${res.status}: ${err}`)
  }

  return { sent: true }
}
