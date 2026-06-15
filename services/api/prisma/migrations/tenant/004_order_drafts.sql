-- Aura Platform — Rascunhos de pedido (1 por usuário)
-- Ticket #49: sessão expira e perde pedido em construção

CREATE TABLE IF NOT EXISTS order_drafts (
  id                 TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id            TEXT        NOT NULL UNIQUE,
  customer_id        TEXT,
  customer_name      TEXT,
  customer_whatsapp  TEXT,
  channel            TEXT        DEFAULT 'manual',
  notes              TEXT        DEFAULT '',
  items              JSONB       NOT NULL DEFAULT '[]',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_drafts_user    ON order_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_order_drafts_updated ON order_drafts(updated_at DESC);
