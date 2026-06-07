#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# Aura Platform — Backup PostgreSQL
# Cron: 0 */6 * * * /home/helygp/backups/backup.sh
# Mantém 7 dias de retenção local.
# ─────────────────────────────────────────────────────────────────

BACKUP_DIR="/home/helygp/backups/postgres"
TIMESTAMP=$(date +"%Y%m%d_%H%M")
LOG="/home/helygp/backups/backup.log"
RETENTION_DAYS=7

# Bancos críticos — master + tenants ativos com dados reais
DBS="aura_master aura_acme aura_fastmalhas aura_forroplastic aura_staging"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] === Backup iniciado ===" >> "$LOG"

SUCCESS=0
FAIL=0

for DB in $DBS; do
  FILE="$BACKUP_DIR/${DB}_${TIMESTAMP}.sql.gz"
  if docker exec supabase-db pg_dump -U postgres "$DB" 2>/dev/null | gzip > "$FILE"; then
    SIZE=$(du -sh "$FILE" | cut -f1)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] OK $DB -> $SIZE" >> "$LOG"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] FALHA $DB" >> "$LOG"
    rm -f "$FILE"
    FAIL=$((FAIL + 1))
  fi
done

# Limpar backups antigos
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
COUNT=$(find "$BACKUP_DIR" -name "*.sql.gz" | wc -l)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] OK=$SUCCESS FAIL=$FAIL | Arquivos: $COUNT (retencao ${RETENTION_DAYS}d)" >> "$LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] === Backup concluido ===" >> "$LOG"

[ "$FAIL" -eq 0 ]
