# UX/UI Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 15 UX/UI issues across PsyCent — organized P0→P3 — reducing friction in the psychologist's clinical documentation workflow.

**Architecture:** All changes in `psicogest/frontend/src/`. Two new UI components (`breadcrumb.tsx`). No new pages; improvements are edits to existing pages. `SessionDocPage` gets the most changes (P0-B, P1-A, P1-B, P1-C, P1-D, P3-A). No database migrations required.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, lucide-react, react-router-dom v6, @tanstack/react-query v5. No test runner — validate each task with `npm run build` (zero TS errors) + manual check at `http://localhost:5173`.

## Global Constraints

- Run all build checks from `psicogest/frontend/`: `npm run build`
- Never import `@/hooks/use-toast` or `sonner` — not installed
- All inline styles use `--psy-*` CSS variables
- Button hierarchy: primary → `PsyButton variant="primary"`, secondary → `PsyButton variant="ghost"` or `Button variant="outline"`
- Commit after every task: `fix(ux/p0-x):` or `feat(ux/p1-x):` prefix

---

### Task 1: P0-A — Remove hardcoded sparklines from Dashboard

**Files:**
- Modify: `psicogest/frontend/src/pages/DashboardPage.tsx`

**What:** Four constant arrays (`SPARK_APT`, `SPARK_NOTES`, `SPARK_ATTEND`, `SPARK_SESS`) with fake values are shown as real trend charts. Delete them and remove the `sparkline`/`sparklineColor` props from the four `KPI` usages. The `KPI` component already handles `sparkline` being `undefined`.

- [ ] **Step 1: Delete the four constant arrays**

Remove lines 11–14 from `DashboardPage.tsx`:
```tsx
// DELETE — remove these 4 lines entirely:
const SPARK_APT  = [3, 5, 4, 6, 5, 7, 8, 6, 9, 8, 10, 11];
const SPARK_NOTES = [2, 3, 1, 4, 2, 1, 0, 2, 1, 2, 3, 2];
const SPARK_ATTEND = [88, 90, 92, 89, 95, 94, 96, 98, 97, 95, 96, 98];
const SPARK_SESS = [1, 0, 1, 2, 1, 0, 1, 1, 2, 1, 0, 1];
```

- [ ] **Step 2: Remove sparkline props from the four KPI components**

Replace the KPI grid block (the `<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">` block) with:
```tsx
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
  <KPI
    label="Citas hoy"
    value={data.appointments_today}
    accent="info"
  />
  <KPI
    label="Notas por cerrar"
    value={data.pending_to_close}
    delta={data.pending_to_close > 0 ? "requieren atención" : "al día"}
    trend={data.pending_to_close > 0 ? "down" : undefined}
    accent={data.pending_to_close > 0 ? "warn" : "ok"}
  />
  <KPI
    label="Asistencia 30d"
    value={attendanceVal ?? "—"}
    unit={attendanceVal !== null ? "%" : undefined}
    accent="ok"
  />
  <KPI
    label="Sesiones abiertas"
    value={draftSessions.length}
    delta={draftSessions.length > 0 ? "en curso" : "ninguna"}
    accent={draftSessions.length > 0 ? "warn" : undefined}
  />
</div>
```

- [ ] **Step 3: Build and verify**

```bash
cd psicogest/frontend && npm run build
```
Expected: zero TS errors. Open `/dashboard` — four KPI tiles with no sparkline charts.

- [ ] **Step 4: Commit**

```bash
git add psicogest/frontend/src/pages/DashboardPage.tsx
git commit -m "fix(ux/p0-a): eliminar arrays de sparklines hardcodeados de los KPIs del Dashboard"
```

---

### Task 2: P0-B — Fix save navigation in SessionDocPage

**Files:**
- Modify: `psicogest/frontend/src/pages/sessions/SessionDocPage.tsx`

**What:** `saveMutation.onSuccess` currently calls `navigate("/agenda")`, ejecting the psychologist mid-session. Remove that navigation. Add 2-second inline "✓ Guardado" feedback instead. Sign still navigates out (correct — session becomes immutable).

- [ ] **Step 1: Add saved feedback state**

Add near the existing `useState` declarations (around line 70):
```tsx
const [savedFeedback, setSavedFeedback] = useState(false);
```

- [ ] **Step 2: Fix saveMutation — remove navigate, add feedback**

Replace the `saveMutation` block (lines 131–162):
```tsx
const saveMutation = useMutation({
  mutationFn: () => {
    const payload: SessionUpdatePayload = {
      actual_start: new Date(form.actual_start).toISOString(),
      actual_end: new Date(form.actual_end).toISOString(),
      diagnosis_cie11: form.diagnosis_cie11,
      diagnosis_description: form.diagnosis_description,
      cups_code: form.cups_code,
      tipo_dx_principal: form.tipo_dx_principal,
      is_emergency: form.is_emergency,
      consultation_reason: form.consultation_reason,
      intervention: form.intervention,
      evolution: form.evolution || undefined,
      next_session_plan: form.next_session_plan || undefined,
      homework_assigned: homework || undefined,
      patient_summary_text: patientSummary || undefined,
      session_fee: Number(form.session_fee),
      authorization_number: form.authorization_number || undefined,
      mental_exam: Object.values(mentalExam).some(Boolean)
        ? (mentalExam as Record<string, string>)
        : undefined,
    };
    return api.sessions.update(sessionId!, payload);
  },
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ["session", sessionId] });
    qc.invalidateQueries({ queryKey: ["sessions"] });
    setSaveError(null);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
    // no navigate — psychologist stays on page after saving draft
  },
  onError: (err) => setSaveError(err instanceof ApiError ? err.message : "Error al guardar."),
});
```

- [ ] **Step 3: Update save button to show feedback**

Replace the save button block at the bottom of the left panel (around line 484):
```tsx
{!readOnly && (
  <div className="pt-1">
    {saveError && (
      <p className="psy-mono text-[12px] mb-2" style={{ color: "var(--psy-danger, #e74c3c)" }}>
        {saveError}
      </p>
    )}
    <button
      type="button"
      onClick={() => saveMutation.mutate()}
      disabled={saveMutation.isPending}
      className="w-full py-2.5 rounded-lg psy-mono text-[13px] font-semibold transition-opacity disabled:opacity-60"
      style={{ background: "var(--psy-primary)", color: "#fff" }}
    >
      {saveMutation.isPending ? "Guardando…" : "Guardar borrador"}
    </button>
    {savedFeedback && (
      <p className="psy-mono text-[11px] mt-1 text-center" style={{ color: "var(--psy-sage)" }}>
        ✓ Guardado
      </p>
    )}
  </div>
)}
```

- [ ] **Step 4: Build and verify**

```bash
cd psicogest/frontend && npm run build
```

Open a draft session, make a change, click "Guardar borrador" — stays on page, shows "✓ Guardado" for 2 s.

- [ ] **Step 5: Commit**

```bash
git add psicogest/frontend/src/pages/sessions/SessionDocPage.tsx
git commit -m "fix(ux/p0-b): guardar borrador ya no navega fuera de SessionDocPage"
```

---

### Task 3: P0-C — Fix RipsTab in PatientDetailPage

**Files:**
- Modify: `psicogest/frontend/src/pages/patients/PatientDetailPage.tsx`

**What:** RIPS exports are per-period (all patients), not per-patient. Replace the misleading global list with a contextual message + link. Remove the `useQuery` import used only in `RipsTab` if it becomes unused (check first — `PatientTasksCard` also uses `useQuery`).

- [ ] **Step 1: Replace RipsTab function (lines 732–796)**

```tsx
function RipsTab() {
  return (
    <div
      className="max-w-xl rounded-[var(--radius)] p-6 flex flex-col gap-4"
      style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
    >
      <div className="psy-mono text-[10.5px] uppercase tracking-wider" style={{ color: "var(--psy-ink-3)" }}>
        RIPS · Resolución 0948/2026
      </div>
      <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--psy-ink-2)" }}>
        Los reportes RIPS se generan por período (mes/año) e incluyen todas las sesiones
        firmadas del consultorio. Para generar o descargar un RIPS, usa la sección global.
      </p>
      <a
        href="/rips"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium"
        style={{ color: "var(--psy-primary)" }}
      >
        Ir a RIPS →
      </a>
    </div>
  );
}
```

- [ ] **Step 2: Build and verify**

```bash
cd psicogest/frontend && npm run build
```

Navigate to any patient → tab "RIPS" → shows message + link, not all exports.

- [ ] **Step 3: Commit**

```bash
git add psicogest/frontend/src/pages/patients/PatientDetailPage.tsx
git commit -m "fix(ux/p0-c): RipsTab muestra mensaje contextual en vez de todos los RIPS del consultorio"
```

---

### Task 4: P1-A — Autosave in SessionDocPage

**Files:**
- Modify: `psicogest/frontend/src/pages/sessions/SessionDocPage.tsx`

**What:** Debounced silent save every 30 s after any form change. Status indicator ("Guardando…" / "✓ Guardado") in the header. No spinner, no navigation.

- [ ] **Step 1: Add `useRef` to React import**

Ensure `useRef` is imported:
```tsx
import { useEffect, useState, useRef } from "react";
```

- [ ] **Step 2: Add autosave state + timer ref**

Add after existing `useState` declarations:
```tsx
const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
```

- [ ] **Step 3: Extract buildPayload helper**

Add this function just before the `saveMutation` declaration:
```tsx
const buildPayload = (): SessionUpdatePayload => ({
  actual_start: new Date(form.actual_start).toISOString(),
  actual_end: new Date(form.actual_end).toISOString(),
  diagnosis_cie11: form.diagnosis_cie11,
  diagnosis_description: form.diagnosis_description,
  cups_code: form.cups_code,
  tipo_dx_principal: form.tipo_dx_principal,
  is_emergency: form.is_emergency,
  consultation_reason: form.consultation_reason,
  intervention: form.intervention,
  evolution: form.evolution || undefined,
  next_session_plan: form.next_session_plan || undefined,
  homework_assigned: homework || undefined,
  patient_summary_text: patientSummary || undefined,
  session_fee: Number(form.session_fee),
  authorization_number: form.authorization_number || undefined,
  mental_exam: Object.values(mentalExam).some(Boolean)
    ? (mentalExam as Record<string, string>)
    : undefined,
});
```

Update `saveMutation.mutationFn` to use it:
```tsx
mutationFn: () => api.sessions.update(sessionId!, buildPayload()),
```

- [ ] **Step 4: Add autosave useEffect**

Add after the existing `useEffect` blocks:
```tsx
useEffect(() => {
  if (readOnly || !sess) return;
  if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
  autoSaveTimer.current = setTimeout(async () => {
    setAutoSaveStatus("saving");
    try {
      await api.sessions.update(sessionId!, buildPayload());
      qc.invalidateQueries({ queryKey: ["session", sessionId] });
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus("idle"), 3000);
    } catch (e) {
      console.error("[autosave]", e);
      setAutoSaveStatus("idle");
    }
  }, 30_000);
  return () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [form, mentalExam, patientSummary, homework]);
```

- [ ] **Step 5: Show status in header**

In the header div, add the status indicator between the breadcrumb/back area and the sign buttons:
```tsx
{!readOnly && autoSaveStatus !== "idle" && (
  <span className="psy-mono text-[10px]" style={{ color: "var(--psy-ink-4)" }}>
    {autoSaveStatus === "saving" && "Guardando…"}
    {autoSaveStatus === "saved" && "✓ Guardado"}
  </span>
)}
```

- [ ] **Step 6: Build and verify**

```bash
cd psicogest/frontend && npm run build
```

Open a draft session, edit a field. Watch Network tab in DevTools — a PUT to `/sessions/:id` fires after 30 s without any user action.

- [ ] **Step 7: Commit**

```bash
git add psicogest/frontend/src/pages/sessions/SessionDocPage.tsx
git commit -m "feat(ux/p1-a): autosave silencioso cada 30s en SessionDocPage"
```

---

### Task 5: P1-B — Section grouping in SessionDocPage

**Files:**
- Modify: `psicogest/frontend/src/pages/sessions/SessionDocPage.tsx`

**What:** Wrap left panel fields in 4 collapsible sections (Diagnóstico, Nota clínica, Plan, Administrativo). Collapse state persisted in `localStorage`.

- [ ] **Step 1: Add SectionHeader component above SessionDocPage**

Add this before the `SessionDocPage` function:
```tsx
function SectionHeader({
  title, sectionKey, open, onToggle,
}: {
  title: string;
  sectionKey: string;
  open: boolean;
  onToggle: (key: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(sectionKey)}
      className="w-full flex items-center justify-between py-2 border-b"
      style={{ borderColor: "var(--psy-line)" }}
    >
      <span className="psy-mono text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--psy-ink-3)" }}>
        {title}
      </span>
      <span
        className="text-[13px]"
        style={{
          color: "var(--psy-ink-4)",
          display: "inline-block",
          transform: open ? "rotate(180deg)" : "none",
          transition: "transform 0.15s",
        }}
      >
        ▾
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Add section state inside SessionDocPage**

Add after existing `useState` declarations:
```tsx
const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
  try {
    const saved = localStorage.getItem("session-doc-sections");
    return saved
      ? JSON.parse(saved)
      : { diagnostico: true, nota: true, plan: true, admin: false };
  } catch {
    return { diagnostico: true, nota: true, plan: true, admin: false };
  }
});

const toggleSection = (key: string) => {
  setOpenSections((prev) => {
    const next = { ...prev, [key]: !prev[key] };
    localStorage.setItem("session-doc-sections", JSON.stringify(next));
    return next;
  });
};
```

- [ ] **Step 3: Restructure left panel**

Replace the entire left panel content (the inner content of `<div className="rounded-xl p-5 space-y-5 lg:overflow-y-auto"...>`) with the 4-section layout below. Keep every existing field — just reorganize them:

```tsx
<div
  className="rounded-xl p-5 space-y-4 lg:overflow-y-auto"
  style={{
    background: "var(--psy-surface)",
    border: "1px solid var(--psy-line)",
    maxHeight: "calc(100vh - 140px)",
  }}
>
  <h2 className="psy-mono text-[12px] font-semibold uppercase tracking-widest" style={{ color: "var(--psy-ink-3)" }}>
    Historia clínica
  </h2>

  {/* ── Diagnóstico ── */}
  <div className="space-y-3">
    <SectionHeader title="Diagnóstico" sectionKey="diagnostico" open={openSections.diagnostico} onToggle={toggleSection} />
    {openSections.diagnostico && (
      <div className="space-y-4 pt-1">
        <TherapeuticGoals patientId={String(sess.patient_id)} readOnly={readOnly} />
        <div
          className="p-3 rounded-lg flex items-center justify-between gap-4"
          style={{ background: "var(--psy-bg-soft)", border: "1px solid var(--psy-line)" }}
        >
          <div className="flex-1">
            <label className={labelClass} style={labelStyle}>Tipo diagnóstico</label>
            <select className={inputClass} style={inputStyle(readOnly)} value={form.tipo_dx_principal} onChange={(e) => set("tipo_dx_principal", e.target.value)} disabled={readOnly}>
              {TIPO_DX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-[13px] cursor-pointer mt-4" style={{ color: "var(--psy-ink-2)" }}>
            <input type="checkbox" checked={form.is_emergency} onChange={(e) => set("is_emergency", e.target.checked)} disabled={readOnly} />
            Urgencia
          </label>
        </div>
        <div className="relative">
          <label className={labelClass} style={labelStyle}>Diagnóstico CIE-11</label>
          <input className={inputClass} style={inputStyle(readOnly)} value={cie11Query} onChange={(e) => setCie11Query(e.target.value)} placeholder="Buscar código CIE-11…" disabled={readOnly} />
          {!readOnly && cie11Results.length > 0 && (
            <ul className="absolute z-20 w-full mt-1 rounded-md shadow-lg overflow-hidden" style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}>
              {cie11Results.map((entry) => (
                <li key={entry.code} className="px-3 py-2 text-[12px] cursor-pointer hover:bg-[var(--psy-bg-soft)]" style={{ color: "var(--psy-ink-1)" }}
                  onMouseDown={() => { set("diagnosis_cie11", entry.code); set("diagnosis_description", entry.description); setCie11Query(`${entry.code} — ${entry.description}`); setCie11Results([]); }}>
                  <span className="font-semibold psy-mono" style={{ color: "var(--psy-primary)" }}>{entry.code}</span>{" "}— {entry.description}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Descripción diagnóstico</label>
          <input className={inputClass} style={inputStyle(readOnly)} value={form.diagnosis_description} onChange={(e) => set("diagnosis_description", e.target.value)} disabled={readOnly} />
        </div>
      </div>
    )}
  </div>

  {/* ── Nota clínica ── */}
  <div className="space-y-3">
    <SectionHeader title="Nota clínica" sectionKey="nota" open={openSections.nota} onToggle={toggleSection} />
    {openSections.nota && (
      <div className="space-y-4 pt-1">
        <div>
          <label className={labelClass} style={labelStyle}>Motivo de consulta</label>
          <textarea className={inputClass} style={inputStyle(readOnly)} rows={3} value={form.consultation_reason} onChange={(e) => set("consultation_reason", e.target.value)} disabled={readOnly} />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Intervención realizada</label>
          <textarea className={inputClass} style={inputStyle(readOnly)} rows={4} value={form.intervention} onChange={(e) => set("intervention", e.target.value)} disabled={readOnly} />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Evolución</label>
          <textarea className={inputClass} style={inputStyle(readOnly)} rows={3} value={form.evolution} onChange={(e) => set("evolution", e.target.value)} disabled={readOnly} />
        </div>
        <div style={readOnly ? { pointerEvents: "none", opacity: 0.7 } : undefined}>
          <MentalExamDropdowns value={mentalExam} onChange={setMentalExam} />
        </div>
      </div>
    )}
  </div>

  {/* ── Plan ── */}
  <div className="space-y-3">
    <SectionHeader title="Plan" sectionKey="plan" open={openSections.plan} onToggle={toggleSection} />
    {openSections.plan && (
      <div className="space-y-4 pt-1">
        <div>
          <label className={labelClass} style={labelStyle}>Plan próxima sesión</label>
          <textarea className={inputClass} style={inputStyle(readOnly)} rows={3} value={form.next_session_plan} onChange={(e) => set("next_session_plan", e.target.value)} disabled={readOnly} />
        </div>
      </div>
    )}
  </div>

  {/* ── Administrativo ── */}
  <div className="space-y-3">
    <SectionHeader title="Administrativo" sectionKey="admin" open={openSections.admin} onToggle={toggleSection} />
    {openSections.admin && (
      <div className="space-y-4 pt-1">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} style={labelStyle}>Inicio</label>
            <input type="datetime-local" className={inputClass} style={inputStyle(readOnly)} value={form.actual_start} onChange={(e) => set("actual_start", e.target.value)} disabled={readOnly} required />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Fin</label>
            <input type="datetime-local" className={inputClass} style={inputStyle(readOnly)} value={form.actual_end} onChange={(e) => set("actual_end", e.target.value)} disabled={readOnly} required />
          </div>
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Código CUPS</label>
          <select className={inputClass} style={inputStyle(readOnly)} value={form.cups_code} onChange={(e) => set("cups_code", e.target.value)} disabled={readOnly}>
            {CUPS_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} style={labelStyle}>Valor sesión (COP)</label>
            <input type="number" className={inputClass} style={inputStyle(readOnly)} value={form.session_fee} onChange={(e) => set("session_fee", e.target.value)} min={0} disabled={readOnly} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>N° autorización</label>
            <input className={inputClass} style={inputStyle(readOnly)} value={form.authorization_number} onChange={(e) => set("authorization_number", e.target.value)} disabled={readOnly} />
          </div>
        </div>
      </div>
    )}
  </div>

  {/* Save button */}
  {!readOnly && (
    <div className="pt-1">
      {saveError && <p className="psy-mono text-[12px] mb-2" style={{ color: "var(--psy-danger, #e74c3c)" }}>{saveError}</p>}
      <button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
        className="w-full py-2.5 rounded-lg psy-mono text-[13px] font-semibold transition-opacity disabled:opacity-60"
        style={{ background: "var(--psy-primary)", color: "#fff" }}>
        {saveMutation.isPending ? "Guardando…" : "Guardar borrador"}
      </button>
      {savedFeedback && (
        <p className="psy-mono text-[11px] mt-1 text-center" style={{ color: "var(--psy-sage)" }}>✓ Guardado</p>
      )}
    </div>
  )}
</div>
```

- [ ] **Step 4: Build and verify**

```bash
cd psicogest/frontend && npm run build
```

Open a draft session — 4 collapsible sections. "Administrativo" collapsed by default. Toggle and reload — state persists.

- [ ] **Step 5: Commit**

```bash
git add psicogest/frontend/src/pages/sessions/SessionDocPage.tsx
git commit -m "feat(ux/p1-b): agrupar campos de SessionDocPage en 4 secciones colapsables"
```

---

### Task 6: P1-C — CIE-11 keyboard navigation

**Files:**
- Modify: `psicogest/frontend/src/pages/sessions/SessionDocPage.tsx`

**What:** Add `↑`/`↓`/`Enter`/`Escape` keyboard navigation to the existing CIE-11 search.

- [ ] **Step 1: Add focused index state**

Add near the existing CIE-11 state:
```tsx
const [cie11FocusedIdx, setCie11FocusedIdx] = useState(-1);
```

- [ ] **Step 2: Add keydown handler**

Add inside `SessionDocPage`, before the render return:
```tsx
const handleCie11KeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (cie11Results.length === 0) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    setCie11FocusedIdx((i) => Math.min(i + 1, cie11Results.length - 1));
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    setCie11FocusedIdx((i) => Math.max(i - 1, 0));
  } else if (e.key === "Enter") {
    e.preventDefault();
    const idx = cie11FocusedIdx >= 0 ? cie11FocusedIdx : 0;
    const entry = cie11Results[idx];
    if (entry) {
      set("diagnosis_cie11", entry.code);
      set("diagnosis_description", entry.description);
      setCie11Query(`${entry.code} — ${entry.description}`);
      setCie11Results([]);
      setCie11FocusedIdx(-1);
    }
  } else if (e.key === "Escape") {
    setCie11Results([]);
    setCie11FocusedIdx(-1);
  }
};
```

Reset focused index when results change — add to the existing CIE-11 `useEffect`:
```tsx
useEffect(() => {
  if (cie11Query.length >= 2) setCie11Results(searchCie11(cie11Query).slice(0, 6));
  else setCie11Results([]);
  setCie11FocusedIdx(-1);
}, [cie11Query]);
```

- [ ] **Step 3: Wire handler and highlight to CIE-11 input + list**

Update the CIE-11 `<input>` (inside Diagnóstico section):
```tsx
<input
  className={inputClass}
  style={inputStyle(readOnly)}
  value={cie11Query}
  onChange={(e) => setCie11Query(e.target.value)}
  onKeyDown={handleCie11KeyDown}
  placeholder="Buscar código CIE-11…"
  disabled={readOnly}
  role="combobox"
  aria-autocomplete="list"
  aria-expanded={cie11Results.length > 0}
/>
```

Update each `<li>` in the results list:
```tsx
{cie11Results.map((entry, idx) => (
  <li
    key={entry.code}
    className="px-3 py-2 text-[12px] cursor-pointer"
    style={{
      color: "var(--psy-ink-1)",
      background: idx === cie11FocusedIdx ? "var(--psy-sage-bg)" : undefined,
    }}
    onMouseEnter={() => setCie11FocusedIdx(idx)}
    onMouseDown={() => {
      set("diagnosis_cie11", entry.code);
      set("diagnosis_description", entry.description);
      setCie11Query(`${entry.code} — ${entry.description}`);
      setCie11Results([]);
      setCie11FocusedIdx(-1);
    }}
  >
    <span className="font-semibold psy-mono" style={{ color: "var(--psy-primary)" }}>{entry.code}</span>
    {" "}— {entry.description}
  </li>
))}
```

- [ ] **Step 4: Build and verify**

```bash
cd psicogest/frontend && npm run build
```

Open a draft session. Type "depresión" in CIE-11. Use ↓↑ to navigate, Enter to select, Escape to close.

- [ ] **Step 5: Commit**

```bash
git add psicogest/frontend/src/pages/sessions/SessionDocPage.tsx
git commit -m "feat(ux/p1-c): navegación por teclado en buscador CIE-11 (↑↓ Enter Escape)"
```

---

### Task 7: P1-D — Breadcrumb + contextual navigation

**Files:**
- Create: `psicogest/frontend/src/components/ui/breadcrumb.tsx`
- Modify: `psicogest/frontend/src/pages/sessions/SessionDocPage.tsx`
- Modify: `psicogest/frontend/src/pages/patients/PatientDetailPage.tsx`

**What:** New `Breadcrumb` component. `SessionDocPage` shows `Pacientes › [Nombre] › [Fecha]`. `PatientDetailPage` shows `Pacientes › [Nombre]`. `?tab=sesiones` restores the active tab on back-navigate.

- [ ] **Step 1: Create breadcrumb component**

Create `psicogest/frontend/src/components/ui/breadcrumb.tsx`:
```tsx
import { Link } from "react-router-dom";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && (
            <span className="psy-mono text-[11px]" style={{ color: "var(--psy-ink-4)" }}>›</span>
          )}
          {item.href ? (
            <Link
              to={item.href}
              className="psy-mono text-[12px] transition-colors hover:underline"
              style={{ color: "var(--psy-ink-3)" }}
            >
              {item.label}
            </Link>
          ) : (
            <span className="psy-mono text-[12px]" style={{ color: "var(--psy-ink-2)" }}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Load patient name in SessionDocPage**

Add import at top of `SessionDocPage.tsx`:
```tsx
import { Breadcrumb } from "@/components/ui/breadcrumb";
```

Add query after the existing `sess` query (after line 68):
```tsx
const { data: sessionPatient } = useQuery({
  queryKey: ["patient-name", sess?.patient_id],
  queryFn: () => api.patients.get(String(sess!.patient_id)),
  enabled: !!sess?.patient_id,
  staleTime: 300_000,
});
```

- [ ] **Step 3: Replace old back button in SessionDocPage header**

Replace the current back-button block (the `<button type="button" onClick={() => navigate("/sessions")}...>` and the `|` separator span):
```tsx
<Breadcrumb
  items={[
    { label: "Pacientes", href: "/patients" },
    sessionPatient
      ? {
          label: [sessionPatient.first_name, sessionPatient.first_surname].filter(Boolean).join(" "),
          href: `/patients/${sess.patient_id}?tab=sesiones`,
        }
      : { label: "Paciente", href: `/patients/${sess.patient_id}?tab=sesiones` },
    {
      label: new Date(sess.actual_start).toLocaleDateString("es-CO", {
        day: "numeric", month: "short", year: "numeric",
      }),
    },
  ]}
/>
```

Keep the `readOnly` badge and the signed-session action buttons (Editar, Constancia PDF) that follow — they stay in the same header row.

- [ ] **Step 4: Add Breadcrumb to PatientDetailPage**

Add import at top of `PatientDetailPage.tsx`:
```tsx
import { Breadcrumb } from "@/components/ui/breadcrumb";
```

Add breadcrumb before the patient header card (before the `<div className="rounded-[var(--radius)] p-5"` at line 212):
```tsx
<Breadcrumb
  items={[
    { label: "Pacientes", href: "/patients" },
    { label: fullName },
  ]}
/>
```

- [ ] **Step 5: Read `?tab` param in PatientDetailPage**

Add `useSearchParams` to the react-router-dom import:
```tsx
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
```

Add after `useParams`:
```tsx
const [searchParams] = useSearchParams();
```

Change the `activeTab` initial state to read from URL:
```tsx
const [activeTab, setActiveTab] = useState<Tab>(() => {
  const t = searchParams.get("tab") as Tab | null;
  return t && TABS.some((tab) => tab.id === t) ? t : "info";
});
```

- [ ] **Step 6: Build and verify**

```bash
cd psicogest/frontend && npm run build
```

Open a session → breadcrumb `Pacientes › Ana Torres › 7 jul 2026`. Click patient name → `/patients/:id?tab=sesiones` with Sesiones tab active.

- [ ] **Step 7: Commit**

```bash
git add psicogest/frontend/src/components/ui/breadcrumb.tsx psicogest/frontend/src/pages/sessions/SessionDocPage.tsx psicogest/frontend/src/pages/patients/PatientDetailPage.tsx
git commit -m "feat(ux/p1-d): breadcrumb contextual paciente↔sesión con restauración de tab"
```

---

### Task 8: P2-A+B — Sidebar labels, icons, badge, real username

**Files:**
- Modify: `psicogest/frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Update imports and navItems**

Replace the lucide-react import line and the `navItems` array:
```tsx
import {
  LayoutDashboard, Calendar, Users, Activity, FileText,
  CreditCard, BarChart3, Settings, LogOut, Search, X,
  ClipboardList, MessageSquare, Wallet, DollarSign, type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSessions } from "@/hooks/useSessions";

const navItems: NavItem[] = [
  { to: "/dashboard",           label: "Dashboard",          Icon: LayoutDashboard, group: "practice" },
  { to: "/agenda",              label: "Agenda",             Icon: Calendar,        group: "practice" },
  { to: "/patients",            label: "Pacientes",          Icon: Users,           group: "practice" },
  { to: "/sessions",            label: "Sesiones",           Icon: Activity,        group: "practice", live: true },
  { to: "/patient-registrations", label: "Registros pacientes", Icon: ClipboardList, group: "practice" },
  { to: "/triage",              label: "Triage",             Icon: MessageSquare,   group: "practice" },
  { to: "/rips",                label: "RIPS",               Icon: FileText,        group: "admin" },
  { to: "/invoices",            label: "Facturas",           Icon: CreditCard,      group: "admin" },
  { to: "/invoices/bulk",       label: "Facturación masa",   Icon: CreditCard,      group: "admin", indent: true },
  { to: "/cartera",             label: "Cartera",            Icon: Wallet,          group: "admin" },
  { to: "/caja",                label: "Caja",               Icon: DollarSign,      group: "admin" },
  { to: "/reports",             label: "Reportes",           Icon: BarChart3,       group: "admin" },
  { to: "/settings",            label: "Configuración",      Icon: Settings,        group: "admin" },
];
```

- [ ] **Step 2: Add draft count query inside Sidebar component**

Add inside `Sidebar` function body (before the return):
```tsx
const { user } = useAuth();
const { data: draftData } = useSessions({ status: "draft" });
const draftCount = draftData?.items?.length ?? 0;

const displayName =
  user?.user_metadata?.full_name ??
  user?.email?.split("@")[0] ??
  "Psicólogo";
const initials = displayName
  .split(" ")
  .map((w: string) => w[0]?.toUpperCase() ?? "")
  .slice(0, 2)
  .join("") || "PS";
```

- [ ] **Step 3: Update NavItemLink to accept draftCount**

Update `NavItemLink` function signature and the badge rendering:
```tsx
function NavItemLink({
  item, linkClass, onNavigate, draftCount = 0,
}: {
  item: NavItem;
  linkClass: (s: { isActive: boolean }, indent?: boolean) => string;
  onNavigate?: () => void;
  draftCount?: number;
}) {
  const Icon = item.Icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === "/dashboard"}
      className={(s) => linkClass(s, item.indent)}
      style={({ isActive }) => ({
        background: isActive ? "var(--psy-sage-bg)" : "transparent",
        color: isActive ? "var(--psy-primary)" : "var(--psy-ink-2)",
      })}
      onClick={onNavigate}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              className="absolute left-[-14px] top-2 bottom-2 w-[3px] rounded-r"
              style={{ background: "var(--psy-sage)" }}
            />
          )}
          <Icon size={16} className="opacity-85 shrink-0" />
          <span>{item.label}</span>
          {item.live && draftCount > 0 && (
            <span
              className="ml-auto psy-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none"
              style={{ background: "var(--psy-warn)", color: "#fff", minWidth: 18, textAlign: "center" as const }}
            >
              {draftCount}
            </span>
          )}
          {item.live && draftCount === 0 && <span className="psy-live-dot ml-auto" />}
        </>
      )}
    </NavLink>
  );
}
```

- [ ] **Step 4: Pass draftCount to practiceItems NavItemLinks**

In the `NavGroup` for Práctica, pass `draftCount`:
```tsx
<NavGroup label="Práctica">
  {practiceItems.map((it) => (
    <NavItemLink
      key={it.to}
      item={it}
      linkClass={linkClass}
      onNavigate={onClose}
      draftCount={it.live ? draftCount : 0}
    />
  ))}
</NavGroup>
```

- [ ] **Step 5: Replace hardcoded user footer**

Replace the user footer block:
```tsx
<div className="flex items-center gap-2.5 p-2">
  <div
    className="w-[30px] h-[30px] rounded-full grid place-items-center text-[12px] font-semibold shrink-0"
    style={{ background: "var(--psy-sage-bg)", color: "var(--psy-primary)", border: "1px solid var(--psy-sage-soft)" }}
  >
    {initials}
  </div>
  <div className="overflow-hidden">
    <div className="text-[13px] font-semibold leading-tight truncate" style={{ color: "var(--psy-ink-1)" }}>
      {displayName}
    </div>
    <div className="psy-mono text-[10px]" style={{ color: "var(--psy-ink-3)" }}>PSI · Colombia</div>
  </div>
</div>
```

- [ ] **Step 6: Build and verify**

```bash
cd psicogest/frontend && npm run build
```

Sidebar shows "Sesiones" (not "Sesiones activas"), Cartera/Caja have different icons, draft badge appears, footer shows real email/name.

- [ ] **Step 7: Commit**

```bash
git add psicogest/frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(ux/p2-ab): sidebar — etiquetas, íconos distintos, badge borradores y nombre real"
```

---

### Task 9: P2-C — Filter pills in PatientsPage

**Files:**
- Modify: `psicogest/frontend/src/pages/patients/PatientsPage.tsx`

- [ ] **Step 1: Replace the two `<select>` elements with pill buttons**

Replace the `{/* Filters */}` block (lines 114–146):
```tsx
{/* Filters */}
<div className="flex flex-col gap-2 mb-4">
  <Input
    placeholder="Buscar por nombre, apellido o documento..."
    value={search}
    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
    className="max-w-sm"
  />
  <div className="flex items-center gap-2 flex-wrap">
    {([
      { value: undefined, label: "Todos" },
      { value: true,      label: "Activos" },
      { value: false,     label: "Inactivos" },
    ] as const).map((opt) => (
      <button
        key={String(opt.value)}
        type="button"
        onClick={() => { setFilterActive(opt.value); setPage(1); }}
        className="text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors border"
        style={
          filterActive === opt.value
            ? { background: "var(--psy-primary)", color: "#fff", borderColor: "var(--psy-primary)" }
            : { background: "var(--psy-surface)", color: "var(--psy-ink-2)", borderColor: "var(--psy-line)" }
        }
      >
        {opt.label}
      </button>
    ))}
    <span className="mx-1 text-[11px]" style={{ color: "var(--psy-line)" }}>|</span>
    {([
      { value: undefined, label: "Con y sin EPS" },
      { value: true,      label: "Con EPS" },
      { value: false,     label: "Sin EPS" },
    ] as const).map((opt) => (
      <button
        key={`eps-${String(opt.value)}`}
        type="button"
        onClick={() => { setFilterEps(opt.value); setPage(1); }}
        className="text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors border"
        style={
          filterEps === opt.value
            ? { background: "var(--psy-primary)", color: "#fff", borderColor: "var(--psy-primary)" }
            : { background: "var(--psy-surface)", color: "var(--psy-ink-2)", borderColor: "var(--psy-line)" }
        }
      >
        {opt.label}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 2: Build and verify**

```bash
cd psicogest/frontend && npm run build
```

Navigate to `/patients` — pill buttons instead of native selects.

- [ ] **Step 3: Commit**

```bash
git add psicogest/frontend/src/pages/patients/PatientsPage.tsx
git commit -m "feat(ux/p2-c): filtros en PatientsPage reemplazados por pill-buttons consistentes"
```

---

### Task 10: P2-D — Normalize Button vs PsyButton

**Files:**
- Modify: `psicogest/frontend/src/pages/patients/PatientDetailPage.tsx`
- Modify: `psicogest/frontend/src/pages/patients/PatientsPage.tsx`

- [ ] **Step 1: Fix PatientDetailPage action buttons**

Ensure `PsyButton` is imported from `@/components/ui/psy`. Replace the actions block in the patient header (`<div className="flex flex-wrap gap-2">`):
```tsx
<div className="flex flex-wrap gap-2">
  {patient.email && (
    <PsyButton variant="ghost" onClick={handleInviteToPortal} disabled={isInviting || inviteSent}>
      {inviteSent ? "Invitación enviada" : isInviting ? "Enviando..." : "Invitar al portal"}
    </PsyButton>
  )}
  {inviteError && (
    <span className="psy-mono text-[11px] self-center" style={{ color: "var(--psy-danger)" }}>
      {inviteError}
    </span>
  )}
  <PsyButton variant="ghost" onClick={() => setIsEditing(!isEditing)}>
    {isEditing ? "Cancelar edición" : "Editar"}
  </PsyButton>
  <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
    <DialogTrigger asChild>
      <PsyButton variant="ghost">Exportar HC</PsyButton>
    </DialogTrigger>
    {/* DialogContent unchanged */}
  </Dialog>
</div>
```

- [ ] **Step 2: Fix PatientsPage primary button**

Add `PsyButton` import to `PatientsPage.tsx`:
```tsx
import { PsyButton } from "@/components/ui/psy";
```

Replace the header "Nuevo paciente" button:
```tsx
<PsyButton
  variant="primary"
  onClick={() => { setShowForm(true); setFormError(null); }}
>
  + Nuevo paciente
</PsyButton>
```

Check if `Button` from `@/components/ui/button` is still used elsewhere in the file; remove the import if not.

- [ ] **Step 3: Build and verify**

```bash
cd psicogest/frontend && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add psicogest/frontend/src/pages/patients/PatientDetailPage.tsx psicogest/frontend/src/pages/patients/PatientsPage.tsx
git commit -m "feat(ux/p2-d): normalizar Button vs PsyButton en PatientsPage y PatientDetailPage"
```

---

### Task 11: P2-E — Split export modal into two dialogs

**Files:**
- Modify: `psicogest/frontend/src/pages/patients/PatientDetailPage.tsx`

- [ ] **Step 1: Add second dialog state**

```tsx
const [certModalOpen, setCertModalOpen] = useState(false);
```

- [ ] **Step 2: Replace single Dialog with two separate ones**

In the patient header actions block, replace the single export `Dialog` with two:

```tsx
{/* Dialog 1: Exportar HC */}
<Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
  <DialogTrigger asChild>
    <PsyButton variant="ghost">Exportar HC</PsyButton>
  </DialogTrigger>
  <DialogContent className="max-w-sm">
    <DialogHeader><DialogTitle>Exportar historia clínica</DialogTitle></DialogHeader>
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <p className="text-sm font-medium">Perfil del paciente</p>
        <div className="flex gap-4">
          {(["adulto", "infante", "familiar"] as const).map((p) => (
            <label key={p} className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="patient_profile" value={p}
                checked={exportOptions.patient_profile === p}
                onChange={() => setExportOptions((o) => ({ ...o, patient_profile: p }))}
                className="accent-primary" />
              <span className="text-sm capitalize">{p}</span>
            </label>
          ))}
        </div>
        {exportOptions.patient_profile === "infante" && (
          <p className="text-xs text-muted-foreground">Incluye responsable legal desde contacto de emergencia.</p>
        )}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Secciones a incluir</p>
        {([
          { key: "include_diagnosis", label: "Diagnóstico (CIE-11)" },
          { key: "include_treatment", label: "Intervención y plan" },
          { key: "include_evolution", label: "Evolución" },
        ] as const).map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2">
            <Checkbox id={key} checked={exportOptions[key]}
              onCheckedChange={(checked) => setExportOptions((o) => ({ ...o, [key]: !!checked }))} />
            <Label htmlFor={key} className="text-sm font-normal cursor-pointer">{label}</Label>
          </div>
        ))}
      </div>
      <div className="space-y-2 pt-2 border-t">
        <p className="text-sm font-medium">Seguridad</p>
        <div className="flex items-center gap-2">
          <Checkbox id="protected_pdf" checked={exportOptions.protected}
            onCheckedChange={(checked) => setExportOptions((o) => ({ ...o, protected: !!checked }))} />
          <Label htmlFor="protected_pdf" className="text-sm font-normal cursor-pointer">
            PDF con contraseña (N° documento del paciente)
          </Label>
        </div>
      </div>
    </div>
    <div className="flex justify-end gap-2 pt-2">
      <Button variant="outline" onClick={() => setExportModalOpen(false)}>Cancelar</Button>
      <Button onClick={handleExportHistory} disabled={isExporting}>
        {isExporting ? "Generando..." : `Descargar HC${exportOptions.protected ? " (protegido)" : ""}`}
      </Button>
    </div>
  </DialogContent>
</Dialog>

{/* Dialog 2: Constancia de asistencia */}
<Dialog open={certModalOpen} onOpenChange={setCertModalOpen}>
  <DialogTrigger asChild>
    <PsyButton variant="ghost">Constancia</PsyButton>
  </DialogTrigger>
  <DialogContent className="max-w-sm">
    <DialogHeader><DialogTitle>Constancia de asistencia</DialogTitle></DialogHeader>
    <div className="space-y-4 py-2">
      <div className="flex items-center gap-2">
        <Checkbox id="cert_count" checked={certIncludeCount} onCheckedChange={(c) => setCertIncludeCount(!!c)} />
        <Label htmlFor="cert_count" className="text-sm font-normal cursor-pointer">Incluir número de sesiones</Label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-muted-foreground">Desde (opcional)</Label>
          <input type="date" value={certFromDate} onChange={(e) => setCertFromDate(e.target.value)}
            className="w-full mt-1 rounded-md border border-input px-2 py-1.5 text-sm" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Hasta (opcional)</Label>
          <input type="date" value={certToDate} onChange={(e) => setCertToDate(e.target.value)}
            className="w-full mt-1 rounded-md border border-input px-2 py-1.5 text-sm" />
        </div>
      </div>
    </div>
    <div className="flex justify-end gap-2 pt-2">
      <Button variant="outline" onClick={() => setCertModalOpen(false)}>Cancelar</Button>
      <Button onClick={() => { handleExportCertificate(); setCertModalOpen(false); }} disabled={isCertExporting}>
        {isCertExporting ? "Generando..." : "Descargar constancia"}
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

- [ ] **Step 3: Build and verify**

```bash
cd psicogest/frontend && npm run build
```

Patient detail header has two separate buttons: "Exportar HC" and "Constancia". Each opens its own small focused dialog.

- [ ] **Step 4: Commit**

```bash
git add psicogest/frontend/src/pages/patients/PatientDetailPage.tsx
git commit -m "feat(ux/p2-e): separar Exportar HC y Constancia en dos diálogos independientes"
```

---

### Task 12: P3-A — Word count in clinical textareas

**Files:**
- Modify: `psicogest/frontend/src/pages/sessions/SessionDocPage.tsx`

- [ ] **Step 1: Add focused field state and word count helper**

Add inside `SessionDocPage`:
```tsx
const [focusedField, setFocusedField] = useState<string | null>(null);
const wordCount = (text: string) =>
  text.trim() ? text.trim().split(/\s+/).length : 0;
```

- [ ] **Step 2: Wrap each of the three textareas**

For each of "Motivo de consulta" (`consultation_reason`), "Intervención realizada" (`intervention`), and "Evolución" (`evolution`), wrap in a `<div>` and add `onFocus`/`onBlur` + counter:

Pattern (repeat for each field, substituting the field name and label):
```tsx
<div>
  <label className={labelClass} style={labelStyle}>Motivo de consulta</label>
  <textarea
    className={inputClass} style={inputStyle(readOnly)} rows={3}
    value={form.consultation_reason}
    onChange={(e) => set("consultation_reason", e.target.value)}
    onFocus={() => setFocusedField("consultation_reason")}
    onBlur={() => setFocusedField(null)}
    disabled={readOnly}
  />
  {focusedField === "consultation_reason" && (
    <div className="text-right psy-mono text-[10px] mt-0.5" style={{ color: "var(--psy-ink-4)" }}>
      {wordCount(form.consultation_reason)} palabras
    </div>
  )}
</div>
```

Repeat with `intervention` and `evolution`.

- [ ] **Step 3: Build and verify**

```bash
cd psicogest/frontend && npm run build
```

Click on any clinical textarea — word count appears below. Click away — disappears.

- [ ] **Step 4: Commit**

```bash
git add psicogest/frontend/src/pages/sessions/SessionDocPage.tsx
git commit -m "feat(ux/p3-a): contador de palabras en textareas clínicos al enfocar"
```

---

### Task 13: P3-B — EmptyState in PatientsPage search

**Files:**
- Modify: `psicogest/frontend/src/pages/patients/PatientsPage.tsx`

- [ ] **Step 1: Add EmptyState import**

```tsx
import { EmptyState } from "@/components/ui/empty-state";
```

- [ ] **Step 2: Replace plain-text empty state**

Replace the plain-text block `{data && data.items.length === 0 && (...)}`:
```tsx
{data && data.items.length === 0 && (
  <EmptyState
    title={search ? `Sin resultados para "${search}"` : "Aún no tienes pacientes registrados."}
    description={
      search
        ? "Intenta con otro nombre, apellido o número de documento."
        : "Registra tu primer paciente para comenzar."
    }
    icon={search ? "🔍" : "🧑‍⚕️"}
    action={
      search ? (
        <button
          type="button"
          onClick={() => {
            setSearch("");
            setFilterActive(undefined);
            setFilterEps(undefined);
            setPage(1);
          }}
          className="text-[13px] font-medium"
          style={{ color: "var(--psy-primary)" }}
        >
          Limpiar búsqueda
        </button>
      ) : undefined
    }
  />
)}
```

- [ ] **Step 3: Build and verify**

```bash
cd psicogest/frontend && npm run build
```

Search for a non-existent patient — `EmptyState` with "Limpiar búsqueda" link.

- [ ] **Step 4: Commit**

```bash
git add psicogest/frontend/src/pages/patients/PatientsPage.tsx
git commit -m "feat(ux/p3-b): EmptyState mejorado en PatientsPage con opción de limpiar búsqueda"
```

---

### Task 14: P3-C — Patient name search in SessionsPage

**Files:**
- Modify: `psicogest/frontend/src/pages/sessions/SessionsPage.tsx`

**What:** Client-side filter on already-loaded items by `patient_name`.

- [ ] **Step 1: Add name search state**

```tsx
const [nameSearch, setNameSearch] = useState("");
```

- [ ] **Step 2: Filter items**

Replace `const items = data?.items ?? [];` with:
```tsx
const allItems = data?.items ?? [];
const items = nameSearch.trim().length >= 2
  ? allItems.filter((s) =>
      s.patient_name?.toLowerCase().includes(nameSearch.toLowerCase())
    )
  : allItems;
```

- [ ] **Step 3: Add search input to filter strip**

In the filter strip block, add a search input before the status pills:
```tsx
<div className="flex items-center gap-3 flex-wrap">
  <input
    type="text"
    placeholder="Buscar por paciente…"
    value={nameSearch}
    onChange={(e) => setNameSearch(e.target.value)}
    className="h-8 rounded-md border px-3 psy-mono text-[12px]"
    style={{
      border: "1px solid var(--psy-line)",
      background: "var(--psy-surface)",
      color: "var(--psy-ink-1)",
      width: 200,
      outline: "none",
    }}
  />
  {(["", "draft", "signed"] as const).map((val) => (
    /* existing pill buttons unchanged */
  ))}
  {draftCount > 0 && (
    <span className="ml-auto psy-mono text-[11px]" style={{ color: "var(--psy-warn)" }}>
      {draftCount} sin firmar
    </span>
  )}
</div>
```

- [ ] **Step 4: Build and verify**

```bash
cd psicogest/frontend && npm run build
```

Navigate to `/sessions`, type a patient name — table filters in real time.

- [ ] **Step 5: Commit**

```bash
git add psicogest/frontend/src/pages/sessions/SessionsPage.tsx
git commit -m "feat(ux/p3-c): búsqueda por nombre de paciente en SessionsPage (client-side)"
```

---

### Task 15: P3-D — Replace "Exportar día" with "Nueva cita"

**Files:**
- Modify: `psicogest/frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Update PageHeader actions**

Replace the `actions` prop in `PageHeader`:
```tsx
actions={
  <PsyButton
    variant="primary"
    icon={<span className="text-[16px] leading-none">+</span>}
    onClick={() => navigate("/agenda")}
  >
    Nueva cita
  </PsyButton>
}
```

Remove unused `Download` import from lucide-react (confirm it's not used elsewhere in the file first).

- [ ] **Step 2: Build and verify**

```bash
cd psicogest/frontend && npm run build
```

Dashboard header shows "Nueva cita" button. Clicking navigates to `/agenda`.

- [ ] **Step 3: Commit**

```bash
git add psicogest/frontend/src/pages/DashboardPage.tsx
git commit -m "feat(ux/p3-d): reemplazar botón Exportar día por Nueva cita en Dashboard"
```

---

## Spec coverage check

| Spec item | Task |
|---|---|
| P0-A sparklines hardcodeados | Task 1 |
| P0-B save navega fuera | Task 2 |
| P0-C RipsTab muestra todos | Task 3 |
| P1-A autosave | Task 4 |
| P1-B agrupación visual | Task 5 |
| P1-C CIE-11 teclado | Task 6 |
| P1-D breadcrumb | Task 7 |
| P2-A sidebar etiquetas/íconos | Task 8 |
| P2-B nombre real en sidebar | Task 8 |
| P2-C filtros pill PatientsPage | Task 9 |
| P2-D normalizar botones | Task 10 |
| P2-E split modal exportación | Task 11 |
| P3-A word count | Task 12 |
| P3-B EmptyState PatientsPage | Task 13 |
| P3-C búsqueda SessionsPage | Task 14 |
| P3-D reemplazar Exportar día | Task 15 |

All 16 spec items covered across 15 tasks (P2-A and P2-B combined in Task 8). ✓
