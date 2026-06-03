/**
 * lib/db.js
 * Conexões PostgreSQL leves via pg (sem Prisma — evita dependência do CLI).
 * master  → busca tenant, waha_session
 * tenant  → persiste notifications
 */

import pg from 'pg'
import { ENV } from './env.js'

const { Pool } = pg

// Pool para o banco master
const masterPool = new Pool({
  connectionString: ENV.MASTER_DB_URL,
  max: 5,
})

// Cache de pools por tenant (evita reconectar a cada notificação)
const tenantPools = new Map()

function tenantPool(dbName) {
  if (tenantPools.has(dbName)) return tenantPools.get(dbName)

  // Deriva a connection string do master trocando só o db name
  const base = new URL(ENV.MASTER_DB_URL)
  base.pathname = `/${dbName}`

  const pool = new Pool({ connectionString: base.toString(), max: 3 })
  pool.on('error', err => console.error(`[db:${dbName}]`, err.message))
  tenantPools.set(dbName, pool)
  return pool
}

// Busca tenant no master → { slug, db_name, waha_session, theme_config }
export async function getTenant(tenantId) {
  const { rows } = await masterPool.query(
    `SELECT id, slug, db_name, waha_session, theme_config
     FROM tenants WHERE id = $1 LIMIT 1`,
    [tenantId]
  )
  return rows[0] ?? null
}

// Persiste notificação in-app no banco do tenant
export async function persistNotification(dbName, { userToken, event, title, body, payload }) {
  const pool = tenantPool(dbName)
  await pool.query(
    `INSERT INTO notifications (user_token, event, title, body, payload)
     VALUES ($1, $2, $3, $4, $5)`,
    [userToken, event, title, body ?? null, JSON.stringify(payload ?? {})]
  )
}
