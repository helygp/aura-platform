/**
 * queue/processor.js
 * Processa um job: renderiza template + despacha para todos os canais.
 *
 * recipient: {
 *   email?:     string   — endereço de e-mail
 *   phone?:     string   — WhatsApp (DDI+número, ex: 5541999990000)
 *   userToken?: string   — token_id do usuário (para in-app)
 *   lang?:      'pt'|'en'
 * }
 *
 * Falha em qualquer canal individual não cancela os outros.
 * O job só é considerado falho se TODOS os canais falharem.
 */

import { render }       from '../templates/index.js'
import { sendEmail }    from '../channels/email.js'
import { sendWhatsApp } from '../channels/whatsapp.js'
import { sendInApp }    from '../channels/inapp.js'
import { getTenant }    from '../lib/db.js'

export async function processJob(job) {
  const { tenantId, event, recipient, data } = job
  const lang     = recipient.lang ?? 'pt'

  // 1. Renderiza o template
  const rendered = render(event, lang, data)

  // 2. Busca tenant (waha_session, db_name, etc.)
  const tenant = await getTenant(tenantId)
  if (!tenant) throw new Error(`Tenant '${tenantId}' não encontrado`)

  const results  = {}
  const failures = []

  // 3. Canal in-app (sempre — se userToken e db_name disponíveis)
  if (recipient.userToken && tenant.db_name) {
    try {
      results.inapp = await sendInApp(
        tenant.db_name,
        recipient.userToken,
        event,
        rendered,
        data
      )
    } catch (err) {
      failures.push({ channel: 'inapp', error: err.message })
      console.error(`[notify:inapp] ${job.id}:`, err.message)
    }
  }

  // 4. Canal email (fallback obrigatório — sempre tenta se houver email)
  if (recipient.email) {
    try {
      results.email = await sendEmail(recipient.email, rendered)
      results.email = { sent: true }
    } catch (err) {
      failures.push({ channel: 'email', error: err.message })
      console.error(`[notify:email] ${job.id}:`, err.message)
    }
  }

  // 5. Canal WhatsApp (opcional — só se houver phone e waha_session)
  if (recipient.phone) {
    try {
      results.whatsapp = await sendWhatsApp(tenant, recipient.phone, rendered.whatsapp)
    } catch (err) {
      failures.push({ channel: 'whatsapp', error: err.message })
      console.error(`[notify:whatsapp] ${job.id}:`, err.message)
    }
  }

  // Falha total: nenhum canal funcionou (todos falharam ou nenhum configurado)
  const activeChannels = [
    recipient.email,
    recipient.phone,
    recipient.userToken && tenant.db_name,
  ].filter(Boolean).length

  if (activeChannels > 0 && failures.length === activeChannels) {
    throw new Error(
      `Todos os canais falharam: ${failures.map(f => `${f.channel}(${f.error})`).join(', ')}`
    )
  }

  return results
}
