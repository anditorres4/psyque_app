---
name: pr-review
description: Ejecuta revisión completa de un PR antes de merge
---

## Uso
```
/pr-review [número de PR o rama]
```

## Proceso
1. Revisar diff completo del PR
2. Aplicar checklist de `.claude/agents/code-reviewer.md`
3. Verificar que tests cubren los cambios
4. Revisar normativa si hay cambios en historial clínico, RIPS o facturación
5. Invocar `superpowers:requesting-code-review` para revisión final

## Criterios de aprobación
- Sin rutas nuevas sin auth
- Sin datos PHI en logs
- Migraciones tienen rollback posible
- Cambios en UI probados visualmente (no solo type-check)
