-- ─────────────────────────────────────────────────────────
-- Migration 003 — Multi-role & Login (v1.2.0)
-- Aplicada em: 2026-06-12
-- Issue: #1
-- ─────────────────────────────────────────────────────────
-- Adiciona suporte a:
--   - Login separado do e-mail (users.login, único por tenant)
--   - Múltiplos perfis por usuário (users.roles text[])
--   - Coluna `role` (single) mantida por compatibilidade (dual-write)
--
-- Aplicar em: aura_master
--
-- Idempotente: pode ser reaplicada sem erro.

BEGIN;

-- 1. Colunas
ALTER TABLE users ADD COLUMN IF NOT EXISTS login text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS roles text[] NOT NULL DEFAULT '{}'::text[];

-- 2. Backfill
UPDATE users
SET login = lower(split_part(email, '@', 1))
WHERE login IS NULL OR login = '';

UPDATE users
SET roles = ARRAY[role::text]
WHERE coalesce(array_length(roles, 1), 0) = 0;

-- 3. Unicidade (tenant_id, login) — não bloqueia NULLs
CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_login_unique
  ON users(tenant_id, login)
  WHERE login IS NOT NULL;

-- 4. Índice GIN para queries "todos com role X"
CREATE INDEX IF NOT EXISTS idx_users_roles ON users USING GIN (roles);

COMMIT;

-- Validação
-- SELECT email, login, role, roles FROM users LIMIT 5;
