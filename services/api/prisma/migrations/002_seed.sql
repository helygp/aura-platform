-- ─────────────────────────────────────────────────────────────
-- Aura Platform — Seed: planos, tenant demo, usuário admin
-- Banco: aura_master
-- ─────────────────────────────────────────────────────────────

-- ─── PLANOS ────────────────────────────────────────────────

INSERT INTO plans (id, name, price_setup, price_monthly, mcp_quota, max_users, max_products, features)
VALUES
  (
    'plan_starter',
    'starter',
    1500.00,
    297.00,
    500,
    5,
    500,
    '{
      "whatsapp": true,
      "store_b2b": false,
      "custom_domain": false,
      "api_access": false,
      "priority_support": false,
      "multi_warehouse": false,
      "advanced_reports": false
    }'::jsonb
  ),
  (
    'plan_pro',
    'pro',
    1500.00,
    597.00,
    2000,
    15,
    5000,
    '{
      "whatsapp": true,
      "store_b2b": true,
      "custom_domain": false,
      "api_access": false,
      "priority_support": true,
      "multi_warehouse": false,
      "advanced_reports": true
    }'::jsonb
  ),
  (
    'plan_full',
    'full',
    1500.00,
    1497.00,
    10000,
    -1,
    -1,
    '{
      "whatsapp": true,
      "store_b2b": true,
      "custom_domain": true,
      "api_access": true,
      "priority_support": true,
      "multi_warehouse": true,
      "advanced_reports": true
    }'::jsonb
  )
ON CONFLICT (name) DO UPDATE SET
  price_setup    = EXCLUDED.price_setup,
  price_monthly  = EXCLUDED.price_monthly,
  mcp_quota      = EXCLUDED.mcp_quota,
  max_users      = EXCLUDED.max_users,
  max_products   = EXCLUDED.max_products,
  features       = EXCLUDED.features,
  updated_at     = now();

-- ─── TENANT DEMO ───────────────────────────────────────────

INSERT INTO tenants (id, slug, name, plan_id, status, theme_config, db_name)
VALUES (
  'tenant_demo',
  'demo',
  'Aura Demo',
  'plan_pro',
  'ACTIVE',
  '{
    "primaryColor": "#0284C7",
    "mood": "light",
    "fontPair": "modern",
    "radius": "soft"
  }'::jsonb,
  'aura_demo'
)
ON CONFLICT (slug) DO UPDATE SET
  name         = EXCLUDED.name,
  theme_config = EXCLUDED.theme_config,
  updated_at   = now();

-- ─── USUÁRIO ADMIN DO TENANT DEMO ──────────────────────────
-- Senha: Aura@2024  (bcrypt hash gerado com cost=10)
-- !! ALTERAR IMEDIATAMENTE EM PRODUÇÃO !!

INSERT INTO users (tenant_id, email, name, password_hash, role, active)
VALUES (
  'tenant_demo',
  'admin@demo.aurabr.app',
  'Admin Demo',
  '$2b$10$mFkCN3T7LRKFbIMzV5Zqp.VkHkpHwK3pBOAhgDgH1kY.PXPLKzIhe',
  'ADMIN',
  true
)
ON CONFLICT (tenant_id, email) DO NOTHING;
