import Redis from 'ioredis'
import { ENV } from './env.js'

function makeClient() {
  const client = new Redis(ENV.REDIS_URL, {
    db:                  ENV.REDIS_DB_NOTIFY,
    maxRetriesPerRequest: null,        // necessário para bloqueio (BLPOP)
    enableReadyCheck:    true,
    lazyConnect:         false,
  })
  client.on('error', err => console.error('[redis]', err.message))
  return client
}

// Dois clientes: um para pub/enqueue, um exclusivo para BLPOP (blocking)
export const redis        = makeClient()
export const redisBlocked = makeClient()
