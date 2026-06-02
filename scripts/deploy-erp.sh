#!/bin/sh
# =============================================================
# deploy-erp.sh — Aura Platform
#
# Faz build e deploy do ERP (+ API) para um tenant específico.
#
# Uso:
#   sh deploy-erp.sh <slug>
#   sh deploy-erp.sh acme
#
# Pré-requisitos:
#   - .credentials/<slug>.env existente com as variáveis do tenant
#   - Docker + Traefik rodando na rede prod_default
#   - Banco do tenant provisionado (scripts/provisionar.sh)
# =============================================================

set -e

RED='\033[0;31m';   GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m';  BOLD='\033[1m';     RESET='\033[0m'

log()  { printf "${CYAN}[deploy]${RESET} %s\n" "$1"; }
ok()   { printf "${GREEN}[✓]${RESET} %s\n" "$1"; }
warn() { printf "${YELLOW}[!]${RESET} %s\n" "$1"; }
fail() { printf "${RED}[✗] ERRO: %s${RESET}\n" "$1" >&2; exit 1; }
step() { printf "\n${BOLD}── %s${RESET}\n" "$1"; }

# ── 1. Argumentos ──────────────────────────────────────────
SLUG="$1"
[ -n "$SLUG" ] || fail "Uso: deploy-erp.sh <slug>"

CREDS_FILE="/projetos/aura-platform/.credentials/${SLUG}.env"
[ -f "$CREDS_FILE" ] || fail "Arquivo de credenciais não encontrado: $CREDS_FILE"

ROOT="/projetos/aura-platform"
[ -d "$ROOT" ] || fail "Raiz do projeto não encontrada: $ROOT"

# ── 2. Carrega variáveis ────────────────────────────────────
step "Carregando credenciais: $SLUG"
set -a
# shellcheck disable=SC1090
. "$CREDS_FILE"
set +a

export TENANT_SLUG="$SLUG"
export TENANT_DB_URL="${DATABASE_URL:-}"
export MASTER_DB_URL="${MASTER_DB_URL:-}"
export JWT_SECRET="${JWT_SECRET:-$(head -c 40 /dev/urandom | xxd -p | tr -d '\n')}"
export JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-$(head -c 40 /dev/urandom | xxd -p | tr -d '\n')}"
export REDIS_URL="${REDIS_URL:-redis://redis-prod:6379}"
export WAHA_URL="${WAHA_URL:-}"
export WAHA_API_KEY="${WAHA_API_KEY:-}"

[ -n "$TENANT_DB_URL" ] || fail "DATABASE_URL não definida em $CREDS_FILE"
ok "Credenciais carregadas"

# ── 3. Rede isolada do tenant ───────────────────────────────
step "Rede Docker"
TENANT_NET="tenant_${SLUG}_net"
docker network create "$TENANT_NET" 2>/dev/null && ok "Rede $TENANT_NET criada" || ok "Rede $TENANT_NET já existe"

# ── 4. Build das imagens ────────────────────────────────────
step "Build Docker"
cd "$ROOT"

log "Construindo imagem ERP..."
docker build -f apps/erp/Dockerfile -t "aura-erp:latest" . 2>&1 | tail -3
ok "Imagem ERP pronta"

log "Construindo imagem API..."
docker build -f services/api/Dockerfile -t "aura-api:latest" . 2>&1 | tail -3
ok "Imagem API pronta"

# ── 5. Para containers antigos ──────────────────────────────
step "Reciclando containers: $SLUG"
docker stop  "erp-${SLUG}" 2>/dev/null && docker rm "erp-${SLUG}" 2>/dev/null && log "erp-${SLUG} removido" || true
docker stop  "api-${SLUG}" 2>/dev/null && docker rm "api-${SLUG}" 2>/dev/null && log "api-${SLUG} removido" || true

# ── 6. Sobe API ─────────────────────────────────────────────
step "Iniciando API"
docker run -d \
  --name "api-${SLUG}" \
  --restart unless-stopped \
  --network "$TENANT_NET" \
  -e NODE_ENV=production \
  -e PORT=3001 \
  -e TENANT_SLUG="$SLUG" \
  -e DATABASE_URL="$MASTER_DB_URL" \
  -e MASTER_DB_URL="$MASTER_DB_URL" \
  -e JWT_SECRET="$JWT_SECRET" \
  -e JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET" \
  -e COOKIE_DOMAIN="${SLUG}.aurabr.app" \
  -e CORS_ORIGIN="https://${SLUG}.aurabr.app" \
  -e CORS_ORIGINS="https://${SLUG}.aurabr.app" \
  -e WAHA_URL="$WAHA_URL" \
  -e WAHA_API_KEY="$WAHA_API_KEY" \
  -e WAHA_SESSION="$SLUG" \
  -e REDIS_URL="$REDIS_URL" \
  -l "traefik.enable=false" \
  aura-api:latest > /dev/null
# Reconecta com alias api para o nginx do ERP resolver o hostname
docker network disconnect "$TENANT_NET" "api-${SLUG}" 2>/dev/null || true
docker network connect --alias api "$TENANT_NET" "api-${SLUG}"
docker network connect prod_default "api-${SLUG}" 2>/dev/null || true
ok "api-${SLUG} iniciada"

# ── 7. Sobe ERP ─────────────────────────────────────────────
step "Iniciando ERP"
docker run -d \
  --name "erp-${SLUG}" \
  --restart unless-stopped \
  --network "$TENANT_NET" \
  -l "traefik.enable=true" \
  -l "traefik.http.routers.erp-${SLUG}.rule=Host(\`${SLUG}.aurabr.app\`)" \
  -l "traefik.http.routers.erp-${SLUG}.entrypoints=websecure" \
  -l "traefik.http.routers.erp-${SLUG}.tls.certresolver=mytlschallenge" \
  -l "traefik.http.routers.erp-${SLUG}.service=erp-${SLUG}-svc" \
  -l "traefik.http.services.erp-${SLUG}-svc.loadbalancer.server.port=80" \
  aura-erp:latest > /dev/null
docker network connect prod_default "erp-${SLUG}" 2>/dev/null || true
ok "erp-${SLUG} iniciado"

# ── 8. Health checks ────────────────────────────────────────
step "Verificando saúde"

wait_healthy() {
  NAME="$1"; URL="$2"; MAX=24; i=0
  printf "${CYAN}[deploy]${RESET} Aguardando %s" "$NAME"
  while [ $i -lt $MAX ]; do
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$NAME" 2>/dev/null || echo "none")
    case "$STATUS" in
      healthy) printf "\n"; ok "$NAME saudável"; return 0 ;;
      none)
        # Container sem healthcheck: testa via IP
        IP=$(docker inspect "$NAME" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' 2>/dev/null | awk '{print $1}')
        if docker exec traefik wget -qO- "http://$IP$URL" >/dev/null 2>&1; then
          printf "\n"; ok "$NAME respondendo"; return 0
        fi
        printf "."; sleep 5; i=$((i+1)) ;;
      *) printf "."; sleep 5; i=$((i+1)) ;;
    esac
  done
  printf "\n"; warn "$NAME demorou — verifique: docker logs $NAME"
}

wait_healthy "api-${SLUG}" /health
wait_healthy "erp-${SLUG}" /health

# ── 9. Resultado ─────────────────────────────────────────────
ERP_URL="https://${SLUG}.aurabr.app"

printf "\n"
printf "${GREEN}${BOLD}╔════════════════════════════════════════════╗${RESET}\n"
printf "${GREEN}${BOLD}║  🚀  Aura ERP — %-10s — ONLINE          ║${RESET}\n" "$SLUG"
printf "${GREEN}${BOLD}╠════════════════════════════════════════════╣${RESET}\n"
printf "${GREEN}${BOLD}║${RESET}  URL:    %-34s ${GREEN}${BOLD}║${RESET}\n" "$ERP_URL"
printf "${GREEN}${BOLD}║${RESET}  Admin:  %-34s ${GREEN}${BOLD}║${RESET}\n" "${ADMIN_EMAIL:-admin@${SLUG}.aurabr.app}"
printf "${GREEN}${BOLD}║${RESET}  Plano:  %-34s ${GREEN}${BOLD}║${RESET}\n" "${TENANT_PLAN:-starter}"
printf "${GREEN}${BOLD}╚════════════════════════════════════════════╝${RESET}\n"
printf "\n"

docker ps --filter "name=erp-${SLUG}" --filter "name=api-${SLUG}" \
  --format "  {{.Names}}\t{{.Status}}\t{{.Image}}"
