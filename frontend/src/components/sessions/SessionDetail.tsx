import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSession, useSignSession, useSessionNotes, useAddSessionNote } from "@/hooks/useSessions";
import { ApiError } from "@/lib/api";

interface Props {
  sessionId: string;
  onBack?: () => void;
}

const CUPS_LABELS: Record<string, string> = {
  "890101": "Consulta de primera vez",
  "890102": "Consulta de control",
  "890403": "Psicoterapia individual adultos",
  "890404": "Psicoterapia individual niños/adolescentes",
  "890601": "Psicoterapia de pareja",
  "890701": "Psicoterapia familiar",
};

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="py-3 border-b last:border-0">
      <dt className="text-xs text-muted-foreground uppercase tracking-wide">{label}</dt>
      <dd className="mt-1 text-sm text-foreground whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

export function SessionDetail({ sessionId, onBack }: Props) {
  const { data: sess, isLoading } = useSession(sessionId);
  const { data: notes } = useSessionNotes(sessionId);
  const signMutation = useSignSession(sessionId);
  const addNoteMutation = useAddSessionNote(sessionId);

  const [signError, setSignError] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [showNoteForm, setShowNoteForm] = useState(false);

  if (isLoading || !sess) {
    return <div className="p-6 text-muted-foreground text-sm">Cargando sesión...</div>;
  }

  const handleSign = async () => {
    setSignError(null);
    try {
      await signMutation.mutateAsync();
    } catch (err) {
      setSignError(err instanceof ApiError ? err.message : "Error al firmar la sesión.");
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setNoteError(null);
    try {
      await addNoteMutation.mutateAsync(noteContent);
      setNoteContent("");
      setShowNoteForm(false);
    } catch (err) {
      setNoteError(err instanceof ApiError ? err.message : "Error al añadir nota.");
    }
  };

  const start = new Date(sess.actual_start);
  const end = new Date(sess.actual_end);
  const isSigned = sess.status === "signed";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {onBack && (
            <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground mb-2 block">
              ← Volver
            </button>
          )}
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[#1E3A5F]">Nota de sesión</h2>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${isSigned ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
              {isSigned ? "Firmada" : "Borrador"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {start.toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {" · "}
            {start.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })} — {end.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>

      {/* Clinical fields */}
      <div className="bg-white rounded-lg border p-5">
        <dl>
          <Field label="Diagnóstico CIE-11" value={`${sess.diagnosis_cie11} — ${sess.diagnosis_description}`} />
          <Field label="Código CUPS" value={`${sess.cups_code} — ${CUPS_LABELS[sess.cups_code] ?? sess.cups_code}`} />
          <Field label="Motivo de consulta" value={sess.consultation_reason} />
          <Field label="Intervención realizada" value={sess.intervention} />
          <Field label="Evolución" value={sess.evolution} />
          <Field label="Plan próxima sesión" value={sess.next_session_plan} />
          <Field label="Valor sesión" value={`$${Number(sess.session_fee).toLocaleString("es-CO")} COP`} />
          <Field label="N° autorización" value={sess.authorization_number} />
        </dl>

        {isSigned && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Firmada el {new Date(sess.signed_at!).toLocaleString("es-CO")}
            </p>
            <p className="text-xs font-mono text-muted-foreground mt-1 break-all">
              SHA-256: {sess.session_hash}
            </p>
          </div>
        )}
      </div>

      {/* Sign button */}
      {!isSigned && (
        <div className="space-y-2">
          {signError && <p className="text-sm text-[#E74C3C]">{signError}</p>}
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            Al firmar, la sesión quedará <strong>inmutable</strong> según la Res. 1995/1999.
            Verifique todos los campos antes de firmar.
          </div>
          <Button
            className="bg-[#1E3A5F] hover:bg-[#2E86AB] text-white w-full"
            onClick={handleSign}
            disabled={signMutation.isPending}
          >
            {signMutation.isPending ? "Firmando..." : "✍ Firmar sesión"}
          </Button>
        </div>
      )}

      {/* Notes section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#1E3A5F]">Notas aclaratorias</h3>
          <Button size="sm" variant="outline" onClick={() => setShowNoteForm(!showNoteForm)}>
            + Añadir nota
          </Button>
        </div>

        {showNoteForm && (
          <form onSubmit={handleAddNote} className="space-y-2 border rounded-lg p-4 bg-slate-50">
            {noteError && <p className="text-xs text-[#E74C3C]">{noteError}</p>}
            <textarea
              className="w-full rounded-md border border-input px-3 py-2 text-sm min-h-[80px]"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              required
              minLength={5}
              maxLength={5000}
              placeholder="Aclaración o información adicional..."
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="bg-[#2E86AB] hover:bg-[#1E3A5F] text-white" disabled={addNoteMutation.isPending}>
                {addNoteMutation.isPending ? "Guardando..." : "Guardar nota"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowNoteForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {notes && notes.length > 0 ? (
          <div className="space-y-2">
            {notes.map((note) => (
              <div key={note.id} className="border rounded-lg p-4 bg-white">
                <p className="text-sm">{note.content}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(note.created_at).toLocaleString("es-CO")} · SHA-256: {note.note_hash.slice(0, 16)}…
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin notas aclaratorias.</p>
        )}
      </div>
    </div>
  );
}
