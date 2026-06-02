-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 004 — Billing Pagar.me
-- Sprint 4 Tarefa 4
-- Banco: aura_master
--
-- Executar via:
--   docker exec supabase-db psql -U postgres -d aura_master \
--     -f /projetos/aura-platform/services/api/prisma/migrations/004_billing_pagarme.sql
--
-- Idempotente — seguro rodar mais de uma vez (ADD COLUMN IF NOT EXISTS,
-- CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Colunas Pagar.me na tabela tenants ───────────────────────────────────

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS pagarme_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS pagarme_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_status          TEXT NOT NULL DEFAULT 'pending',
  --   valores: pending | trial | active | paid | failed | canceled
  --            trial_ending | suspended | pagarme_error | provision_error
  ADD COLUMN IF NOT EXISTS next_billing_date       DATE,
  ADD COLUMN IF NOT EXISTS trial_ends_at           TIMESTAMPTZ;

-- Index para lookup rápido pelo ID da assinatura (usado no webhook)
CREATE INDEX IF NOT EXISTS idx_tenants_pagarme_subscription
  ON tenants(pagarme_subscription_id)
  WHERE pagarme_subscription_id IS NOT NULL;

-- Index para filtrar tenants por billing_status (dashboard/alertas)
CREATE INDEX IF NOT EXISTS idx_tenants_billing_status
  ON tenants(billing_status);

-- ─── 2. Tabela billing_events ─────────────────────────────────────────────────
--
-- Auditoria imutável de todos os eventos recebidos do Pagar.me via webhook.
-- Nunca deletar ou atualizar registros nesta tabela.

CREATE TABLE IF NOT EXISTS billing_events (
  id                BIGSERIAL     PRIMARY KEY,
  tenant_id         TEXT          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type        TEXT          NOT NULL,
  -- ex: subscription.payment.paid | subscription.payment.failed
  --     subscription.canceled | subscription.trial_end | charge.paid
  amount            NUMERIC(10,2),            -- em reais (centavos / 100)
  status            TEXT          NOT NULL,   -- paid | failed | pending | canceled | trial
  pagarme_charge_id TEXT,
  payload           JSONB,                    -- payload bruto do evento
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_tenant_id
  ON billing_events(tenant_id);

CREATE INDEX IF NOT EXISTS idx_billing_events_event_type
  ON billing_events(event_type);

-- Útil para paginação reversa e relatórios por período
CREATE INDEX IF NOT EXISTS idx_billing_events_created_at
  ON billing_events(created_at DESC);

-- ─── 3. Tabela payment_failures ───────────────────────────────────────────────
--
-- Rastreia falhas consecutivas por tenant.
-- O webhook conta quantas falhas ocorreram nos últimos 90 dias
-- e suspende o tenant após MAX_PAYMENT_FAILURES (default 3).

CREATE TABLE IF NOT EXISTS payment_failures (
  id                BIGSERIAL     PRIMARY KEY,
  tenant_id         TEXT          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pagarme_charge_id TEXT,
  failed_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  reason            TEXT          -- mensagem de erro da gateway
);

CREATE INDEX IF NOT EXISTS idx_payment_failures_tenant_id
  ON payment_failures(tenant_id);

-- Index composto para a query de contagem de falhas recentes:
--   WHERE tenant_id = $1 AND failed_at > now() - interval '90 days'
CREATE INDEX IF NOT EXISTS idx_payment_failures_failed_at
  ON payment_failures(tenant_id, failed_at DESC);
