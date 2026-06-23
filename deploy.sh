#!/bin/bash
set -e
set -o pipefail

# PATH explícito para SSH não herdar variáveis de ambiente incompletas
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

BRANCH=${1:-staging}
REPO_DIR="/home/helygp/projetos/aura-platform"
DEPLOY_LOG_DIR="${DEPLOY_LOG_DIR:-/tmp}"
mkdir -p "$DEPLOY_LOG_DIR" 2>/dev/null || DEPLOY_LOG_DIR=/tmp
LOG="$DEPLOY_LOG_DIR/deploy-${BRANCH}.log"
[ -f "$REPO_DIR/.credentials/smtp.env" ] && . "$REPO_DIR/.credentials/smtp.env"

echo "[$(date)] === Deploy iniciado — branch: $BRANCH ===" | tee $LOG

# ── 1. Git ───────────────────────────────────────────────────────
cd $REPO_DIR
git fetch origin 2>&1 | tee -a $LOG
git checkout $BRANCH 2>&1 | tee -a $LOG
git reset --hard origin/$BRANCH 2>&1 | tee -a $LOG
echo "[$(date)] Git OK — $(git log --oneline -1)" | tee -a $LOG

# ── 2. Build imagem API ──────────────────────────────────────────
if [ "$BRANCH" = "staging" ]; then IMAGE="api-aura:staging"
else IMAGE="api-aura:latest"; fi

echo "[$(date)] Buildando imagem API ($IMAGE)..." | tee -a $LOG
docker build -f $REPO_DIR/services/api/Dockerfile -t $IMAGE $REPO_DIR 2>&1 | tail -3 | tee -a $LOG
echo "[$(date)] Imagem API OK" | tee -a $LOG

# ── 3. Build ERP ─────────────────────────────────────────────────
echo "[$(date)] Buildando ERP..." | tee -a $LOG
docker run --rm \
  -v $REPO_DIR:/workspace \
  -w /workspace/apps/erp \
  node:22-bookworm-slim \
  sh -c "npm install --silent 2>/dev/null; npx vite@5.4.21 build" >> $LOG 2>&1
echo "[$(date)] ERP OK" | tee -a $LOG

# ── 4. Deploy staging ────────────────────────────────────────────
if [ "$BRANCH" = "staging" ]; then
  docker stop api-staging 2>/dev/null; docker rm api-staging 2>/dev/null || true
  docker run -d --name api-staging --restart unless-stopped \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v /usr/bin/docker:/usr/bin/docker:ro \
    --memory 384m --memory-swap 384m --cpus 0.75 \
    --network prod_default \
    --network supabase_supabase_net \
    --network tenant_staging_net \
    -e NODE_ENV=production -e PORT=3001 -e TENANT_SLUG=staging \
    -e DATABASE_URL="postgresql://aura_staging:AuraStaging2024@supabase-db:5432/aura_staging" \
    -e TENANT_DB_URL="postgresql://aura_staging:AuraStaging2024@supabase-db:5432/aura_staging" \
    -e MASTER_DB_URL="postgresql://postgres:pD5MouDfpF2b0ThSrnI6IQIcn7j5ZKFfnrxmPBeOgvs7JTl5WhWLQANAZCH7ztMe@supabase-db:5432/aura_master" \
    -e JWT_SECRET="b6c7dbc78f766c2bcdf76ecc0ea81963df24554bd6dcb6be6c5bf34e89c486e29cd9abede6032419" \
    -e JWT_REFRESH_SECRET="da40f37f0989d9aa7bfba64703d24ace4b14676326acf7595eae2d78b0ed468e0e9e8c2bfc5f4647" \
    -e BUYER_JWT_SECRET="buyer_staging_2024" \
    -e COOKIE_DOMAIN=".aurabr.app" \
    -e CORS_ORIGINS="https://staging.aurabr.app,https://loja.staging.aurabr.app" \
    -e REDIS_URL="redis://redis-prod:6379" \
    -e MASTER_SECRET="e04f913bd51a8cb66e5b0c6d37487ba3d0249237fa6fd3900c2b6c9194d8c49e" \
    -e PAGARME_API_KEY="b518a03b-2140-4042-9d13-334607390d29" \
    -e PAGARME_WEBHOOK_SECRET="aura_webhook_2024" \
    -e SMTP_HOST="${SMTP_HOST:-stalwart-mail}" -e SMTP_PORT="${SMTP_PORT:-465}" -e SMTP_SECURE="${SMTP_SECURE:-true}" \
    -e SMTP_USER="${SMTP_USER:-noreply@aurabr.app}" -e SMTP_PASS="${SMTP_PASS}" \
    -e TRIAL_DAYS="14" -e WAHA_URL="" -e WAHA_API_KEY="" -e WAHA_SESSION="default" \
    -e PROVISION_AGENT_URL="http://provision-agent:4001" \
    -e AGENT_SECRET="aura-provision-secret-2024" \
    -l "traefik.enable=true" \
    -l "traefik.docker.network=prod_default" \
    -l "traefik.http.routers.api-staging.rule=Host(\`api.staging.aurabr.app\`)" \
    -l "traefik.http.routers.api-staging.tls.certresolver=mytlschallenge" \
    -l "traefik.http.routers.api-staging.entrypoints=websecure" \
    -l "traefik.http.services.api-staging.loadbalancer.server.port=3001" \
    $IMAGE

  docker cp $REPO_DIR/apps/erp/dist/. erp-staging:/usr/share/nginx/html/
  docker exec erp-staging nginx -s reload
  echo "[$(date)] ✅ https://staging.aurabr.app" | tee -a $LOG

# ── 5. Deploy produção ───────────────────────────────────────────
elif [ "$BRANCH" = "main" ]; then
  for SLUG in acme fastmalhas; do
    case $SLUG in
      acme)         DB_PASS="AuraAcme72aa2d14d2a454f5"  ; WAHA_URL="http://waha_7b61c0d3-104d-4f6d-b276-34e50d5b115e:3000" ; WAHA_KEY="eecfa4cf-8003-4c77-9f4f-a6e2de81a575" ;;
      fastmalhas)   DB_PASS="AuraFast29166"              ; WAHA_URL="" ; WAHA_KEY="" ;;
    esac
    docker stop api-$SLUG 2>/dev/null; docker rm api-$SLUG 2>/dev/null || true
    docker run -d --name api-$SLUG --restart unless-stopped \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v /usr/bin/docker:/usr/bin/docker:ro \
    --memory 384m --memory-swap 384m --cpus 0.75 \
      --network prod_default --network supabase_supabase_net --network tenant_${SLUG}_net \
      -e NODE_ENV=production -e PORT=3001 -e TENANT_SLUG=$SLUG \
      -e DATABASE_URL="postgresql://aura_${SLUG}:${DB_PASS}@supabase-db:5432/aura_${SLUG}" \
      -e TENANT_DB_URL="postgresql://aura_${SLUG}:${DB_PASS}@supabase-db:5432/aura_${SLUG}" \
      -e MASTER_DB_URL="postgresql://postgres:pD5MouDfpF2b0ThSrnI6IQIcn7j5ZKFfnrxmPBeOgvs7JTl5WhWLQANAZCH7ztMe@supabase-db:5432/aura_master" \
      -e JWT_SECRET="b6c7dbc78f766c2bcdf76ecc0ea81963df24554bd6dcb6be6c5bf34e89c486e29cd9abede6032419" \
      -e JWT_REFRESH_SECRET="da40f37f0989d9aa7bfba64703d24ace4b14676326acf7595eae2d78b0ed468e0e9e8c2bfc5f4647" \
      -e BUYER_JWT_SECRET="buyer_${SLUG}_2024" \
      -e COOKIE_DOMAIN=".aurabr.app" \
      -e CORS_ORIGINS="https://${SLUG}.aurabr.app,https://loja.${SLUG}.aurabr.app" \
      -e REDIS_URL="redis://redis-prod:6379" \
      -e MASTER_SECRET="e04f913bd51a8cb66e5b0c6d37487ba3d0249237fa6fd3900c2b6c9194d8c49e" \
      -e PAGARME_API_KEY="b518a03b-2140-4042-9d13-334607390d29" \
      -e PAGARME_WEBHOOK_SECRET="aura_webhook_2024" \
      -e SMTP_HOST="${SMTP_HOST:-stalwart-mail}" -e SMTP_PORT="${SMTP_PORT:-465}" -e SMTP_SECURE="${SMTP_SECURE:-true}" \
      -e SMTP_USER="${SMTP_USER:-noreply@aurabr.app}" -e SMTP_PASS="${SMTP_PASS}" \
      -e TRIAL_DAYS="14" \
      -e WAHA_URL="$WAHA_URL" -e WAHA_API_KEY="$WAHA_KEY" -e WAHA_SESSION="default" \
      -e PROVISION_AGENT_URL="http://provision-agent:4001" \
      -e AGENT_SECRET="aura-provision-secret-2024" \
      -l "traefik.enable=true" \
    -l "traefik.docker.network=prod_default" \
      -l "traefik.http.routers.api-${SLUG}.rule=Host(\`api.${SLUG}.aurabr.app\`)" \
      -l "traefik.http.routers.api-${SLUG}.tls.certresolver=mytlschallenge" \
      -l "traefik.http.routers.api-${SLUG}.entrypoints=websecure" \
      -l "traefik.http.services.api-${SLUG}.loadbalancer.server.port=3001" \
      $IMAGE
    docker cp $REPO_DIR/apps/erp/dist/. erp-$SLUG:/usr/share/nginx/html/
    docker exec erp-$SLUG nginx -s reload
    echo "[$(date)] ✅ $SLUG OK" | tee -a $LOG
  done
fi

echo "[$(date)] === Deploy concluído ===" | tee -a $LOG
