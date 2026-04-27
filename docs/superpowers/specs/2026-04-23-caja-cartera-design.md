# Diseño: Módulos Caja + Cartera

**Fecha:** 2026-04-23  
**Proyecto:** psyque_app — SaaS de gestión clínica para psicólogos colombianos  
**Stack:** FastAPI + SQLAlchemy 2 + PostgreSQL/Supabase RLS (backend) / React 18 + TypeScript + shadcn/ui (frontend)

---

## Contexto

El sistema ya cuenta con modelos de Pacientes, Citas, Sesiones, Facturas y RIPS. Este diseño añade dos módulos financieros que cubren el flujo de dinero diario y el seguimiento de deudas:

- **Caja:** control de turno por usuario — registra ingresos de pacientes y gastos operativos durante el día de atención.
- **Cartera:** vista de facturas con saldo pendiente y registro de abonos.

Ambos módulos se integran a través del modelo `Invoice` existente: un pago registrado en Caja actualiza directamente el saldo de la factura en Cartera.

---

## Decisiones de diseño

1. **Cartera no tiene modelo propio.** Es una vista derivada de `Invoice` filtrada por `payment_status != "paid"`. Elimina doble registro y garantiza coherencia.
2. **Control de turno sin cuadre físico.** La apertura/cierre de caja es un control de turno — no hay conteo de efectivo ni conciliación física.
3. **Permisos sin fricción para el psicólogo solo.** La mayoría de tenants son un solo profesional que actúa como admin. Las restricciones de edición/eliminación solo aplican cuando hay múltiples usuarios; la UI no diferencia roles visualmente.
4. **Pacientes particulares y de EPS/convenio.** El sistema ya almacena si una consulta es particular o por convenio. Cartera hereda esta distinción con tabs de filtrado.

---

## Modelos de datos

### Nuevo: `CashSession`

Representa un turno de trabajo abierto por un usuario.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID PK | |
| `tenant_id` | UUID | RLS — aísla por tenant |
| `user_id` | UUID | Supabase auth UID del usuario que abre el turno |
| `opened_at` | timestamp | Momento de apertura |
| `closed_at` | timestamp, nullable | Nulo mientras el turno está abierto |
| `status` | enum | `"open"` \| `"closed"` |
| `notes` | text, nullable | Observaciones al cerrar (opcional) |

**Restricción:** solo puede haber un turno `"open"` por `(tenant_id, user_id)` a la vez.

---

### Nuevo: `CashTransaction`

Cada movimiento de dinero dentro de un turno.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID PK | |
| `tenant_id` | UUID | RLS |
| `session_id` | UUID FK → CashSession, nullable | Turno al que pertenece. Nulo si el abono se registra desde Cartera sin turno abierto. |
| `type` | enum | `"income"` \| `"expense"` |
| `amount` | decimal(12,2) | Monto del movimiento |
| `category` | enum | Income: `"particular"` \| `"eps"` \| `"otro"` / Expense: `"nomina"` \| `"servicios"` \| `"compras"` \| `"otro"` |
| `description` | text | Descripción libre |
| `invoice_id` | UUID FK → Invoice, nullable | Solo para ingresos vinculados a una factura |
| `patient_id` | UUID FK → Patient, nullable | Solo para ingresos de pacientes |
| `created_at` | timestamp | |
| `created_by` | UUID | Supabase auth UID |

**Regla de negocio:** al crear una `CashTransaction` de tipo `income` con `invoice_id`, el sistema ejecuta:
```
Invoice.amount_paid += transaction.amount
Invoice.payment_status = "paid" | "partial" | "unpaid"  # recalculado
```

**Transacciones sin turno:** si se registra un abono desde Cartera y no hay turno abierto, se crea la `CashTransaction` con `session_id = null` (turno suelto administrativo).

---

### Cambios al modelo existente: `Invoice`

Se añaden dos campos:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `amount_paid` | decimal(12,2), default 0 | Suma acumulada de abonos recibidos |
| `payment_status` | enum | `"unpaid"` \| `"partial"` \| `"paid"` |

El campo `payment_status` se recalcula en cada abono:
- `amount_paid == 0` → `"unpaid"`
- `0 < amount_paid < total` → `"partial"`
- `amount_paid >= total` → `"paid"`

---

## API Endpoints

### Router `/caja`

| Método | Ruta | Descripción | Permiso |
|--------|------|-------------|---------|
| `POST` | `/caja/sessions` | Abrir turno. Falla si ya hay uno abierto para el usuario. | Cualquier usuario |
| `GET` | `/caja/sessions` | Listar turnos. Dueño del tenant ve todos; otros solo los propios. | Cualquier usuario |
| `GET` | `/caja/sessions/{id}` | Detalle del turno con resumen financiero (total ingresos, total egresos, neto). | Cualquier usuario |
| `PUT` | `/caja/sessions/{id}/close` | Cerrar turno con notas opcionales. Solo el dueño del turno. | Dueño del turno |
| `POST` | `/caja/sessions/{id}/transactions` | Registrar ingreso o gasto. Solo en turno abierto. | Dueño del turno |
| `GET` | `/caja/sessions/{id}/transactions` | Listar transacciones del turno. | Cualquier usuario |
| `PUT` | `/caja/transactions/{id}` | Editar transacción. El tenant owner puede editar cualquiera. | Dueño del turno o tenant owner |
| `DELETE` | `/caja/transactions/{id}` | Eliminar transacción. | Dueño del turno o tenant owner |

### Router `/cartera`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/cartera` | Facturas con `payment_status != "paid"`, agrupadas por paciente/EPS. Soporta filtros: `type=particular\|eps`, búsqueda por nombre, paginación. |
| `GET` | `/cartera/summary` | Totales: deuda particular, deuda EPS, gran total. |
| `POST` | `/cartera/invoices/{id}/payments` | Registrar abono. Crea `CashTransaction` (vinculada al turno abierto si existe) y actualiza `Invoice`. |

---

## Frontend

### Página Caja (`/caja`)

**Sin turno abierto:**
- Botón prominente "Abrir turno" con fecha y hora actual.
- Tabla de historial de turnos: fecha, usuario, total ingresos, total egresos, estado.

**Turno abierto:**
- Header: hora de apertura + botón "Cerrar turno" (pide confirmación con campo de notas).
- Dos tarjetas resumen: **Ingresos del día** / **Egresos del día** con totales.
- Botones de acción: "Registrar ingreso" | "Registrar gasto".
- Lista de transacciones ordenadas por hora: tipo (badge), categoría, descripción, monto.
- Cada fila tiene acciones inline editar/eliminar.

**Modal "Registrar ingreso":**
- Autocomplete de paciente (componente existente `PatientSearch`).
- Dropdown de facturas pendientes del paciente (`payment_status != "paid"`).
- Al seleccionar la factura, la `category` se auto-completa (particular / eps) desde el tipo de consulta de la factura — el usuario no la selecciona manualmente.
- Campos: monto, método de pago (efectivo / transferencia / tarjeta), descripción opcional.

**Modal "Registrar gasto":**
- Select de categoría (nómina / servicios / compras / otro).
- Campos: monto, descripción.

---

### Página Cartera (`/cartera`)

- **Tabs:** Particular | EPS/Convenio | Todos.
- **Card resumen:** total cartera particular, total cartera EPS, gran total — siempre visible arriba.
- **Tabla:** Paciente/Entidad — Total facturado — Pagado — Saldo pendiente — Última actividad — Botón "Abonar".
- **Modal "Registrar abono":** monto + descripción. Si hay turno abierto, la transacción se asocia automáticamente; si no, se crea suelta.

---

## Flujo de datos: pago de paciente

```
Usuario abre turno
  → POST /caja/sessions → CashSession{status: "open"}

Usuario registra ingreso desde Caja
  → POST /caja/sessions/{id}/transactions
    {type: "income", invoice_id: "...", amount: 80000, ...}
  → CashTransaction creada
  → Invoice.amount_paid += 80000
  → Invoice.payment_status recalculado

Vista Cartera actualizada
  → factura desaparece si payment_status == "paid"
  → saldo reducido si "partial"

Usuario cierra turno al final del día
  → PUT /caja/sessions/{id}/close
  → CashSession{status: "closed", closed_at: now}
```

---

## Migraciones Alembic

1. **`add_invoice_payment_fields`** — añade `amount_paid` y `payment_status` a `invoices`.
2. **`create_cash_sessions`** — crea tabla `cash_sessions` con RLS.
3. **`create_cash_transactions`** — crea tabla `cash_transactions` con RLS, FK a `cash_sessions` e `invoices`.

---

## Consideraciones de cumplimiento

- Los gastos registrados en Caja (nómina, servicios, compras) sirven como base para el **Reporte financiero del negocio** — ingresos vs. egresos por período.
- Las transacciones de Cartera vinculadas a EPS son la base futura para conciliación con radicación de RIPS ante ADRES.
- Los registros de `CashTransaction` se retienen con el tenant — aplica retención documental por normativa tributaria colombiana.
