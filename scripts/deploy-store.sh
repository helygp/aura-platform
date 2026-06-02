#!/bin/sh
# =============================================================
# deploy-store.sh — Aura Platform
#
# Build e deploy da loja B2B para um tenant específico.
#
# Uso:
#   sh deploy-store.sh <slug>
#   sh deploy-store.sh acme
# =============================================================

set -e

RED='\033[0;31m';  GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m';     RESET='\033[0m'

log()  { printf "${CYAN}[store]${RESET} %s\n" "$1"; }
ok()   { printf "${GREEN}[✓]${RESET} %s\n" "$1"; }
warn() { printf "${YELLOW}[!]${RESET} %s\n" "$1"; }
fail() { printf "${RED}[✗] ERRO: %s${RESET}\n" "$1" >&2; exit 1; }
step() { printf "\n${BOLD}── %s${RESET}\n" "$1"; }

# ── 1. Argumentos ──────────────────────────────────────────
SLUG="$1"
[ -n "$SLUG" ] || fail "Uso: deploy-store.sh <slug>"

ROOT="/projetos/aura-platform"
CREDS_FILE="$ROOT/.credentials/${SLUG}.env"
[ -f "$CREDS_FILE" ] || fail "Credenciais não encontradas: $CREDS_FILE"
[ -d "$ROOT" ]       || fail "Raiz do projeto não encontrada: $ROOT"

# ── 2. Carrega variáveis ────────────────────────────────────
step "Carregando credenciais: $SLUG"
set -a; . "$CREDS_FILE"; set +a

: "${TENANT_DB_URL:?TENANT_DB_URL não definido em $CREDS_FILE}"
: "${JWT_SECRET:?JWT_SECRET não definido}"
: "${JWT_REFRESH_SECRET:?JWT_REFRESH_SECRET não definido}"

if [ -z "$BUYER_JWT_SECRET" ]; then
  warn "BUYER_JWT_SECRET não definido — gerando automaticamente"
  BUYER_JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
  echo "BUYER_JWT_SECRET=$BUYER_JWT_SECRET" >> "$CREDS_FILE"
fi

ok "Credenciais carregadas"

# ── 3. Migration da loja ────────────────────────────────────
step "Aplicando migration 003_store_schema.sql"

MIGRATION="$ROOT/services/api/prisma/migrations/tenant/003_store_schema.sql"
[ -f "$MIGRATION" ] || fail "Migration não encontrada: $MIGRATION"

DB_NAME=$(echo "$TENANT_DB_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
DB_PASS=$(echo "$TENANT_DB_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')

PGCONTAINER=$(docker ps --format "{{.Names}}" | grep -E "supabase-db|postgres-prod|db-prod" | head -1)
if [ -n "$PGCONTAINER" ]; then
  docker cp "$MIGRATION" "$PGCONTAINER:/tmp/003_store_schema.sql"
  docker exec -e PGPASSWORD="$DB_PASS" \
    "$PGCONTAINER" psql -U postgres -d "$DB_NAME" -f /tmp/003_store_schema.sql \
    && ok "Migration aplicada" || warn "Migration já pode estar aplicada"
else
  warn "Container do banco não encontrado — aplique manualmente:"
  warn "  psql '$TENANT_DB_URL' -f $MIGRATION"
fi

# ── 4. Build da imagem ──────────────────────────────────────
step "Build docker: aura-store (pode demorar 3-5min)"
cd "$ROOT"

docker build \
  -f apps/store/Dockerfile \
  -t "aura-store:latest" \
  --build-arg "NEXT_PUBLIC_API_URL=https://api.${SLUG}.aurabr.app" \
  --build-arg "NEXT_PUBLIC_DEFAULT_TENANT_SLUG=${SLUG}" \
  . 2>&1 | tail -5

ok "Imagem aura-store:latest construída"

# ── 5. Para e remove container anterior ─────────────────────
step "Atualizando container store-${SLUG}"

docker stop  "store-${SLUG}" 2>/dev/null && docker rm "store-${SLUG}" 2>/dev/null \
  && log "Container anterior removido" || true

# ── 6. Cria/garante rede ────────────────────────────────────
TENANT_NET="tenant_${SLUG}_net"
docker network create "$TENANT_NET" 2>/dev/null \
  && ok "Rede $TENANT_NET criada" || ok "Rede $TENANT_NET já existe"

# ── 7. Sobe o container ─────────────────────────────────────
docker run -d \
  --name "store-${SLUG}" \
  --restart unless-stopped \
  --network "$TENANT_NET" \
  --network-alias store \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e API_INTERNAL_URL=http://api:3001 \
  -e "NEXT_PUBLIC_API_URL=https://api.${SLUG}.aurabr.app" \
  -e "NEXT_PUBLIC_DEFAULT_TENANT_SLUG=${SLUG}" \
  --label "traefik.enable=true" \
  --label "traefik.http.routers.store-${SLUG}.rule=Host(\`loja.${SLUG}.aurabr.app\`)" \
  --label "traefik.http.routers.store-${SLUG}.entrypoints=websecure" \
  --label "traefik.http.routers.store-${SLUG}.tls.certresolver=mytlschallenge" \
  --label "traefik.http.routers.store-${SLUG}.service=store-${SLUG}-svc" \
  --label "traefik.http.services.store-${SLUG}-svc.loadbalancer.server.port=3000" \
  "aura-store:latest"

# Conecta à rede prod_default do Traefik
docker network connect prod_default "store-${SLUG}" 2>/dev/null \
  && ok "Conectado à prod_default" || warn "prod_default já conectada ou não existe"

ok "Container store-${SLUG} iniciado"

# ── 8. Healthcheck ──────────────────────────────────────────
step "Aguardando loja iniciar (máx 2min)"

ATTEMPTS=0
until [ $ATTEMPTS -ge 12 ]; do
  sleep 10; ATTEMPTS=$((ATTEMPTS + 1))
  STATUS=$(docker inspect --format='{{.State.Status}}' "store-${SLUG}" 2>/dev/null || echo "unknown")
  HTTP=$(docker exec "store-${SLUG}" wget -qO- http://localhost:3000/ 2>/dev/null | head -c 20 | tr -d '\n' | wc -c)
  [ "$HTTP" -gt 0 ] && ok "Loja respondendo internamente" && break
  printf "  aguardando... %ds\n" "$((ATTEMPTS * 10))"
done

# ── 9. Smoke test externo ───────────────────────────────────
step "Smoke test externo"
STORE_URL="https://loja.${SLUG}.aurabr.app"
HTTP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 10 "$STORE_URL" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "308" ] || [ "$HTTP_CODE" = "307" ]; then
  ok "Loja respondendo: $STORE_URL (HTTP $HTTP_CODE)"
else
  warn "HTTP $HTTP_CODE em $STORE_URL — DNS ou TLS pode ainda estar propagando"
fi

# ── 10. Resumo ──────────────────────────────────────────────
printf "\n${GREEN}${BOLD}══════════════════════════════════════════${RESET}\n"
printf "${GREEN}${BOLD}  Loja B2B deployada!${RESET}\n"
printf "${GREEN}${BOLD}══════════════════════════════════════════${RESET}\n"
printf "  Tenant:   ${BOLD}%s${RESET}\n" "$SLUG"
printf "  URL:      ${CYAN}%s${RESET}\n" "$STORE_URL"
printf "  Container: store-%s\n" "$SLUG"
printf "  Logs:     docker logs -f store-%s\n\n" "$SLUG"
