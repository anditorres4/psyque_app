# Bloque 6 — Dashboard mejorado: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un widget "Diagnósticos frecuentes" al dashboard que muestre los top 10 códigos CIE-11 más usados en sesiones firmadas, con selector de período de 3/6/12 meses.

**Architecture:** El backend expone `GET /reports/top-diagnoses` que agrega la tabla `sessions` existente (no requiere migración). El frontend agrega un hook `useTopDiagnoses` y un componente `TopDiagnosesWidget` integrado en `DashboardPage.tsx` bajo la sección de próximas citas.

**Tech Stack:** FastAPI Query params, SQLAlchemy `func.count + group_by`, React Query (`useQuery`), Tailwind CSS.

---

## Archivos a tocar

| Archivo | Acción | Responsabilidad |
|---------|--------|----------------|
| `psicogest/backend/app/schemas/report.py` | Modificar | Agregar `TopDiagnosisItem` y `TopDiagnosesResponse` |
| `psicogest/backend/app/services/report_service.py` | Modificar | Agregar método `top_diagnoses(months, limit)` |
| `psicogest/backend/app/api/v1/reports.py` | Modificar | Agregar `GET /reports/top-diagnoses` |
| `psicogest/frontend/src/lib/api.ts` | Modificar | Agregar interfaces TS + `api.reports.topDiagnoses()` |
| `psicogest/frontend/src/hooks/useDashboard.ts` | Modificar | Agregar `useTopDiagnoses(months)` |
| `psicogest/frontend/src/pages/DashboardPage.tsx` | Modificar | Agregar `DiagnosisRow`, `TopDiagnosesWidget` e integrar |

**No se requiere migración** — lee de la tabla `sessions` existente (campos `diagnosis_cie11` y `diagnosis_description` ya presentes).

---

## Task 1 — Backend: schema + service + endpoint

**Files:**
- Modify: `psicogest/backend/app/schemas/report.py`
- Modify: `psicogest/backend/app/services/report_service.py`
- Modify: `psicogest/backend/app/api/v1/reports.py`

- [ ] **Paso 1: Agregar schemas a `report.py`**

Abrir `psicogest/backend/app/schemas/report.py`. Al final del archivo, después de `NewPatientsReportResponse`, agregar:

```python
class TopDiagnosisItem(BaseModel):
    diagnosis_cie11: str
    diagnosis_description: str
    count: int


class TopDiagnosesResponse(BaseModel):
    data: list[TopDiagnosisItem]
    months: int
```

- [ ] **Paso 2: Agregar método `top_diagnoses` a `ReportService` en `report_service.py`**

El archivo ya importa `func` de sqlalchemy, `datetime`, `timedelta`, y `Session`. No agregar ningún import nuevo.

Al final de la clase `ReportService`, después de `new_patients_report`, agregar:

```python
    def top_diagnoses(self, months: int = 3, limit: int = 10) -> dict:
        """Top N diagnoses by frequency in signed sessions."""
        start_date = datetime.now() - timedelta(days=months * 30)
        results = (
            self.db.query(
                Session.diagnosis_cie11,
                Session.diagnosis_description,
                func.count(Session.id).label("count"),
            )
            .filter(
                Session.tenant_id == self._tenant_id,
                Session.status == "signed",
                Session.actual_start >= start_date,
            )
            .group_by(Session.diagnosis_cie11, Session.diagnosis_description)
            .order_by(func.count(Session.id).desc())
            .limit(limit)
            .all()
        )
        return {
            "data": [
                {
                    "diagnosis_cie11": r[0],
                    "diagnosis_description": r[1],
                    "count": r[2],
                }
                for r in results
            ],
            "months": months,
        }
```

- [ ] **Paso 3: Agregar `TopDiagnosesResponse` al import en `reports.py` y registrar el endpoint**

En `psicogest/backend/app/api/v1/reports.py`, reemplazar el bloque de imports de schemas:

```python
from app.schemas.report import (
    AttendanceReportResponse,
    DashboardSummary,
    NewPatientsReportResponse,
    RevenueReportResponse,
    SessionTypeReportResponse,
    TopDiagnosesResponse,
)
```

Al final del archivo, agregar:

```python
@router.get("/top-diagnoses", response_model=TopDiagnosesResponse)
def top_diagnoses(
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    months: int = Query(3, ge=1, le=24),
    limit: int = Query(10, ge=1, le=20),
) -> TopDiagnosesResponse:
    result = _service(ctx).top_diagnoses(months, limit)
    return TopDiagnosesResponse(**result)
```

- [ ] **Paso 4: Verificar en FastAPI docs**

Con el backend corriendo (`uvicorn app.main:app --port 8000` desde `psicogest/backend`), navegar a `http://localhost:8000/docs`. Buscar `GET /reports/top-diagnoses`. Hacer "Try it out" con `months=3`. Respuesta esperada:

```json
{
  "data": [
    {
      "diagnosis_cie11": "6A70",
      "diagnosis_description": "Trastorno depresivo episódico",
      "count": 5
    }
  ],
  "months": 3
}
```

Si no hay sesiones firmadas aún: `{"data": [], "months": 3}` — esto también es correcto.

- [ ] **Paso 5: Commit**

```bash
git add psicogest/backend/app/schemas/report.py \
        psicogest/backend/app/services/report_service.py \
        psicogest/backend/app/api/v1/reports.py
git commit -m "feat: add top-diagnoses report endpoint"
```

---

## Task 2 — Frontend: tipos + método en api.ts

**Files:**
- Modify: `psicogest/frontend/src/lib/api.ts`

- [ ] **Paso 1: Agregar interfaces TypeScript en `api.ts`**

En `psicogest/frontend/src/lib/api.ts`, buscar el bloque `// --- Dashboard` (alrededor de la línea 198). Después del bloque de `DashboardStats`, agregar:

```ts
// --- Top Diagnoses -----------------------------------------------------------

export interface TopDiagnosisItem {
  diagnosis_cie11: string;
  diagnosis_description: string;
  count: number;
}

export interface TopDiagnosesResponse {
  data: TopDiagnosisItem[];
  months: number;
}
```

- [ ] **Paso 2: Agregar `topDiagnoses` al namespace `reports` en `api.ts`**

Localizar el objeto `reports:` (alrededor de la línea 867). El objeto tiene métodos `revenue`, `attendance`, `sessionTypes`, `newPatients`, `summary`. Después de `summary`, agregar `topDiagnoses` antes del cierre del objeto:

```ts
    topDiagnoses: (months: number = 3): Promise<TopDiagnosesResponse> => {
      return request<TopDiagnosesResponse>("GET", `/reports/top-diagnoses?months=${months}`);
    },
```

El objeto `reports` completo debe quedar así (mostrado con contexto):

```ts
  reports: {
    revenue: (months?: number) => { ... },
    attendance: (months?: number) => { ... },
    sessionTypes: (months?: number) => { ... },
    newPatients: (months?: number) => { ... },
    summary: (months?: number) => { ... },
    topDiagnoses: (months: number = 3): Promise<TopDiagnosesResponse> => {
      return request<TopDiagnosesResponse>("GET", `/reports/top-diagnoses?months=${months}`);
    },
  },
```

- [ ] **Paso 3: Commit**

```bash
git add psicogest/frontend/src/lib/api.ts
git commit -m "feat: add TopDiagnosisItem types and api.reports.topDiagnoses"
```

---

## Task 3 — Frontend: hook + widget en dashboard

**Files:**
- Modify: `psicogest/frontend/src/hooks/useDashboard.ts`
- Modify: `psicogest/frontend/src/pages/DashboardPage.tsx`

- [ ] **Paso 1: Agregar `useTopDiagnoses` a `useDashboard.ts`**

El archivo actual contiene solo `useDashboardStats`. Reemplazar el contenido completo del archivo con:

```ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => api.dashboard.getStats(),
    staleTime: 60_000,
    retry: 2,
  });
}

export function useTopDiagnoses(months: number = 3) {
  return useQuery({
    queryKey: ["reports", "top-diagnoses", months],
    queryFn: () => api.reports.topDiagnoses(months),
    staleTime: 5 * 60_000,
    retry: 2,
  });
}
```

- [ ] **Paso 2: Actualizar imports en `DashboardPage.tsx`**

Localizar la primera línea de `psicogest/frontend/src/pages/DashboardPage.tsx`. Reemplazar el bloque de imports actual:

```tsx
import { useState } from "react";
import { useDashboardStats, useTopDiagnoses } from "@/hooks/useDashboard";
import type { AppointmentSummary, TopDiagnosisItem } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
```

- [ ] **Paso 3: Agregar constante y componentes `DiagnosisRow` y `TopDiagnosesWidget`**

En `DashboardPage.tsx`, antes de la función `export function DashboardPage()`, agregar después de `MODALITY_LABELS`:

```tsx
const MONTHS_OPTIONS = [
  { value: 3, label: "3 m" },
  { value: 6, label: "6 m" },
  { value: 12, label: "12 m" },
] as const;

function DiagnosisRow({ item, rank }: { item: TopDiagnosisItem; rank: number }) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-muted-foreground w-5 text-right shrink-0">
          {rank}
        </span>
        <div>
          <p className="text-sm font-medium text-[#1E3A5F]">{item.diagnosis_description}</p>
          <p className="text-xs text-muted-foreground font-mono">{item.diagnosis_cie11}</p>
        </div>
      </div>
      <span className="text-sm font-semibold text-[#1E3A5F] shrink-0 ml-4">
        {item.count} {item.count === 1 ? "sesión" : "sesiones"}
      </span>
    </div>
  );
}

function TopDiagnosesWidget() {
  const [months, setMonths] = useState<3 | 6 | 12>(3);
  const { data, isLoading, isError } = useTopDiagnoses(months);

  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm">
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#1E3A5F] uppercase tracking-wide">
          Diagnósticos frecuentes
        </h2>
        <div className="flex gap-1">
          {MONTHS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMonths(opt.value)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                months === opt.value
                  ? "bg-[#1E3A5F] text-white"
                  : "text-muted-foreground hover:bg-gray-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5">
        {isLoading && (
          <div className="py-6 text-center text-sm text-muted-foreground">Cargando...</div>
        )}
        {isError && (
          <div className="py-6 text-center text-sm text-red-500">
            Error al cargar diagnósticos.
          </div>
        )}
        {data && data.data.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No hay sesiones firmadas en los últimos {months} meses.
          </div>
        )}
        {data &&
          data.data.map((item, i) => (
            <DiagnosisRow key={`${item.diagnosis_cie11}-${i}`} item={item} rank={i + 1} />
          ))}
      </div>
    </div>
  );
}
```

- [ ] **Paso 4: Integrar `TopDiagnosesWidget` en `DashboardPage`**

Localizar el cierre del `return` de `DashboardPage`. El bloque `data.upcoming.length === 0` actualmente es el último elemento antes de `</div>`. Agregar `<TopDiagnosesWidget />` justo antes del `</div>` de cierre del return:

```tsx
  return (
    <div className="p-8 space-y-6 max-w-4xl">
      {/* ... StatCards, upcoming ... */}

      {data.upcoming.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm">
          {/* ... */}
        </div>
      )}

      {data.upcoming.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm">
          <EmptyState
            title="No hay citas próximas"
            description="Agenda una nueva cita para ver aquí su resumen."
            icon="📅"
          />
        </div>
      )}

      <TopDiagnosesWidget />
    </div>
  );
```

- [ ] **Paso 5: Verificar en el navegador**

Con frontend corriendo (`npm run dev` desde `psicogest/frontend`), navegar a `http://localhost:5173`. Verificar:

1. Widget "Diagnósticos frecuentes" aparece debajo de la sección de próximas citas.
2. Los botones "3 m", "6 m", "12 m" cambian el período (el widget se recarga con nuevos datos).
3. Si hay sesiones firmadas: se ven filas con número de orden, descripción, código CIE-11 en monospace, y conteo.
4. Si no hay datos: aparece el mensaje "No hay sesiones firmadas en los últimos N meses."

- [ ] **Paso 6: Commit**

```bash
git add psicogest/frontend/src/hooks/useDashboard.ts \
        psicogest/frontend/src/pages/DashboardPage.tsx
git commit -m "feat: add top diagnoses widget to dashboard"
```

---

## Verificación final (criterios PRD §4.1 / Bloque 6)

- [ ] `GET /reports/top-diagnoses?months=3` retorna JSON `{"data": [...], "months": 3}` con hasta 10 ítems ordenados por count DESC
- [ ] Widget visible en el dashboard con encabezado "DIAGNÓSTICOS FRECUENTES"
- [ ] Selector de período funciona — botón activo resaltado en azul `#1E3A5F`
- [ ] Cada fila muestra: número de ranking, descripción legible, código CIE-11 en monospace, conteo de sesiones
- [ ] Estado vacío muestra mensaje explicativo (no pantalla en blanco ni error)
- [ ] Estado de carga muestra texto "Cargando..." mientras espera la respuesta
