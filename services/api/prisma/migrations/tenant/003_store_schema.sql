-- Migration 003: Área do comprador B2B (Tarefa 9)
-- Banco do tenant — executar via db-setup.sh ou manualmente

-- ─── COMPRADORES ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS buyer_accounts (
  id            BIGSERIAL        PRIMARY KEY,
  token_id      TEXT             NOT NULL UNIQUE,           -- JWT sub, nunca o id numérico
  name          TEXT             NOT NULL,
  email         TEXT             NOT NULL,
  password_hash TEXT             NOT NULL,
  company_name  TEXT,
  phone         TEXT,
  active        BOOLEAN          NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ      NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ      NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_buyer_email ON buyer_accounts(lower(email));
CREATE INDEX        IF NOT EXISTS idx_buyer_token ON buyer_accounts(token_id);

-- ─── PEDIDOS: adiciona buyer_id + ref ──────────────────────────────────────────

-- Coluna ref (token opaco gerado pelo servidor: ord_<16hex>)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ref TEXT UNIQUE;

-- Buyer_id opcional (NULL para compradores anônimos/não logados)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_id BIGINT REFERENCES buyer_accounts(id) ON DELETE SET NULL;

-- Payment method
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_type') THEN
    CREATE TYPE payment_method_type AS ENUM ('pix', 'boleto', 'a_combinar');
  END IF;
END $$;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method payment_method_type NOT NULL DEFAULT 'a_combinar';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_ref      ON orders(ref);
CREATE INDEX IF NOT EXISTS idx_orders_buyer    ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created  ON orders(created_at DESC);

-- ─── ORDER_ITEMS: adiciona colunas da loja ────────────────────────────────────

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_name TEXT NOT NULL DEFAULT '';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sku_code     TEXT NOT NULL DEFAULT '';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS attributes   JSONB;

-- ─── PRODUTOS: destaque na home ───────────────────────────────────────────────

ALTER TABLE products ADD COLUMN IF NOT EXISTS publico         BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS destaque        BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS destaque_ordem  INT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS images          JSONB   NOT NULL DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_title       TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_description TEXT;

-- ─── CONFIGURAÇÕES DO TENANT (tema da loja) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed de configuração padrão da loja
INSERT INTO settings (key, value)
VALUES ('theme', '{
  "logoUrl": null,
  "faviconUrl": null,
  "heroTitle": null,
  "heroSubtitle": null,
  "heroCta": null,
  "heroBannerUrl": null,
  "minimumOrderAmount": 0
}'::jsonb)
ON CONFLICT (key) DO NOTHING;
