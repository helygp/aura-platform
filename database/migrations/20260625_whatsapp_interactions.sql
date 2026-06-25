-- Migração: Feature #46 WhatsApp Atendimento
-- Tabelas de interações e mensagens WhatsApp por tenant

CREATE TABLE IF NOT EXISTS whatsapp_interactions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone        text NOT NULL,
  customer_id           text REFERENCES customers(id) ON DELETE SET NULL,
  dify_conversation_id  text,
  bot_order_id          text,
  status                text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','abandoned')),
  started_at            timestamptz NOT NULL DEFAULT now(),
  last_message_at       timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wi_phone    ON whatsapp_interactions(customer_phone);
CREATE INDEX IF NOT EXISTS idx_wi_last_msg ON whatsapp_interactions(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_wi_status   ON whatsapp_interactions(status);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id   uuid NOT NULL REFERENCES whatsapp_interactions(id) ON DELETE CASCADE,
  direction        text NOT NULL CHECK (direction IN ('inbound','outbound')),
  sender           text NOT NULL CHECK (sender IN ('customer','bot','human')),
  content          text NOT NULL,
  waha_message_id  text UNIQUE,
  sent_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wm_interaction ON whatsapp_messages(interaction_id, sent_at ASC);
CREATE INDEX IF NOT EXISTS idx_wm_waha_id     ON whatsapp_messages(waha_message_id) WHERE waha_message_id IS NOT NULL;
