#!/bin/bash
# lint-on-save: formatea el archivo guardado según su tipo

FILE=$1

if [[ -z "$FILE" ]]; then
  echo "Usage: lint-on-save.sh <file>"
  exit 1
fi

# Frontend: TypeScript/TSX/JS
if [[ "$FILE" =~ psicogest/frontend/.*\.(ts|tsx|js|jsx)$ ]]; then
  cd psicogest/frontend
  npx eslint --fix "$FILE" 2>/dev/null || true
fi

# Backend: Python
if [[ "$FILE" =~ psicogest/backend/.*\.py$ ]]; then
  python -m black "$FILE" 2>/dev/null || true
  python -m isort "$FILE" 2>/dev/null || true
fi
