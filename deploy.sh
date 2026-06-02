#!/bin/bash
# deploy.sh — Script de deploy por branch
# Uso: bash deploy.sh staging | bash deploy.sh main

set -e
BRANCH=${1:-staging}
REPO_DIR="/projetos/aura-platform"
LOG="/writable/deploy-${BRANCH}.log"

echo "[$(date)] Deploy iniciado — branch: $BRANCH" | tee -a $LOG

cd $REPO_DIR
git pull origin $BRANCH 2>&1 | tee -a $LOG

# ─── Build da imagem API ───────────────────────────────────────────
echo "[$(date)] Buildando imagem API..." | tee -a $LOG

if [ "$BRANCH" = "staging" ]; then
  IMAGE="api-aura:staging"
else
  IMAGE="api-aura:latest"
fi

docker build -f services/api/Dockerfile -t $IMAGE . 2>&1 | tail -5 | tee -a $LOG

# ─── Build do ERP ─────────────────────────────────────────────────
echo "[$(date)] Buildando ERP..." | tee -a $LOG
cd $REPO_DIR/apps/erp
vite build >> $LOG 2>&1
cd $REPO_DIR

# ─── Deploy staging ───────────────────────────────────────────────
if [ "$BRANCH" = "staging" ]; then
  echo "[$(date)] Deployando staging..." | tee -a $LOG

  # Recriar api-staging
  docker stop api-staging 2>/dev/null || true
  docker rm   api-staging 2>/dev/null || true
  docker run -d --name api-staging --restart unless-stopped \
    --network prod_default \
    --network supabase_supabase_net \
    --network tenant_staging_net \
    -e NODE_ENV=production -e PORT=3001 -e TENANT_SLUG=staging \
    -e DATABASE_URL="postgresql://aura_staging:$(cat $REPO_DIR/.credentials/staging.env | grep DB_PASS | cut -d= -f2)@supabase-db:5432/aura_staging" \
    -e TENANT_DB_URL="postgresql://aura_staging:$(cat $REPO_DIR/.credentials/staging.env | grep DB_PASS | cut -d= -f2)@supabase-db:5432/aura_staging" \
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
    -e SMTP_HOST="mail.aurabr.app" -e SMTP_PORT="587" \
    -e SMTP_USER="noreply@aurabr.app" -e SMTP_PASS="" \
    -e TRIAL_DAYS="14" -e WAHA_URL="" -e WAHA_API_KEY="" -e WAHA_SESSION="default" \
    -e PROVISION_AGENT_URL="http://provision-agent:4001" \
    -e AGENT_SECRET="aura-provision-secret-2024" \
    -l "traefik.enable=true" \
    -l "traefik.http.routers.api-staging.rule=Host(\`api.staging.aurabr.app\`)" \
    -l "traefik.http.routers.api-staging.tls.certresolver=mytlschallenge" \
    -l "traefik.http.routers.api-staging.entrypoints=websecure" \
    -l "traefik.http.services.api-staging.loadbalancer.server.port=3001" \
    $IMAGE

  # Deploy ERP no staging
  docker cp $REPO_DIR/apps/erp/dist/. erp-staging:/usr/share/nginx/html/
  docker exec erp-staging nginx -s reload

  echo "[$(date)] ✅ Staging deployado — https://staging.aurabr.app" | tee -a $LOG

# ─── Deploy produção ──────────────────────────────────────────────
elif [ "$BRANCH" = "main" ]; then
  echo "[$(date)] Deployando produção..." | tee -a $LOG

  for SLUG in acme fastmalhas forroplastic; do
    echo "[$(date)] → $SLUG" | tee -a $LOG

    # Pegar envs do arquivo de credenciais
    CREDS="$REPO_DIR/.credentials/${SLUG}.env"
    DB_PASS=$(grep DB_PASS $CREDS | cut -d= -f2)
    WAHA_URL=$(grep WAHA_URL $CREDS | cut -d= -f2 || echo "")
    WAHA_KEY=$(grep WAHA_KEY $CREDS | cut -d= -f2 || echo "")

    docker stop api-$SLUG && docker rm api-$SLUG

    docker run -d --name api-$SLUG --restart unless-stopped \
      --network prod_default \
      --network supabase_supabase_net \
      --network tenant_${SLUG}_net \
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
      -e SMTP_HOST="mail.aurabr.app" -e SMTP_PORT="587" \
      -e SMTP_USER="noreply@aurabr.app" -e SMTP_PASS="" \
      -e TRIAL_DAYS="14" \
      -e WAHA_URL="$WAHA_URL" -e WAHA_API_KEY="$WAHA_KEY" -e WAHA_SESSION="default" \
      -e PROVISION_AGENT_URL="http://provision-agent:4001" \
      -e AGENT_SECRET="aura-provision-secret-2024" \
      -l "traefik.enable=true" \
      -l "traefik.http.routers.api-${SLUG}.rule=Host(\`api.${SLUG}.aurabr.app\`)" \
      -l "traefik.http.routers.api-${SLUG}.tls.certresolver=mytlschallenge" \
      -l "traefik.http.routers.api-${SLUG}.entrypoints=websecure" \
      -l "traefik.http.services.api-${SLUG}.loadbalancer.server.port=3001" \
      $IMAGE

    docker cp $REPO_DIR/apps/erp/dist/. erp-$SLUG:/usr/share/nginx/html/
    docker exec erp-$SLUG nginx -s reload
    echo "[$(date)] ✅ $SLUG OK" | tee -a $LOG
  done

  echo "[$(date)] ✅ Produção atualizada" | tee -a $LOG
fi
