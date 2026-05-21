# Flujo de Pago y Suscripciones — PsyCent

**Fecha:** 2026-05-21  
**Estado:** Aprobado  
**Scope:** Auth diferenciada por rol + Stripe Checkout + guards de plan + paywall

---

## Resumen

Implementar un flujo completo de monetización para terapeutas con:
- Login/registro diferenciado entre pacientes y terapeutas
- Prueba gratuita de 14 días tras el registro del terapeuta
- Selección de plan post-registro (Prueba gratuita / Estándar / Premium)
- Pagos recurrentes mensuales vía Stripe Checkout (hosted)
- Bloqueo real de features por plan en backend
- Grace period de 3 días + paywall al vencer

---

## Decisiones de diseño

| Decisión | Elección | Razón |
|----------|----------|-------|
| Login diferenciado | Dos URLs independientes | UX separada por rol, branding distinto |
| Registro de pacientes | Libre, sin invitación | Menor fricción para captación |
| Stripe integration | Checkout hosted | Menor complejidad, PCI automático, soporte COP |
| Subscription enforcement | Endpoint `/billing/status` + backend guards | Balance UX/seguridad, sin depender del JWT |
| Plan enum | Renombrar a `free_trial`, `estandar`, `premium` | Consistencia con marketing |
| Feature restriction | Bloqueo real en backend (RIPS, DIAN, IA) | Diferenciación funcional real entre planes |
| Expiración | Grace period 3 días → paywall total | No bloquear sin aviso previo |

---

## Arquitectura

### Nuevas rutas frontend

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/login` | redirect | → `/login/terapeuta` (backward compat) |
| `/login/terapeuta` | `TerapeutaLoginPage` | Login con Google OAuth, link a login paciente |
| `/login/paciente` | `PacienteLoginPage` | Login simplificado, link a login terapeuta |
| `/register` | redirect | → `/register/terapeuta` (backward compat) |
| `/register/terapeuta` | `RegisterPage` (ajustado) | Registro profesional con Colpsic |
| `/register/paciente` | `PacienteRegisterPage` | Registro libre: nombre + email + contraseña |
| `/select-plan` | `PlanSelectPage` | Pantalla post-registro: 3 tarjetas de planes |
| `/billing/success` | `BillingSuccessPage` | Retorno desde Stripe tras pago exitoso |
| `/paywall` | `PaywallPage` | Bloqueo total cuando suscripción expiró |

### Nuevas rutas backend

```
POST /api/v1/auth/setup-patient-profile
  - Sin auth de tenant
  - Setea app_metadata.role = "patient" vía Supabase Admin API
  - No crea fila en tenants

POST /api/v1/billing/create-checkout-session
  Body: { plan: "estandar" | "premium" }
  - Crea/recupera Stripe Customer para el tenant
  - Crea Stripe Checkout Session (mode=subscription)
  - Retorna { checkout_url }

POST /api/v1/billing/webhook  (sin JWT — firma Stripe)
  Eventos:
  - checkout.session.completed → guarda subscription_id, activa plan, actualiza plan_expires_at
  - invoice.payment_succeeded  → renueva plan_expires_at +1 mes, subscription_status = "active"
  - invoice.payment_failed     → subscription_status = "past_due"
  - customer.subscription.deleted → subscription_status = "canceled", plan = "free_trial"

GET /api/v1/billing/status
  Retorna: { plan, subscription_status, plan_expires_at, days_remaining, in_grace_period }

POST /api/v1/billing/customer-portal
  - Crea Stripe Customer Portal session
  - Retorna { portal_url }
```

---

## Base de datos

### Migración de enum `saas_plan`

```sql
ALTER TYPE saas_plan RENAME VALUE 'starter' TO 'free_trial';
ALTER TYPE saas_plan RENAME VALUE 'pro'     TO 'estandar';
ALTER TYPE saas_plan RENAME VALUE 'clinic'  TO 'premium';
```

### Nuevas columnas en `tenants`

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `stripe_customer_id` | `VARCHAR(50)` | YES | ID del cliente Stripe |
| `stripe_subscription_id` | `VARCHAR(50)` | YES | ID de suscripción activa |
| `subscription_status` | `VARCHAR(20)` | NO, default `'trial'` | `trial` / `active` / `past_due` / `canceled` / `expired` |

### Cambio en `setup_profile`

El tenant se crea con:
- `plan = 'free_trial'`
- `plan_expires_at = NOW() + INTERVAL '14 days'`  (antes 30 días)
- `subscription_status = 'trial'`

---

## Flujos de usuario

### Terapeuta — registro y pago

```
/register/terapeuta
  → supabase.auth.signUp({ user_metadata: { colpsic_number, ... } })
  → Email de verificación
  → Email confirmado → useAuth llama setup_profile()
  → Tenant creado: plan=free_trial, 14 días, subscription_status=trial
  → Redirect /select-plan

/select-plan
  ├─ "Comenzar gratis"
  │    → redirect /dashboard
  ├─ "Elegir Estándar"
  │    → POST /billing/create-checkout-session { plan: "estandar" }
  │    → redirect Stripe Checkout
  │    → Stripe success → POST /billing/webhook (checkout.session.completed)
  │    → redirect /billing/success → redirect /dashboard
  └─ "Empezar ahora" (Premium)
       → POST /billing/create-checkout-session { plan: "premium" }
       → (mismo flujo)
```

### Paciente — registro libre

```
/register/paciente
  → supabase.auth.signUp({ user_metadata: { full_name, register_as: "patient" } })
  → Email de verificación
  → Email confirmado → useAuth.ensureTenantConfigured():
      - detecta user_metadata.register_as === "patient" (sin colpsic_number)
      - llama POST /auth/setup-patient-profile en lugar de setup_profile
  → Backend setea app_metadata.role = "patient" vía Supabase Admin API
  → supabase.auth.refreshSession()
  → App.tsx: role=patient → redirect /portal/dashboard
```

> **Nota de implementación:** `useAuth.ts` hoy salta el setup si no hay `colpsic_number`. Hay que
> agregar la rama: si `register_as === "patient"` → llamar `setup-patient-profile`.
> Si ninguna condición aplica (Google OAuth sin colpsic) → ruta `/complete-profile` existente.

### Renovación mensual (Stripe Billing automático)

```
Stripe cobra mensualmente
  ├─ Éxito → webhook invoice.payment_succeeded
  │           → plan_expires_at += 1 mes, subscription_status = "active"
  └─ Fallo  → webhook invoice.payment_failed
              → subscription_status = "past_due"
              → Frontend muestra banner de aviso en próxima carga
              → Stripe reintenta 3 veces (configurable en Dashboard)
              → Si sigue fallando → customer.subscription.deleted
                                   → plan = "free_trial", status = "canceled"
```

---

## Control de acceso

### `require_active_subscription` (todas las rutas de terapeuta)

```python
def require_active_subscription(tenant: Tenant = Depends(get_tenant)):
    now = datetime.now(timezone.utc)   # timezone-aware para coincidir con TIMESTAMPTZ
    grace_end = tenant.plan_expires_at + timedelta(days=3)
    if now > grace_end:
        raise HTTPException(402, "Suscripción vencida. Renueva tu plan en /select-plan")
```

### `require_plan("premium")` (rutas premium)

```python
PREMIUM_ROUTES = [
    "POST /api/v1/rips/*",
    "GET  /api/v1/rips/*",
    "POST /api/v1/invoices/*",
    "POST /api/v1/ai/*",
]
```

Retorna `HTTP 403` con `detail: "Se requiere plan Premium para usar esta función"`.

### Frontend — `useUpgradePrompt()`

Hook centralizado que intercepta errores 403 de React Query y muestra un `Dialog`:

```
Esta función requiere el plan Premium
RIPS automático y Facturación DIAN están incluidos en Premium ($90K COP/mes)

[Ver planes →]   [Cerrar]
```

"Ver planes" → `/select-plan` si está en trial/estándar, o Customer Portal si tiene suscripción Stripe activa.

---

## Frontend — Componentes nuevos

### `SubscriptionBanner`

- Visible cuando `days_remaining ≤ 3`
- Barra ámbar fija en top de `AppLayout`
- No descartable
- Texto: "Tu plan vence en X días — [Actualizar plan →]"

### `PaywallPage` (`/paywall`)

- Reemplaza `AppLayout` cuando `subscription_status === "expired"`
- Mismas tres tarjetas de `/select-plan`
- `ProtectedRoute` redirige aquí automáticamente

### `useBillingStatus()`

```typescript
const { data } = useQuery({
  queryKey: ['billing-status'],
  queryFn: () => api.billing.getStatus(),
  staleTime: 5 * 60 * 1000,  // 5 min cache
})
```

### Settings — pestaña "Plan"

Nueva pestaña en `/settings`:
- Badge plan actual
- Fecha y días restantes
- "Actualizar plan" → `/select-plan`
- "Gestionar suscripción" → Stripe Customer Portal (solo si tiene suscripción Stripe)
- Estado: `Activo` / `Pago pendiente` / `Cancelado`

---

## Planes — features por nivel

| Feature | `free_trial` | `estandar` | `premium` |
|---------|:---:|:---:|:---:|
| Agendamiento + recordatorios | ✓ | ✓ | ✓ |
| Historia clínica digital | ✓ | ✓ | ✓ |
| Analytics básicos | ✓ | ✓ | ✓ |
| RIPS automático MinSalud | ✓ | ✗ | ✓ |
| Facturación electrónica DIAN | ✓ | ✗ | ✓ |
| Analytics avanzados | ✓ | ✗ | ✓ |
| Funciones IA clínicas | ✓ | ✗ | ✓ |
| Soporte prioritario | — | ✗ | ✓ |

> `free_trial` tiene acceso completo para que el terapeuta pueda evaluar todas las features antes de comprar.

---

## Variables de entorno nuevas (backend)

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_ESTANDAR=price_xxx
STRIPE_PRICE_ID_PREMIUM=price_xxx
```

---

## Landing page

El botón "Iniciar sesión" de `landing.html` apunta a `/login/terapeuta`.

---

## Archivos a crear / modificar

### Backend
- `app/core/config.py` — agregar vars Stripe
- `app/models/tenant.py` — nuevas columnas Stripe + subscription_status
- `app/api/v1/auth_routes.py` — nuevo endpoint setup-patient-profile + ajuste plan/días en setup_profile
- `app/api/v1/billing.py` — nuevo módulo con todas las rutas de billing
- `app/services/billing_service.py` — lógica Stripe
- `app/core/deps.py` — `require_active_subscription`, `require_plan`
- `app/api/v1/rips.py` — agregar `require_plan("premium")`
- `app/api/v1/invoices.py` — agregar `require_plan("premium")`
- `app/api/v1/ai.py` — agregar `require_plan("premium")`
- `app/main.py` — registrar router de billing
- `alembic/versions/xxxx_billing_stripe_columns.py` — migración

### Frontend
- `src/pages/auth/LoginPage.tsx` → redirect a `/login/terapeuta`
- `src/pages/auth/TerapeutaLoginPage.tsx` — nuevo
- `src/pages/auth/PacienteLoginPage.tsx` — nuevo
- `src/pages/auth/PacienteRegisterPage.tsx` — nuevo
- `src/pages/auth/RegisterPage.tsx` → ajustar redirect post-registro a `/select-plan`
- `src/pages/auth/CompleteProfilePage.tsx` → ajustar redirect a `/select-plan`
- `src/pages/billing/PlanSelectPage.tsx` — nuevo
- `src/pages/billing/BillingSuccessPage.tsx` — nuevo
- `src/pages/billing/PaywallPage.tsx` — nuevo
- `src/components/layout/SubscriptionBanner.tsx` — nuevo
- `src/components/billing/UpgradePromptDialog.tsx` — nuevo
- `src/hooks/useBillingStatus.ts` — nuevo
- `src/hooks/useUpgradePrompt.ts` — nuevo
- `src/services/billing.ts` — nuevo
- `src/pages/settings/SettingsPage.tsx` → nueva pestaña Plan
- `src/App.tsx` → nuevas rutas + lógica de paywall en ProtectedRoute
- `src/hooks/useAuth.ts` → detectar `register_as=patient` para llamar setup-patient-profile
- `public/landing.html` → actualizar href del botón "Iniciar sesión"
