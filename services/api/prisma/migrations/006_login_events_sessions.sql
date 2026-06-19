-- ─────────────────────────────────────────────────────────
-- 006: login_events + user_sessions
-- Camada 2 do plano de analytics multi-tenant (master.aurabr.app)
--
-- login_events  → audit append-only, todo login (sucesso/falha)
-- user_sessions → estado atual, quem está online + duração
-- ─────────────────────────────────────────────────────────

BEGIN;

-- ─── login_events ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS login_events (
  id              TEXT        PRIMARY KEY,
  user_id         TEXT        NULL REFERENCES users(id) ON DELETE SET NULL,
  tenant_id       TEXT        NULL REFERENCES tenants(id) ON DELETE SET NULL,
  tenant_slug     TEXT        NULL,
  identifier      TEXT        NOT NULL,
  success         BOOLEAN     NOT NULL,
  failure_reason  TEXT        NULL,
  ip              TEXT        NULL,
  user_agent      TEXT        NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_events_user_created
  ON login_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_events_tenant_created
  ON login_events (tenant_slug, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_events_success_created
  ON login_events (success, created_at DESC);


-- ─── user_sessions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_sessions (
  id                TEXT        PRIMARY KEY,
  user_id           TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id         TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_slug       TEXT        NOT NULL,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NULL,
  revoked_at        TIMESTAMPTZ NULL,
  ip                TEXT        NULL,
  user_agent        TEXT        NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_revoked
  ON user_sessions (user_id, revoked_at);

CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity
  ON user_sessions (last_activity_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_sessions_tenant_revoked
  ON user_sessions (tenant_slug, revoked_at);

COMMIT;
