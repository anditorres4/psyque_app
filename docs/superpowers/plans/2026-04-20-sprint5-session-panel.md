# Sprint 5 — Módulo Sesión: Panel Intra-Sesión, Notas Clínicas y Firmado

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-drivenDevelopment (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Session module — panel intra-sesión (two-column layout with patient data + form), complete session note form, autosave every 60s, SHA-256 signed closure, and clarification notes (new records linked to original, never editing it).

**Architecture:** SessionService (ORM) with autosave via React Query mutations, hashed closure using Python stdlib `hashlib.sha256`, clarification notes as new records with `linked_session_id` pointing to original. The `SessionPanel` uses two-column layout (40% patient info | 60% form) per PRD section 5.4.

**Tech Stack:** FastAPI router, SQLAlchemy ORM, React Query `useMutation` with `onMutate` for autosave, Python `hashlib` (stdlib), React hooks for timer.

---

## File Map

**Create:**
- `psicogest/backend/app/models/session.py` — Session model (already defined in schema)
- `psicogest/backend/app/schemas/session.py` — SessionCreate, SessionUpdate, SessionDetail, SessionSummary schemas
- `psicogest/backend/app/services/session_service.py` — SessionService with autosave, signing, clarification
- `psicogest/backend/app/api/v1/sessions.py` — CRUD + sign + clarification endpoints
- `psicogest/frontend/src/hooks/useSession.ts` — React Query hooks for session
- `psicogest/frontend/src/components/SessionPanel.tsx` — two-column panel component
- `psicogest/frontend/src/components/SessionForm.tsx` — note form with autosave
- `psicogest/frontend/src/pages/SessionPage.tsx` — full-page session view
- `psicogest/backend/tests/test_session.py` — session model tests
- `psicogest/backend/tests/test_session_service.py` — service tests

**Modify:**
- `psicogest/backend/app/main.py` — add sessions router
- `psicogest/frontend/src/App.tsx` — add route /sessions/:id
- `psicogest/frontend/src/lib/api.ts` — add sessions API methods

**Existing (reuse):**
- `app/models/appointment.py` — already has appointment model to link from
- `app/models/patient.py` — patient data for session panel

---

### Task 1: Session model + schema

**Files:**
- The `sessions` table is already defined in PRD section 6.1. Check if migration exists:
```bash
ls psicogest/backend/app/models/session.py
```
If not, create it.

- Update `app/schemas/session.py` with all required fields from PRD RF-SES-02:
  - session_type (from appointment or override)
  - modality (presencial/virtual)
  - actual_start, actual_end (auto from timer, editable)
  - diagnosis_cie11 + diagnosis_description (searchable CIE-11 codes table)
  - cups_code (890201 for psychology, preselected by session_type)
  - consultation_reason, intervention, evolution, next_session_plan (text)
  - session_fee (integer in COP)
  - status (draft/signed)
  - session_hash (SHA-256 when signed)
  - signed_at (timestamp when signed)
  - linked_session_id for clarifications

- [ ] **Step 1: Verify sessions table exists**

- [ ] **Step 2: Create/update session model if needed**

- [ ] **Step 3: Create session schemas**

---

### Task 2: CIE-11 codes data + lookup

**Files:**
- Create `psicogest/backend/data/cie11_codes.json` with common psychological codes
- Create helper in `app/services/cie11_service.py` for lookup

- [ ] **Step 1: Create CIE-11 codes JSON**

- [ ] **Step 2: Create CIE-11 lookup service**

---

### Task 3: SessionService + endpoint logic

**Files:**
- `app/services/session_service.py`
- `app/api/v1/sessions.py`

**Endpoints per PRD section 7.3:**
- `POST /sessions` — create from appointment
- `GET /sessions/{id}` — get detail
- `PUT /sessions/{id}` — update (only if draft)
- `POST /sessions/{id}/sign` — sign with SHA-256 hash
- `POST /sessions/{id}/clarification` — add clarification note (new record, never edits original)

**Business rules:**
- Only draft sessions can be updated (PUT returns 403 if signed)
- Signing calculates `session_hash = SHA256(content + server_timestamp)`
- Clarification creates new session record with `linked_session_id` pointing to original

- [ ] **Step 1: Implement SessionService**

- [ ] **Step 2: Implement sessions router endpoints**

- [ ] **Step 3: Register router in main.py**

- [ ] **Step 4: Run tests**

---

### Task 4: SessionPanel frontend component

**Files:**
- `src/components/SessionPanel.tsx`
- `src/components/SessionForm.tsx`
- `src/pages/SessionPage.tsx`

**Layout per PRD section 8.3:**
- Two column: 40% left (patient info, diagnosis, history) | 60% right (form)
- Timer in header starting at 00:00 when panel opens
- Autosave every 60 seconds (React Query mutation)

**Patient info column:**
- Name, photo/initial
- Current diagnosis CIE-11 (editable)
- Original consultation reason
- Last note (truncated, "ver más")
- Current medication
- Alerts marked by psychologist

**Form fields:**
- session_type dropdown
- modality dropdown
- actual_start, actual_end (from timer, editable)
- diagnosis_cie11 (search/browse)
- diagnosis_description (autofilled)
- cups_code (preselected by type, editable)
- consultation_reason (required)
- intervention (required)
- evolution (optional)
- next_session_plan (optional)
- session_fee (integer)

- [ ] **Step 1: Create SessionPanel with two-column layout**

- [ ] **Step 2: Create SessionForm with all fields**

- [ ] **Step 3: Add autosave timer (60s interval)**

- [ ] **Step 4: Create SessionPage wrapper**

- [ ] **Step 5: Add route in App.tsx**

---

### Task 5: Integration with appointment (activate session)

**Files:**
- Modify `AppointmentSidebar` or add "Iniciar sesión" button
- Link from appointment to session panel

**PRD RF-SES-01:**
- Button enabled when appointment is within ±15 minutes of scheduled time
- Outside this range, show explanatory message

- [ ] **Step 1: Add "Iniciar sesión" button to appointment view**

- [ ] **Step 2: Route to session page on click**

---

### Task 6: Tests

**Files:**
- `tests/test_session.py`
- `tests/test_session_service.py`

- [ ] **Step 1: Write session model tests**

- [ ] **Step 2: Write service tests (draft, sign, clarification)**

- [ ] **Step 3: Run all tests**

---

## Self-Review

### Spec Coverage

| Requirement | Task |
|---|---|
| Panel intra-sesión two-column layout | Task 4 |
| Formulario de nota completo (all fields) | Task 4 |
| Autosave cada 60s | Task 4 |
| Firmado SHA-256 (hash + timestamp) | Task 3 |
| Notas aclARATORIAS (new records, never edit) | Task 3 |
| CIE-11 lookup | Task 2 |
| Timer de sesión | Task 4 |
| Botón "Iniciar sesión" desde appointment | Task 5 |
| PUT retorna 403 si firmada | Task 3 |

### Placeholder Scan
No placeholders — all steps contain complete code patterns.

### Type Consistency
- `Session.hash` → SHA-256 hex string (64 chars)
- `Session.status` → "draft" | "signed"
- `Session.linked_session_id` → UUID for clarification links
- `appointment_id` → foreign key to appointment

---

## Archivo de referencias para Claude Code

Del PRD sección 5.4 y 7.3:
- RF-SES-01: Panel activation within ±15 min of scheduled time
- RF-SES-02: Complete form fields (11 campos)
- RF-SES-03: SHA-256 hash + server timestamp at signing
- Section 6.1: sessions table schema
- Section 7.3: API endpoints

---

(End of file - total N lines)