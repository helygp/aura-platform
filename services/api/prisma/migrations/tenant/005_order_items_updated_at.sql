-- ─── 005_order_items_updated_at.sql ─────────────────────────────────────
-- Adiciona coluna order_items.updated_at (faltava desde 002_business_schema.sql).
--
-- Contexto: o backend (services/api/src/routes/orders.js) sempre referenciou
-- order_items.updated_at em 2 UPDATEs:
--   * PUT  /api/orders/:id/items/:itemId          (editar quantidade)
--   * PATCH /api/orders/:id/items/:itemId/cancel  (cancelar item parcial)
-- Como a coluna nunca existiu no schema do tenant, ambos endpoints retornavam
-- 500 em produção em TODOS os tenants. O frontend (handleCancelItem) engolia
-- o erro silenciosamente, então o problema não aparecia em ticket — até o
-- ticket AuraSuporte #54 (Leonardo Fonseca / fastmalhas / pedido 1048), que
-- tentou 8 vezes em 1 min e finalmente reportou.
--
-- Esta migration:
--   1) Aplicada manualmente em prod nos 3 tenants atuais (acme, fastmalhas,
--      forroplastic) em 2026-06-16 ~20:18 UTC, com superuser postgres.
--   2) Fica registrada aqui como source-of-truth pra novos tenants e
--      auditoria histórica.
--
-- Refs: ticket #54, GitHub issue #25.

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
