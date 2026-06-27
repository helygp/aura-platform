-- 20260627_orders_aging_index_and_backfill.sql
-- Tickets #120 (issue #94) — Tracking de tempo entre status de pedidos (Fase 1).
--
-- A fundação (tabela order_status_log + trigger trg_log_order_status + função
-- log_order_status_change) já existe nos 3 tenants ativos. Esta migração
-- complementa essa fundação com:
--
--   1. Índice composto (to_status, changed_at DESC) para acelerar a consulta
--      de aging — listar pedidos por tempo de permanência no status atual.
--
--   2. Backfill conservador: para cada pedido sem nenhuma linha em
--      order_status_log (pedidos criados antes da instalação do trigger),
--      insere UMA única linha "from=NULL, to=status_atual, changed_at=created_at".
--      Não inventa transições intermediárias.
--
-- Aplicar em ordem: staging → fastmalhas → acme.
-- Restart das APIs após aplicar (cache de prepared statements do pg pode mascarar
-- a presença do novo índice em planos antigos).

BEGIN;

CREATE INDEX IF NOT EXISTS idx_osl_status_at
  ON order_status_log (to_status, changed_at DESC);

INSERT INTO order_status_log (order_id, from_status, to_status, changed_at)
SELECT o.id, NULL, o.status::text, o.created_at
FROM orders o
WHERE NOT EXISTS (
  SELECT 1 FROM order_status_log osl WHERE osl.order_id = o.id
);

COMMIT;
