-- Tickets #83 e #117 — Cancelamento/Devolução de pedidos + integridade financeira
--
-- 1) Estende enum `order_status` com valores que JÁ eram usados pelo código
--    (porém nunca chegavam ao banco porque o INSERT em order_history quebrava)
--    e adiciona novos para o fluxo de devolução.
--
--    Bug latente descoberto: POST/PUT/DELETE em /api/orders/:id/items/*
--    tentavam inserir status 'item_adicionado'/'item_editado'/'item_removido'
--    em order_history, que não existiam no enum. Resultado: ROLLBACK silencioso
--    de TODAS as edições de item via ERP (operações nunca persistiam).
--
-- 2) Adiciona coluna `qty_returned` em order_items para suportar devolução
--    parcial. O total efetivo do pedido passa a ser:
--      SUM((qty - qty_returned) * price_unit) FILTER (WHERE status != 'cancelado')
--
-- Aplicar em cada tenant DB (aura_staging primeiro; depois aura_fastmalhas, aura_acme).
-- IMPORTANTE: após ALTER TYPE ADD VALUE, reiniciar os containers de API correspondentes
-- (api-staging, api-fastmalhas, api-acme) — prepared statements em pg precisam recarregar.

-- 1) Enum order_status — novos valores para order_history (somente registro, nunca como status de pedido)
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'item_adicionado';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'item_editado';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'item_removido';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'item_devolvido';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'devolucao_total';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'devolucao_parcial';

-- 2) order_items.qty_returned — devolução parcial
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS qty_returned integer NOT NULL DEFAULT 0;

ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_qty_returned_check;

ALTER TABLE order_items
  ADD CONSTRAINT order_items_qty_returned_check
    CHECK (qty_returned >= 0 AND qty_returned <= qty);

COMMENT ON COLUMN order_items.qty_returned IS
  'Tickets #83/#117: quantidade já devolvida pelo cliente. Item efetivo = qty - qty_returned.';
