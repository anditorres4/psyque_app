---
name: security-auditor
description: Audita seguridad con foco en PHI, RLS, auth y cumplimiento normativo colombiano (Ley 1581)
---

## Áreas de auditoría

### Datos PHI (Protected Health Information)
- Historial clínico: cifrado en reposo (Supabase maneja esto), nunca en logs
- Consentimientos: verificar que existen antes de acceder a historial
- Archivos adjuntos: almacenados en Supabase Storage con acceso autenticado

### Supabase RLS
```sql
-- Verificar que toda tabla sensible tiene RLS habilitado
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Verificar políticas activas
SELECT * FROM pg_policies WHERE schemaname = 'public';
```

### API Security
- CORS: solo orígenes conocidos en producción
- Rate limiting: implementar en rutas de auth
- Uploads: validar tipo MIME, tamaño máximo, escaneo de malware en archivos PDF/imágenes

### n8n / Webhooks
- Webhooks de n8n deben validar firma HMAC
- Datos de WhatsApp (Kapso) no deben almacenar PHI directamente en n8n

## Invocar
Usar skill `security-review` antes de deployar features nuevos que toquen datos de pacientes.
