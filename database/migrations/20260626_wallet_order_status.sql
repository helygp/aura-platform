-- Tickets #83/#117 — terceira rodada
--
-- Adiciona snapshot do status do pedido no momento da transação. Usado como
-- critério adicional de consolidação: ajustes feitos no mesmo status agrupam;
-- ao mudar o status do pedido (pendente → confirmado → separando), as novas
-- transações começam linhas separadas no extrato.
--
-- Aplicar em cada tenant DB.

ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS order_status text;

CREATE INDEX IF NOT EXISTS idx_wallet_consolidation
  ON wallet_transactions (order_ref, type, created_by, order_status, created_at DESC)
  WHERE description ILIKE 'Ajuste pedido%';

COMMENT ON COLUMN wallet_transactions.order_status IS
  'Tickets #83/#117: snapshot do status do pedido no momento da transação. Usado para consolidação de ajustes (mesmo status agrupa, status diferente separa).';
