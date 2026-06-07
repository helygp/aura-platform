#!/bin/bash
# Script para verificar configuração do ambiente staging

echo "=== Verificando configuração do staging ==="
echo ""

echo "1. Container erp-staging existe?"
docker ps --filter "name=erp-staging" --format "{{.Names}}\t{{.Status}}"
echo ""

echo "2. Configuração nginx em erp-staging:"
docker exec erp-staging cat /etc/nginx/conf.d/default.conf 2>/dev/null || \
docker exec erp-staging cat /etc/nginx/nginx.conf 2>/dev/null
echo ""

echo "3. Container api-staging existe?"
docker ps --filter "name=api-staging" --format "{{.Names}}\t{{.Status}}"
echo ""

echo "4. Variáveis de ambiente em api-staging:"
docker exec api-staging printenv | grep -E "DATABASE_URL|TENANT_SLUG|TENANT_DB_URL" | head -5
echo ""

echo "5. Teste de conectividade erp-staging → api-staging:"
docker exec erp-staging wget -q -O- http://api-staging:3001/health 2>/dev/null && echo "✅ OK" || echo "❌ FALHOU"
echo ""

echo "6. Logs recentes de erp-staging:"
docker logs erp-staging --tail 20
