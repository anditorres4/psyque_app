#!/bin/bash
# Pre-commit hook: bloquea commits con problemas críticos

set -e

echo "Running pre-commit checks..."

# 1. Verificar que no hay archivos .env commiteados
if git diff --cached --name-only | grep -E "^\.env$|^\.env\.local$|^psicogest/backend/\.env$|^psicogest/frontend/\.env\.local$"; then
  echo "ERROR: Attempted to commit .env files with secrets. Aborting."
  exit 1
fi

# 2. Buscar claves hardcodeadas comunes
if git diff --cached | grep -E "(SUPABASE_SERVICE_KEY|API_KEY|SECRET_KEY)\s*=\s*['\"][a-zA-Z0-9]{20,}"; then
  echo "ERROR: Possible hardcoded secret detected. Aborting."
  exit 1
fi

# 3. Lint frontend si hay cambios en frontend/
if git diff --cached --name-only | grep -q "^psicogest/frontend/"; then
  echo "Linting frontend..."
  cd psicogest/frontend && npm run lint --silent
  cd ../..
fi

echo "Pre-commit checks passed."
