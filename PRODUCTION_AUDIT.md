# PsyCent Production Readiness Audit
**Date:** 2026-05-26  
**Auditors:** 7 parallel sub-agents (Security, Code Quality, Error Handling, Documentation, Performance, Data Integrity, Dependency Hygiene)

---

## Executive Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 11 |
| HIGH | 36 |
| MEDIUM | 39 |
| LOW | 15 |
| **Total** | **101** |

**Verdict:** Not production-ready. There are **11 CRITICAL** issues (4 in data integrity, 4 in error handling, 2 in security, 1 in dependencies) that must be fixed before going live with real patient data or real payments.

---

## Domain Breakdown

### 🔴 Security (2 CRITICAL · 3 HIGH · 4 MEDIUM)

#### SEC-C1 — CRITICAL: `service_role` key used inside user-facing endpoints
- **File:** `backend/app/api/v1/auth_routes.py` — `setup_profile()`, `setup_patient_profile()`
- **Issue:** Admin Supabase key is used directly in API handlers. A single authorization flaw grants full admin access.
- **Fix:** Move all admin-key operations to an isolated internal service. Use Supabase RLS for data isolation instead.

#### SEC-C2 — CRITICAL: Webhook HMAC verification skipped in development
- **File:** `backend/app/api/v1/webhooks.py` ~lines 20–45
- **Issue:** When `webhook_triage_secret` is empty and `is_development=True`, HMAC check is bypassed entirely. Staging/prod deployments that forget to set the secret are fully exposed.
- **Fix:**
  ```python
  if not settings.webhook_triage_secret:
      raise HTTPException(status_code=503, detail="Webhook secret not configured.")
  ```

#### SEC-H1 — HIGH: CORS wildcard methods + headers with `allow_credentials=True`
- **File:** `backend/app/main.py` CORSMiddleware config
- **Fix:**
  ```python
  allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allow_headers=["Content-Type", "Authorization"],
  ```

#### SEC-H2 — HIGH: No authorization check on patient invite — only tenant match
- **File:** `backend/app/api/v1/patient_auth.py` `invite_patient_to_portal()`
- **Fix:** Verify `tenant.auth_user_id == ctx.tenant.user_id` before acting.

#### SEC-H3 — HIGH: No rate limiting on any endpoint
- **Issue:** `/auth/login`, `/auth/forgot-password`, `/webhooks/*`, booking endpoints — all unprotected against brute force.
- **Fix:** Add `slowapi` middleware; apply `@limiter.limit("5/minute")` to auth routes.

#### SEC-M1 — MEDIUM: JWT `verify_aud=False` without issuer validation
- **File:** `backend/app/core/security.py`
- **Fix:** Add `issuer=settings.supabase_url` to `jwt.decode()` to prevent token confusion.

#### SEC-M2 — MEDIUM: RLS policy audit needed (anon key allows direct DB access)
- **Fix:** Run `SELECT tablename FROM information_schema.tables WHERE table_schema='public'` and verify every clinical table has `ALTER TABLE x ENABLE ROW LEVEL SECURITY`.

#### SEC-M3 — MEDIUM: Raw `text()` SQL in `auth_routes.py` and `deps.py`
- **Files:** `auth_routes.py` ~50–70, `deps.py` subscription check
- **Fix:** Replace with ORM operations (`db.add(Tenant(...))`, `db.query(Tenant).filter(...)`) for type safety and auditability.

---

### 🔴 Data Integrity (4 CRITICAL · 6 HIGH · 2 MEDIUM)

#### DI-C1 — CRITICAL: `datetime.utcnow()` throughout backend (8 call sites)
- **Files:** `caja.py:85,201,237`, `cartera.py:199`, `report_service.py` (×5), `invoice_service.py:116`, `credit_note_service.py:68`
- **Issue:** Returns timezone-naive objects. Cannot be safely compared against timezone-aware DB columns.
- **Fix (all sites):** `datetime.now(tz=timezone.utc)`

#### DI-C2 — CRITICAL: Subscription expiry comparison may fail on timezone mismatch
- **File:** `backend/app/core/deps.py:74–76`
- **Fix:**
  ```python
  if expires and expires.tzinfo is None:
      expires = expires.replace(tzinfo=timezone.utc)
  ```

#### DI-C3 — CRITICAL: Signed session immutability enforced only in application code
- **File:** `backend/app/models/session.py`, `session_service.py`
- **Issue:** Res. 1995/1999 requires clinical records to be immutable after signing. A SQL injection or ORM bypass can modify signed sessions with no DB-level protection.
- **Fix:** Add a PostgreSQL trigger:
  ```sql
  CREATE OR REPLACE FUNCTION enforce_session_immutability()
  RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    IF OLD.status = 'signed' AND (
      NEW.diagnosis_cie11 IS DISTINCT FROM OLD.diagnosis_cie11 OR
      NEW.consultation_reason IS DISTINCT FROM OLD.consultation_reason OR
      NEW.intervention IS DISTINCT FROM OLD.intervention OR
      NEW.session_fee IS DISTINCT FROM OLD.session_fee
    ) THEN
      RAISE EXCEPTION 'Cannot modify a signed session (Res. 1995/1999)';
    END IF;
    RETURN NEW;
  END;
  $$;
  CREATE TRIGGER trg_session_immutable
    BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION enforce_session_immutability();
  ```

#### DI-C4 — CRITICAL: `func.now()` in `TimestampMixin` may produce naive datetimes
- **File:** `backend/app/models/base.py:31,36–37`
- **Fix:** Use `func.now()` with explicit timezone in PostgreSQL (`TIMESTAMP WITH TIME ZONE`); verify column definition in Alembic migration is `TIMESTAMP(timezone=True)`.

#### DI-H1 — HIGH: Missing FK constraints on 6 models
- **Files:** `session.py`, `appointment.py`, `invoice.py`, `clinical_document.py`, `clinical_record.py`
- **Issue:** ORM relationships declared but no `ForeignKey()` in `mapped_column()`. Database cannot enforce referential integrity; orphaned records are possible.
- **Fix (example):**
  ```python
  patient_id: Mapped[uuid.UUID] = mapped_column(
      UUID(as_uuid=True),
      ForeignKey("patients.id", ondelete="CASCADE"),
      nullable=False, index=True
  )
  ```

#### DI-H2 — HIGH: Missing `UNIQUE` constraint on `sessions.appointment_id`
- **File:** `backend/app/models/session.py`
- **Fix:** `appointment_id: Mapped[uuid.UUID | None] = mapped_column(..., unique=True)`

#### DI-H3 — HIGH: Missing `UNIQUE` constraint on `invoices.invoice_number`
- **File:** `backend/app/models/invoice.py`
- **Fix:** `invoice_number: Mapped[str] = mapped_column(sa.String(20), nullable=False, unique=True)`

#### DI-H4 — HIGH: MIME type validation bypassable when `file.content_type` is `None`
- **File:** `backend/app/api/v1/documents.py:32`
- **Fix:**
  ```python
  if not file.content_type or file.content_type not in DocumentService.ALLOWED_CONTENT_TYPES:
      raise HTTPException(400, "Invalid or missing MIME type")
  ```

#### DI-M1 — MEDIUM: `session_ids` JSONB array in invoices has no UUID validation
- **File:** `backend/app/models/invoice.py`
- **Fix:** Add a CHECK constraint or validate in `invoice_service.py` that each UUID exists and belongs to the patient.

---

### 🔴 Error Handling (4 CRITICAL · 4 HIGH · 4 MEDIUM · 3 LOW)

#### EH-C1 — CRITICAL: No timeout on Supabase Storage HTTP calls
- **File:** `backend/app/services/document_service.py:96,108,128`
- **Fix:** `with httpx.Client(timeout=15.0) as client:`

#### EH-C2 — CRITICAL: Storage upload failure can leave orphaned DB records
- **File:** `backend/app/services/document_service.py:66–84`
- **Issue:** Storage upload and DB commit are not atomic. If upload fails after commit, the DB record has no backing file.
- **Fix:** Wrap storage upload before the DB commit; rollback DB if upload fails.

#### EH-C3 — CRITICAL: React mutations (appointments) have no `onError` handler
- **File:** `frontend/src/hooks/useAppointments.ts:40–60`
- **Issue:** `useCreateAppointment`, `useUpdateAppointment`, `useCancelAppointment` silently swallow errors. User gets no feedback on failure.
- **Fix:** Add `onError: (error) => { /* show error to user */ }` to each mutation.

#### EH-C4 — CRITICAL: Background tasks (email, calendar sync) have no error handling
- **File:** `backend/app/api/v1/appointments.py`
- **Issue:** If `_send_confirmation_email` or `sync_appointment_background` throws, the error is silently lost.
- **Fix:** Wrap each background task body in `try/except` with `logger.exception(...)`.

#### EH-H1 — HIGH: `email_service.py` returns `False` on HTTP error — callers don't check
- **File:** `backend/app/services/email_service.py:82–109`
- **Fix:** At minimum log at ERROR level (not WARNING); consider raising for critical emails.

#### EH-H2 — HIGH: Stripe webhook events not logged before processing
- **File:** `backend/app/api/v1/billing.py:60–80`
- **Fix:** Add `logger.info("Processing Stripe event: %s", event_type)` and wrap in `try/except Exception: logger.exception(...)`.

#### EH-H3 — HIGH: Supabase Admin API exceptions expose raw error details to client
- **File:** `backend/app/api/v1/auth_routes.py:100–120`
- **Fix:** Log the raw error, return a generic user-facing message.

#### EH-H4 — HIGH: Billing `except Exception as exc` leaks raw exception to client
- **File:** `backend/app/api/v1/billing.py:42,53,67`
- **Fix:** `raise HTTPException(502, "Error al procesar tu solicitud.")` — never `f"...: {exc}"`.

#### EH-M1 — MEDIUM: No React error boundary in app root
- **Fix:** Wrap `<App>` in an `ErrorBoundary` component that renders a fallback page instead of crashing.

#### EH-M2 — MEDIUM: `useAuth.ts` swallows `setupPatientProfile` failure, returns stale session
- **File:** `frontend/src/hooks/useAuth.ts:20–48`
- **Fix:** Surface the error to the user rather than silently continuing with partial profile.

---

### 🟡 Performance (4 HIGH · 6 MEDIUM · 2 LOW)

#### PERF-H1 — HIGH: N+1 query in `cartera.py` — `list_cartera` endpoint
- **File:** `backend/app/api/v1/cartera.py:67–82`
- **Issue:** Fetches a Patient per-invoice inside a loop. 50 invoices = 51 queries.
- **Fix:** Batch-load: `patients = {p.id: p for p in db.query(Patient).filter(Patient.id.in_(patient_ids)).all()}`

#### PERF-H2 — HIGH: N+1 query in `cartera.py` — `cartera_summary`
- **File:** `backend/app/api/v1/cartera.py:103–112`
- **Fix:** Same batch-load pattern as PERF-H1.

#### PERF-H3 — HIGH: N+1 query in `cartera.py` — `register_payment`
- **File:** `backend/app/api/v1/cartera.py:134–142`
- **Fix:** `joinedload(Invoice.patient_)` on the initial invoice query.

#### PERF-H4 — HIGH: Appointments range query loads patients with second round-trip
- **File:** `backend/app/api/v1/appointments.py:45–55`
- **Fix:** Use `joinedload(Appointment.patient_)` to eager-load in one query.

#### PERF-M1 — MEDIUM: `session_service.list_paginated` uses two queries (sessions + patient batch)
- **Fix:** `joinedload(Session.patient_)`.

#### PERF-M2 — MEDIUM: `get_patient_appointments` has no pagination (unbounded list)
- **File:** `backend/app/api/v1/appointments.py:23–39`
- **Fix:** Add `page`/`page_size` params.

#### PERF-M3 — MEDIUM: `get_patient_sessions` returns `.items` but loses pagination metadata
- **File:** `backend/app/api/v1/patients.py:28–39`
- **Fix:** Change response model to `PaginatedSessions` and return the full paginated object.

#### PERF-M4 — MEDIUM: `list_referrals` has no pagination
- **File:** `backend/app/api/v1/referrals.py:32–39`

#### PERF-M5 — MEDIUM: Caja `total` count is `len(sessions)` (always ≤ limit) not true total
- **File:** `backend/app/api/v1/caja.py:57–70`
- **Fix:** `total = query.count()` before applying `.limit()`.

#### PERF-M6 — MEDIUM: Dashboard makes 6+ separate COUNT/SUM queries
- **File:** `backend/app/services/dashboard_service.py:20–70`
- **Fix:** Combine into 1–2 queries using SQLAlchemy `case()` aggregation.

---

### 🟡 Dependency Hygiene (1 CRITICAL · 2 HIGH · 3 MEDIUM · 4 LOW)

#### DEP-C1 — CRITICAL: `python-jose >= 3.3.0` has CVE-2024-33664 (JWT validation bypass)
- **Fix:** Replace with `PyJWT`. Change `from jose import jwt` → `import jwt`. Update all encode/decode calls and test auth flows.

#### DEP-H1 — HIGH: `stripe >= 7.0.0` is legacy (v7 from 2019; current is v10+)
- **Fix:** Upgrade to `stripe>=10.0.0`; review Stripe changelog for breaking changes before processing real payments.

#### DEP-H2 — HIGH: `anthropic >= 0.40.0` is 9+ months old; SDK v1.x now available
- **Fix:** Upgrade to `anthropic>=1.0.0`; test all AI endpoints.

#### DEP-M1 — MEDIUM: `psycopg2-binary` uses LGPL v3 (commercial licensing concern)
- **Action:** Document LGPL compliance or migrate to `psycopg3` (MIT) before commercial launch.

#### DEP-M2 — MEDIUM: `openai >= 1.0.0` pinned to v1.0; latest v1.40+ has improvements
- **Fix:** `openai>=1.40.0` — no breaking changes within v1.x.

#### DEP-M3 — MEDIUM: `reportlab >= 4.2.0` has dual BSD/Commercial license
- **Action:** Verify usage is within BSD terms or obtain commercial license before launch.

---

### 🟢 Code Quality (0 CRITICAL · 3 MEDIUM · 5 LOW)

#### CQ-M1 — MEDIUM: Diagnostic `console.log` with patient emails left in production
- **File:** `frontend/src/pages/agenda/AgendaPage.tsx:49–50`
- **Fix:** Remove both lines immediately. (Also removes GDPR/Ley 1581 risk of logging PII to console.)

#### CQ-M2 — MEDIUM: Unused import `AIResponse` in `ai_service.py:13`
- **Fix:** `from app.services.ai.providers import get_provider`

#### CQ-M3 — MEDIUM: Monolithic `api.ts` export (~320+ lines, 15+ domains)
- **File:** `frontend/src/lib/api.ts`
- **Fix:** Split into domain modules (`lib/api/auth.ts`, `lib/api/caja.ts`, etc.) — a refactor sprint, not a blocker.

#### CQ-L1–L5 — LOW: Unused `date` import, unnecessary `__future__`, hardcoded color hex codes, magic number `0.4` (confidence threshold) in `AiDiagnosisSection.tsx`
- None are production blockers.

---

### 🟡 Documentation (17 HIGH · 17 MEDIUM · 1 LOW)

The bulk of documentation issues are not production blockers but impede maintainability:

- **Missing docstrings** on all `invoices.py` routes and RIPS service business logic
- **6 env vars** missing from `.env.example` (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `FEVRIPS_BASE_URL`, Stripe plan descriptions, `WEBHOOK_TRIAGE_SECRET` description)
- **CLAUDE.md** missing at `/psicogest/` level (only exists at repo root)
- **README** missing deployment, RIPS configuration, troubleshooting, and regulatory compliance sections
- **Outdated** `rips.py` module docstring still references Res. 2275/2023 (now superseded by Res. 0948/2026)

---

## Prioritized Fix Checklist

### Immediate blockers (ship nothing until resolved)

- [ ] **SEC-C1** — Remove `service_role` key from user-facing API endpoints
- [ ] **SEC-C2** — Require `webhook_triage_secret` unconditionally; remove dev bypass
- [ ] **DEP-C1** — Replace `python-jose` with `PyJWT` (CVE-2024-33664)
- [ ] **DI-C1** — Replace all `datetime.utcnow()` / `datetime.now()` with `datetime.now(tz=timezone.utc)` (8 sites)
- [ ] **DI-C2** — Timezone-guard subscription expiry comparison in `deps.py`
- [ ] **DI-H1** — Add `ForeignKey()` constraints to 6 models; generate migration
- [ ] **DI-H2** — Add `UNIQUE` on `sessions.appointment_id`
- [ ] **DI-H3** — Add `UNIQUE` on `invoices.invoice_number`
- [ ] **EH-C1** — Add `timeout=15.0` to all `httpx.Client()` calls in `document_service.py`
- [ ] **EH-C2** — Make document storage + DB commit atomic (upload before commit)
- [ ] **EH-C3** — Add `onError` handlers to all appointment mutations
- [ ] **EH-C4** — Wrap background task bodies in `try/except` with logging
- [ ] **CQ-M1** — Remove `console.log` lines from `AgendaPage.tsx:49–50` (PII leak risk)

### High priority (before onboarding paying users)

- [ ] **SEC-H1** — Restrict CORS to explicit methods/headers
- [ ] **SEC-H3** — Add rate limiting to auth and booking endpoints
- [ ] **DI-C3** — Add DB trigger to enforce signed session immutability (Res. 1995/1999)
- [ ] **DI-H4** — Validate MIME type before passing to `DocumentService`
- [ ] **EH-H1** — Escalate email failures from WARNING to ERROR; alert on critical failures
- [ ] **EH-H2** — Log + wrap Stripe webhook processing
- [ ] **EH-H3/H4** — Stop leaking raw exception details in HTTP responses
- [ ] **EH-M1** — Add React error boundary to app root
- [ ] **PERF-H1/H2/H3** — Fix 3 N+1 patterns in `cartera.py`
- [ ] **PERF-H4** — Fix appointments range query with `joinedload`
- [ ] **DEP-H1** — Upgrade `stripe` to v10+
- [ ] **DEP-M1** — Document LGPL compliance for `psycopg2-binary`

### Medium priority (next sprint)

- [ ] **PERF-M2/M3/M4** — Add pagination to unbounded list endpoints
- [ ] **PERF-M5** — Fix caja `total` count to use `query.count()`
- [ ] **PERF-M6** — Aggregate dashboard queries into 1–2 SQL calls
- [ ] **DEP-H2** — Upgrade `anthropic` to v1.x
- [ ] **SEC-M1** — Add `issuer` validation to JWT decode
- [ ] **SEC-M2** — Audit and document all RLS policies
- [ ] **SEC-M3** — Replace raw `text()` SQL in `auth_routes.py` and `deps.py` with ORM
- [ ] **CQ-M2** — Remove unused `AIResponse` import
- [ ] **DOC** — Add 6 missing vars to `.env.example`
- [ ] **DOC** — Update `rips.py` docstring to reference Res. 0948/2026

### Low priority / refactoring sprint

- [ ] **CQ-M3** — Split monolithic `api.ts` into domain modules
- [ ] **PERF-L** — Add name-column indexes for patient search
- [ ] **EH-M2** — Surface `setupPatientProfile` failure in UI
- [ ] **DOC** — Add docstrings to all invoice endpoints and RIPS service
- [ ] **DOC** — Add README deployment and regulatory sections
