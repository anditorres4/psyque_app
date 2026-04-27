# Bloque 5 — Plantillas PDF Avanzadas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar toggles de secciones y selector de perfil de paciente (adulto/infante/familiar) al PDF de historia clínica, con un modal de configuración en el frontend antes de descargar.

**Architecture:** El backend recibe query params opcionales en `GET /patients/{id}/history-export` que controlan qué secciones incluir y qué plantilla de perfil usar. El servicio PDF lee esos parámetros para condicionar bloques del story de ReportLab. El frontend reemplaza el botón directo "Exportar HC" con un modal de configuración que envía esos params.

**Tech Stack:** FastAPI query params, ReportLab (ya instalado), React + shadcn Dialog, Checkbox, RadioGroup.

---

## Archivos a tocar

| Archivo | Acción |
|---------|--------|
| `psicogest/backend/app/services/history_pdf_service.py` | Modificar — añadir `PDFOptions`, refactorizar `_build_pdf` y `generate` |
| `psicogest/backend/app/api/v1/patients.py` | Modificar — añadir query params al endpoint `history-export` |
| `psicogest/frontend/src/lib/api.ts` | Modificar — `exportHistory` acepta `HistoryExportOptions` |
| `psicogest/frontend/src/pages/patients/PatientDetailPage.tsx` | Modificar — modal de configuración antes de descargar |
| `psicogest/frontend/src/components/ui/checkbox.tsx` | Crear — componente shadcn Checkbox |

---

## Task 1 — Agregar `PDFOptions` y refactorizar `_build_pdf`

**Files:**
- Modify: `psicogest/backend/app/services/history_pdf_service.py`

El servicio actual genera siempre todas las secciones. Hay que hacer `_build_pdf` condicional según opciones.

- [ ] **Paso 1: Agregar dataclass `PDFOptions` al inicio de `history_pdf_service.py`**

Insertar justo antes de la función `_build_pdf` (línea 31 actual):

```python
from dataclasses import dataclass, field

@dataclass
class PDFOptions:
    include_diagnosis: bool = True
    include_treatment: bool = True
    include_evolution: bool = True
    patient_profile: str = "adulto"  # "adulto" | "infante" | "familiar"
```

- [ ] **Paso 2: Añadir `opts: PDFOptions` a `_build_pdf` y aplicar toggles en la sección de sesiones**

Cambiar la firma de `_build_pdf` (línea 31):

```python
def _build_pdf(
    buffer,
    tenant: Tenant,
    patient: Patient,
    sessions: list[ClinicalSession],
    notes: dict[str, list[SessionNote]],
    opts: PDFOptions | None = None,
) -> None:
```

Agregar al inicio del cuerpo de `_build_pdf`, justo después de abrir la función:

```python
    if opts is None:
        opts = PDFOptions()
```

- [ ] **Paso 3: Aplicar perfil infante — sección datos del paciente**

En `_build_pdf`, después de construir `patient_data` (tras la línea `if patient.eps_name:`), agregar bloque para responsable legal cuando el perfil es infante:

```python
    if opts.patient_profile == "infante" and (patient.emergency_contact_name or patient.emergency_contact_phone):
        patient_data += [
            *patient_field("Responsable legal", patient.emergency_contact_name),
            *patient_field("Teléfono responsable", patient.emergency_contact_phone),
        ]
```

- [ ] **Paso 4: Aplicar toggles en el loop de sesiones**

Dentro del `for i, sess in enumerate(sessions, 1):` block, reemplazar la construcción de `sess_fields` (actualmente líneas 222-237) por versión condicional:

```python
            sess_fields = [
                ("Fecha", sess.actual_start.strftime("%d/%m/%Y %H:%M")),
                ("Hora fin", sess.actual_end.strftime("%H:%M")),
                ("CUPS", sess.cups_code),
                ("Valor", f"${sess.session_fee:,.0f} COP"),
            ]
            if opts.include_diagnosis:
                sess_fields += [
                    ("CIE-11", sess.diagnosis_cie11),
                    ("Diagnóstico", sess.diagnosis_description),
                ]
            if sess.authorization_number:
                sess_fields.append(("Autorización", sess.authorization_number))
            sess_fields.append(("Motivo de consulta", sess.consultation_reason))
            if opts.include_treatment:
                sess_fields.append(("Intervención", sess.intervention))
                if sess.next_session_plan:
                    sess_fields.append(("Plan", sess.next_session_plan))
            if opts.include_evolution and sess.evolution:
                sess_fields.append(("Evolución", sess.evolution))
```

- [ ] **Paso 5: Modificar `HistoryPDFService.generate` para aceptar y pasar `PDFOptions`**

Cambiar la firma del método `generate` y la llamada a `_build_pdf`:

```python
    def generate(self, patient_id: str, opts: PDFOptions | None = None) -> bytes:
        """Generate clinical history PDF and return as bytes."""
        import io
        if opts is None:
            opts = PDFOptions()

        patient_uuid = uuid.UUID(patient_id)
        patient = self.db.get(Patient, patient_uuid)
        if not patient or patient.tenant_id != self._tenant_id:
            raise ValueError("Paciente no encontrado.")

        tenant = self.db.get(Tenant, self._tenant_id)
        if not tenant:
            raise ValueError("Tentante no encontrado.")

        sessions = list(
            self.db.execute(
                select(ClinicalSession)
                .where(ClinicalSession.tenant_id == self._tenant_id)
                .where(ClinicalSession.patient_id == patient_uuid)
                .where(ClinicalSession.status == "signed")
                .order_by(ClinicalSession.actual_start)
            ).scalars()
        )

        session_ids = [str(s.id) for s in sessions]
        all_notes: dict[str, list[SessionNote]] = {}
        if session_ids:
            notes_list = list(
                self.db.execute(
                    select(SessionNote)
                    .where(SessionNote.session_id.in_([uuid.UUID(sid) for sid in session_ids]))
                    .order_by(SessionNote.created_at)
                ).scalars()
            )
            all_notes = {}
            for n in notes_list:
                key = str(n.session_id)
                if key not in all_notes:
                    all_notes[key] = []
                all_notes[key].append(n)

        buffer = io.BytesIO()
        _build_pdf(buffer, tenant, patient, sessions, all_notes, opts)
        buffer.seek(0)
        return buffer.read()
```

- [ ] **Paso 6: Verificar importación del dataclass**

Confirmar que `from dataclasses import dataclass, field` está en la sección de imports al principio del archivo (ya añadido en Paso 1).

---

## Task 2 — Agregar query params al endpoint `history-export`

**Files:**
- Modify: `psicogest/backend/app/api/v1/patients.py`

- [ ] **Paso 1: Agregar import de `PDFOptions` y `Query` en patients.py**

Agregar al bloque de imports existente:

```python
from fastapi import Query
from app.services.history_pdf_service import HistoryPDFService, PDFOptions
```

*(Ya existe el import de `HistoryPDFService` — solo agregar `PDFOptions` a esa línea y `Query` a la línea de fastapi.)*

- [ ] **Paso 2: Reemplazar el endpoint `history-export` con versión que acepta query params**

Reemplazar la función `export_patient_history` completa:

```python
@router.get("/{patient_id}/history-export")
def export_patient_history(
    patient_id: str,
    ctx: Annotated[TenantDB, Depends(get_tenant_db)],
    include_diagnosis: bool = Query(True),
    include_treatment: bool = Query(True),
    include_evolution: bool = Query(True),
    patient_profile: str = Query("adulto"),
) -> StreamingResponse:
    """Generate and download clinical history PDF (Res. 1995/1999 Art. 15)."""
    try:
        _service(ctx).get_by_id(patient_id)
    except PatientNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado.")

    opts = PDFOptions(
        include_diagnosis=include_diagnosis,
        include_treatment=include_treatment,
        include_evolution=include_evolution,
        patient_profile=patient_profile,
    )

    try:
        pdf_bytes = HistoryPDFService(ctx.db, ctx.tenant.tenant_id).generate(patient_id, opts)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    filename = f"HC_{patient_id}_{datetime.now(tz=timezone.utc).strftime('%Y%m%d_%H%M')}.pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Type": "application/pdf",
        },
    )
```

- [ ] **Paso 3: Verificar en `http://localhost:8000/docs` que el endpoint muestra los 4 nuevos query params**

Navegar a `/docs`, buscar `GET /patients/{patient_id}/history-export`, confirmar que aparecen `include_diagnosis`, `include_treatment`, `include_evolution`, `patient_profile` como query params opcionales.

---

## Task 3 — Crear componente Checkbox (shadcn)

**Files:**
- Create: `psicogest/frontend/src/components/ui/checkbox.tsx`

El modal necesita checkboxes. El proyecto no tiene este componente aún.

- [ ] **Paso 1: Crear `checkbox.tsx`**

```tsx
import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
```

- [ ] **Paso 2: Verificar que `@radix-ui/react-checkbox` está instalado**

```bash
cd psicogest/frontend && grep "radix-ui/react-checkbox" package.json
```

Si no aparece, instalar:
```bash
npm install @radix-ui/react-checkbox
```

---

## Task 4 — Modal de configuración en `PatientDetailPage.tsx`

**Files:**
- Modify: `psicogest/frontend/src/pages/patients/PatientDetailPage.tsx`

Reemplazar el botón directo "Exportar HC" por un flujo: botón → abre Dialog → el usuario configura toggles → botón Descargar llama a la API con los params.

- [ ] **Paso 1: Agregar imports necesarios**

Agregar al bloque de imports existente en `PatientDetailPage.tsx`:

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
```

*(El componente ya puede tener Dialog importado — verificar y no duplicar.)*

- [ ] **Paso 2: Agregar estado del modal y opciones de exportación**

Dentro del componente `PatientDetailPage`, agregar junto a los estados existentes:

```tsx
const [exportModalOpen, setExportModalOpen] = useState(false);
const [exportOptions, setExportOptions] = useState({
  include_diagnosis: true,
  include_treatment: true,
  include_evolution: true,
  patient_profile: "adulto" as "adulto" | "infante" | "familiar",
});
const [isExporting, setIsExporting] = useState(false);
```

- [ ] **Paso 3: Modificar `handleExportHistory` para aceptar las opciones**

Reemplazar la función `handleExportHistory` existente:

```tsx
const handleExportHistory = async () => {
  if (!id) return;
  setIsExporting(true);
  try {
    const blob = await api.patients.exportHistory(id, exportOptions);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `HC_${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setExportModalOpen(false);
  } catch (err) {
    console.error("Error exporting history:", err);
  } finally {
    setIsExporting(false);
  }
};
```

- [ ] **Paso 4: Reemplazar el botón "Exportar HC" por el Dialog completo**

Localizar el botón actual (líneas ~154-155):
```tsx
<Button onClick={handleExportHistory}>
  Exportar HC
</Button>
```

Reemplazarlo con:

```tsx
<Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
  <DialogTrigger asChild>
    <Button variant="outline">Exportar HC</Button>
  </DialogTrigger>
  <DialogContent className="max-w-sm">
    <DialogHeader>
      <DialogTitle>Opciones de exportación</DialogTitle>
    </DialogHeader>

    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <p className="text-sm font-medium">Perfil del paciente</p>
        <div className="flex gap-4">
          {(["adulto", "infante", "familiar"] as const).map((p) => (
            <label key={p} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="patient_profile"
                value={p}
                checked={exportOptions.patient_profile === p}
                onChange={() => setExportOptions((o) => ({ ...o, patient_profile: p }))}
                className="accent-primary"
              />
              <span className="text-sm capitalize">{p}</span>
            </label>
          ))}
        </div>
        {exportOptions.patient_profile === "infante" && (
          <p className="text-xs text-muted-foreground">
            Incluye responsable legal desde contacto de emergencia.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Secciones a incluir</p>
        {(
          [
            { key: "include_diagnosis", label: "Diagnóstico (CIE-11)" },
            { key: "include_treatment", label: "Intervención y plan" },
            { key: "include_evolution", label: "Evolución" },
          ] as const
        ).map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2">
            <Checkbox
              id={key}
              checked={exportOptions[key]}
              onCheckedChange={(checked) =>
                setExportOptions((o) => ({ ...o, [key]: !!checked }))
              }
            />
            <Label htmlFor={key} className="text-sm font-normal cursor-pointer">
              {label}
            </Label>
          </div>
        ))}
      </div>
    </div>

    <div className="flex justify-end gap-2 pt-2">
      <Button variant="outline" onClick={() => setExportModalOpen(false)}>
        Cancelar
      </Button>
      <Button onClick={handleExportHistory} disabled={isExporting}>
        {isExporting ? "Generando..." : "Descargar PDF"}
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

---

## Task 5 — Modificar `api.ts` para pasar opciones de exportación

**Files:**
- Modify: `psicogest/frontend/src/lib/api.ts`

- [ ] **Paso 1: Agregar interface `HistoryExportOptions`**

Agregar antes o cerca de donde está `patients.exportHistory`:

```ts
export interface HistoryExportOptions {
  include_diagnosis?: boolean;
  include_treatment?: boolean;
  include_evolution?: boolean;
  patient_profile?: "adulto" | "infante" | "familiar";
}
```

- [ ] **Paso 2: Modificar `patients.exportHistory` para aceptar opciones y construir query string**

Reemplazar la función `exportHistory` existente:

```ts
exportHistory: (id: string, opts: HistoryExportOptions = {}): Promise<Blob> => {
  const params = new URLSearchParams();
  if (opts.include_diagnosis !== undefined) params.set("include_diagnosis", String(opts.include_diagnosis));
  if (opts.include_treatment !== undefined) params.set("include_treatment", String(opts.include_treatment));
  if (opts.include_evolution !== undefined) params.set("include_evolution", String(opts.include_evolution));
  if (opts.patient_profile) params.set("patient_profile", opts.patient_profile);
  const qs = params.toString();
  const url = `${API_BASE}/patients/${id}/history-export${qs ? `?${qs}` : ""}`;
  return getAuthHeader().then((headers) =>
    fetch(url, { headers }).then((res) => {
      if (!res.ok) throw new ApiError(res.status, "Error exporting history");
      return res.blob();
    })
  );
},
```

---

## Verificación (criterios del plan §5)

- [ ] PDF excluye secciones según toggles: descargar con `include_diagnosis=false` → el PDF no muestra CIE-11 ni Diagnóstico en las sesiones
- [ ] Plantilla infante incluye responsable legal: si el paciente tiene `emergency_contact_name`, aparece como "RESPONSABLE LEGAL" en el PDF cuando el perfil es "infante"
- [ ] Modal aparece antes de descargar con las 3 opciones de perfil y 3 checkboxes de secciones
- [ ] Por defecto: perfil adulto, todas las secciones activas
- [ ] El PDF con todas las opciones desactivadas sigue incluyendo datos del paciente, fecha, sesiones (fecha/hora/CUPS/valor) y hash SHA-256
