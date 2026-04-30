---
name: deploy
description: Guía el proceso de deploy a Railway (backend) y Vercel (frontend)
---

## Uso
```
/deploy backend|frontend|all
```

## Pre-deploy checklist
- [ ] `pytest` pasa en backend
- [ ] `npm run build` pasa en frontend sin errores
- [ ] `npm run lint` sin errores
- [ ] Migraciones pendientes documentadas
- [ ] Variables de entorno actualizadas en Railway/Vercel si hay nuevas

## Backend (Railway)
```bash
# Railway deploya automáticamente en push a main
# Para migraciones manuales en producción:
railway run alembic upgrade head
```

## Frontend (Vercel)
```bash
# Vercel deploya automáticamente en push a main
# Preview en PRs automáticamente
```

## Post-deploy
- Verificar `/health` endpoint del backend
- Verificar login funciona en producción
- Revisar logs en Railway/Vercel por errores
