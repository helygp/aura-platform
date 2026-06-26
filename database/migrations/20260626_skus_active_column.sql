-- Ticket #116 / PR #66 follow-up
-- Adiciona coluna `active` em skus para suportar soft delete (inativação) quando o SKU
-- possui histórico em stock_movements ou order_items.
--
-- Regras de exclusão (aplicadas em services/api/src/routes/products.js PUT /:id):
--   - stock > 0              → 409 (precisa zerar antes)
--   - stock = 0, sem histórico → DELETE (remoção física)
--   - stock = 0, com histórico → UPDATE active=false (soft delete, preserva integridade)
--
-- Listagens GET /api/products e GET /api/products/:id filtram active=true por padrão.
--
-- Aplicar em cada tenant DB (aura_staging, aura_fastmalhas, aura_acme).

ALTER TABLE skus ADD COLUMN active boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_skus_product_active ON skus (product_id) WHERE active = true;
