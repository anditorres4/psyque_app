import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClinicalRecord, useUpsertClinicalRecord } from "@/hooks/useClinicalRecord";
import { useAiFeatures } from "@/hooks/useAiFeatures";
import { AiDiagnosisSection } from "@/components/patients/AiDiagnosisSection";
import { AiClinicalRecordSummarySection } from "@/components/patients/AiClinicalRecordSummarySection";
import type { AntecedentesBlock, ClinicalRecordUpsert, MentalExamBlock } from "@/lib/api";

interface AntecedenteItem {
  id: string;
  label: string;
}

const ANTECEDENTES_PERSONALES: AntecedenteItem[] = [
  { id: "enfermedades_cronicas", label: "Enfermedades crónicas (HTA, diabetes, epilepsia…)" },
  { id: "discapacidad", label: "Discapacidad física o sensorial" },
  { id: "cirugias_hospitalizaciones", label: "Cirugías u hospitalizaciones previas" },
  { id: "alergias_medicamentos", label: "Alergias a medicamentos" },
];

const ANTECEDENTES_FAMILIARES: AntecedenteItem[] = [
  { id: "enf_psiquiatrica_familia", label: "Enfermedades psiquiátricas en familia" },
  { id: "enf_neurologica_familia", label: "Enfermedades neurológicas en familia" },
  { id: "violencia_abuso", label: "Historia de violencia o abuso" },
  { id: "enf_medica_relevante", label: "Enfermedades médicas relevantes" },
];

const ANTECEDENTES_MEDICOS: AntecedenteItem[] = [
  { id: "medicacion_actual", label: "Medicación actual" },
  { id: "enfermedades_actuales", label: "Enfermedades médicas activas" },
  { id: "alergias", label: "Alergias conocidas" },
  { id: "consumo_sustancias", label: "Consumo de sustancias" },
];

const ANTECEDENTES_PSICOLOGICOS: AntecedenteItem[] = [
  { id: "consultas_previas", label: "Consultas psicológicas previas" },
  { id: "tratamiento_psiquiatrico", label: "Tratamiento psiquiátrico previo" },
  { id: "hospitalizacion_psiquiatrica", label: "Hospitalización psiquiátrica" },
  { id: "medicacion_psicotropica", label: "Medicación psicotrópica actual" },
  { id: "autolesiones", label: "Conductas autolesivas previas" },
  { id: "ideacion_suicida", label: "Ideación suicida" },
];

function blockToChecked(block: AntecedentesBlock | null | undefined): Record<string, boolean> {
  if (!block) return {};
  return Object.fromEntries(block.items.map((id) => [id, true]));
}

function checkedToBlock(checked: Record<string, boolean>, notas: string): AntecedentesBlock {
  return {
    items: Object.entries(checked).filter(([, v]) => v).map(([k]) => k),
    notas,
  };
}

function emptyMentalExam(): MentalExamBlock {
  return {
    appearance: null,
    psychomotor: null,
    cognition: null,
    thought: null,
    perception: null,
    affect: null,
    insight: null,
    judgment: null,
    language: null,
    orientation: null,
  };
}

interface AntecedentesEditorProps {
  title: string;
  items: AntecedenteItem[];
  checked: Record<string, boolean>;
  notas: string;
  readOnly: boolean;
  onChange: (checked: Record<string, boolean>, notas: string) => void;
}

function AntecedentesEditor({ title, items, checked, notas, readOnly, onChange }: AntecedentesEditorProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-[#1E3A5F]">{title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {items.map((item) => (
          <label key={item.id} className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={checked[item.id] ?? false}
              onChange={(e) => onChange({ ...checked, [item.id]: e.target.checked }, notas)}
              disabled={readOnly}
              className="mt-0.5 rounded border-gray-400"
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Notas</label>
        {readOnly ? (
          <p className="text-sm text-foreground">
            {notas || <span className="italic text-muted-foreground">Sin notas</span>}
          </p>
        ) : (
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[60px]"
            value={notas}
            onChange={(e) => onChange(checked, e.target.value)}
            placeholder="Notas adicionales..."
          />
        )}
      </div>
    </div>
  );
}

interface ClinicalRecordSectionProps {
  patientId: string;
  patientAge?: number | null;
}

export function ClinicalRecordSection({ patientId, patientAge = null }: ClinicalRecordSectionProps) {
  const { data: record, isLoading } = useClinicalRecord(patientId);
  const upsertMutation = useUpsertClinicalRecord(patientId);
  const { canDiagnose, canSummarize } = useAiFeatures();

  const handleDiagnosisAccepted = (code: string, description: string) => {
    setDiagnosisCie11(code);
    setDiagnosisDesc(description);
    if (!editing) {
      setEditing(true);
    }
  };

  const [editing, setEditing] = useState(false);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [diagnosisCie11, setDiagnosisCie11] = useState("");
  const [diagnosisDesc, setDiagnosisDesc] = useState("");
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const [therapeuticGoals, setTherapeuticGoals] = useState("");
  const [antPers, setAntPers] = useState<Record<string, boolean>>({});
  const [antPersNotas, setAntPersNotas] = useState("");
  const [antFam, setAntFam] = useState<Record<string, boolean>>({});
  const [antFamNotas, setAntFamNotas] = useState("");
  const [antMed, setAntMed] = useState<Record<string, boolean>>({});
  const [antMedNotas, setAntMedNotas] = useState("");
  const [antPsic, setAntPsic] = useState<Record<string, boolean>>({});
  const [antPsicNotas, setAntPsicNotas] = useState("");
  const [presentingProblems, setPresentingProblems] = useState("");
  const [symptomDescription, setSymptomDescription] = useState("");
  const [mentalExam, setMentalExam] = useState<MentalExamBlock>(emptyMentalExam());

  const syncFromRecord = () => {
    if (!record) return;
    setChiefComplaint(record.chief_complaint ?? "");
    setDiagnosisCie11(record.initial_diagnosis_cie11 ?? "");
    setDiagnosisDesc(record.initial_diagnosis_description ?? "");
    setTreatmentPlan(record.treatment_plan ?? "");
    setTherapeuticGoals(record.therapeutic_goals ?? "");
    setAntPers(blockToChecked(record.antecedentes_personales));
    setAntPersNotas(record.antecedentes_personales?.notas ?? "");
    setAntFam(blockToChecked(record.antecedentes_familiares));
    setAntFamNotas(record.antecedentes_familiares?.notas ?? "");
    setAntMed(blockToChecked(record.antecedentes_medicos));
    setAntMedNotas(record.antecedentes_medicos?.notas ?? "");
    setAntPsic(blockToChecked(record.antecedentes_psicologicos));
    setAntPsicNotas(record.antecedentes_psicologicos?.notas ?? "");
    setPresentingProblems(record.presenting_problems ?? "");
    setSymptomDescription(record.symptom_description ?? "");
    setMentalExam(record.mental_exam ?? emptyMentalExam());
  };

  useEffect(() => {
    syncFromRecord();
  }, [record]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    const payload: ClinicalRecordUpsert = {
      chief_complaint: chiefComplaint || null,
      initial_diagnosis_cie11: diagnosisCie11 || null,
      initial_diagnosis_description: diagnosisDesc || null,
      treatment_plan: treatmentPlan || null,
      therapeutic_goals: therapeuticGoals || null,
      antecedentes_personales: checkedToBlock(antPers, antPersNotas),
      antecedentes_familiares: checkedToBlock(antFam, antFamNotas),
      antecedentes_medicos: checkedToBlock(antMed, antMedNotas),
      antecedentes_psicologicos: checkedToBlock(antPsic, antPsicNotas),
      presenting_problems: presentingProblems || null,
      symptom_description: symptomDescription || null,
      mental_exam: mentalExam,
    };
    try {
      await upsertMutation.mutateAsync(payload);
      setEditing(false);
    } catch {
      // error surfaced by upsertMutation.isError
    }
  };

  const handleCancel = () => {
    syncFromRecord();
    setEditing(false);
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Cargando historia clínica...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#1E3A5F]">Historia clínica</h3>
        <div className="flex items-center gap-2">
          {!editing ? (
            <Button size="sm" variant="outline" onClick={() => { syncFromRecord(); setEditing(true); }}>
              Editar historia
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={handleCancel}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="bg-[#2E86AB] hover:bg-[#1E3A5F] text-white"
                onClick={handleSave}
                disabled={upsertMutation.isPending}
              >
                {upsertMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </>
          )}
        </div>
      </div>

      {upsertMutation.isError && (
        <p className="text-sm text-red-600">Error al guardar. Intenta de nuevo.</p>
      )}

      <div className="rounded-lg border bg-card p-5 space-y-6">
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">Motivo de consulta</label>
          {editing ? (
            <textarea
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[80px]"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="Motivo de consulta..."
            />
          ) : (
            <p className="mt-1 text-sm">
              {record?.chief_complaint || <span className="italic text-muted-foreground">No registrado</span>}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide">Dx. inicial CIE-11</label>
            {editing ? (
              <Input
                className="mt-1"
                value={diagnosisCie11}
                onChange={(e) => setDiagnosisCie11(e.target.value)}
                placeholder="Código CIE-11..."
              />
            ) : (
              <p className="mt-1 text-sm">
                {record?.initial_diagnosis_cie11 || <span className="italic text-muted-foreground">No registrado</span>}
              </p>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide">Descripción dx.</label>
            {editing ? (
              <Input
                className="mt-1"
                value={diagnosisDesc}
                onChange={(e) => setDiagnosisDesc(e.target.value)}
                placeholder="Descripción del diagnóstico..."
              />
            ) : (
              <p className="mt-1 text-sm">
                {record?.initial_diagnosis_description || <span className="italic text-muted-foreground">No registrado</span>}
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">Plan de tratamiento</label>
          {editing ? (
            <textarea
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[80px]"
              value={treatmentPlan}
              onChange={(e) => setTreatmentPlan(e.target.value)}
              placeholder="Plan de tratamiento..."
            />
          ) : (
            <p className="mt-1 text-sm">
              {record?.treatment_plan || <span className="italic text-muted-foreground">No registrado</span>}
            </p>
          )}
        </div>

        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">Metas terapéuticas</label>
          {editing ? (
            <textarea
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[80px]"
              value={therapeuticGoals}
              onChange={(e) => setTherapeuticGoals(e.target.value)}
              placeholder="Metas terapéuticas..."
            />
          ) : (
            <p className="mt-1 text-sm">
              {record?.therapeutic_goals || <span className="italic text-muted-foreground">No registrado</span>}
            </p>
          )}
        </div>

        {/* Síntomas y Motivo de Consulta */}
        <div className="border-t pt-6 space-y-4">
          <h4 className="text-sm font-semibold text-[#1E3A5F]">Síntomas y Motivo de Consulta</h4>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Problemas presentados</label>
            {editing ? (
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[60px]"
                value={presentingProblems}
                onChange={(e) => setPresentingProblems(e.target.value)}
                placeholder="Describe los problemas que presenta el paciente..."
              />
            ) : (
              <p className="text-sm">
                {record?.presenting_problems || <span className="italic text-muted-foreground">No registrado</span>}
              </p>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Descripción de síntomas</label>
            {editing ? (
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[80px]"
                value={symptomDescription}
                onChange={(e) => setSymptomDescription(e.target.value)}
                placeholder="Descripción detallada de los síntomas..."
              />
            ) : (
              <p className="text-sm">
                {record?.symptom_description || <span className="italic text-muted-foreground">No registrado</span>}
              </p>
            )}
          </div>
        </div>

        {/* Examen Mental */}
        <div className="border-t pt-6 space-y-4">
          <h4 className="text-sm font-semibold text-[#1E3A5F]">Examen Mental</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Apariencia y presentación</label>
              {editing ? (
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[60px]"
                  value={mentalExam.appearance ?? ""}
                  onChange={(e) => setMentalExam({ ...mentalExam, appearance: e.target.value || null })}
                  placeholder="Apariencia general..."
                />
              ) : (
                <p className="text-sm">
                  {record?.mental_exam?.appearance || <span className="italic text-muted-foreground">-</span>}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Psicomotricidad y actitud</label>
              {editing ? (
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[60px]"
                  value={mentalExam.psychomotor ?? ""}
                  onChange={(e) => setMentalExam({ ...mentalExam, psychomotor: e.target.value || null })}
                  placeholder="Psicomotricidad..."
                />
              ) : (
                <p className="text-sm">
                  {record?.mental_exam?.psychomotor || <span className="italic text-muted-foreground">-</span>}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Funciones cognitivas</label>
              {editing ? (
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[60px]"
                  value={mentalExam.cognition ?? ""}
                  onChange={(e) => setMentalExam({ ...mentalExam, cognition: e.target.value || null })}
                  placeholder="Memoria, atención, concentración..."
                />
              ) : (
                <p className="text-sm">
                  {record?.mental_exam?.cognition || <span className="italic text-muted-foreground">-</span>}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Pensamiento (curso y contenido)</label>
              {editing ? (
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[60px]"
                  value={mentalExam.thought ?? ""}
                  onChange={(e) => setMentalExam({ ...mentalExam, thought: e.target.value || null })}
                  placeholder="Pensamiento..."
                />
              ) : (
                <p className="text-sm">
                  {record?.mental_exam?.thought || <span className="italic text-muted-foreground">-</span>}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Percepción</label>
              {editing ? (
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[60px]"
                  value={mentalExam.perception ?? ""}
                  onChange={(e) => setMentalExam({ ...mentalExam, perception: e.target.value || null })}
                  placeholder="Alucinaciones, ilusiones..."
                />
              ) : (
                <p className="text-sm">
                  {record?.mental_exam?.perception || <span className="italic text-muted-foreground">-</span>}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Afecto y humor</label>
              {editing ? (
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[60px]"
                  value={mentalExam.affect ?? ""}
                  onChange={(e) => setMentalExam({ ...mentalExam, affect: e.target.value || null })}
                  placeholder="Afecto, humor..."
                />
              ) : (
                <p className="text-sm">
                  {record?.mental_exam?.affect || <span className="italic text-muted-foreground">-</span>}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Conciencia del problema (Insight)</label>
              {editing ? (
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[60px]"
                  value={mentalExam.insight ?? ""}
                  onChange={(e) => setMentalExam({ ...mentalExam, insight: e.target.value || null })}
                  placeholder="Insight..."
                />
              ) : (
                <p className="text-sm">
                  {record?.mental_exam?.insight || <span className="italic text-muted-foreground">-</span>}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Juicio y abstracción</label>
              {editing ? (
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[60px]"
                  value={mentalExam.judgment ?? ""}
                  onChange={(e) => setMentalExam({ ...mentalExam, judgment: e.target.value || null })}
                  placeholder="Juicio..."
                />
              ) : (
                <p className="text-sm">
                  {record?.mental_exam?.judgment || <span className="italic text-muted-foreground">-</span>}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Lenguaje y comunicación</label>
              {editing ? (
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[60px]"
                  value={mentalExam.language ?? ""}
                  onChange={(e) => setMentalExam({ ...mentalExam, language: e.target.value || null })}
                  placeholder="Lenguaje..."
                />
              ) : (
                <p className="text-sm">
                  {record?.mental_exam?.language || <span className="italic text-muted-foreground">-</span>}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Orientación témporo-espacial</label>
              {editing ? (
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[60px]"
                  value={mentalExam.orientation ?? ""}
                  onChange={(e) => setMentalExam({ ...mentalExam, orientation: e.target.value || null })}
                  placeholder="Orientación..."
                />
              ) : (
                <p className="text-sm">
                  {record?.mental_exam?.orientation || <span className="italic text-muted-foreground">-</span>}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="border-t pt-6 space-y-6">
          <h4 className="text-sm font-semibold text-[#1E3A5F]">Antecedentes</h4>

          <AntecedentesEditor
            title="Antecedentes personales"
            items={ANTECEDENTES_PERSONALES}
            checked={antPers}
            notas={antPersNotas}
            readOnly={!editing}
            onChange={(c, n) => { setAntPers(c); setAntPersNotas(n); }}
          />
          <AntecedentesEditor
            title="Antecedentes familiares"
            items={ANTECEDENTES_FAMILIARES}
            checked={antFam}
            notas={antFamNotas}
            readOnly={!editing}
            onChange={(c, n) => { setAntFam(c); setAntFamNotas(n); }}
          />
          <AntecedentesEditor
            title="Antecedentes médicos"
            items={ANTECEDENTES_MEDICOS}
            checked={antMed}
            notas={antMedNotas}
            readOnly={!editing}
            onChange={(c, n) => { setAntMed(c); setAntMedNotas(n); }}
          />
          <AntecedentesEditor
            title="Antecedentes psicológicos"
            items={ANTECEDENTES_PSICOLOGICOS}
            checked={antPsic}
            notas={antPsicNotas}
            readOnly={!editing}
            onChange={(c, n) => { setAntPsic(c); setAntPsicNotas(n); }}
          />
        </div>

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
            onAccept={handleDiagnosisAccepted}
          />
          <AiClinicalRecordSummarySection
            patientId={patientId}
            canSummarize={canSummarize}
          />
        </div>
      </div>
    </div>
  );
}
