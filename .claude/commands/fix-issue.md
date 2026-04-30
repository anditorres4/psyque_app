---
name: fix-issue
description: Diagnostica y corrige un bug reportado siguiendo el flujo de debugging del proyecto
---

## Uso
```
/fix-issue <descripción del bug o número de issue>
```

## Proceso
1. Invocar `superpowers:systematic-debugging` para diagnóstico estructurado
2. Identificar la capa afectada (DB / RLS / Backend / API / Frontend)
3. Reproducir el bug localmente antes de proponer fix
4. Escribir o actualizar el test que cubre el caso
5. Aplicar el fix mínimo necesario
6. Verificar con `superpowers:verification-before-completion`

## Reglas
- No agregar manejo de errores para casos imposibles
- No refactorizar código adyacente mientras se corrige el bug
- Si el bug toca lógica de RIPS o firma de sesiones, confirmar con el usuario antes de proceder
