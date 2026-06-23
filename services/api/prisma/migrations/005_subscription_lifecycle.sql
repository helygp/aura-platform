-- Migration 005: subscription lifecycle + contract overrides
-- Adiciona campos de contrato e controle de acesso ao tenant.
-- IDEMPOTENTE: cada coluna usa "ADD COLUMN IF NOT EXISTS", então roda
-- sem efeito em ambientes onde as colunas já existem (produção).

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS grace_period_days  INTEGER       NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS access_level       TEXT          NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS access_note        TEXT,
  ADD COLUMN IF NOT EXISTS access_expires_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contract_price     NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS contract_limits    JSONB,
  ADD COLUMN IF NOT EXISTS db_url             TEXT;

-- Garante valores válidos para access_level (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_access_level'
  ) THEN
    ALTER TABLE tenants
      ADD CONSTRAINT chk_access_level
      CHECK (access_level IN ('NORMAL', 'FULL', 'COURTESY'));
  END IF;
END$$;

COMMENT ON COLUMN tenants.grace_period_days  IS 'Dias de tolerância após vencimento antes do bloqueio';
COMMENT ON COLUMN tenants.access_level       IS 'NORMAL=padrão, FULL=acesso total independente de plano, COURTESY=sem cobrança';
COMMENT ON COLUMN tenants.access_note        IS 'Nota interna sobre o contrato especial';
COMMENT ON COLUMN tenants.access_expires_at  IS 'Quando o override de acesso vence (null = permanente)';
COMMENT ON COLUMN tenants.contract_price     IS 'Preço contratado (override do plan.priceMonthly)';
COMMENT ON COLUMN tenants.contract_limits    IS 'Limites override por contrato (maxUsers, maxProducts) em JSON';
COMMENT ON COLUMN tenants.db_url             IS 'Override de DATABASE_URL para tenants em hosts dedicados';
