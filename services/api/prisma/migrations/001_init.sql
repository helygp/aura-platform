-- ─────────────────────────────────────────────────────────────
-- Aura Platform — Migration 001: init banco master
-- Banco: aura_master
-- Executar via: psql -U postgres -d aura_master -f 001_init.sql
-- ─────────────────────────────────────────────────────────────

-- Extensões
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- busca trigram em emails/nomes

-- ─── ENUMs ─────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE tenant_status AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('ADMIN', 'FINANCEIRO', 'ESTOQUE', 'OPERADOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE billing_type AS ENUM ('SETUP', 'MONTHLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE billing_status AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── PLANS ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plans (
  id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name            TEXT        NOT NULL UNIQUE,
  price_setup     NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_monthly   NUMERIC(10,2) NOT NULL,
  mcp_quota       INTEGER     NOT NULL DEFAULT 0,
  max_users       INTEGER     NOT NULL DEFAULT 5,
  max_products    INTEGER     NOT NULL DEFAULT 100,
  features        JSONB       NOT NULL DEFAULT '{}',
  active          BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── TENANTS ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenants (
  id              TEXT         PRIMARY KEY DEFAULT gen_random_uuid()::text,
  slug            TEXT         NOT NULL UNIQUE,
  name            TEXT         NOT NULL,
  plan_id         TEXT         NOT NULL REFERENCES plans(id),
  status          tenant_status NOT NULL DEFAULT 'TRIAL',
  theme_config    JSONB        NOT NULL DEFAULT '{}',
  db_name         TEXT         UNIQUE,
  waha_session    TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug     ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status   ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_plan_id  ON tenants(plan_id);

-- ─── USERS ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id              TEXT         PRIMARY KEY DEFAULT gen_random_uuid()::text,
  token_id        TEXT         NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  tenant_id       TEXT         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email           TEXT         NOT NULL,
  name            TEXT         NOT NULL DEFAULT '',
  password_hash   TEXT         NOT NULL,
  role            user_role    NOT NULL DEFAULT 'OPERADOR',
  active          BOOLEAN      NOT NULL DEFAULT true,
  refresh_family  TEXT,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT users_tenant_email_unique UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_token_id  ON users(token_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email     ON users USING gin (email gin_trgm_ops);

-- ─── BILLING ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing (
  id              TEXT            PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id       TEXT            NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period          TEXT            NOT NULL,              -- 'YYYY-MM'
  amount          NUMERIC(10,2)   NOT NULL,
  type            billing_type    NOT NULL DEFAULT 'MONTHLY',
  status          billing_status  NOT NULL DEFAULT 'PENDING',
  paid_at         TIMESTAMPTZ,
  invoice_ref     TEXT,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),

  CONSTRAINT billing_tenant_period_type_unique UNIQUE (tenant_id, period, type)
);

CREATE INDEX IF NOT EXISTS idx_billing_tenant_id ON billing(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_status    ON billing(status);
CREATE INDEX IF NOT EXISTS idx_billing_period    ON billing(period);

-- ─── TRIGGER: updated_at automático ────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ 
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['plans', 'tenants', 'users', 'billing'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated_at ON %s;
       CREATE TRIGGER trg_%s_updated_at
         BEFORE UPDATE ON %s
         FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      t, t, t, t
    );
  END LOOP;
END $$;
