# Patient Registration Flow — Design Spec
**Date:** 2026-05-25  
**Status:** Approved

## Context

When a psychologist confirms a booking request and the patient doesn't exist yet in the system (matched by email), the system cannot auto-create an `Appointment` because `patient_id` is NOT NULL. This spec defines the full flow to handle that case: send a registration link to the patient, collect minimum clinical data, create the patient + appointment, and activate portal access automatically.

---

## User Stories

1. **Psychologist:** Confirms a booking request → sees "Email sent to [email] to complete registration" toast → sees the event in the calendar as "pending registration" (purple) until the patient completes the form.
2. **Psychologist:** Clicks the pending-registration event → sidebar shows badge, email sent date, and "Resend email" button.
3. **Patient:** Receives email → clicks link → fills minimum form (pre-filled name/email) → submits → portal account created → redirect to portal with "Check your email to access your account" message.

---

## Data Layer

### Migration `0044_patient_registration_flow`

**`booking_requests` — 3 new columns:**
- `registration_token: VARCHAR(36)` — nullable, indexed
- `registration_token_expires_at: TIMESTAMP WITH TIME ZONE` — nullable
- `registration_token_used_at: TIMESTAMP WITH TIME ZONE` — nullable

**`patients` — make nullable (fields not collected in minimum form):**
- `marital_status` — nullable (enum stays, column becomes nullable)
- `occupation` — nullable
- `address` — nullable
- `municipality_dane` — nullable
- `zone` — nullable
- `payer_type` — nullable

**`patients` — stay NOT NULL (required by minimum form):**
- `first_name`, `first_surname`, `doc_type`, `doc_number`, `birth_date`, `biological_sex`, `phone`, `hc_number` (auto-generated)

---

## Backend

### `BookingRequestSummary` schema — new fields
```python
registration_pending: bool = False
registration_token_expires_at: datetime | None = None
registration_token_sent_at: datetime | None = None  # derived from created_at when token set
```

### `BookingService.confirm()` — updated logic
```
if patient found by email → create Appointment (existing behavior)
if patient NOT found:
  → generate UUID token
  → set registration_token, registration_token_expires_at = now() + 48h on req
  → return req (registration_pending=True inferred by router)
```
No appointment is created yet. The appointment is created when the patient submits the registration form.

### New public endpoints — `/api/v1/booking/`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/registration/{token}` | None | Validate token, return pre-fill data |
| `POST` | `/registration/{token}` | None | Submit minimum fields, create Patient + Appointment + Supabase user |

**`GET /registration/{token}` response:**
```json
{
  "patient_name": "...",
  "patient_email": "...",
  "psychologist_name": "...",
  "requested_start": "...",
  "session_type": "..."
}
```

**`POST /registration/{token}` request body:**
```json
{
  "doc_type": "CC",
  "doc_number": "12345678",
  "birth_date": "1990-05-15",
  "biological_sex": "F",
  "phone": "3001234567"
}
```
Name and email come from the booking request (server-side), not from the client.

**`POST /registration/{token}` success flow:**
1. Validate token (exists, not used, not expired)
2. Create `Patient` with minimum fields + nullable fields as `None`
3. Create `Appointment` (scheduled, virtual, from booking request data)
4. Create Supabase Auth user via admin API (service role)
5. Generate portal invite link via Supabase admin
6. Send `EmailService.send_portal_invite()` with invite link
7. Set `registration_token_used_at = now()`
8. Commit
9. Return `{ "appointment_start": "...", "patient_name": "..." }`

**Token error responses:**
- Token not found → `404`
- Token already used → `410 Gone` — "Este enlace ya fue utilizado"
- Token expired → `410 Gone` — "Este enlace expiró. Pide a tu psicólogo que reenvíe el link"

### `EmailService` — new method
`send_patient_registration_request(to_email, patient_name, psychologist_name, registration_link, appointment_start)`

Subject: `"Completa tu registro — cita el {date}"`

Body: warm tone, appointment date prominent, big CTA button "Completar mi registro", note that link expires in 48 hours.

### `booking_requests.py` router — `confirm_request` update
After `svc.confirm()`:
- If `req.registration_token` is set → dispatch background task to send registration email
- Return `BookingRequestSummary` with `registration_pending=True`

### `booking_requests.py` — new endpoint
`POST /{request_id}/resend-registration` — regenerates token (new UUID, new 48h expiry), sends email again. Returns updated `BookingRequestSummary`.

---

## Frontend

### New public page: `/registro/:token`
- Route added to `App.tsx` (no auth guard)
- Fetches `GET /api/v1/booking/registration/{token}` on mount
- Shows error states for 404/410 with appropriate message
- Form fields:
  - Nombre (readonly, pre-filled)
  - Email (readonly, pre-filled)
  - Tipo de documento (select: CC/TI/CE/PA/RC/MS)
  - Número de documento (text)
  - Fecha de nacimiento (date picker)
  - Sexo biológico (select: Masculino/Femenino/Indeterminado)
  - Teléfono (pre-filled from booking if available, editable)
- On submit: `POST /api/v1/booking/registration/{token}`
- On success: full-page confirmation — "¡Registro completo! Revisa tu correo para acceder a tu cuenta."

### `AgendaPage` — changes
- `useBookingRequests` called twice: `status=pending` + `status=confirmed` (filter `registration_pending=true` client-side)
- Or: single call `useBookingRequests()` with no status filter, handle both in component
- Calendar events for `registration_pending` requests: color `#7C4DFF`, title `"📋 {patient_name}"`
- Sidebar panel for registration-pending requests (separate from pending requests sidebar):
  - Badge "Registro pendiente"
  - Appointment date/time
  - "Email enviado a [email]"
  - Expiry indicator: "Enlace válido hasta [date]" or "⚠ Enlace expirado"
  - Button "Reenviar email" → calls `POST /{id}/resend-registration`

### `useBooking.ts` — changes
- `useConfirmBookingRequest.onSuccess`: if response has `registration_pending=true` → show toast "Email enviado a [email] para completar registro. Recuérdale revisarlo."
- New hook: `useResendRegistration()` — mutation for `POST /{id}/resend-registration`

### `useBookingRequests` — parameter update
Accept optional `status?: string` — when called without status, returns all non-rejected requests (pending + confirmed-pending-registration).

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Patient registers after token expires | 410 with message to contact psychologist |
| Patient tries to use token twice | 410 "Ya utilizado" |
| Supabase user creation fails | Rollback Patient + Appointment, return 502, log error |
| Email send fails | Log warning, do NOT fail the request (email is best-effort) |
| Patient already exists when form submitted (race condition) | Use existing patient, create appointment, mark token used |

---

## Legends / Calendar Colors

| Color | Meaning |
|-------|---------|
| `#2E5E8A` blue | Confirmed appointment |
| `#B8843A` amber | Pending booking request |
| `#7C4DFF` purple | Confirmed — awaiting patient registration |
| `#4F7F5A` green | Completed |
| `#B0463A` red | Cancelled |
