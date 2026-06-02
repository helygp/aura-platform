/**
 * queue/index.js
 * Fila de notificações sobre Redis (RPUSH / BLPOP).
 *
 * Estrutura do job:
 * {
 *   id:        string    — uuid único
 *   tenantId:  string
 *   event:     string
 *   recipient: { email, phone?, userToken?, lang? }
 *   data:      object    — dados para interpolação dos templates
 *   attempts:  number    — tentativas já realizadas
 *   nextAt:    number    — timestamp ms para execução (backoff)
 *   createdAt: number
 * }
 *
 * Fluxo:
 *   enqueue()  → RPUSH aura:notify:queue
 *   worker     → BLPOP (bloqueante, timeout 2s) → processa → em caso de falha
 *                recalcula nextAt e reencadeia (até MAX_RETRIES) ou move para dead
 */

import { randomUUID }  from 'crypto'
import { redis, redisBlocked } from '../lib/redis.js'
import { ENV }         from '../lib/env.js'
import { processJob }  from './processor.js'

const { QUEUE_KEY, DEAD_KEY, MAX_RETRIES } = ENV

/* ─── Backoff exponencial: 30s, 5min, 30min ─── */
const BACKOFF_SECONDS = [30, 300, 1800]

function backoffMs(attempt) {
  const idx = Math.min(attempt, BACKOFF_SECONDS.length - 1)
  return BACKOFF_SECONDS[idx] * 1000
}

/* ─── Enfileirar ─── */
export async function enqueue(tenantId, event, recipient, data) {
  const job = {
    id:        randomUUID(),
    tenantId,
    event,
    recipient,
    data:      data ?? {},
    attempts:  0,
    nextAt:    Date.now(),
    createdAt: Date.now(),
  }
  await redis.rpush(QUEUE_KEY, JSON.stringify(job))
  return job.id
}

/* ─── Worker loop ─── */
let running = false

export async function startWorker() {
  if (running) return
  running = true
  console.log(`[notify:worker] iniciado — fila: ${QUEUE_KEY}`)

  while (running) {
    try {
      // BLPOP bloqueia até 2s esperando item
      const result = await redisBlocked.blpop(QUEUE_KEY, 2)
      if (!result) continue  // timeout — nenhum job, continua loop

      const [, raw] = result
      let job

      try {
        job = JSON.parse(raw)
      } catch {
        console.error('[notify:worker] job malformado, descartando:', raw)
        continue
      }

      // Backoff: se ainda não chegou a hora, reencadeia no final da fila
      if (job.nextAt > Date.now()) {
        await redis.rpush(QUEUE_KEY, JSON.stringify(job))
        await sleep(200)  // evita spin em fila com só jobs futuros
        continue
      }

      try {
        await processJob(job)
        console.log(`[notify:worker] ✓ ${job.id} (${job.event}) processado`)
      } catch (err) {
        job.attempts += 1
        console.error(`[notify:worker] ✗ ${job.id} tentativa ${job.attempts}:`, err.message)

        if (job.attempts < MAX_RETRIES) {
          job.nextAt = Date.now() + backoffMs(job.attempts)
          await redis.rpush(QUEUE_KEY, JSON.stringify(job))
          console.log(`[notify:worker] retry em ${backoffMs(job.attempts) / 1000}s`)
        } else {
          // Dead letter: preserva para análise
          job.failedAt  = Date.now()
          job.lastError = err.message
          await redis.rpush(DEAD_KEY, JSON.stringify(job))
          console.error(`[notify:worker] 💀 ${job.id} movido para dead letter`)
        }
      }
    } catch (err) {
      // Erros de conexão Redis — aguarda antes de tentar novamente
      console.error('[notify:worker] erro no loop:', err.message)
      await sleep(3000)
    }
  }
}

export function stopWorker() { running = false }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
