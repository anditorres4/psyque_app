# AI Features Contextual Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Disolver el tab "Psyque IA" y reubicar cada feature de IA dentro del contexto clínico donde tiene sentido: diagnóstico en Historia Clínica, resumen en cada Sesión, resumen global en Historia Clínica, análisis en Documentos — con gating por plan (`pro`/`clinic`) que muestra un badge de mejora en `starter`.

**Architecture:** Se introduce un hook `useAiFeatures` que centraliza la lectura del plan y feature flags del tenant, exponiendo booleanos `canDiagnose`, `canSummarize`, `canAnalyzeDocuments`. Cada tab recibe un componente AI autónomo como sibling al final de su contenido; estos componentes no modifican el formulario padre directamente sino que emiten callbacks (`onAcceptDiagnosis`, `onSummaryGenerated`) para que el padre actualice su estado. El backend no necesita cambios de endpoints; sí necesita que `summarize/clinical-record` incluya los últimos resúmenes de sesión en el prompt.

**Tech Stack:** React 18, TypeScript, React Query, FastAPI, SQLAlchemy, Tailwind CSS, psy design tokens.

---

## Archivos a tocar

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `frontend/src/hooks/useAiFeatures.ts` | Crear | Leer plan + features del tenant, exponer `canDiagnose`, `canSummarize`, `canAnalyzeDocuments` |
| `frontend/src/components/ui/AiFeatureBadge.tsx` | Crear | Badge "IA" con logo + banner upgrade para plan starter |
| `frontend/src/components/patients/AiDiagnosisSection.tsx` | Crear | Panel diagnóstico CIE-11 para Historia Clínica (reemplaza AiDiagnosisPanel) |
| `frontend/src/components/patients/AiSessionSummarySection.tsx` | Crear | Panel resumen sesión para SessionDetail y SessionForm |
| `frontend/src/components/patients/AiClinicalRecordSummarySection.tsx` | Crear | Panel resumen historia clínica con sesiones incluidas |
| `frontend/src/components/patients/ClinicalRecordSection.tsx` | Modificar | Agregar AiDiagnosisSection y AiClinicalRecordSummarySection al final |
| `frontend/src/components/sessions/SessionDetail.tsx` | Modificar | Agregar AiSessionSummarySection al final |
| `frontend/src/components/sessions/SessionForm.tsx` | Modificar | Agregar AiSessionSummarySection al final (pre-guardado) |
| `frontend/src/components/patients/DocumentsTab.tsx` | Modificar | Agregar AiDocumentsPanel al final de la lista de documentos |
| `frontend/src/pages/patients/PatientDetailPage.tsx` | Modificar | Eliminar tab `psyque-ia`, eliminar imports de paneles viejos |
| `backend/app/api/v1/ai.py` | Modificar | `summarize/clinical-record`: incluir últimas 5 sesiones resumidas en el prompt |
| `frontend/src/components/patients/AiDiagnosisPanel.tsx` | Eliminar | Reemplazado por AiDiagnosisSection |
| `frontend/src/components/patients/AiSummariesPanel.tsx` | Eliminar | Reemplazado por los dos componentes específicos |

---

## Task 1 — Hook `useAiFeatures` + componente `AiFeatureBadge`

**Files:**
- Crear: `psicogest/frontend/src/hooks/useAiFeatures.ts`
- Crear: `psicogest/frontend/src/components/ui/AiFeatureBadge.tsx`

- [ ] **Paso 1: Crear `useAiFeatures.ts`**

```ts
// psicogest/frontend/src/hooks/useAiFeatures.ts
import { useQuery } from "@tanstack/react-query";
import { api as aiApi } from "@/lib/ai";

export interface AiFeatures {
  canDiagnose: boolean;
  canSummarize: boolean;
  canAnalyzeDocuments: boolean;
  isLoading: boolean;
}

export function useAiFeatures(): AiFeatures {
  const { data, isLoading } = useQuery({
    queryKey: ["ai-features"],
    queryFn: () => aiApi.getFeatures(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return {
    canDiagnose: data?.ai_diagnosis ?? false,
    canSummarize: data?.ai_summaries ?? false,
    canAnalyzeDocuments: data?.ai_documents ?? false,
    isLoading,
  };
}
```

- [ ] **Paso 2: Crear `AiFeatureBadge.tsx`**

```tsx
// psicogest/frontend/src/components/ui/AiFeatureBadge.tsx
import { useState } from "react";
import { Sparkles, X } from "lucide-react";

interface AiFeatureBadgeProps {
  /** true = feature disponible, false = mostrar upgrade */
  available: boolean;
  /** Contenido del feature cuando está disponible */
  children: React.ReactNode;
  /** Nombre legible del feature para el banner */
  featureName?: string;
}

export function AiFeatureBadge({
  available,
  children,
  featureName = "esta función de IA",
}: AiFeatureBadgeProps) {
  const [bannerDismissed, setBannerDismissed] = useState(false);

  if (available) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 psy-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--psy-sage)" }}>
          <Sparkles size={11} />
          Psyque IA
        </div>
        {children}
      </div>
    );
  }

  if (bannerDismissed) {
    return (
      <button
        type="button"
        onClick={() => setBannerDismissed(false)}
        className="flex items-center gap-1.5 psy-mono text-[10px] uppercase tracking-wider opacity-40 hover:opacity-70 transition-opacity"
        style={{ color: "var(--psy-sage)" }}
      >
        <Sparkles size={11} />
        Psyque IA
      </button>
    );
  }

  return (
    <div
      className="rounded-lg p-4 flex items-start gap-3"
      style={{
        background: "var(--psy-sage-bg)",
        border: "1px solid var(--psy-sage-soft)",
      }}
    >
      <Sparkles size={16} className="shrink-0 mt-0.5" style={{ color: "var(--psy-sage)" }} />
      <div className="flex-1">
        <p className="text-[13px] font-semibold" style={{ color: "var(--psy-ink-1)" }}>
          Psyque IA · Plan Pro
        </p>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--psy-ink-3)" }}>
          {`Activa ${featureName} actualizando tu plan a Pro o Clinic.`}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setBannerDismissed(true)}
        className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
        aria-label="Cerrar"
      >
        <X size={14} style={{ color: "var(--psy-ink-3)" }} />
      </button>
    </div>
  );
}
```

- [ ] **Paso 3: Verificar TypeScript**

```bash
cd psicogest/frontend && npx tsc --noEmit 2>&1 | grep "AiFeature"
```

Resultado esperado: sin errores en estos archivos.

- [ ] **Paso 4: Commit**

```bash
git add psicogest/frontend/src/hooks/useAiFeatures.ts \
        psicogest/frontend/src/components/ui/AiFeatureBadge.tsx
git commit -m "feat: add useAiFeatures hook and AiFeatureBadge upgrade component"
```

---

## Task 2 — Backend: incluir resúmenes de sesiones en `summarize/clinical-record`

**Files:**
- Modificar: `psicogest/backend/app/api/v1/ai.py` (líneas ~246-295)

El endpoint actual construye `clinical_record_text` solo desde `ClinicalRecord`. Hay que agregar los últimos 5 resúmenes de sesión del paciente.

- [ ] **Paso 1: Agregar import del modelo `AiSessionSummary`**

Al inicio de `ai.py`, donde están los imports de modelos, agregar:

```python
from app.models.ai_session_summary import AiSessionSummary
```

- [ ] **Paso 2: Reemplazar el cuerpo de `summarize_clinical_record` desde donde construye `clinical_record_text`**

Localizar el bloque (línea ~278) que dice `clinical_record_text = ""` hasta el `return ai_service.generate_clinical_record_summary(...)`. Reemplazarlo con:

```python
    clinical_record_text = ""

    clinical_record = ctx.db.query(ClinicalRecord).filter(
        ClinicalRecord.patient_id == input_data.patient_id,
        ClinicalRecord.tenant_id == uuid.UUID(ctx.tenant.tenant_id),
    ).first()

    if clinical_record:
        clinical_record_text = (
            f"Motivo de consulta: {clinical_record.chief_complaint or 'No registrado'}\n\n"
            f"Problemas presentados: {clinical_record.presenting_problems or 'No registrado'}\n\n"
            f"Descripción de síntomas: {clinical_record.symptom_description or 'No registrado'}\n\n"
            f"Plan de tratamiento: {clinical_record.treatment_plan or 'No registrado'}\n\n"
            f"Objetivos terapéuticos: {clinical_record.therapeutic_goals or 'No registrado'}"
        )
    else:
        clinical_record_text = "Sin historia clínica registrada"

    # Incluir los últimos 5 resúmenes de sesión para enriquecer el contexto
    recent_summaries = (
        ctx.db.query(AiSessionSummary)
        .join(
            __import__("app.models.session", fromlist=["Session"]).Session,
            AiSessionSummary.session_id == __import__("app.models.session", fromlist=["Session"]).Session.id,
        )
        .filter(
            AiSessionSummary.tenant_id == uuid.UUID(ctx.tenant.tenant_id),
            __import__("app.models.session", fromlist=["Session"]).Session.patient_id == input_data.patient_id,
        )
        .order_by(AiSessionSummary.created_at.desc())
        .limit(5)
        .all()
    )

    if recent_summaries:
        summaries_text = "\n\n".join(
            f"Sesión {i + 1}: {s.summary}" for i, s in enumerate(reversed(recent_summaries))
        )
        clinical_record_text += f"\n\n---\nResúmenes de últimas {len(recent_summaries)} sesiones:\n{summaries_text}"

    return ai_service.generate_clinical_record_summary(
        ctx.db, tenant, input_data.patient_id, clinical_record_text
    )
```

> **Nota:** El import dinámico con `__import__` es feo. Mejor agregar `from app.models.session import Session as SessionModel` al bloque de imports en la parte superior del archivo. Ver paso siguiente.

- [ ] **Paso 3: Limpiar el import — reemplazar el `__import__` inline**

En el bloque de imports de `ai.py` (donde están `from app.models.clinical_record import ClinicalRecord` y otros), agregar:

```python
from app.models.session import Session as SessionModel
```

Luego en el bloque de `recent_summaries`, reemplazar los `__import__(...)` con `SessionModel`:

```python
    recent_summaries = (
        ctx.db.query(AiSessionSummary)
        .join(SessionModel, AiSessionSummary.session_id == SessionModel.id)
        .filter(
            AiSessionSummary.tenant_id == uuid.UUID(ctx.tenant.tenant_id),
            SessionModel.patient_id == input_data.patient_id,
        )
        .order_by(AiSessionSummary.created_at.desc())
        .limit(5)
        .all()
    )
```

- [ ] **Paso 4: Verificar que el backend arranca sin errores**

```bash
cd psicogest/backend && python -c "from app.api.v1.ai import router; print('OK')"
```

Resultado esperado: `OK`

- [ ] **Paso 5: Commit**

```bash
git add psicogest/backend/app/api/v1/ai.py
git commit -m "feat: include last 5 session summaries in clinical record AI summary context"
```

---

## Task 3 — `AiDiagnosisSection` (Historia Clínica)

**Files:**
- Crear: `psicogest/frontend/src/components/patients/AiDiagnosisSection.tsx`

Este componente reemplaza a `AiDiagnosisPanel`. Recibe el estado **actual del formulario** (no el record guardado) para poder sugerir diagnóstico antes del guardado. Emite `onAccept(code, description)` para que `ClinicalRecordSection` llene los campos de diagnóstico.

- [ ] **Paso 1: Crear `AiDiagnosisSection.tsx`**

```tsx
// psicogest/frontend/src/components/patients/AiDiagnosisSection.tsx
import { useState } from "react";
import { CheckCircle, XCircle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { AiFeatureBadge } from "@/components/ui/AiFeatureBadge";
import { useAiDiagnosis } from "@/hooks/useAiDiagnosis";
import type { MentalExamBlock } from "@/lib/api";
import type { DiagnosisCode } from "@/lib/ai";

interface Props {
  patientId: string;
  canDiagnose: boolean;
  // Campos del formulario de historia clínica (estado en vivo, no guardado)
  chiefComplaint: string;
  presentingProblems: string;
  symptomDescription: string;
  mentalExam: MentalExamBlock;
  patientAge: number | null;
  patientSex: "male" | "female" | "other" | null;
  onAccept: (code: string, description: string) => void;
}

const CONFIDENCE_BADGE: Record<string, { label: string; style: React.CSSProperties }> = {
  alta:  { label: "Alta",  style: { background: "var(--psy-sage-bg)",  color: "var(--psy-ok)" } },
  media: { label: "Media", style: { background: "#FFF8EC",              color: "var(--psy-warn)" } },
  baja:  { label: "Baja",  style: { background: "var(--psy-bg-soft)",   color: "var(--psy-ink-3)" } },
};

function SuggestionCard({
  item,
  onAccept,
  onReject,
}: {
  item: DiagnosisCode;
  onAccept: () => void;
  onReject: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [decided, setDecided] = useState<"accepted" | "rejected" | null>(null);
  const badge = CONFIDENCE_BADGE[String(item.confidence)] ?? CONFIDENCE_BADGE.baja;

  const handleAccept = () => { setDecided("accepted"); onAccept(); };
  const handleReject = () => { setDecided("rejected"); onReject(); };

  return (
    <div
      className="rounded-md p-3 space-y-2 transition-opacity"
      style={{
        border: "1px solid var(--psy-line)",
        background: decided === "accepted" ? "var(--psy-sage-bg)" : decided === "rejected" ? "var(--psy-bg-soft)" : "var(--psy-surface)",
        opacity: decided === "rejected" ? 0.55 : 1,
      }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="psy-mono text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--psy-bg-soft)", color: "var(--psy-primary)" }}>
              {item.code}
            </span>
            <span className="text-[11px] px-1.5 py-0.5 rounded font-medium" style={badge.style}>
              {badge.label}
            </span>
          </div>
          <p className="text-[13px] font-medium" style={{ color: "var(--psy-ink-1)" }}>{item.description}</p>
        </div>
        {!decided && (
          <div className="flex gap-1 shrink-0">
            <button
              type="button"
              onClick={handleAccept}
              className="p-1 rounded transition-colors hover:bg-[var(--psy-sage-bg)]"
              title="Aceptar diagnóstico"
            >
              <CheckCircle size={18} style={{ color: "var(--psy-ok)" }} />
            </button>
            <button
              type="button"
              onClick={handleReject}
              className="p-1 rounded transition-colors hover:bg-[var(--psy-bg-soft)]"
              title="Rechazar"
            >
              <XCircle size={18} style={{ color: "var(--psy-danger)" }} />
            </button>
          </div>
        )}
        {decided === "accepted" && (
          <span className="text-[11px] font-medium shrink-0" style={{ color: "var(--psy-ok)" }}>✓ Aceptado</span>
        )}
        {decided === "rejected" && (
          <span className="text-[11px] font-medium shrink-0" style={{ color: "var(--psy-ink-3)" }}>Rechazado</span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[11px] transition-colors"
        style={{ color: "var(--psy-ink-3)" }}
      >
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {open ? "Ocultar justificación" : "Ver justificación"}
      </button>
      {open && (
        <p className="text-[12px] pt-1 border-t" style={{ color: "var(--psy-ink-2)", borderColor: "var(--psy-line)" }}>
          Confianza: {Math.round(Number(item.confidence) * 100)}%
        </p>
      )}
    </div>
  );
}

export function AiDiagnosisSection({
  patientId, canDiagnose,
  chiefComplaint, presentingProblems, symptomDescription,
  mentalExam, patientAge, patientSex, onAccept,
}: Props) {
  const { suggestions, loading, error, suggestDiagnosis, submitFeedback, clearError } = useAiDiagnosis();
  const [currentSuggestion, setCurrentSuggestion] = useState<typeof suggestions[0] | null>(null);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  const hasContext = !!(chiefComplaint.trim() || presentingProblems.trim() || symptomDescription.trim());

  const buildSummary = () => {
    const parts: string[] = [];
    if (patientAge) parts.push(`Edad: ${patientAge} años`);
    if (chiefComplaint) parts.push(`Motivo: ${chiefComplaint}`);
    if (presentingProblems) parts.push(`Problemas: ${presentingProblems}`);
    if (symptomDescription) parts.push(`Síntomas: ${symptomDescription}`);
    const examEntries = Object.entries(mentalExam).filter(([, v]) => v);
    if (examEntries.length) parts.push(`Examen mental: ${examEntries.map(([k, v]) => `${k}: ${v}`).join("; ")}`);
    return parts.join("\n");
  };

  const handleSuggest = async () => {
    clearError();
    setCurrentSuggestion(null);
    setAccepted([]);
    setRejected([]);
    setFeedbackSaved(false);
    const result = await suggestDiagnosis({
      patientId,
      clinicalRecordSummary: buildSummary(),
      currentSymptoms: symptomDescription ? [symptomDescription] : [],
    });
    setCurrentSuggestion(result);
  };

  const handleAccept = (item: DiagnosisCode) => {
    setAccepted((prev) => [...prev, item.code]);
    onAccept(item.code, item.description);
  };

  const handleReject = (code: string) => {
    setRejected((prev) => [...prev, code]);
  };

  const handleSaveFeedback = async () => {
    if (!currentSuggestion) return;
    await submitFeedback(currentSuggestion.id, accepted, rejected);
    setFeedbackSaved(true);
  };

  return (
    <AiFeatureBadge available={canDiagnose} featureName="sugerencias de diagnóstico CIE-11">
      <div className="space-y-3">
        <p className="text-[12px]" style={{ color: "var(--psy-ink-3)" }}>
          Genera sugerencias de diagnóstico a partir del contexto clínico. Acepta ✓ para copiar el código al formulario.
        </p>

        <button
          type="button"
          onClick={handleSuggest}
          disabled={loading || !hasContext}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors"
          style={{
            background: loading || !hasContext ? "var(--psy-bg-soft)" : "var(--psy-primary)",
            color: loading || !hasContext ? "var(--psy-ink-3)" : "#fff",
            border: "1px solid transparent",
            cursor: loading || !hasContext ? "not-allowed" : "pointer",
          }}
        >
          {loading && <Loader2 size={13} className="animate-spin" />}
          {loading ? "Analizando..." : "Sugerir diagnósticos CIE-11"}
        </button>

        {!hasContext && (
          <p className="text-[11px]" style={{ color: "var(--psy-ink-4)" }}>
            Completa al menos uno de: motivo de consulta, problemas presentantes o síntomas.
          </p>
        )}

        {error && (
          <p className="text-[12px]" style={{ color: "var(--psy-danger)" }}>{error}</p>
        )}

        {currentSuggestion && currentSuggestion.suggestions.length === 0 && (
          <p className="text-[12px]" style={{ color: "var(--psy-ink-3)" }}>
            El modelo no encontró diagnósticos con el contexto disponible. Agrega más detalle clínico.
          </p>
        )}

        {currentSuggestion && currentSuggestion.suggestions.map((item) => (
          <SuggestionCard
            key={item.code}
            item={item}
            onAccept={() => handleAccept(item)}
            onReject={() => handleReject(item.code)}
          />
        ))}

        {currentSuggestion && (accepted.length > 0 || rejected.length > 0) && !feedbackSaved && (
          <button
            type="button"
            onClick={handleSaveFeedback}
            className="text-[12px] underline transition-colors"
            style={{ color: "var(--psy-ink-3)" }}
          >
            Guardar decisiones para auditoría
          </button>
        )}
        {feedbackSaved && (
          <p className="text-[12px]" style={{ color: "var(--psy-ok)" }}>✓ Decisiones guardadas.</p>
        )}

        {currentSuggestion && (
          <p className="text-[11px]" style={{ color: "var(--psy-ink-4)" }}>
            Sugerencias orientativas. La decisión diagnóstica es responsabilidad del profesional.
          </p>
        )}
      </div>
    </AiFeatureBadge>
  );
}
```

- [ ] **Paso 2: Verificar tipos**

```bash
cd psicogest/frontend && npx tsc --noEmit 2>&1 | grep "AiDiagnosisSection"
```

Resultado esperado: sin errores.

- [ ] **Paso 3: Commit**

```bash
git add psicogest/frontend/src/components/patients/AiDiagnosisSection.tsx
git commit -m "feat: add AiDiagnosisSection component for Historia Clínica tab"
```

---

## Task 4 — `AiSessionSummarySection` (SessionDetail + SessionForm)

**Files:**
- Crear: `psicogest/frontend/src/components/patients/AiSessionSummarySection.tsx`

Recibe `sessionId` (puede ser `null` cuando todavía es un formulario pre-guardado) y los campos de la sesión. Cuando `sessionId` es `null` (SessionForm), el botón dice "Disponible al guardar la sesión" y está deshabilitado. Cuando existe, genera y muestra el resumen editable.

- [ ] **Paso 1: Crear `AiSessionSummarySection.tsx`**

```tsx
// psicogest/frontend/src/components/patients/AiSessionSummarySection.tsx
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { AiFeatureBadge } from "@/components/ui/AiFeatureBadge";
import { useAiSummaries } from "@/hooks/useAiSummaries";
import type { SessionSummary } from "@/lib/ai";

interface Props {
  sessionId: string | null;
  canSummarize: boolean;
  intervention: string;
  evolution: string;
  onSummaryGenerated?: (summary: SessionSummary) => void;
}

export function AiSessionSummarySection({
  sessionId, canSummarize, intervention, evolution, onSummaryGenerated,
}: Props) {
  const { summarizeSession, loading, error, clearError } = useAiSummaries();
  const [result, setResult] = useState<SessionSummary | null>(null);
  const [editedSummary, setEditedSummary] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const hasContent = !!(intervention.trim() || evolution.trim());
  const isPreSave = sessionId === null;

  const handleGenerate = async () => {
    if (!sessionId) return;
    clearError();
    const summary = await summarizeSession(sessionId);
    setResult(summary);
    setEditedSummary(summary.summary);
    onSummaryGenerated?.(summary);
  };

  return (
    <AiFeatureBadge available={canSummarize} featureName="resumen de sesión">
      <div className="space-y-3">
        <p className="text-[12px]" style={{ color: "var(--psy-ink-3)" }}>
          Genera un resumen clínico de la sesión a partir de la intervención y evolución.
        </p>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || !hasContent || isPreSave}
          title={isPreSave ? "Guarda la sesión primero para generar el resumen" : undefined}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors"
          style={{
            background: loading || !hasContent || isPreSave ? "var(--psy-bg-soft)" : "var(--psy-primary)",
            color: loading || !hasContent || isPreSave ? "var(--psy-ink-3)" : "#fff",
            cursor: loading || !hasContent || isPreSave ? "not-allowed" : "pointer",
          }}
        >
          {loading && <Loader2 size={13} className="animate-spin" />}
          {isPreSave ? "Disponible al guardar la sesión" : loading ? "Generando..." : "Generar resumen IA"}
        </button>

        {!hasContent && !isPreSave && (
          <p className="text-[11px]" style={{ color: "var(--psy-ink-4)" }}>
            Completa la intervención o evolución para generar el resumen.
          </p>
        )}

        {error && (
          <p className="text-[12px]" style={{ color: "var(--psy-danger)" }}>{error}</p>
        )}

        {result && (
          <div className="space-y-2">
            {isEditing ? (
              <textarea
                className="w-full rounded-md text-[13px] px-3 py-2 resize-y min-h-[100px]"
                style={{
                  border: "1px solid var(--psy-line)",
                  background: "var(--psy-surface)",
                  color: "var(--psy-ink-1)",
                }}
                value={editedSummary}
                onChange={(e) => setEditedSummary(e.target.value)}
              />
            ) : (
              <p
                className="text-[13px] leading-relaxed p-3 rounded-md"
                style={{ background: "var(--psy-bg-soft)", color: "var(--psy-ink-1)" }}
              >
                {editedSummary}
              </p>
            )}

            {result.key_topics.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {result.key_topics.map((topic) => (
                  <span
                    key={topic}
                    className="text-[11px] px-2 py-0.5 rounded-full psy-mono"
                    style={{ background: "var(--psy-sage-bg)", color: "var(--psy-ink-2)" }}
                  >
                    {topic}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsEditing((v) => !v)}
                className="text-[12px] underline"
                style={{ color: "var(--psy-ink-3)" }}
              >
                {isEditing ? "Terminar edición" : "Editar resumen"}
              </button>
              <span className="psy-mono text-[10px]" style={{ color: "var(--psy-ink-4)" }}>
                {result.model_version}
              </span>
            </div>
          </div>
        )}
      </div>
    </AiFeatureBadge>
  );
}
```

- [ ] **Paso 2: Verificar tipos**

```bash
cd psicogest/frontend && npx tsc --noEmit 2>&1 | grep "AiSessionSummary"
```

Resultado esperado: sin errores.

- [ ] **Paso 3: Commit**

```bash
git add psicogest/frontend/src/components/patients/AiSessionSummarySection.tsx
git commit -m "feat: add AiSessionSummarySection component for session detail and form"
```

---

## Task 5 — `AiClinicalRecordSummarySection` (Historia Clínica)

**Files:**
- Crear: `psicogest/frontend/src/components/patients/AiClinicalRecordSummarySection.tsx`

Genera y muestra el resumen global del paciente (historia + últimas 5 sesiones). El texto es editable. Es distinto del panel de diagnóstico — aparecen los dos en Historia Clínica, en secciones separadas.

- [ ] **Paso 1: Crear `AiClinicalRecordSummarySection.tsx`**

```tsx
// psicogest/frontend/src/components/patients/AiClinicalRecordSummarySection.tsx
import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { AiFeatureBadge } from "@/components/ui/AiFeatureBadge";
import { useAiSummaries } from "@/hooks/useAiSummaries";
import type { ClinicalRecordSummary } from "@/lib/ai";

interface Props {
  patientId: string;
  canSummarize: boolean;
}

export function AiClinicalRecordSummarySection({ patientId, canSummarize }: Props) {
  const { summarizeClinicalRecord, loading, error, clearError } = useAiSummaries();
  const [result, setResult] = useState<ClinicalRecordSummary | null>(null);
  const [editedSummary, setEditedSummary] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const handleGenerate = async () => {
    clearError();
    const summary = await summarizeClinicalRecord(patientId);
    setResult(summary);
    setEditedSummary(summary.summary);
  };

  return (
    <AiFeatureBadge available={canSummarize} featureName="resumen de historia clínica">
      <div className="space-y-3">
        <p className="text-[12px]" style={{ color: "var(--psy-ink-3)" }}>
          Resumen inteligente de la historia clínica incluyendo las últimas sesiones realizadas.
        </p>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors"
          style={{
            background: loading ? "var(--psy-bg-soft)" : "var(--psy-primary)",
            color: loading ? "var(--psy-ink-3)" : "#fff",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          {result ? "Actualizar resumen" : "Generar resumen"}
        </button>

        {error && (
          <p className="text-[12px]" style={{ color: "var(--psy-danger)" }}>{error}</p>
        )}

        {result && (
          <div className="space-y-3">
            {isEditing ? (
              <textarea
                className="w-full rounded-md text-[13px] px-3 py-2 resize-y min-h-[120px]"
                style={{
                  border: "1px solid var(--psy-line)",
                  background: "var(--psy-surface)",
                  color: "var(--psy-ink-1)",
                }}
                value={editedSummary}
                onChange={(e) => setEditedSummary(e.target.value)}
              />
            ) : (
              <p
                className="text-[13px] leading-relaxed p-3 rounded-md"
                style={{ background: "var(--psy-bg-soft)", color: "var(--psy-ink-1)" }}
              >
                {editedSummary}
              </p>
            )}

            {result.key_aspects.length > 0 && (
              <div>
                <p className="text-[11px] psy-mono uppercase tracking-wider mb-1.5" style={{ color: "var(--psy-ink-3)" }}>
                  Aspectos clave
                </p>
                <ul className="space-y-1">
                  {result.key_aspects.map((a, i) => (
                    <li key={i} className="text-[12px] flex items-start gap-1.5" style={{ color: "var(--psy-ink-2)" }}>
                      <span style={{ color: "var(--psy-sage)" }}>·</span> {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.recommendations.length > 0 && (
              <div>
                <p className="text-[11px] psy-mono uppercase tracking-wider mb-1.5" style={{ color: "var(--psy-ink-3)" }}>
                  Recomendaciones
                </p>
                <ul className="space-y-1">
                  {result.recommendations.map((r, i) => (
                    <li key={i} className="text-[12px] flex items-start gap-1.5" style={{ color: "var(--psy-ink-2)" }}>
                      <span style={{ color: "var(--psy-sage)" }}>·</span> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsEditing((v) => !v)}
                className="text-[12px] underline"
                style={{ color: "var(--psy-ink-3)" }}
              >
                {isEditing ? "Terminar edición" : "Editar resumen"}
              </button>
              <span className="psy-mono text-[10px]" style={{ color: "var(--psy-ink-4)" }}>
                {result.model_version}
              </span>
            </div>
          </div>
        )}
      </div>
    </AiFeatureBadge>
  );
}
```

- [ ] **Paso 2: Verificar tipos**

```bash
cd psicogest/frontend && npx tsc --noEmit 2>&1 | grep "AiClinicalRecord"
```

Resultado esperado: sin errores.

- [ ] **Paso 3: Commit**

```bash
git add psicogest/frontend/src/components/patients/AiClinicalRecordSummarySection.tsx
git commit -m "feat: add AiClinicalRecordSummarySection with session context inclusion"
```

---

## Task 6 — Integrar IA en `ClinicalRecordSection`

**Files:**
- Modificar: `psicogest/frontend/src/components/patients/ClinicalRecordSection.tsx`

`ClinicalRecordSection` recibe ya `patientId`. Hay que:
1. Importar `useAiFeatures`, `AiDiagnosisSection`, `AiClinicalRecordSummarySection`
2. Calcular `patientAge` y `patientSex` — estos ya vienen del patient, pero `ClinicalRecordSection` no los recibe hoy. Hay que agregar las props `patientAge` y `patientSex`.
3. Agregar un callback `onDiagnosisAccepted(code, description)` que actualice `diagnosisCie11` y `diagnosisDesc` en el estado local.
4. Al final del JSX (antes del `</div>` que cierra el bloque de antecedentes), agregar las dos secciones IA dentro de un `<div className="border-t pt-6 space-y-8">`.

- [ ] **Paso 1: Ampliar la interfaz de props de `ClinicalRecordSection`**

En [ClinicalRecordSection.tsx](psicogest/frontend/src/components/patients/ClinicalRecordSection.tsx), buscar la definición de las props (alrededor de la línea donde está `patientId: string`). Reemplazarla con:

```tsx
// La interfaz actualmente solo tiene { patientId: string }
// Reemplazar con:
interface ClinicalRecordSectionProps {
  patientId: string;
  patientAge?: number | null;
  patientSex?: "male" | "female" | "other" | null;
}
```

Y actualizar la firma de la función:

```tsx
export function ClinicalRecordSection({ patientId, patientAge = null, patientSex = null }: ClinicalRecordSectionProps) {
```

- [ ] **Paso 2: Agregar imports en `ClinicalRecordSection.tsx`**

Al inicio del archivo, después de los imports existentes, agregar:

```tsx
import { useAiFeatures } from "@/hooks/useAiFeatures";
import { AiDiagnosisSection } from "@/components/patients/AiDiagnosisSection";
import { AiClinicalRecordSummarySection } from "@/components/patients/AiClinicalRecordSummarySection";
```

- [ ] **Paso 3: Agregar el hook y el callback dentro del componente**

Dentro del cuerpo de la función, después de las líneas de `useState` existentes, agregar:

```tsx
  const { canDiagnose, canSummarize } = useAiFeatures();

  const handleDiagnosisAccepted = (code: string, description: string) => {
    setDiagnosisCie11(code);
    setDiagnosisDesc(description);
    if (!editing) {
      setEditing(true);
    }
  };
```

- [ ] **Paso 4: Agregar las secciones IA al final del JSX**

Localizar el `</div>` de cierre que sigue a los 4 `<AntecedentesEditor />` (línea ~540). Agregar justo antes del `</div>` que cierra todo el bloque `rounded-lg border bg-card`:

```tsx
        {/* ── Psyque IA ── */}
        <div className="border-t pt-6 space-y-8" style={{ borderColor: "var(--psy-line)" }}>
          <AiDiagnosisSection
            patientId={patientId}
            canDiagnose={canDiagnose}
            chiefComplaint={chiefComplaint}
            presentingProblems={presentingProblems}
            symptomDescription={symptomDescription}
            mentalExam={mentalExam}
            patientAge={patientAge}
            patientSex={patientSex}
            onAccept={handleDiagnosisAccepted}
          />
          <AiClinicalRecordSummarySection
            patientId={patientId}
            canSummarize={canSummarize}
          />
        </div>
```

- [ ] **Paso 5: Actualizar el llamador en `PatientDetailPage.tsx`**

En [PatientDetailPage.tsx](psicogest/frontend/src/pages/patients/PatientDetailPage.tsx), localizar donde se renderiza `<ClinicalRecordSection patientId={id} />` (línea ~305). Reemplazar con:

```tsx
<ClinicalRecordSection
  patientId={id}
  patientAge={patientAge}
  patientSex={patientSex}
/>
```

Donde `patientAge` y `patientSex` ya existen en el componente (derivados de `patient.birth_date` y `patient.sex`).

- [ ] **Paso 6: Verificar build**

```bash
cd psicogest/frontend && npm run build 2>&1 | tail -5
```

Resultado esperado: `✓ built in ...`

- [ ] **Paso 7: Commit**

```bash
git add psicogest/frontend/src/components/patients/ClinicalRecordSection.tsx \
        psicogest/frontend/src/pages/patients/PatientDetailPage.tsx
git commit -m "feat: embed AI diagnosis and clinical record summary inside Historia Clínica tab"
```

---

## Task 7 — Integrar `AiSessionSummarySection` en `SessionDetail`

**Files:**
- Modificar: `psicogest/frontend/src/components/sessions/SessionDetail.tsx`

- [ ] **Paso 1: Agregar imports en `SessionDetail.tsx`**

```tsx
import { useAiFeatures } from "@/hooks/useAiFeatures";
import { AiSessionSummarySection } from "@/components/patients/AiSessionSummarySection";
```

- [ ] **Paso 2: Agregar el hook dentro del componente**

Dentro de `SessionDetail`, después de `const isSigned = sess.status === "signed";`, agregar:

```tsx
  const { canSummarize } = useAiFeatures();
```

- [ ] **Paso 3: Agregar la sección IA al final del JSX**

Localizar el bloque `{/* Notes */}` (la sección de notas clínicas al final). Justo antes de ese bloque, agregar:

```tsx
      {/* ── Psyque IA · Resumen de sesión ── */}
      <div
        className="rounded-lg p-5 space-y-2"
        style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
      >
        <AiSessionSummarySection
          sessionId={sessionId}
          canSummarize={canSummarize}
          intervention={sess.intervention ?? ""}
          evolution={sess.evolution ?? ""}
        />
      </div>
```

- [ ] **Paso 4: Verificar build**

```bash
cd psicogest/frontend && npm run build 2>&1 | tail -5
```

Resultado esperado: `✓ built in ...`

- [ ] **Paso 5: Commit**

```bash
git add psicogest/frontend/src/components/sessions/SessionDetail.tsx
git commit -m "feat: embed AiSessionSummarySection in SessionDetail"
```

---

## Task 8 — Integrar `AiSessionSummarySection` en `SessionForm`

**Files:**
- Modificar: `psicogest/frontend/src/components/sessions/SessionForm.tsx`

En `SessionForm`, la sesión no existe todavía (`sessionId` es `null`). Se muestra el botón deshabilitado con el texto "Disponible al guardar la sesión". Después del submit exitoso, si hay `onSuccess(createdSessionId)`, el componente padre puede re-renderizar `SessionDetail` con el nuevo ID y el resumen ya estará disponible.

- [ ] **Paso 1: Agregar imports en `SessionForm.tsx`**

```tsx
import { useAiFeatures } from "@/hooks/useAiFeatures";
import { AiSessionSummarySection } from "@/components/patients/AiSessionSummarySection";
```

- [ ] **Paso 2: Agregar el hook y la sección al final del formulario**

Dentro del componente, después del bloque de `useState`, agregar:

```tsx
  const { canSummarize } = useAiFeatures();
```

Localizar el botón de submit (`type="submit"`) al final del JSX. Agregar la sección IA justo después del botón de submit (fuera del `<form>` si el botón es el último elemento, o como sección hermana separada por un `<div>`):

```tsx
      {/* ── Psyque IA · Resumen (post-guardado) ── */}
      <div
        className="rounded-lg p-5 mt-4"
        style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
      >
        <AiSessionSummarySection
          sessionId={null}
          canSummarize={canSummarize}
          intervention={intervention}
          evolution={evolution}
        />
      </div>
```

- [ ] **Paso 3: Verificar build**

```bash
cd psicogest/frontend && npm run build 2>&1 | tail -5
```

Resultado esperado: `✓ built in ...`

- [ ] **Paso 4: Commit**

```bash
git add psicogest/frontend/src/components/sessions/SessionForm.tsx
git commit -m "feat: show AiSessionSummarySection (pre-save state) in SessionForm"
```

---

## Task 9 — Integrar `AiDocumentsPanel` en `DocumentsTab`

**Files:**
- Modificar: `psicogest/frontend/src/components/patients/DocumentsTab.tsx`

`AiDocumentsPanel` ya existe y funciona. Solo hay que importarlo, envolverlo con `AiFeatureBadge`, y añadirlo al final de `DocumentsTab`.

- [ ] **Paso 1: Agregar imports en `DocumentsTab.tsx`**

```tsx
import { useAiFeatures } from "@/hooks/useAiFeatures";
import { AiDocumentsPanel } from "@/components/patients/AiDocumentsPanel";
import { AiFeatureBadge } from "@/components/ui/AiFeatureBadge";
```

- [ ] **Paso 2: Agregar el hook dentro del componente `DocumentsTab`**

Localizar donde se define la función `DocumentsTab({ patientId })`. Dentro del cuerpo, antes del `return`, agregar:

```tsx
  const { canAnalyzeDocuments } = useAiFeatures();
```

- [ ] **Paso 3: Agregar el panel IA al final del JSX**

Localizar el `</div>` de cierre del componente. Justo antes, agregar:

```tsx
      {/* ── Psyque IA · Análisis de documentos ── */}
      <div
        className="rounded-lg p-5 mt-2"
        style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
      >
        <AiFeatureBadge available={canAnalyzeDocuments} featureName="análisis de documentos">
          <AiDocumentsPanel patientId={patientId} />
        </AiFeatureBadge>
      </div>
```

- [ ] **Paso 4: Verificar build**

```bash
cd psicogest/frontend && npm run build 2>&1 | tail -5
```

Resultado esperado: `✓ built in ...`

- [ ] **Paso 5: Commit**

```bash
git add psicogest/frontend/src/components/patients/DocumentsTab.tsx
git commit -m "feat: embed AiDocumentsPanel inside DocumentsTab with plan gating"
```

---

## Task 10 — Eliminar tab `psyque-ia` y limpiar imports

**Files:**
- Modificar: `psicogest/frontend/src/pages/patients/PatientDetailPage.tsx`
- Eliminar: `psicogest/frontend/src/components/patients/AiDiagnosisPanel.tsx`
- Eliminar: `psicogest/frontend/src/components/patients/AiSummariesPanel.tsx`

- [ ] **Paso 1: Limpiar `PatientDetailPage.tsx`**

Remover:
1. Import de `AiDiagnosisPanel` (línea ~26)
2. Import de `AiSummariesPanel` (línea ~27)
3. `"psyque-ia"` del tipo `Tab` (línea ~33)
4. La entrada `{ id: "psyque-ia", label: "Psyque IA" }` de la constante `TABS`
5. El bloque `{activeTab === "psyque-ia" && ...}` completo (líneas ~343-357)

El tipo `Tab` resultante debe ser:
```tsx
type Tab = "info" | "historia" | "sesiones" | "documentos" | "rips" | "seguimiento" | "remisiones";
```

Los `TABS` sin la entrada IA:
```tsx
const TABS: { id: Tab; label: string }[] = [
  { id: "info",        label: "Información" },
  { id: "historia",    label: "Historia clínica" },
  { id: "sesiones",    label: "Sesiones" },
  { id: "documentos",  label: "Documentos" },
  { id: "rips",        label: "RIPS" },
  { id: "seguimiento", label: "Seguimiento" },
  { id: "remisiones",  label: "Remisiones" },
];
```

- [ ] **Paso 2: Eliminar los archivos de paneles obsoletos**

```bash
rm psicogest/frontend/src/components/patients/AiDiagnosisPanel.tsx
rm psicogest/frontend/src/components/patients/AiSummariesPanel.tsx
```

- [ ] **Paso 3: Verificar build limpio**

```bash
cd psicogest/frontend && npm run build 2>&1 | tail -10
```

Resultado esperado: `✓ built in ...` sin warnings de imports no usados.

- [ ] **Paso 4: Commit**

```bash
git add -A
git commit -m "feat: remove standalone Psyque IA tab, AI features now embedded in context tabs"
```

---

## Task 11 — Verificación manual (checklist)

- [ ] **Historia Clínica tab:**
  - Al abrir la historia de cualquier paciente, al final del formulario aparece la sección "Psyque IA" con ícono de Sparkles.
  - Plan `starter`: se ve el banner "Psyque IA · Plan Pro" con botón ✕ que lo minimiza a solo el ícono.
  - Plan `pro`/`clinic`: se ve el botón "Sugerir diagnósticos CIE-11".
  - Al llenar motivo de consulta y hacer click: spinner → tarjetas con código CIE-11, badge de confianza.
  - Click ✓ en una tarjeta: el campo "Dx. inicial CIE-11" del formulario se actualiza y el formulario pasa a modo edición.
  - Click "Guardar decisiones para auditoría" → confirmación "✓ Decisiones guardadas."
  - Debajo del diagnóstico: sección "Generar resumen" / "Actualizar resumen".
  - Click "Generar resumen": spinner → texto editable + lista de aspectos clave + recomendaciones.

- [ ] **Sesiones tab (SessionDetail):**
  - Al abrir una sesión con intervención y evolución rellenas, aparece sección "Psyque IA · Resumen de sesión".
  - Click "Generar resumen IA": spinner → resumen editable + topics como badges.
  - Click "Editar resumen" → textarea editable.

- [ ] **Crear sesión (SessionForm):**
  - Al final del formulario (antes de guardar) aparece sección IA con botón deshabilitado "Disponible al guardar la sesión".

- [ ] **Documentos tab:**
  - Al final de la lista de documentos, aparece sección "Psyque IA · Análisis de Documentos".
  - Plan `starter`: banner de upgrade.
  - Plan `pro`/`clinic`: dropdown de documentos + botón "Analizar".

- [ ] **No existe la tab "Psyque IA"** en la barra de tabs del perfil del paciente.

- [ ] **Commit final**

```bash
git push origin main
```

---

## Self-Review

**Spec coverage:**
- ✅ Diagnóstico en Historia Clínica, alimentado por historia clínica
- ✅ Resumen de sesión en SessionDetail Y SessionForm
- ✅ Resumen de sesión alimentado por `intervention` + `evolution`
- ✅ Resumen de historia clínica en Historia Clínica, incluye últimas sesiones automáticamente (Task 2)
- ✅ Análisis de documentos en DocumentsTab
- ✅ No existe tab IA independiente (Task 10)
- ✅ Plan starter → badge con logo IA + banner de upgrade
- ✅ Feature flags fijos por plan (los lee el endpoint `/ai/features` que ya filtra por `tenant.features`)
- ✅ Diagnóstico: acepta sugerencia → copia código al formulario sin sobreescribir hasta pulsar ✓
- ✅ Resumen de sesión: guardable y editable
- ✅ Resumen de historia clínica: único por paciente, editable

**Pendiente fuera del scope de este plan:** Persistir el `editedSummary` editado de vuelta al backend. Actualmente la edición es solo local (en memoria). Un Task 12 futuro podría agregar un endpoint `PATCH /ai/session-summary/{id}` y un botón "Guardar edición". Se omite aquí por YAGNI — el usuario no lo solicitó explícitamente.
