# UX/UI Improvements — PsyCent

**Fecha:** 2026-07-07  
**Alcance:** Frontend React (`psicogest/frontend/src/`)  
**Dispositivo principal:** Desktop/laptop  
**Flujos de mayor fricción:** Documentación de sesión clínica, navegación paciente ↔ sesión  
**Resultado esperado:** Plan de implementación priorizado en 4 tiers (P0–P3)

---

## Contexto

Análisis UX/UI completo de las 10 pantallas principales de PsyCent. Se identificaron 16 oportunidades agrupadas en 4 niveles de prioridad. Los P0 son bugs activos que afectan la confianza del usuario (datos falsos, navegación que expulsa del contexto). Los P1 atacan directamente los flujos de mayor fricción reportados. Los P2–P3 consolidan consistencia y polish.

---

## P0 — Bugs disfrazados de UX (1–2 días)

### P0-A: Eliminar sparklines hardcodeados del Dashboard

**Archivo:** `psicogest/frontend/src/pages/DashboardPage.tsx:11-14`

**Problema:** Cuatro arrays constantes (`SPARK_APT`, `SPARK_NOTES`, `SPARK_ATTEND`, `SPARK_SESS`) con valores ficticios se muestran como gráficas de tendencia reales en los KPIs. Un psicólogo con 0 citas ve la misma curva ascendente que uno con 20.

**Solución — opción A (recomendada):** Extender el endpoint `GET /api/v1/dashboard/stats` para devolver arrays históricos de 12 puntos por métrica (agrupados por semana o por día según el volumen). Pasar esos arrays al componente `KPI`.

**Solución — opción B (rápida):** Eliminar los sparklines del componente `KPI` hasta que el backend los tenga. Mejor sin gráfica que con gráfica falsa.

**Criterio de aceptación:** Ningún dato visual en el Dashboard es constante/hardcodeado.

---

### P0-B: "Guardar borrador" no debe navegar fuera de SessionDocPage

**Archivo:** `psicogest/frontend/src/pages/sessions/SessionDocPage.tsx:159`

**Problema:** `saveMutation.onSuccess` llama `navigate("/agenda")`. El psicólogo guarda su nota clínica y es expulsado a la Agenda, perdiendo el contexto de la sesión en curso.

**Solución:**
- Remover `navigate("/agenda")` del `onSuccess` de `saveMutation`.
- Mostrar feedback inline: texto "Guardado ✓" junto al botón durante 2 s, luego desaparece.
- `signMutation.onSuccess` **sí** navega a `/agenda` (la sesión queda inmutable, tiene sentido cerrar).
- El botón "← Sesiones" en el header es la única salida explícita.

**Criterio de aceptación:** Guardar borrador deja al psicólogo en la misma página. Solo firmar navega afuera.

---

### P0-C: Tab RIPS en PatientDetailPage filtra por paciente

**Archivo:** `psicogest/frontend/src/pages/patients/PatientDetailPage.tsx:733`

**Problema:** `RipsTab` llama `api.rips.list()` sin filtro, mostrando TODOS los RIPS del consultorio dentro del perfil de un paciente individual. Confuso y potencialmente una fuga de información.

**Solución — Frontend:** `RipsTab` recibe `patientId: string` como prop y lo pasa al API call: `api.rips.list({ patient_id: patientId })`.

**Solución — Backend:** El endpoint `GET /api/v1/rips` debe aceptar `patient_id` como query param opcional y filtrar los resultados. Verificar si `rips_service.py` ya lo soporta; si no, agregar el filtro.

**Criterio de aceptación:** El tab RIPS de un paciente muestra solo las exportaciones que incluyen sesiones de ese paciente.

---

## P1 — Fricción alta, flujo clínico (3–4 días)

### P1-A: Autosave en SessionDocPage

**Archivo:** `psicogest/frontend/src/pages/sessions/SessionDocPage.tsx`

**Problema:** No hay guardado automático. Pérdida total de notas si el psicólogo cierra el tab o pierde conexión.

**Solución:**
- Debounce de 30 s sobre cualquier cambio en `form`, `mentalExam`, `patientSummary` u `homework`.
- El save silencioso no muestra spinner ni navega. Extraer la lógica de guardado a una función `saveSession()` que el botón manual y el autosave comparten. El autosave llama `saveSession()` directamente (sin callback de navegación); el botón manual muestra el estado "Guardando…" / "Guardado ✓".
- Indicador en el header: `"Guardado hace X s"` / `"Guardando…"` / `"Sin cambios"`.
- Usar `useRef` para el timer y cleanup en `useEffect` para evitar saves post-unmount.
- El autosave se desactiva cuando `readOnly === true` (sesión firmada).

**Criterio de aceptación:** Cambios en cualquier campo se persisten automáticamente en ≤ 35 s sin acción del usuario.

---

### P1-B: Agrupación visual de campos en SessionDocPage

**Archivo:** `psicogest/frontend/src/pages/sessions/SessionDocPage.tsx` (panel izquierdo)

**Problema:** ~12 campos en lista plana sin jerarquía. Scroll largo para encontrar un campo. No hay señales visuales de qué sección clínica corresponde a cada campo.

**Solución:** Agrupar en 4 secciones colapsables con encabezado:

| Sección | Campos incluidos | Estado inicial |
|---|---|---|
| Diagnóstico | CIE-11, descripción diagnóstico, tipo DX, urgencia | Abierta |
| Nota clínica | Motivo de consulta, intervención, evolución, examen mental | Abierta |
| Plan | Plan próxima sesión, objetivos terapéuticos | Abierta |
| Administrativo | CUPS, fechas inicio/fin, valor sesión, N° autorización | Colapsada |

- Cada sección tiene un `<button>` de toggle con ícono `ChevronDown/Up`.
- Estado de colapso persiste en `localStorage` con clave `session-doc-sections`.
- En modo `readOnly` las secciones igualmente colapsan/expanden pero los campos no son editables.

**Criterio de aceptación:** El psicólogo puede colapsar "Administrativo" y ver solo los campos clínicos relevantes durante la sesión.

---

### P1-C: CIE-11 combobox con navegación por teclado

**Archivo:** `psicogest/frontend/src/pages/sessions/SessionDocPage.tsx:357-388`

**Problema:** Buscador CIE-11 custom (`input` + `ul`) sin soporte de teclado. El psicólogo debe usar el mouse para seleccionar diagnóstico, interrumpiendo el flujo de documentación.

**Solución:**
- Crear componente `Combobox` en `psicogest/frontend/src/components/ui/combobox.tsx`.
- Soportar: `↓`/`↑` navega resultados, `Enter` selecciona el resaltado, `Escape` cierra sin seleccionar, `Tab` avanza al siguiente campo.
- ARIA: `role="combobox"`, `aria-expanded`, `aria-activedescendant`, `role="listbox"` en la lista.
- El mismo componente se puede reutilizar en `PatientForm` si tiene búsquedas similares.

**Criterio de aceptación:** El psicólogo puede buscar y seleccionar un diagnóstico CIE-11 sin tocar el mouse.

---

### P1-D: Breadcrumb y navegación contextual paciente ↔ sesión

**Archivos:** `SessionDocPage.tsx`, `PatientDetailPage.tsx`, `PatientsPage.tsx`

**Problema:** No hay camino de vuelta contextual. Desde `SessionDocPage` el back-link lleva a la lista global de sesiones, no al paciente. Desde `PatientDetailPage` no hay back a la lista de pacientes.

**Solución:**
- Componente `Breadcrumb` en `psicogest/frontend/src/components/ui/breadcrumb.tsx` con props `items: {label: string, href?: string}[]`.
- En `SessionDocPage`: `Pacientes › [Nombre paciente] › Sesión [fecha]`. El nombre del paciente linkea a `/patients/:id?tab=sesiones`.
- En `PatientDetailPage`: `Pacientes › [Nombre paciente]`. "Pacientes" linkea a `/patients`.
- El tab activo se restaura via query param `?tab=sesiones` — `PatientDetailPage` ya lee `activeTab` desde estado; leer también desde `searchParams` al montar.
- `SessionDocPage` debe cargar el nombre del paciente: ya tiene `sess.patient_id`; hacer una query ligera a `api.patients.get(sess.patient_id)` (o extender el endpoint de sesión para incluir `patient_name`).

**Criterio de aceptación:** Desde `SessionDocPage` un clic lleva al perfil del paciente con el tab de sesiones activo. Desde `PatientDetailPage` un clic lleva a la lista de pacientes.

---

## P2 — Consistencia de UI (2–3 días)

### P2-A: Sidebar — etiquetas, íconos y badge de borradores

**Archivo:** `psicogest/frontend/src/components/layout/Sidebar.tsx`

Cambios:
1. `"Sesiones activas"` → `"Sesiones"` (la página muestra todas, no solo activas).
2. Ícono de Cartera: `FileText` → `Wallet` (lucide). Ícono de Caja: `CreditCard` → `DollarSign`.
3. Badge numérico sobre el ícono de "Sesiones" cuando hay sesiones en estado `draft`. El conteo viene del hook `useSessions({ status: "draft" })` ya usado en Dashboard — reutilizar.

---

### P2-B: Nombre real del usuario en la sidebar

**Archivo:** `psicogest/frontend/src/components/layout/Sidebar.tsx:133-148`

**Problema:** Avatar muestra "PS" / "Psicólogo" hardcodeados.

**Solución:** Leer del hook de auth. `useAuth()` ya expone `user`. Usar `user.user_metadata?.full_name` (si está) o derivar iniciales del email. El avatar color se mantiene pero las iniciales y el nombre son dinámicos.

```tsx
const initials = user?.user_metadata?.full_name
  ? user.user_metadata.full_name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()
  : user?.email?.slice(0, 2).toUpperCase() ?? "PS";
```

---

### P2-C: Filtros uniformes en PatientsPage

**Archivo:** `psicogest/frontend/src/pages/patients/PatientsPage.tsx:122-145`

**Problema:** Los `<select>` nativos son inconsistentes con el patrón de pill-buttons de `AgendaPage` y `SessionsPage`.

**Solución:** Reemplazar los dos `<select>` con pill-buttons del mismo estilo que los filtros de Agenda:
- Fila de pills: `Todos | Activos | Inactivos` (estado del paciente)
- Segunda fila: `Con y sin EPS | Con EPS | Sin EPS`

Mismo estilo inline que `STATUS_FILTERS` en `AgendaPage.tsx:51-57`.

---

### P2-D: Normalizar Button vs PsyButton

**Archivos:** `PatientDetailPage.tsx`, `PatientsPage.tsx`

**Regla:** Acciones primarias → `PsyButton variant="primary"`. Acciones secundarias/outline → `PsyButton variant="ghost"` o `Button variant="outline"`. Nunca mezclar en la misma barra de acciones.

**Cambios concretos:**
- `PatientDetailPage.tsx`: botón "Editar" y "Exportar HC" → `PsyButton variant="ghost"`. Botón "Invitar al portal" → `PsyButton variant="ghost"`.
- `PatientsPage.tsx`: botón "+ Nuevo paciente" → `PsyButton variant="primary"`.

---

### P2-E: Separar modal de exportación en PatientDetailPage

**Archivo:** `psicogest/frontend/src/pages/patients/PatientDetailPage.tsx:267-393`

**Problema:** Un solo modal mezcla exportación de historia clínica y constancia de asistencia — dos acciones sin relación directa.

**Solución:** Dos botones separados en el header del paciente:
- `"Exportar HC"` → abre `ExportHistoryDialog` (solo las opciones de historia clínica).
- `"Constancia"` → abre `AttendanceCertDialog` (solo las opciones de fechas y conteo).

Cada diálogo es más pequeño y enfocado. El código existente se divide en dos componentes extraídos.

---

## P3 — Polish (1–2 días)

### P3-A: Contador de palabras en textareas clínicos

**Archivo:** `psicogest/frontend/src/pages/sessions/SessionDocPage.tsx`

Mostrar `"X palabras"` debajo de los campos "Motivo de consulta", "Intervención" y "Evolución" cuando tienen foco. Texto pequeño (`psy-mono text-[10px]`), alineado a la derecha, color `psy-ink-4`. Solo visible con foco para no recargar la UI.

---

### P3-B: EmptyState mejorado en PatientsPage

**Archivo:** `psicogest/frontend/src/pages/patients/PatientsPage.tsx:177-181`

Reemplazar el texto plano con el componente `EmptyState` existente. Cuando hay término de búsqueda activo, mostrar:
- Título: `"Sin resultados para '[término]'"`
- Descripción: `"Intenta con otro nombre, apellido o número de documento."`
- Acción: botón `"Limpiar búsqueda"` que resetea `search` y `filterActive`.

---

### P3-C: Búsqueda y filtro de fecha en SessionsPage

**Archivo:** `psicogest/frontend/src/pages/sessions/SessionsPage.tsx`

Agregar sobre la tabla:
- Input de búsqueda client-side por `patient_name` (filtrar sobre `data.items` ya cargados).
- Selector de mes (`<select>` o pills de últimos 3/6/12 meses) que pase `date_from`/`date_to` al hook `useSessions`.

El backend ya acepta params de fecha en el endpoint de sesiones.

---

### P3-D: Reemplazar "Exportar día" en Dashboard

**Archivo:** `psicogest/frontend/src/pages/DashboardPage.tsx:151`

El botón "Exportar día" (ícono `Download`) no tiene función implementada. Dos opciones:
- **Opción A:** Eliminar el botón.
- **Opción B:** Reemplazar por `"+ Nueva cita"` que navega a `/agenda` con `?new=1` para abrir el form de nueva cita directamente.

**Decisión:** Opción B — es la acción más frecuente desde el dashboard y ya tiene precedente en el diseño.

---

## Resumen de cambios

| ID | Descripción | Archivo(s) principal(es) | Prioridad |
|---|---|---|---|
| P0-A | Eliminar sparklines hardcodeados | `DashboardPage.tsx` + backend | P0 |
| P0-B | Guardar borrador no navega | `SessionDocPage.tsx:159` | P0 |
| P0-C | RIPS filtrado por paciente | `PatientDetailPage.tsx:733` + backend | P0 |
| P1-A | Autosave 30s en SessionDoc | `SessionDocPage.tsx` | P1 |
| P1-B | Agrupación visual 4 secciones | `SessionDocPage.tsx` | P1 |
| P1-C | CIE-11 combobox con teclado | `SessionDocPage.tsx` + nuevo `combobox.tsx` | P1 |
| P1-D | Breadcrumb paciente ↔ sesión | `SessionDocPage.tsx`, `PatientDetailPage.tsx` | P1 |
| P2-A | Sidebar etiquetas + íconos + badge | `Sidebar.tsx` | P2 |
| P2-B | Nombre real en sidebar | `Sidebar.tsx` | P2 |
| P2-C | Filtros pill en PatientsPage | `PatientsPage.tsx` | P2 |
| P2-D | Normalizar Button vs PsyButton | `PatientDetailPage.tsx`, `PatientsPage.tsx` | P2 |
| P2-E | Separar modal exportación | `PatientDetailPage.tsx` | P2 |
| P3-A | Word count en textareas | `SessionDocPage.tsx` | P3 |
| P3-B | EmptyState en búsqueda pacientes | `PatientsPage.tsx` | P3 |
| P3-C | Búsqueda + fecha en SessionsPage | `SessionsPage.tsx` | P3 |
| P3-D | Reemplazar "Exportar día" | `DashboardPage.tsx` | P3 |

**Esfuerzo total estimado:** 7–11 días de frontend. Los P0 tienen componente de backend (P0-A sparklines, P0-C filtro RIPS).

---

## Decisiones explícitas

- **Dark mode:** fuera de scope. El CLAUDE.md lo marca como "planificado"; no se toca aquí.
- **Mobile:** fuera de scope. El psicólogo usa desktop.
- **Portal paciente:** fuera de scope. Tiene su propio layout y flujo.
- **P0-A opción de implementación:** si el backend tarda más de 1 día en agregar sparklines históricos, se ejecuta opción B (eliminar) y se hace P0-A como tarea backend separada.
- **P1-D nombre de paciente en breadcrumb:** si extender el endpoint de sesión para incluir `patient_name` es más rápido que una segunda query, se prefiere esa opción.
