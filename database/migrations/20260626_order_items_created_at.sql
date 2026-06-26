-- Tickets #83/#117 — quarta rodada (UX)
--
-- Adiciona created_at em order_items para ordem estável dos itens em GET /orders.
-- Sem isso, json_agg() retornava itens fora de ordem após UPDATE de qty, fazendo
-- o item editado "pular" pro final da lista no detalhe do pedido.
--
-- Backfill: para itens existentes, usa updated_at (melhor aproximação disponível).
--
-- Aplicar em cada tenant DB.

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Backfill itens existentes (created_at não pode ser depois do updated_at)
UPDATE order_items
   SET created_at = updated_at
 WHERE created_at > updated_at;

CREATE INDEX IF NOT EXISTS idx_oi_order_created
  ON order_items (order_id, created_at);

COMMENT ON COLUMN order_items.created_at IS
  'Tickets #83/#117: timestamp de inserção. Usado para ordem estável na listagem após edições (json_agg ORDER BY).';
