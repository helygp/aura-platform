-- ─────────────────────────────────────────────────────────
-- Migration 005 — Password Reset Tokens (v1.3.0)
-- Aplicada em: 2026-06-12
-- Issue: #2
-- ─────────────────────────────────────────────────────────
-- Tabela para tokens do fluxo "Esqueci minha senha".
--
-- Segurança:
--   - Salvamos APENAS o sha256(token_raw), nunca o token cru
--   - Token raw vai para o e-mail; DB armazena hash
--   - TTL 1h, uso único
--   - ON DELETE CASCADE: se o user for excluído, tokens vão junto
--
-- Aplicar em: aura_master
--
-- Idempotente: pode ser reaplicada sem erro.

BEGIN;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamp NOT NULL,
  used_at     timestamp,
  created_at  timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_user    ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_expires ON password_reset_tokens(expires_at);

COMMIT;

-- Limpeza periódica recomendada (cron):
-- DELETE FROM password_reset_tokens WHERE expires_at < now() - interval '7 days';
