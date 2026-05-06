import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { API_BASE } from "@/lib/api";

interface NpsPublicData {
  token: string;
  patient_name: string;
  already_responded: boolean;
  score: number | null;
}

async function fetchNps(token: string): Promise<NpsPublicData> {
  const res = await fetch(`${API_BASE}/public/nps/${token}`);
  if (!res.ok) throw new Error("Encuesta no encontrada");
  return res.json();
}

async function respondNps(token: string, score: number, feedback: string): Promise<void> {
  const res = await fetch(`${API_BASE}/public/nps/${token}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ score, feedback }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Error al enviar" }));
    throw new Error(err.detail);
  }
}

const SCORE_LABELS: Record<number, string> = {
  0: "Muy insatisfecho",
  1: "Insatisfecho",
  2: "Poco satisfecho",
  3: "Mediocre",
  4: "Regular",
  5: "Aceptable",
  6: "Bien",
  7: "Satisfecho",
  8: "Muy satisfecho",
  9: "Excelente",
  10: "Absolutamente excelente",
};

export function NpsPage() {
  const { token } = useParams<{ token: string }>();
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["nps-public", token],
    queryFn: () => fetchNps(token!),
    enabled: !!token,
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: () => respondNps(token!, score!, feedback),
    onSuccess: () => setSubmitted(true),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F0F4F8]">
        <div className="text-slate-500 text-sm">Cargando encuesta...</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F0F4F8]">
        <div className="max-w-sm text-center p-8">
          <div className="text-4xl mb-4">🔍</div>
          <h2 className="text-xl font-semibold text-slate-700 mb-2">Encuesta no encontrada</h2>
          <p className="text-sm text-slate-500">El enlace puede estar vencido o ser inválido.</p>
        </div>
      </div>
    );
  }

  if (data.already_responded || submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F0F4F8]">
        <div className="max-w-sm text-center p-8 bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="text-5xl mb-4">💚</div>
          <h2 className="text-xl font-semibold text-slate-700 mb-2">¡Gracias por tu respuesta!</h2>
          <p className="text-sm text-slate-500">
            Tu opinión es muy valiosa para seguir mejorando el servicio.
          </p>
          {data.score !== null && (
            <div className="mt-4 inline-block bg-[#2E86AB] text-white rounded-full px-4 py-1.5 text-sm font-semibold">
              Tu puntuación: {data.score}/10
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F0F4F8] p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🌿</div>
          <h2 className="text-xl font-semibold text-slate-700">¿Cómo fue tu sesión?</h2>
          <p className="text-sm text-slate-500 mt-1">
            Hola {data.patient_name}, en una escala del 0 al 10, ¿qué tan satisfecho/a estás?
          </p>
        </div>

        <div className="space-y-6">
          {/* Score selector */}
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-2">
              <span>Nada satisfecho/a</span>
              <span>Muy satisfecho/a</span>
            </div>
            <div className="grid grid-cols-11 gap-1">
              {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setScore(n)}
                  className={`h-10 rounded-lg text-sm font-semibold transition-all ${
                    score === n
                      ? "bg-[#2E86AB] text-white shadow-md scale-110"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            {score !== null && (
              <p className="text-center text-sm text-[#2E86AB] font-medium mt-2">
                {SCORE_LABELS[score]}
              </p>
            )}
          </div>

          {/* Feedback */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              Comentario (opcional)
            </label>
            <textarea
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="¿Qué podría mejorar? ¿Qué te gustó?"
              maxLength={1000}
            />
          </div>

          <button
            type="button"
            disabled={score === null || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="w-full py-3 rounded-xl bg-[#2E86AB] text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#1E3A5F] transition-colors"
          >
            {mutation.isPending ? "Enviando..." : "Enviar calificación"}
          </button>

          {mutation.isError && (
            <p className="text-center text-sm text-red-600">{(mutation.error as Error).message}</p>
          )}

          <p className="text-center text-xs text-slate-400">
            Tu respuesta es completamente confidencial.
          </p>
        </div>
      </div>
    </div>
  );
}
