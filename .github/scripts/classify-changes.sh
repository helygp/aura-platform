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
#   change_files_list=<csv> (até 20 arquivos, pra debug)
#
# Comportamento por evento:
#   - pull_request: compara HEAD com origin/<base_ref> (cumulativo do PR)
#   - push:         compara HEAD com HEAD~1 (apenas este commit)
#   - outros:       compara HEAD com HEAD~1 como fallback
#
# Uso manual (fora do CI):
#   bash .github/scripts/classify-changes.sh [base-ref]
# ─────────────────────────────────────────────────────────────────────
set -e

EVENT="${GITHUB_EVENT_NAME:-push}"
BASE_REF="${1:-$GITHUB_BASE_REF}"

# Estratégia de diff baseada no evento
if [ "$EVENT" = "pull_request" ] && [ -n "$BASE_REF" ]; then
  # PR: cumulativo desde a base do PR
  git fetch origin "$BASE_REF" --depth=100 2>/dev/null || true
  if git rev-parse "origin/$BASE_REF" >/dev/null 2>&1; then
    FILES=$(git diff --name-only "origin/$BASE_REF...HEAD" 2>/dev/null || true)
    DIFF_MODE="pr-cumulative (vs origin/$BASE_REF)"
  else
    FILES=$(git diff --name-only "HEAD~1...HEAD" 2>/dev/null || true)
    DIFF_MODE="fallback-single (origin/$BASE_REF indisponível)"
  fi
else
  # Push ou outros: apenas o commit atual
  FILES=$(git diff --name-only "HEAD~1...HEAD" 2>/dev/null || true)
  DIFF_MODE="single-commit (HEAD~1...HEAD)"
fi

# Fallback final: se vazio, usar tudo (commit inicial?)
if [ -z "$FILES" ]; then
  FILES=$(git ls-files)
  DIFF_MODE="$DIFF_MODE → fallback ls-files (commit inicial)"
fi

# Log de debug — útil pra entender classificações inesperadas
echo "─── classify-changes debug ───" >&2
echo "EVENT: $EVENT" >&2
echo "BASE_REF: ${BASE_REF:-<none>}" >&2
echo "DIFF_MODE: $DIFF_MODE" >&2
echo "FILES ($(echo "$FILES" | grep -c '.')):" >&2
echo "$FILES" | head -30 | sed 's/^/  /' >&2
[ "$(echo "$FILES" | grep -c '.')" -gt 30 ] && echo "  ... (truncado)" >&2
echo "──────────────────────────────" >&2

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
# Lista compacta dos primeiros 20 arquivos (CSV, sem newlines)
LIST=$(echo "$FILES" | head -20 | tr '\n' ',' | sed 's/,$//')

echo "change_type=$TYPE"
echo "change_files_count=$COUNT"
echo "change_files_list=$LIST"
