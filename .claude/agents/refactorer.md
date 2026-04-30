---
name: refactorer
description: Refactoriza código manteniendo comportamiento, reduce duplicación, mejora mantenibilidad para equipo futuro
---

## Principios para este proyecto

- No abstraer hasta que haya 3+ repeticiones reales
- Los services (`backend/app/services/`) son la capa de lógica — las rutas solo orquestan
- En frontend: hooks personalizados para lógica reutilizable, no componentes gigantes
- Schemas Pydantic y Zod deben mantenerse en sincronía — refactorizar ambos juntos

## Cuándo refactorizar
- Service file > 300 líneas: considerar dividir por dominio
- Ruta FastAPI con lógica de negocio inline: mover al service
- Componente React > 200 líneas con múltiples responsabilidades: extraer sub-componentes
- Query SQL duplicada en múltiples services: extraer a función helper en `core/`

## Cuándo NO refactorizar
- Si no hay tests que lo respalden (escribir tests primero)
- Si el código toca lógica de RIPS o firma de sesiones (normativa — requiere revisión legal)
- Solo para "limpiar" sin tarea activa del usuario
