# Actualización RIPS — Estado de cumplimiento normativo

---

## Contexto normativo: dos resoluciones en juego

El sistema de RIPS en Colombia ha tenido dos actualizaciones recientes importantes:

| Norma | Fecha | Estado |
|-------|-------|--------|
| **Res. 2275 de 2023** (con modificaciones 558/2024 y 1884/2024) | 2023–2024 | **Derogada** por la nueva resolución de 2026 |
| **Res. 0948 de 2026** | 14 de mayo de 2026 | **Vigente** — nueva norma que reemplaza todo lo anterior |

La **Resolución 0948 del 14 de mayo de 2026** es la norma actualmente vigente. Fue firmada hace apenas días y reemplaza completamente la normativa de 2023. Sus documentos técnicos (la especificación detallada de cómo generar los RIPS) fueron publicados el 29 de abril de 2026.

---

## Lo que implementamos en PsyCent

PsyCent implementó el nuevo formato de RIPS basado en los **lineamientos v4.3 del MinSalud (manual API Docker v4.3, vigente desde 2024)**. Este formato es el que usa el mecanismo de validación del MinSalud (el Docker que recibe los RIPS) y fue diseñado para cumplir con la Res. 2275/2023 y sus actualizaciones.

**La buena noticia:** La Res. 0948/2026 mantiene la **misma estructura técnica JSON** (mismo formato, mismos campos principales). No es un cambio de formato — es una consolidación y ajuste de la norma anterior. El mecanismo de validación (API Docker del MinSalud) sigue siendo el mismo.

---

## ¿Qué cambió en la Res. 0948/2026 respecto a lo anterior?

### Cambios que NO afectan a los psicólogos independientes de PsyCent

- Se excluyeron formalmente del ámbito de aplicación los **centros de cirugía estética**, **medicina alternativa sin CUPS**, **centros de investigación** y **centros de reconocimiento de conductores** — estos nunca aplicaron para psicólogos
- Se reorganizó y consolidó la norma en un solo documento (antes había 3 resoluciones vigentes simultáneamente)
- Se ajustaron algunos campos del Documento Técnico 1 (especificaciones técnicas)

### Cambios relevantes para psicólogos independientes

**Umbral de facturación electrónica (3.500 UVT):**
- Si el psicólogo **no supera 3.500 UVT anuales** en ventas: puede emitir factura convencional (no electrónica) a sus pacientes particulares, pero **sí debe reportar RIPS** usando el módulo "RIPS sin factura"
- Si el psicólogo **supera 3.500 UVT anuales**: debe emitir Factura Electrónica de Venta (FEV) en salud para todas sus facturas, incluyendo las de pacientes particulares
- Si el psicólogo **factura a alguna EPS/ERP**: debe usar FEV en salud para absolutamente todas sus facturas, sin importar el monto

> Para referencia: 3.500 UVT en 2026 equivalen aproximadamente a **$175 millones de pesos en ventas anuales**. La mayoría de psicólogos independientes están por debajo de este umbral.

---

## Estado de cumplimiento de PsyCent

### Lo que está implementado y en producción ✅

1. **Nuevo formato JSON RIPS (v4.3)** — El archivo generado cumple con la estructura que acepta el mecanismo de validación del MinSalud
2. **Campos nuevos obligatorios por sesión** — 7 campos clínicos/administrativos agregados (modalidad, grupo de servicios, código 706 = Salud Mental, finalidad, causa, concepto de recaudo, moderador)
3. **Campos nuevos por paciente** — País de residencia, país de origen, indicador de incapacidad
4. **Módulo "RIPS sin factura"** — El flujo correcto para psicólogos independientes que atienden pacientes particulares
5. **Envío automático a la API del MinSalud (Premium)** — Código listo, obtiene el CUV automáticamente
6. **ZIP descargable (Estándar)** — El psicólogo descarga y sube al portal del MinSalud manualmente
7. **Base de datos actualizada (migración 0042)** — Aplicada en producción

### Verificación con la Res. 0948/2026 ✅ Completada (2026-05-23)

Se comparó el **Documento Técnico 1** (29 de abril de 2026, 140 páginas) y el **Documento Técnico 2** campo por campo contra la implementación actual de PsyCent. Resultado:

**Implementación compatible ✅** — La estructura JSON, los campos y sus reglas de validación son los mismos. Se encontró **un solo bug**:

| Campo | Problema | Corrección |
|-------|----------|-----------|
| `tipoDiagnosticoPrincipal` | Se enviaba `"1"` (1 carácter). El spec exige `"01"` o `"02"` (2 caracteres) | Corregido — migración `0043` + modelo + servicio. Default ahora es `"01"` (diagnóstico confirmado) |

El campo indica si el diagnóstico es confirmado (`"01"`) o presuntivo (`"02"`). No afecta la aceptación del RIPS por el MinSalud en la práctica (es una notificación, no un error bloqueante), pero queda normalizado.

**Documento Técnico 2** — Aplica únicamente a la **Factura Electrónica de Venta (FEV XML)**, no al RIPS JSON. Define campos adicionales del sector salud que van en el XML de la DIAN (CODIGO_PRESTADOR, MODALIDAD_PAGO, COBERTURA_PLAN_BENEFICIOS, COPAGO, CUOTA_MODERADORA, etc.). Esto es relevante para el **sprint Factus** — cuando se implemente la emisión de FEV a la DIAN, estos campos deben incluirse en el XML de la factura.

---

## ¿Qué falta para que el sistema esté 100% operativo?

### 1. Docker MinSalud (bloqueante para plan Premium)

El envío automático al MinSalud requiere que **el Docker del MinSalud esté instalado y funcionando** en un servidor. Este es el sistema que provee el MinSalud para que las IPS y profesionales envíen sus RIPS via API.

**Estado actual:** La variable `FEVRIPS_BASE_URL` en Railway está vacía — el Docker aún no está configurado.

**Opciones:**
- **Railway:** Crear un servicio nuevo que corra el Docker. ~$5–15 USD/mes adicional
- **VPS propio:** Instalar en un servidor independiente (DigitalOcean, Linode, etc.)
- **Instancia propia del psicólogo:** El MinSalud permite que cada prestador configure la suya

Una vez configurado, solo hay que:
1. Subir el Docker al servidor
2. Agregar `FEVRIPS_BASE_URL=https://<dirección>` en Railway
3. El psicólogo Premium configura su contraseña SISPRO en su perfil de PsyCent

### 2. Verificación de compatibilidad con Documento Técnico 1 (Res. 0948/2026)

Revisar el anexo técnico de la nueva resolución y confirmar que los campos que genera PsyCent siguen siendo válidos. Baja prioridad — el mecanismo de validación del MinSalud (la API Docker) es el mismo y los cambios esperados son menores.

### 3. Facturación Electrónica (Factus → DIAN) — Próximo sprint

Una vez que el psicólogo tiene el CUV del RIPS, puede emitir la factura electrónica a la DIAN a través de Factus. PsyCent tiene el diseño listo pero no está implementado.

> Aplica principalmente a psicólogos que superan las 3.500 UVT o que facturan a EPS.

---

## Flujo operativo por plan

**Plan Estándar:**
```
1. Psicólogo firma las sesiones del mes
2. RIPS → Generar → Descargar ZIP
3. El psicólogo sube el ZIP al portal MinSalud manualmente
4. El portal le entrega el CUV
```

**Plan Premium (cuando el Docker esté listo):**
```
1. Psicólogo firma las sesiones del mes
2. RIPS → Generar → "Enviar al MinSalud" (un clic)
3. PsyCent obtiene el CUV automáticamente
4. Se habilita el botón "Facturar" (sprint Factus — pendiente)
```

---

## Resumen ejecutivo

| Item | Estado |
|------|--------|
| Formato JSON RIPS v4.3 implementado | ✅ En producción |
| Campos nuevos paciente/sesión en BD | ✅ En producción (migración 0042) |
| ZIP descargable — Plan Estándar | ✅ Listo para usar |
| Código de envío automático — Plan Premium | ✅ Código completo |
| Docker MinSalud configurado | ⚠️ Pendiente — decisión de infraestructura |
| Variable `FEVRIPS_BASE_URL` en Railway | ⚠️ Pendiente — depende del Docker |
| Verificación Documento Técnico 1 (Res. 0948/2026) | ✅ Completada — bug `tipoDiagnosticoPrincipal` corregido (migr. 0043) |
| Facturación electrónica (Factus → DIAN) | 🔜 Próximo sprint |

---

## Normas de referencia

- **Resolución 0948 de 2026** (14 may 2026) — norma vigente, reemplaza la 2275/2023
- Documento Técnico 1: Especificaciones técnicas de campos y reglas de validación del RIPS (29 abr 2026)
- Documento Técnico 2: Campos adicionales del sector salud para la FEV (29 abr 2026)
- Manual API Docker FEV-RIPS v4.3 — manual técnico del mecanismo de validación del MinSalud

---

*Última actualización: 2026-05-23 — Verificación Doc. Técnico 1 y 2 completa*
