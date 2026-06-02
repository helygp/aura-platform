-- ─────────────────────────────────────────────────────────────
-- Aura Platform — Migration 002: schema de negócio do tenant
-- Banco: aura_<slug>
-- ─────────────────────────────────────────────────────────────

-- ─── ENUMs ─────────────────────────────────────────────────

DO $$ BEGIN CREATE TYPE product_type AS ENUM ('simples','variante'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE stock_status AS ENUM ('ok','baixo','zerado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE movement_type AS ENUM ('entrada','saida','ajuste'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE order_status  AS ENUM ('pendente','confirmado','separando','enviado','entregue','cancelado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE order_channel AS ENUM ('manual','whatsapp','loja'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE person_type   AS ENUM ('pj','pf'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE cust_status   AS ENUM ('ativo','inativo','bloqueado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE bot_order_status AS ENUM ('pending_approval','approved','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── CLIENTES ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
  id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name          TEXT        NOT NULL,
  person_type   person_type NOT NULL DEFAULT 'pj',
  document      TEXT,
  whatsapp      TEXT,
  email         TEXT,
  status        cust_status NOT NULL DEFAULT 'ativo',
  credit_limit  NUMERIC(12,2) NOT NULL DEFAULT 0,
  address       JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cust_status   ON customers(status);
CREATE INDEX IF NOT EXISTS idx_cust_doc      ON customers(document);
CREATE INDEX IF NOT EXISTS idx_cust_wpp      ON customers(whatsapp);

-- ─── PRODUTOS ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id            TEXT         PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name          TEXT         NOT NULL,
  code          TEXT         NOT NULL UNIQUE,
  category      TEXT         NOT NULL DEFAULT '',
  type          product_type NOT NULL DEFAULT 'simples',
  image_url     TEXT,
  attributes    JSONB        NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prod_code     ON products(code);
CREATE INDEX IF NOT EXISTS idx_prod_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_prod_type     ON products(type);

-- ─── SKUs ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS skus (
  id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_id      TEXT        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  code            TEXT        NOT NULL UNIQUE,
  attributes      JSONB       NOT NULL DEFAULT '{}',
  price_wholesale NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock           INTEGER     NOT NULL DEFAULT 0,
  stock_min       INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sku_product ON skus(product_id);
CREATE INDEX IF NOT EXISTS idx_sku_code    ON skus(code);

-- ─── MOVIMENTAÇÕES DE ESTOQUE ───────────────────────────────

CREATE TABLE IF NOT EXISTS stock_movements (
  id          TEXT          PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sku_id      TEXT          NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
  type        movement_type NOT NULL,
  qty         INTEGER       NOT NULL,
  qty_before  INTEGER       NOT NULL DEFAULT 0,
  qty_after   INTEGER       NOT NULL DEFAULT 0,
  reason      TEXT          NOT NULL DEFAULT '',
  user_name   TEXT          NOT NULL DEFAULT 'sistema',
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mv_sku  ON stock_movements(sku_id);
CREATE INDEX IF NOT EXISTS idx_mv_type ON stock_movements(type);
CREATE INDEX IF NOT EXISTS idx_mv_date ON stock_movements(created_at DESC);

-- ─── PEDIDOS ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orders (
  id            TEXT         PRIMARY KEY DEFAULT gen_random_uuid()::text,
  customer_id   TEXT         REFERENCES customers(id),
  customer_name TEXT         NOT NULL DEFAULT '',
  customer_whatsapp TEXT,
  channel       order_channel NOT NULL DEFAULT 'manual',
  status        order_status  NOT NULL DEFAULT 'pendente',
  total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes         TEXT          NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ord_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_ord_customer   ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_ord_channel    ON orders(channel);
CREATE INDEX IF NOT EXISTS idx_ord_created    ON orders(created_at DESC);

-- ─── ITENS DO PEDIDO ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS order_items (
  id           TEXT    PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id     TEXT    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sku_id       TEXT    REFERENCES skus(id),
  sku_code     TEXT    NOT NULL,
  product_name TEXT    NOT NULL,
  attributes   JSONB   NOT NULL DEFAULT '{}',
  qty          INTEGER NOT NULL DEFAULT 1,
  price_unit   NUMERIC(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_oi_order ON order_items(order_id);

-- ─── HISTÓRICO DE STATUS DO PEDIDO ──────────────────────────

CREATE TABLE IF NOT EXISTS order_history (
  id         TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id   TEXT        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     order_status NOT NULL,
  note       TEXT         NOT NULL DEFAULT '',
  user_name  TEXT         NOT NULL DEFAULT 'sistema',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oh_order ON order_history(order_id);

-- ─── PEDIDOS BOT (WhatsApp) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS bot_orders (
  id           TEXT             PRIMARY KEY DEFAULT gen_random_uuid()::text,
  bot_order_id TEXT             NOT NULL UNIQUE DEFAULT ('BOT-'||upper(substr(gen_random_uuid()::text,1,6))),
  customer_name  TEXT           NOT NULL,
  customer_phone TEXT           NOT NULL,
  items        JSONB            NOT NULL DEFAULT '[]',
  total        NUMERIC(12,2)    NOT NULL DEFAULT 0,
  status       bot_order_status NOT NULL DEFAULT 'pending_approval',
  received_at  TIMESTAMPTZ      NOT NULL DEFAULT now(),
  reviewed_at  TIMESTAMPTZ,
  reviewed_by  TEXT
);
CREATE INDEX IF NOT EXISTS idx_bo_status ON bot_orders(status);
CREATE INDEX IF NOT EXISTS idx_bo_date   ON bot_orders(received_at DESC);
