#!/bin/sh
# scripts/db-setup.sh
# Cria o banco master e aplica migrations + seed
# Uso: sh scripts/db-setup.sh

set -e

DB="aura_master"
PSQL="docker exec supabase-db psql -U postgres"
MIGRATIONS_DIR="/projetos/aura-platform/services/api/prisma/migrations"

echo "==> Criando banco $DB (se não existir)..."
$PSQL -tc "SELECT 1 FROM pg_database WHERE datname='$DB'" | grep -q 1 \
  && echo "    já existe." \
  || ($PSQL -c "CREATE DATABASE $DB OWNER postgres" && echo "    criado.")

echo "==> Aplicando 001_init.sql..."
docker exec -i supabase-db psql -U postgres -d "$DB" < "$MIGRATIONS_DIR/001_init.sql"

echo "==> Aplicando 002_seed.sql..."
docker exec -i supabase-db psql -U postgres -d "$DB" < "$MIGRATIONS_DIR/002_seed.sql"

echo ""
echo "==> Verificando tabelas..."
$PSQL -d "$DB" -c "\dt"

echo ""
echo "✓ Banco $DB pronto."
echo ""
echo "Planos:"
$PSQL -d "$DB" -c "SELECT name, price_setup, price_monthly, max_users, max_products FROM plans ORDER BY price_monthly"
echo ""
echo "Tenants:"
$PSQL -d "$DB" -c "SELECT slug, status, db_name FROM tenants"
