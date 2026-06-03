/**
 * lib/env.js
 * Valida e expõe variáveis de ambiente.
 * Falha rápido na inicialização se variáveis obrigatórias estiverem ausentes.
 */

import 'dotenv/config'

function require_env(key) {
  const val = process.env[key]
  if (!val) throw new Error(`Variável de ambiente obrigatória ausente: ${key}`)
  return val
}

function optional_env(key, fallback = undefined) {
  return process.env[key] ?? fallback
}

export const ENV = {
  NODE_ENV:           optional_env('NODE_ENV', 'development'),
  PORT:               parseInt(optional_env('PORT', '3001'), 10),

  // JWT ERP
  JWT_SECRET:         require_env('JWT_SECRET'),
  JWT_REFRESH_SECRET: require_env('JWT_REFRESH_SECRET'),
  JWT_ACCESS_TTL:     optional_env('JWT_ACCESS_TTL',  '15m'),
  JWT_REFRESH_TTL:    optional_env('JWT_REFRESH_TTL', '7d'),

  // JWT Comprador (loja B2B)
  BUYER_JWT_SECRET:   optional_env('BUYER_JWT_SECRET'),

  // Cookie
  COOKIE_DOMAIN:      optional_env('COOKIE_DOMAIN', 'localhost'),

  // CORS
  CORS_ORIGINS: optional_env('CORS_ORIGINS', optional_env('CORS_ORIGIN', 'http://localhost:5173'))
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),

  // Banco
  DATABASE_URL:   optional_env('DATABASE_URL'),
  TENANT_DB_URL:  optional_env('TENANT_DB_URL'),

  // Master
  MASTER_SECRET:  optional_env('MASTER_SECRET'),

  // Pagar.me
  PAGARME_API_KEY:        optional_env('PAGARME_API_KEY'),
  PAGARME_WEBHOOK_SECRET: optional_env('PAGARME_WEBHOOK_SECRET'),

  // Trial
  TRIAL_DAYS: parseInt(optional_env('TRIAL_DAYS', '14'), 10),

  // Falhas de pagamento antes de suspender
  MAX_PAYMENT_FAILURES: parseInt(optional_env('MAX_PAYMENT_FAILURES', '3'), 10),
}

export const IS_PROD = ENV.NODE_ENV === 'production'

