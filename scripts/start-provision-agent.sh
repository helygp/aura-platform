#!/bin/sh
# start-provision-agent.sh
# Inicia o provision-agent no host com nohup
# Deve ser chamado no boot do servidor

set -e

AGENT_DIR="/projetos/aura-platform/services/provision-agent"
LOG_FILE="/writable/provision-agent.log"
PID_FILE="/writable/provision-agent.pid"

# Matar instância anterior se existir
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  kill "$OLD_PID" 2>/dev/null && echo "Instância anterior (PID $OLD_PID) encerrada." || true
  rm -f "$PID_FILE"
fi

cd "$AGENT_DIR"

# Variáveis de ambiente
export PORT=4001
export AGENT_SECRET="${AGENT_SECRET:-aura-provision-secret-2024}"
export AURA_DOMAIN="${AURA_DOMAIN:-aurabr.app}"
export AURA_DB_CONTAINER="${AURA_DB_CONTAINER:-supabase-db}"
export AURA_DB_SUPERUSER="${AURA_DB_SUPERUSER:-postgres}"
export MASTER_DB_URL="${MASTER_DB_URL:-postgresql://postgres:pD5MouDfpF2b0ThSrnI6IQIcn7j5ZKFfnrxmPBeOgvs7JTl5WhWLQANAZCH7ztMe@supabase-db:5432/aura_master}"
export MASTER_SECRET="${MASTER_SECRET:-e04f913bd51a8cb66e5b0c6d37487ba3d0249237fa6fd3900c2b6c9194d8c49e}"
export PAGARME_API_KEY="${PAGARME_API_KEY:-b518a03b-2140-4042-9d13-334607390d29}"
export SMTP_HOST="${SMTP_HOST:-mail.aurabr.app}"
export SMTP_PORT="${SMTP_PORT:-587}"
export SMTP_USER="${SMTP_USER:-noreply@aurabr.app}"
export SMTP_PASS="${SMTP_PASS:-}"

nohup node index.js >> "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

echo "✅ Provision agent iniciado (PID $(cat $PID_FILE)) | Log: $LOG_FILE"
