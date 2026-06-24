#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# classify-changes.sh
#
# Classifica os arquivos alterados num commit/PR em uma das categorias:
#
#   slug-only    — só toca apps/erp, apps/store, ou rotas API tenant
#                  (consumidas pelo ERP/loja de cada slug). Tem staging.
#
#   master-only  — só toca apps/master ou services/api/src/routes/master
#                  (painel admin). NÃO TEM STAGING — atenção redobrada.
#
#   mixed        — toca SLUG e MASTER no mesmo commit.
#                  Recomendação: dividir em 2 PRs (1 slug, 1 master).
#
#   infra-only   — só toca .github/, deploy.sh, Dockerfile, migrations,
#                  ou packages/* (shared). Tem staging.
#
#   unclassified — apenas arquivos auxiliares (README, configs, etc).
#
# Output (stdout, formato GitHub Actions outputs):
#   change_type=<categoria>
#   change_files_count=<N>
#
# Uso:
#   bash .github/scripts/classify-changes.sh [base-ref]
#   bash .github/scripts/classify-changes.sh main
# ─────────────────────────────────────────────────────────────────────
set -e

BASE_REF="${1:-${GITHUB_BASE_REF:-main}}"

# Fetch raso do base ref pra ter algo pra comparar
git fetch origin "$BASE_REF" --depth=50 2>/dev/null || true

# Lista arquivos alterados. Estratégia em ordem de preferência:
#   1. diff vs origin/<base-ref>
#   2. diff vs HEAD~1 (fallback se origin/<base-ref> indisponível)
#   3. ls-files (commit inicial)
if git rev-parse "origin/$BASE_REF" >/dev/null 2>&1; then
  FILES=$(git diff --name-only "origin/$BASE_REF...HEAD" 2>/dev/null || true)
fi
if [ -z "$FILES" ]; then
  FILES=$(git diff --name-only "HEAD~1...HEAD" 2>/dev/null || true)
fi
if [ -z "$FILES" ]; then
  FILES=$(git ls-files)
fi

# Patterns das categorias
PATTERN_MASTER='^(apps/master/|services/api/src/routes/master/)'
PATTERN_SLUG_APPS='^(apps/erp/|apps/store/)'
PATTERN_SLUG_API='^services/api/src/routes/(store/|[^/]+\.js$)'
PATTERN_INFRA='^(\.github/|deploy\.sh$|.*[Dd]ockerfile|services/api/prisma/|packages/)'

HAS_MASTER=$(echo "$FILES" | grep -E "$PATTERN_MASTER" | head -1 || true)
HAS_SLUG_APPS=$(echo "$FILES" | grep -E "$PATTERN_SLUG_APPS" | head -1 || true)
HAS_SLUG_API=$(echo "$FILES" | grep -E "$PATTERN_SLUG_API" | head -1 || true)
HAS_INFRA=$(echo "$FILES" | grep -E "$PATTERN_INFRA" | head -1 || true)

# Decisão (ordem importa: mixed antes de master-only/slug-only)
if [ -n "$HAS_MASTER" ] && { [ -n "$HAS_SLUG_APPS" ] || [ -n "$HAS_SLUG_API" ]; }; then
  TYPE="mixed"
elif [ -n "$HAS_MASTER" ]; then
  TYPE="master-only"
elif [ -n "$HAS_SLUG_APPS" ] || [ -n "$HAS_SLUG_API" ]; then
  TYPE="slug-only"
elif [ -n "$HAS_INFRA" ]; then
  TYPE="infra-only"
else
  TYPE="unclassified"
fi

COUNT=$(echo "$FILES" | grep -c '.' || echo 0)

echo "change_type=$TYPE"
echo "change_files_count=$COUNT"
