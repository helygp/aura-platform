-- Tickets #83 + #117 — segunda rodada
--
-- 1) Tabela `order_reasons` para cadastro de motivos indexáveis de cancelamento
--    e devolução de pedidos. Padrão alinhado com product_attribute_defs.
--
-- 2) Seeds iniciais (8 cancelamento + 6 devolução). Idempotente por (kind, label).
--
-- Aplicar em cada tenant DB (aura_staging primeiro; depois aura_fastmalhas, aura_acme).

-- ── 1. Tipo + tabela ──
DO $$ BEGIN
  CREATE TYPE order_reason_kind AS ENUM ('cancellation', 'return');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS order_reasons (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  kind        order_reason_kind NOT NULL,
  label       text NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_reasons_kind_active
  ON order_reasons (kind, sort_order) WHERE active = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_order_reasons_kind_label
  ON order_reasons (kind, lower(label));

COMMENT ON TABLE order_reasons IS
  'Tickets #83/#117: motivos cadastráveis de cancelamento (kind=cancellation) e devolução (kind=return) de pedidos.';

-- ── 2. Seeds ──
INSERT INTO order_reasons (kind, label, sort_order) VALUES
  ('cancellation', 'Cliente desistiu',                 10),
  ('cancellation', 'Sem resposta do cliente',          20),
  ('cancellation', 'Estoque insuficiente',             30),
  ('cancellation', 'Erro no preço ou atributos',       40),
  ('cancellation', 'Pagamento não confirmado',         50),
  ('cancellation', 'Pedido duplicado',                 60),
  ('cancellation', 'Decisão interna',                  70),
  ('return',       'Produto com defeito',              10),
  ('return',       'Tamanho ou cor errados',           20),
  ('return',       'Não correspondeu ao esperado',     30),
  ('return',       'Avariado no transporte',           40),
  ('return',       'Arrependimento (7 dias)',          50),
  ('return',       'Erro no envio (item trocado)',     60)
ON CONFLICT (kind, lower(label)) DO NOTHING;

-- ── 3. GRANTs para o role do tenant ──
-- Tabelas criadas por CREATE TABLE neste banco ficam com owner=postgres por padrão.
-- O app conecta usando o role com o mesmo nome do database (aura_staging,
-- aura_fastmalhas, aura_acme). Garante privilégios.
DO $$
DECLARE
  tenant_role text := current_database();
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = tenant_role) THEN
    EXECUTE format('GRANT ALL PRIVILEGES ON TABLE order_reasons TO %I', tenant_role);
    EXECUTE format('GRANT USAGE ON TYPE order_reason_kind TO %I', tenant_role);
  ELSE
    RAISE NOTICE 'Skipping GRANT — role % does not exist', tenant_role;
  END IF;
END $$;
