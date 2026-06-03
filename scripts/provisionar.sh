#!/bin/sh
# =============================================================
# provisionar.sh — Aura Platform
# Provisiona um novo tenant do zero.
#
# Uso:
#   sh provisionar.sh <slug> "<Nome>" <plano>
#   sh provisionar.sh acme "Acme Ltda" starter
#
# Variáveis de ambiente necessárias:
#   AURA_DB_SUPERUSER       postgres
#   AURA_DB_CONTAINER       supabase-db
#   AURA_TRAEFIK_CONFIG_VOL traefik-config
#   AURA_WAHA_ORCH_URL      http://localhost:4000
#   AURA_WAHA_ORCH_TOKEN    <token>
#   AURA_DOMAIN             aurabr.app
#   AURA_WEBHOOK_BASE       https://n8n.srv885928.hstgr.cloud/webhook
# =============================================================

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()  { printf "${CYAN}[aura]${RESET} %s\n" "$1"; }
ok()   { printf "${GREEN}[✓]${RESET} %s\n" "$1"; }
warn() { printf "${YELLOW}[!]${RESET} %s\n" "$1"; }
fail() { printf "${RED}[✗] ERRO: %s${RESET}\n" "$1" >&2; exit 1; }
step() { printf "\n${BOLD}── %s${RESET}\n" "$1"; }

require_env() {
  eval val=\$$1
  [ -n "$val" ] || fail "Variável de ambiente obrigatória ausente: $1"
}

# ── 1. ARGUMENTOS ──────────────────────────────────────────

SLUG="${1:-${TENANT_SLUG:-}}"
NOME="${2:-${TENANT_NAME:-}}"
PLANO="${3:-${TENANT_PLAN:-pro}}"
ADMIN_NAME_INPUT="${ADMIN_NAME:-Admin}"
ADMIN_EMAIL_INPUT="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD_INPUT="${ADMIN_PASSWORD:-}"

[ -n "$SLUG"  ] || fail "Uso: provisionar.sh <slug> \"<Nome>\" <plano>"
[ -n "$NOME"  ] || fail "Nome do tenant obrigatório."
[ -n "$PLANO" ] || fail "Plano obrigatório (starter | pro | full)."

echo "$SLUG" | grep -qE '^[a-z0-9][a-z0-9-]{2,29}$' \
  || fail "Slug inválido. Use apenas a-z, 0-9, hífens (3-30 chars)."

case "$PLANO" in
  starter|pro|full) ;;
  *) fail "Plano inválido: '$PLANO'. Use: starter | pro | full" ;;
esac

require_env AURA_DB_SUPERUSER
require_env AURA_DB_CONTAINER
require_env AURA_TRAEFIK_CONFIG_VOL
require_env AURA_WAHA_ORCH_URL
require_env AURA_WAHA_ORCH_TOKEN
require_env AURA_DOMAIN
require_env AURA_WEBHOOK_BASE

DB_NAME="aura_$(echo ${SLUG} | tr "-" "_")"
PSQL="docker exec ${AURA_DB_CONTAINER} psql -U ${AURA_DB_SUPERUSER}"
PSQL_MASTER="$PSQL -d aura_master"
TENANT_ID="tenant_${SLUG}"
MIGRATIONS_DIR="${AURA_MIGRATIONS_DIR:-/opt/aura-platform/migrations}"

printf "\n${BOLD}╔══════════════════════════════════════╗${RESET}\n"
printf "${BOLD}║  Aura Platform — Provisionar Tenant  ║${RESET}\n"
printf "${BOLD}╚══════════════════════════════════════╝${RESET}\n"
log "Slug:  $SLUG  |  Plano: $PLANO  |  DB: $DB_NAME"

# ── 2. IDEMPOTÊNCIA ────────────────────────────────────────

step "Verificando disponibilidade..."

EXISTS=$($PSQL_MASTER -tAc "SELECT COUNT(*) FROM tenants WHERE slug='${SLUG}'" 2>/dev/null || echo "0")
TENANT_JA_EXISTE="false"
[ "$EXISTS" = "0" ] || { warn "Tenant '$SLUG' já existe (criado pela API) — pulando INSERT."; TENANT_JA_EXISTE="true"; }

DB_EXISTS=$($PSQL -tAc "SELECT COUNT(*) FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null || echo "0")
BANCO_JA_EXISTE="false"
[ "$DB_EXISTS" = "0" ] || { warn "Banco '${DB_NAME}' já existe — pulando CREATE DATABASE."; BANCO_JA_EXISTE="true"; }

ok "Verificação concluída."

# ── 3. BANCO ISOLADO ───────────────────────────────────────

step "Criando banco PostgreSQL isolado: $DB_NAME"

if [ "$BANCO_JA_EXISTE" = "false" ]; then
  $PSQL -c "CREATE DATABASE \"${DB_NAME}\"" > /dev/null
  ok "Banco ${DB_NAME} criado."
else
  ok "Banco ${DB_NAME} já existia."
fi
ok "Banco $DB_NAME criado."

# ── 4. MIGRATIONS DO TENANT ────────────────────────────────

step "Rodando migrations no banco do tenant..."

mkdir -p "$MIGRATIONS_DIR"
TENANT_MIGRATION="${MIGRATIONS_DIR}/001_tenant_base.sql"

if [ ! -f "$TENANT_MIGRATION" ]; then
  cat > "$TENANT_MIGRATION" << 'TENANT_SQL'
-- Aura Platform — Schema base por tenant
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_token  TEXT        NOT NULL,
  event       TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  body        TEXT,
  read        BOOLEAN     NOT NULL DEFAULT false,
  payload     JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_user  ON notifications(user_token);
CREATE INDEX IF NOT EXISTS idx_notif_read  ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notif_event ON notifications(event);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      JSONB        NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
INSERT INTO settings (key, value) VALUES
  ('whatsapp', '{"enabled":false,"session":null}'::jsonb),
  ('store',    '{"enabled":false,"min_order":0}'::jsonb),
  ('notify',   '{"email":true,"whatsapp":false}'::jsonb)
ON CONFLICT (key) DO NOTHING;
TENANT_SQL
  ok "Template de migration criado em $TENANT_MIGRATION"
fi

docker exec -i ${AURA_DB_CONTAINER} psql -U ${AURA_DB_SUPERUSER} -d "${DB_NAME}" \
  < "$TENANT_MIGRATION" > /dev/null
ok "Migrations aplicadas em $DB_NAME."

# ── 5. TENANT NO BANCO MASTER (feito pela API via Prisma) ──────────────────

step "Verificando tenant no banco master..."

TENANT_EXISTS=$($PSQL_MASTER -tAc "SELECT COUNT(*) FROM tenants WHERE slug='${SLUG}'" 2>/dev/null | tr -d ' ' || echo "0")
[ "$TENANT_EXISTS" != "0" ] && ok "Tenant '$SLUG' já registrado pela API." || warn "Tenant não encontrado no master — foi criado pela API?"

# ── 6. ROTA TRAEFIK ────────────────────────────────────────

step "Configurando rota Traefik: ${SLUG}.${AURA_DOMAIN}"

printf "http:\n  routers:\n    erp-%s:\n      rule: \"Host(\`%s.%s\`)\"\n      entryPoints: [websecure]\n      tls: {certResolver: mytlschallenge}\n      service: erp-global\n    store-%s:\n      rule: \"Host(\`loja.%s.%s\`)\"\n      entryPoints: [websecure]\n      tls: {certResolver: mytlschallenge}\n      service: store-global\n" \
  "$SLUG" "$SLUG" "$AURA_DOMAIN" \
  "$SLUG" "$SLUG" "$AURA_DOMAIN" \
  | docker run --rm -i -v "${AURA_TRAEFIK_CONFIG_VOL}:/config" \
      alpine sh -c "cat > /config/${SLUG}.yml"

ok "Rota criada: ${SLUG}.yml (hot-reload automático)"

# ── 7. WAHA / AURAZAP ──────────────────────────────────────

step "Provisionando sessão WhatsApp (AuraZap)..."

WEBHOOK_URL="${AURA_WEBHOOK_BASE}/${SLUG}/whatsapp"
WAHA_RESPONSE=$(curl -sf -X POST "${AURA_WAHA_ORCH_URL}/provision" \
  -H "Authorization: Bearer ${AURA_WAHA_ORCH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"instance_id\":\"${SLUG}\",\"webhook_url\":\"${WEBHOOK_URL}\"}" 2>&1) || true

if echo "$WAHA_RESPONSE" | grep -q '"apiKey"'; then
  WAHA_KEY=$(echo "$WAHA_RESPONSE" | grep -o '"apiKey":"[^"]*"' | cut -d'"' -f4)
  WAHA_URL=$(echo "$WAHA_RESPONSE" | grep -o '"publicUrl":"[^"]*"' | cut -d'"' -f4)
  $PSQL_MASTER -c "UPDATE tenants SET waha_session='${WAHA_KEY}' WHERE slug='${SLUG}';" > /dev/null
  ok "Sessão WAHA: $WAHA_URL"
else
  warn "AuraZap indisponível — WhatsApp não provisionado agora."
  WAHA_KEY="(pendente)"; WAHA_URL="(pendente)"
fi

# ── 8. CREDENCIAIS ─────────────────────────────────────────

CREDS_DIR="/projetos/aura-platform/.credentials"
mkdir -p "$CREDS_DIR" && chmod 700 "$CREDS_DIR"
CREDS_FILE="${CREDS_DIR}/${SLUG}.env"

cat > "$CREDS_FILE" << CREDS
# Credenciais — ${SLUG} — $(date -Iseconds)
# !! NÃO COMMITAR !!

TENANT_SLUG=${SLUG}
TENANT_ID=${TENANT_ID}
TENANT_PLAN=${PLANO}

DB_NAME=${DB_NAME}
DATABASE_URL=postgresql://${AURA_DB_SUPERUSER}:SENHA_AQUI@localhost:5432/${DB_NAME}

ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD_INITIAL=Aura@${SLUG}2024

ERP_URL=https://${SLUG}.${AURA_DOMAIN}
STORE_URL=https://loja.${SLUG}.${AURA_DOMAIN}

WAHA_SESSION_ID=${SLUG}
WAHA_API_KEY=${WAHA_KEY}
WAHA_URL=${WAHA_URL}
WAHA_WEBHOOK=${WEBHOOK_URL}
CREDS

chmod 600 "$CREDS_FILE"
ok "Credenciais: $CREDS_FILE"

# ── 9. RESUMO ──────────────────────────────────────────────

printf "\n${BOLD}${GREEN}╔══════════════════════════════════════╗${RESET}\n"
printf "${BOLD}${GREEN}║   Tenant provisionado com sucesso!   ║${RESET}\n"
printf "${BOLD}${GREEN}╚══════════════════════════════════════╝${RESET}\n\n"
printf "  ${BOLD}Tenant:${RESET}  %s (%s) — %s\n"  "$NOME" "$SLUG" "$PLANO"
printf "  ${BOLD}ERP:${RESET}     https://%s.%s\n"  "$SLUG" "$AURA_DOMAIN"
printf "  ${BOLD}Loja:${RESET}    https://loja.%s.%s\n" "$SLUG" "$AURA_DOMAIN"
printf "  ${BOLD}Admin:${RESET}   %s\n"              "$ADMIN_EMAIL"
printf "  ${BOLD}Senha:${RESET}   Aura@%s2024  ${YELLOW}← TROCAR NO 1º LOGIN${RESET}\n" "$SLUG"
printf "  ${BOLD}WAHA:${RESET}    %s\n\n"            "$WAHA_URL"
