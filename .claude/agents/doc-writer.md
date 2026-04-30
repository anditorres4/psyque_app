---
name: doc-writer
description: Documenta APIs, flujos de n8n y decisiones de arquitectura para el equipo
---

## Qué documentar

### APIs (backend)
- Docstrings en endpoints solo si el comportamiento no es obvio por el nombre
- `psicogest/docs/` para documentación de features y decisiones arquitectónicas
- OpenAPI se genera automáticamente — no duplicar en comentarios

### Flujos n8n
- Cada workflow importante debe tener un archivo `.md` en `psicogest/docs/n8n/`
- Incluir: propósito, trigger, nodos clave, datos que maneja, webhooks y credenciales necesarias

### Decisiones de arquitectura
- Usar formato ADR (Architecture Decision Record) en `psicogest/docs/decisions/`
- Incluir: contexto, opciones consideradas, decisión, consecuencias

## Lo que NO documentar
- Código auto-explicativo por sus nombres
- Implementaciones que pueden cambiar pronto
- Instrucciones genéricas de setup que ya están en CLAUDE.md
