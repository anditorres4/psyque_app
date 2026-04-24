# Plan de Implementación — psyque_app vs PRD Heiko

**Fecha:** 2026-04-24  
**Contexto:** Análisis del PRD V2 de Heiko (competidor) comparado contra psyque_app. El objetivo es identificar brechas y planificar los bloques de desarrollo siguientes para alcanzar y superar las capacidades del competidor.

---

## 1. Gap Analysis: PRD Heiko vs psyque_app

### Implementado ✅
- Dashboard (citas hoy, asistencia 30d, próximas citas)
- Agenda FullCalendar (mensual/semanal/día, crear/editar/cancelar/completar/no-show)
- Disponibilidad (bloques semanales recurrentes)
- Pacientes (CRUD completo, HC#, búsqueda, paginación)
- Historia clínica básica (antecedentes JSONB, diagnóstico inicial CIE-11, plan tratamiento)
- Sesiones clínicas (draft/signed, firma SHA-256, notas append-only, Res. 1995/1999)
- Documentos clínicos (upload/download, Supabase Storage)
- Facturación (individual, bulk, PDF, email automático)
- Caja y cartera (turnos, transacciones, deuda por paciente/EPS)
- RIPS Res. 2275/2023 (validación, generación, ZIP)
- Reportes (ingresos, asistencia, tipos sesión, pacientes nuevos)
- Recordatorios automáticos por email (48h y 2h pre-cita)
- FEV/DIAN: modelos y migraciones listos, integración bloqueada en Factus

### Falta implementar ❌

| # | Feature | PRD ref |
|---|---------|---------|
| 1 | Historia clínica estructurada completa (examen mental por secciones) | §4.5 |
| 2 | Seguimiento e indicadores terapéuticos medibles | §4.7 |
| 3 | Diagnóstico asistido por IA — panel "Psyque IA" | §4.6 |
| 4 | Remisiones y derivaciones | §4.5 tabs |
| 5 | Plantillas PDF avanzadas (por perfil, toggles de secciones) | §4.8 |
| 6 | Dashboard mejorado (diagnósticos frecuentes, agenda del día) | §4.1 |
| 7 | QR / magic link de agendamiento público | §4.2 |
| 8 | Google Calendar bidireccional | §4.3, Fase 2 |
| 9 | Portal del paciente | §9.2 Fase 2 |

---

## 2. Bloques de desarrollo

---

### Bloque 1 — Examen mental estructurado

**Por qué:** Convierte la historia clínica de "campos libres" a formulario clínico profesional. Es la base para el Bloque 3 (IA), que necesita estructura de síntomas y examen mental para generar sugerencias.

#### Backend

**Migration:** `psicogest/backend/alembic/versions/0018_add_mental_exam_to_clinical_records.py`
- `op.add_column("clinical_records", sa.Column("mental_exam", JSONB(), nullable=True))`
- `op.add_column("clinical_records", sa.Column("presenting_problems", sa.Text(), nullable=True))`
- `op.add_column("clinical_records", sa.Column("symptom_description", sa.Text(), nullable=True))`

**Modify:** `psicogest/backend/app/models/clinical_record.py`
- Agregar campos: `mental_exam: Mapped[dict | None]` (JSONB), `presenting_problems: Mapped[str | None]`, `symptom_description: Mapped[str | None]`

**Modify:** `psicogest/backend/app/schemas/clinical_record.py`
- Nuevo schema `MentalExamBlock`:
  ```
  appearance, psychomotor, cognition, thought,
  perception, affect, insight, judgment, language, orientation
  ```
  (todos `str | None`)
- Agregar `mental_exam: MentalExamBlock | None`, `presenting_problems`, `symptom_description` a `ClinicalRecordDetail` y `ClinicalRecordUpsert`

*No se requieren cambios en endpoints — ya existe `PUT /patients/{id}/clinical-record`.*

#### Frontend

**Modify:** `psicogest/frontend/src/components/patients/ClinicalRecordSection.tsx`
- Nueva sección expandible **"Síntomas y Motivo de Consulta"**: campos `presenting_problems` (textarea) y `symptom_description` (textarea)
- Nueva sección expandible **"Examen Mental"**: 10 campos de texto estructurado con labels clínicos (Apariencia, Psicomotricidad, Cognición, Pensamiento, Percepción, Afecto, Insight, Juicio, Lenguaje, Orientación)

**Modify:** `psicogest/frontend/src/lib/api.ts`
- Agregar `MentalExamBlock` interface y campos a `ClinicalRecord`

---

### Bloque 2 — Seguimiento e indicadores terapéuticos

**Por qué:** Los indicadores de progreso permiten al psicólogo demostrar avance terapéutico con datos. PRD §4.7 muestra creación de indicadores con nombre/descripción y visualización de avance.

#### Backend

**New model:** `psicogest/backend/app/models/therapy_indicator.py`
```python
class TherapyIndicator(Base, UUIDPrimaryKey, TenantMixin, TimestampMixin):
    __tablename__ = "therapy_indicators"
    patient_id: UUID, name: str(200), description: Text|None,
    unit: str(50)|None,  # "escala 1-10", "%", "días", etc.
    initial_value: Numeric(10,2)|None, target_value: Numeric(10,2)|None,
    is_active: bool = True

class TherapyMeasurement(Base, UUIDPrimaryKey, TenantMixin):
    __tablename__ = "therapy_measurements"
    indicator_id: UUID, session_id: UUID|None,
    value: Numeric(10,2), notes: Text|None, measured_at: TIMESTAMP, created_at: TIMESTAMP
```

**Migration:** `0019_create_therapy_indicators.py`

**New schemas:** `psicogest/backend/app/schemas/therapy_indicator.py`
- `TherapyIndicatorCreate`, `TherapyIndicatorUpdate`, `TherapyIndicatorDetail`
- `TherapyMeasurementCreate`, `TherapyMeasurementDetail`
- `TherapyIndicatorWithProgress` (incluye lista de measurements para gráfico)

**New service:** `psicogest/backend/app/services/therapy_indicator_service.py`
- `create(patient_id, data)`, `update(id, data)`, `delete(id)`, `list_by_patient(patient_id)`
- `add_measurement(indicator_id, value, notes, session_id, measured_at)`
- `get_with_measurements(indicator_id)`

**New router:** `psicogest/backend/app/api/v1/indicators.py`
```
POST   /patients/{id}/indicators
GET    /patients/{id}/indicators
GET    /indicators/{id}
PUT    /indicators/{id}
DELETE /indicators/{id}
POST   /indicators/{id}/measurements
GET    /indicators/{id}/measurements
```

**Modify:** `psicogest/backend/app/models/__init__.py` y `psicogest/backend/app/main.py` — registrar modelos y router

#### Frontend

**Modify:** `psicogest/frontend/src/pages/patients/PatientDetailPage.tsx`
- Agregar tab **"Seguimiento"**

**New component:** `psicogest/frontend/src/components/patients/IndicatorsTab.tsx`
- Lista de indicadores activos: nombre, unidad, valor inicial, valor actual, meta, % progreso
- Botón "Nuevo indicador" → formulario inline o modal
- Por indicador: botón "Registrar medición" → input de valor + notas + fecha
- Sparkline de evolución temporal usando Recharts (ya en el proyecto para Reportes)
- Indicadores marcados como archivados/completados se ocultan pero pueden verse

**New hooks:** `psicogest/frontend/src/hooks/useTherapyIndicators.ts`
- `useIndicators(patientId)`, `useCreateIndicator()`, `useUpdateIndicator()`, `useDeleteIndicator()`
- `useMeasurements(indicatorId)`, `useAddMeasurement()`

**Modify:** `psicogest/frontend/src/lib/api.ts` — tipos e interfaces, métodos en namespace `indicators`

---

### Bloque 3 — Diagnóstico asistido por IA (Psyque IA)

**Por qué:** Feature estrella — el PRD de Heiko muestra el "panel IA" como diferenciador principal. Permite al psicólogo obtener sugerencias CIE-11/DSM-5 desde síntomas, con trazabilidad completa.

**Decisión técnica:** Usar Claude API con `claude-haiku-4-5-20251001` (balance costo/calidad). Backend actúa como proxy. Añadir `ANTHROPIC_API_KEY` a settings. Feature disponible solo en plan `pro` y `clinic`.

#### Backend

**Modify:** `psicogest/backend/app/core/config.py`
- `anthropic_api_key: str = ""`

**New model:** `psicogest/backend/app/models/ai_suggestion.py`
```python
class AiDiagnosisSuggestion(Base, UUIDPrimaryKey, TenantMixin):
    __tablename__ = "ai_diagnosis_suggestions"
    patient_id: UUID, session_id: UUID|None,
    input_context: JSONB,     # {chief_complaint, symptoms, mental_exam, patient_age, sex}
    suggestions: JSONB,       # [{code_cie11, description, rationale, confidence}]
    accepted_codes: JSONB,    # list[str]
    rejected_codes: JSONB,    # list[str]
    model_version: str(50),   # "claude-haiku-4-5-20251001"
    created_at: TIMESTAMP
```

**Migration:** `0020_create_ai_suggestions.py`

**New service:** `psicogest/backend/app/services/ai_service.py`
- Construye prompt estructurado con contexto clínico
- Llama `anthropic.messages.create()` — respuesta JSON parseada
- Persiste en `ai_diagnosis_suggestions` para trazabilidad/auditoría
- Si `anthropic_api_key` vacío → `raise AiServiceUnavailableError` → HTTP 503

**New schemas:** `psicogest/backend/app/schemas/ai_suggestion.py`
- `AiSuggestRequest`, `DiagnosisSuggestionItem`, `AiSuggestResponse`, `AiSuggestionFeedback`

**New router:** `psicogest/backend/app/api/v1/ai.py`
```
POST /patients/{id}/ai/suggest-diagnosis  → AiSuggestResponse
POST /ai/suggestions/{id}/feedback        → 204
GET  /patients/{id}/ai/suggestions        → list[AiSuggestionSummary]
```

**Dependencies:** Agregar `anthropic` a `requirements.txt`

#### Frontend

**New component:** `psicogest/frontend/src/components/patients/AiDiagnosisPanel.tsx`
- Panel dentro de tab "Diagnóstico" del perfil del paciente
- Textarea síntomas/motivo (pre-llena desde `presenting_problems`)
- Botón "Sugerir diagnósticos" con badge "Psyque IA" → spinner → lista
- Cada sugerencia: código CIE-11, descripción, justificación colapsable, botones ✓ / ✗
- Sugerencias aceptadas se copian al CIE-11 de la sesión activa

---

### Bloque 4 — Remisiones y derivaciones

**Por qué:** Tab "Remisiones" visible en el PRD. Flujo frecuente en psicología. Simple de implementar.

#### Backend

**New model:** `psicogest/backend/app/models/referral.py`
- `patient_id`, `session_id|None`, `referred_to_name`, `referred_to_specialty`, `referred_to_institution|None`, `reason`, `priority` (urgente/preferente/programado), `notes|None`

**Migration:** `0021_create_referrals.py`

**New schemas, service y router:**
```
POST /patients/{id}/referrals
GET  /patients/{id}/referrals
GET  /referrals/{id}/pdf  → StreamingResponse PDF
```

#### Frontend
- Tab **"Remisiones"** en `PatientDetailPage.tsx`
- Componente `ReferralsTab.tsx`: lista + formulario + descarga PDF

---

### Bloque 5 — Plantillas PDF avanzadas

**Por qué:** PRD §4.8 muestra toggles y plantillas por perfil (adulto, infante, familiar).

#### Backend
- **Modify** `history_pdf_service.py`: parámetros `include_diagnosis`, `include_treatment`, `include_evolution`, `patient_profile`
- **Modify endpoint** `GET /patients/{id}/history-export`: query params con opciones

#### Frontend
- **Modify** `PatientDetailPage.tsx`: modal con toggles antes de descargar HC

---

### Bloque 6 — Dashboard mejorado

**Por qué:** PRD §4.1 muestra diagnósticos frecuentes. KPI clínico diferenciador.

#### Backend
- **New endpoint** `GET /reports/top-diagnoses` — top 10 CIE-11 por frecuencia en `sessions`

#### Frontend
- **Modify** `DashboardPage.tsx`: widget "Diagnósticos frecuentes" con código + descripción + count

---

### Bloque 7 — QR / Magic link de agendamiento

**Por qué:** PRD §4.2. Psicólogo comparte QR, paciente agenda directamente.

#### Backend
- Migration: `booking_slug`, `booking_enabled`, `booking_welcome_message` en tenants
- Migration: estado `pending_confirmation` en appointments
- **Rutas públicas (sin auth):**
  - `GET /public/booking/{slug}` — info + slots disponibles
  - `POST /public/booking/{slug}/request` — crea appointment, envía email

#### Frontend
- **New page pública** `/book/:slug` — sin AppLayout
- **New tab "Agendamiento"** en Settings: toggle, URL, QR, mensaje
- **Modify AgendaPage**: mostrar `pending_confirmation` + botones confirmar/rechazar

---

### Bloques futuros (Fase 2/3 — no planificar ahora)

- **Bloque 8 — Google Calendar bidireccional:** OAuth2, webhooks, job de sync
- **Bloque 9 — Portal del paciente:** subaplicación Supabase Magic Link, subdomain propio

---

## 3. Orden de implementación

| # | Bloque | Complejidad | Prerequisito |
|---|--------|-------------|--------------|
| 1 | Examen mental estructurado | Media | — |
| 2 | Seguimiento e indicadores | Media | — |
| 4 | Remisiones | Baja | — |
| 6 | Dashboard mejorado | Baja | — |
| 5 | Plantillas PDF avanzadas | Media | Bloque 1 |
| 3 | Diagnóstico IA | Alta | Bloque 1 |
| 7 | QR / magic link | Alta | — |

---

## 4. Decisiones técnicas

- **IA:** Claude API `claude-haiku-4-5-20251001`, `ANTHROPIC_API_KEY` en env, restringida a plan pro/clinic
- **QR:** Reutilizar `react-qr-code` (ya planeado para FEV)
- **Slots públicos:** Reutilizar lógica `AppointmentService._check_availability()`
- **FEV/DIAN:** Bloqueado Factus — 7 tareas en memoria del proyecto

---

## 5. Verificación por bloque

- **Bloque 1:** `PUT /patients/{id}/clinical-record` persiste `mental_exam` JSONB. 10 campos visibles en UI.
- **Bloque 2:** CRUD indicadores. Mediciones con fecha. Gráfico sparkline de progreso.
- **Bloque 3:** Sugerencias CIE-11 retornadas. Feedback persiste. 503 si key vacía.
- **Bloque 4:** PDF de remisión descargable. Lista en tab del paciente.
- **Bloque 5:** PDF excluye secciones según toggles. Plantilla infante incluye responsable legal.
- **Bloque 6:** Widget top diagnósticos visible con últimos 3 meses.
- **Bloque 7:** `/book/:slug` accesible sin auth. Appointment `pending_confirmation` creado. Email al psicólogo.
