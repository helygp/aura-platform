/**
 * lib/tenantDb.js
 * Conexão ao banco do tenant.
 *
 * Arquitetura atual: banco único compartilhado (TENANT_DB_URL).
 * Arquitetura futura: banco por tenant (aura_<slug>) — trocar getPool() para
 * retornar pool isolado por slug.
 *
 * A assinatura de query() e getClient() já aceita `tenantSlug` como terceiro
 * parâmetro para facilitar a migração futura sem alterar as chamadas.
 */

import pg from 'pg'
const { Pool } = pg

// Pool singleton por URL de conexão
const _pools = new Map()

function getPool(tenantSlug) {
  // MVP: todos os tenants no mesmo banco
  // Futuro: `const url = process.env[`TENANT_DB_URL_${slug.toUpperCase()}`] ?? TENANT_DB_URL`
  const url = process.env.TENANT_DB_URL ?? process.env.DATABASE_URL
  if (!url) throw new Error('TENANT_DB_URL não configurada.')

  if (_pools.has(url)) return _pools.get(url)

  const pool = new Pool({
    connectionString: url,
    max:              10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 3_000,
  })
  pool.on('error', (err) => console.error('[tenantDb] pool error', err.message))
  _pools.set(url, pool)
  return pool
}

/**
 * Executa uma query no banco do tenant.
 * @param {string}   text        SQL parametrizado
 * @param {any[]}    params      Parâmetros da query
 * @param {string=}  tenantSlug  Slug do tenant (reservado para isolamento futuro)
 */
export async function query(text, params = [], tenantSlug) {
  return getPool(tenantSlug).query(text, params)
}

/**
 * Retorna um client pg para transações manuais.
 * Lembre de chamar client.release() no finally.
 * @param {string=} tenantSlug
 */
export async function getClient(tenantSlug) {
  return getPool(tenantSlug).connect()
}

/** @deprecated Use query() diretamente. */
export function getTenantPool(tenantSlug) {
  return getPool(tenantSlug)
}
