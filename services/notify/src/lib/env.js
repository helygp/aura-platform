import 'dotenv/config'

function req(key) {
  const v = process.env[key]
  if (!v) throw new Error(`Env obrigatória ausente: ${key}`)
  return v
}

export const ENV = {
  NODE_ENV:        process.env.NODE_ENV ?? 'development',

  // Redis — fila de notificações
  REDIS_URL:       process.env.REDIS_URL ?? 'redis://localhost:6379',
  REDIS_DB_NOTIFY: parseInt(process.env.REDIS_DB_NOTIFY ?? '3', 10),

  // SMTP Stalwart
  SMTP_HOST:       process.env.SMTP_HOST ?? 'localhost',
  SMTP_PORT:       parseInt(process.env.SMTP_PORT ?? '587', 10),
  SMTP_USER:       req('SMTP_USER'),
  SMTP_PASS:       req('SMTP_PASS'),
  SMTP_FROM:       process.env.SMTP_FROM ?? 'noreply@aurabr.app',
  SMTP_FROM_NAME:  process.env.SMTP_FROM_NAME ?? 'Aura Platform',

  // Banco master (para buscar waha_session do tenant)
  MASTER_DB_URL:   req('MASTER_DB_URL'),

  // Worker
  QUEUE_KEY:       process.env.QUEUE_KEY        ?? 'aura:notify:queue',
  DEAD_KEY:        process.env.DEAD_KEY         ?? 'aura:notify:dead',
  PROCESSING_KEY:  process.env.PROCESSING_KEY   ?? 'aura:notify:processing',
  POLL_MS:         parseInt(process.env.POLL_MS ?? '500', 10),
  MAX_RETRIES:     parseInt(process.env.MAX_RETRIES ?? '3', 10),
}
