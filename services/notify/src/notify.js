/**
 * notify.js — Aura Notification Engine
 *
 * Função principal: notify(tenantId, event, recipient, data)
 *
 * @param {string} tenantId   — ID do tenant no banco master
 * @param {string} event      — 'order.created' | 'inventory.low' | 'daily.summary' | 'mcp.quota_80pct'
 * @param {object} recipient  — { email?, phone?, userToken?, lang? }
 * @param {object} data       — dados para interpolação do template
 * @returns {Promise<string>} — jobId (enfileirado de forma assíncrona)
 *
 * Uso:
 *   import { notify } from '@aura/notify'
 *
 *   await notify('tenant_acme', 'order.created', {
 *     email:     'cliente@acme.com',
 *     phone:     '5541999990000',
 *     userToken: 'tok-abc',
 *     lang:      'pt',
 *   }, {
 *     orderCode:    '1042',
 *     customerName: 'João Silva',
 *     total:        '1.250,00',
 *     itemCount:    3,
 *   })
 */

import { z }       from 'zod'
import { enqueue } from './queue/index.js'
import { KNOWN_EVENTS } from './templates/index.js'

const recipientSchema = z.object({
  email:     z.string().email().optional(),
  phone:     z.string().regex(/^\d{10,15}$/, 'Telefone inválido').optional(),
  userToken: z.string().optional(),
  lang:      z.enum(['pt', 'en']).default('pt'),
}).refine(
  r => r.email || r.phone || r.userToken,
  { message: 'recipient precisa ter ao menos email, phone ou userToken' }
)

export async function notify(tenantId, event, recipient, data = {}) {
  // Validações básicas (fail-fast antes de enfileirar)
  if (!tenantId) throw new Error('tenantId obrigatório')
  if (!KNOWN_EVENTS.includes(event)) {
    throw new Error(`Evento desconhecido: '${event}'. Conhecidos: ${KNOWN_EVENTS.join(', ')}`)
  }

  const parsed = recipientSchema.safeParse(recipient)
  if (!parsed.success) {
    throw new Error(`recipient inválido: ${parsed.error.errors.map(e => e.message).join(', ')}`)
  }

  const jobId = await enqueue(tenantId, event, parsed.data, data)
  return jobId
}
