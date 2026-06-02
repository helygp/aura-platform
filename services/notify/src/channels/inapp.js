import { persistNotification } from '../lib/db.js'

/**
 * Persiste notificação in-app na tabela `notifications` do banco do tenant.
 *
 * @param {string} dbName
 * @param {string} userToken   — token_id do usuário destinatário
 * @param {string} event
 * @param {{ title, body }}  rendered
 * @param {object} payload     — dados extras para o frontend
 */
export async function sendInApp(dbName, userToken, event, { title, body }, payload = {}) {
  if (!dbName) return { skipped: true, reason: 'no_db_name' }
  await persistNotification(dbName, { userToken, event, title, body, payload })
  return { saved: true }
}
