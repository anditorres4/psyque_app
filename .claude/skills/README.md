# Skills disponibles en este proyecto

Los skills son instrucciones situacionales que Claude Code carga bajo demanda via la herramienta `Skill`.

## Skills de flujo de trabajo (invocar antes de actuar)

| Skill | Cuándo usarlo |
|-------|---------------|
| `superpowers:systematic-debugging` | Antes de proponer cualquier fix a un bug |
| `superpowers:brainstorming` | Antes de diseñar un feature nuevo |
| `superpowers:writing-plans` | Cuando hay un spec o requerimiento multi-paso |
| `superpowers:executing-plans` | Al ejecutar un plan previamente escrito |
| `superpowers:requesting-code-review` | Antes de hacer merge o al completar una feature |
| `superpowers:verification-before-completion` | Antes de declarar una tarea como completa |
| `superpowers:test-driven-development` | Al implementar cualquier feature o bugfix |

## Skills de herramientas

| Skill | Cuándo usarlo |
|-------|---------------|
| `n8n-workflow-patterns` | Al diseñar workflows de n8n |
| `n8n-node-configuration` | Al configurar nodos específicos en n8n |
| `n8n-validation-expert` | Al encontrar errores de validación en n8n |
| `claude-api` | Al trabajar con integración de Anthropic SDK |

## Cómo agregar skills locales

Crear archivo `.md` en esta carpeta con frontmatter:
```markdown
---
name: nombre-del-skill
description: Descripción de cuándo usarlo
---

## Instrucciones
...
```

Los skills globales de Superpowers están en `~/.claude/plugins/superpowers/skills/`.
