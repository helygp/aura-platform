#!/usr/bin/env bash
# ============================================================
# deploy-master.sh — Build e deploy do painel master
# Sprint 4 Tarefa 7
#
# Uso:
#   cd /projetos/aura-platform
#   bash scripts/deploy-master.sh
#
# Variáveis de ambiente necessárias:
#   MASTER_SECRET      — segredo do painel (obrigatório)
#   MASTER_BASIC_AUTH  — hash htpasswd/SHA1 para basic auth (obrigatório)
#   AURA_DOMAIN        — domínio base (default: aurabr.app)
#   API_HOST           — nome do container da API (default: api-acme)
# ============================================================

set -euo pipefail

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
RESET="\033[0m"

log()  { echo -e "${BOLD}[deploy-master]${RESET} $*"; }
ok()   { echo -e "${GREEN}✓${RESET} $*"; }
warn() { echo -e "${YELLOW}⚠${RESET} $*"; }
fail() { echo -e "${RED}✗ ERRO:${RESET} $*"; exit 1; }

# ── Variáveis ──────────────────────────────────────────────

CREDS="/projetos/aura-platform/.credentials/acme.env"

MASTER_SECRET="${MASTER_SECRET:-$(grep "^MASTER_SECRET=" "$CREDS" 2>/dev/null | cut -d= -f2)}"
MASTER_BASIC_AUTH="${MASTER_BASIC_AUTH:-$(grep "^MASTER_BASIC_AUTH=" "$CREDS" 2>/dev/null | cut -d= -f2-)}"
AURA_DOMAIN="${AURA_DOMAIN:-aurabr.app}"
API_HOST="${API_HOST:-api-acme}"
CONTAINER_NAME="master-panel"
IMAGE_NAME="aura-master:latest"

[[ -z "$MASTER_SECRET" ]]     && fail "MASTER_SECRET não definido. Adicione em $CREDS"
[[ -z "$MASTER_BASIC_AUTH" ]] && fail "MASTER_BASIC_AUTH não definido. Gere com: node scripts/gen-basic-auth.js"

# ── Build ──────────────────────────────────────────────────

log "Fazendo build da imagem $IMAGE_NAME..."

cd /projetos/aura-platform

docker build \
  --build-arg VITE_MASTER_SECRET="$MASTER_SECRET" \
  --build-arg VITE_DOMAIN="$AURA_DOMAIN" \
  -f apps/master/Dockerfile \
  -t "$IMAGE_NAME" \
  . 2>&1 | tail -5

ok "Imagem $IMAGE_NAME construída."

# ── Deploy ─────────────────────────────────────────────────

log "Parando container anterior (se existir)..."
docker rm -f "$CONTAINER_NAME" 2>/dev/null && warn "Container anterior removido." || true

log "Subindo container $CONTAINER_NAME..."

docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --network prod_default \
  -e API_HOST="$API_HOST" \
  --label "traefik.enable=true" \
  --label "traefik.http.routers.master.rule=Host(\`master.${AURA_DOMAIN}\`)" \
  --label "traefik.http.routers.master.entrypoints=websecure" \
  --label "traefik.http.routers.master.tls.certresolver=mytlschallenge" \
  --label "traefik.http.routers.master.service=master-svc" \
  --label "traefik.http.services.master-svc.loadbalancer.server.port=80" \
  --label "traefik.http.middlewares.master-basicauth.basicauth.users=${MASTER_BASIC_AUTH}" \
  --label "traefik.http.middlewares.master-basicauth.basicauth.removeheader=true" \
  --label "traefik.http.routers.master.middlewares=master-basicauth" \
  "$IMAGE_NAME"

sleep 3

if docker ps --filter "name=$CONTAINER_NAME" --filter "status=running" | grep -q "$CONTAINER_NAME"; then
  ok "Container $CONTAINER_NAME UP ✓"
else
  fail "Container não subiu. Logs:\n$(docker logs $CONTAINER_NAME 2>&1 | tail -10)"
fi

echo ""
echo -e "${BOLD}Painel master disponível em:${RESET}"
echo -e "  https://master.${AURA_DOMAIN}"
echo -e "  Usuário: hely"
echo -e "  Senha:   [MASTER_SECRET]"
echo ""
