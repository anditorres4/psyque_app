import { ChevronDown } from "lucide-react";
import { useState } from "react";

export interface MentalExamData {
  apariencia?: string;
  actitud?: string;
  conciencia?: string;
  orientacion?: string;
  atencion?: string;
  memoria?: string;
  lenguaje?: string;
  pensamiento_curso?: string;
  pensamiento_contenido?: string;
  percepcion?: string;
  afecto?: string;
  humor?: string;
  psicomotricidad?: string;
  juicio?: string;
  insight?: string;
  observaciones?: string;
}

const FIELDS: {
  key: keyof MentalExamData;
  label: string;
  options: string[];
}[] = [
  {
    key: "apariencia",
    label: "Apariencia",
    options: ["Adecuada al contexto", "Descuidada", "Extravagante", "Higiénica deficiente", "Llamativa"],
  },
  {
    key: "actitud",
    label: "Actitud",
    options: ["Colaboradora", "Hostil", "Indiferente", "Ansiosa", "Defensiva", "Seductora"],
  },
  {
    key: "conciencia",
    label: "Conciencia / Alerta",
    options: ["Alerta", "Somnoliento", "Obnubilado", "Estuporoso", "Comatoso"],
  },
  {
    key: "orientacion",
    label: "Orientación",
    options: ["Orientado en tiempo, lugar y persona", "Desorientado en tiempo", "Desorientado en lugar", "Desorientado en persona", "Desorientación global"],
  },
  {
    key: "atencion",
    label: "Atención",
    options: ["Conservada", "Hipoprosexia", "Hiperprosexia", "Distraíble", "Aprosexia"],
  },
  {
    key: "memoria",
    label: "Memoria",
    options: ["Conservada", "Amnesia anterógrada", "Amnesia retrógrada", "Hipermnesia", "Confabulación"],
  },
  {
    key: "lenguaje",
    label: "Lenguaje",
    options: ["Normal", "Logorrea", "Mutismo", "Dislalia", "Afasia", "Bradilalia", "Taquilalia"],
  },
  {
    key: "pensamiento_curso",
    label: "Pensamiento: Curso",
    options: ["Normal", "Fuga de ideas", "Pensamiento retardado", "Perseveración", "Tangencialidad", "Circunstancialidad", "Bloqueo del pensamiento"],
  },
  {
    key: "pensamiento_contenido",
    label: "Pensamiento: Contenido",
    options: ["Sin alteraciones", "Ideación delirante", "Ideación obsesiva", "Ideación fóbica", "Ideación suicida", "Ideación homicida", "Preocupaciones excesivas"],
  },
  {
    key: "percepcion",
    label: "Percepción",
    options: ["Sin alteraciones", "Alucinaciones auditivas", "Alucinaciones visuales", "Alucinaciones táctiles", "Ilusiones", "Despersonalización", "Desrealización"],
  },
  {
    key: "afecto",
    label: "Afecto",
    options: ["Eutímico", "Deprimido", "Expansivo", "Ansioso", "Irritable", "Aplanado", "Embotado", "Lábil", "Inapropiado"],
  },
  {
    key: "humor",
    label: "Humor / Estado de ánimo",
    options: ["Eutímico", "Deprimido", "Eufórico", "Disfórico", "Ansioso", "Irritable"],
  },
  {
    key: "psicomotricidad",
    label: "Psicomotricidad",
    options: ["Normal", "Agitación psicomotriz", "Inhibición psicomotriz", "Estereotipias", "Tics", "Temblor"],
  },
  {
    key: "juicio",
    label: "Juicio",
    options: ["Conservado", "Alterado", "Parcialmente conservado"],
  },
  {
    key: "insight",
    label: "Insight / Conciencia de enfermedad",
    options: ["Completo", "Parcial", "Ausente", "Reconoce síntomas, niega enfermedad"],
  },
];

interface Props {
  value: MentalExamData;
  onChange: (data: MentalExamData) => void;
  collapsed?: boolean;
}

export function MentalExamDropdowns({ value, onChange, collapsed: initialCollapsed = false }: Props) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const handleField = (key: keyof MentalExamData, val: string) => {
    onChange({ ...value, [key]: val });
  };

  const filledCount = FIELDS.filter((f) => value[f.key]).length;

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">Examen Mental</span>
          {filledCount > 0 && (
            <span className="text-xs bg-[#2E86AB] text-white rounded-full px-2 py-0.5">
              {filledCount}/{FIELDS.length}
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`text-slate-500 transition-transform ${collapsed ? "" : "rotate-180"}`}
        />
      </button>

      {!collapsed && (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FIELDS.map(({ key, label, options }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
              <select
                className="h-9 w-full rounded-md border border-input px-2 text-sm bg-white"
                value={value[key] ?? ""}
                onChange={(e) => handleField(key, e.target.value)}
              >
                <option value="">— Seleccionar —</option>
                {options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          ))}

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones adicionales</label>
            <textarea
              className="w-full rounded-md border border-input px-3 py-2 text-sm min-h-[60px]"
              value={value.observaciones ?? ""}
              onChange={(e) => onChange({ ...value, observaciones: e.target.value })}
              placeholder="Observaciones libres del examen mental..."
            />
          </div>
        </div>
      )}
    </div>
  );
}
