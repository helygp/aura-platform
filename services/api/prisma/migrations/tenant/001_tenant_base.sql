-- Aura Platform — Schema base por tenant
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_token  TEXT        NOT NULL,
  event       TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  body        TEXT,
  read        BOOLEAN     NOT NULL DEFAULT false,
  payload     JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_user  ON notifications(user_token);
CREATE INDEX IF NOT EXISTS idx_notif_read  ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notif_event ON notifications(event);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      JSONB        NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
INSERT INTO settings (key, value) VALUES
  ('whatsapp', '{"enabled":false,"session":null}'::jsonb),
  ('store',    '{"enabled":false,"min_order":0}'::jsonb),
  ('notify',   '{"email":true,"whatsapp":false}'::jsonb)
ON CONFLICT (key) DO NOTHING;
