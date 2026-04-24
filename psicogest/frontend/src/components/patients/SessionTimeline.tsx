import { useState } from "react";
import { useSessions, useSessionNotes } from "@/hooks/useSessions";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const CUPS_LABELS: Record<string, string> = {
  "890101": "Consulta de primera vez",
  "890102": "Consulta de control",
  "890403": "Psicoterapia individual adultos",
  "890404": "Psicoterapia individual niños/adolescentes",
  "890601": "Psicoterapia de pareja",
  "890701": "Psicoterapia familiar",
};

interface SessionRowProps {
  session: {
    id: string;
    actual_start: string;
    diagnosis_cie11: string;
    cups_code: string;
    session_fee: number;
    status: string;
  };
  onOpenSession: (sessionId: string) => void;
}

function SessionNotesExpanded({ sessionId }: { sessionId: string }) {
  const { data: notes, isLoading } = useSessionNotes(sessionId);

  if (isLoading) {
    return <div className="p-3 text-sm text-muted-foreground">Cargando notas...</div>;
  }

  if (!notes || notes.length === 0) {
    return <div className="p-3 text-sm text-muted-foreground">Sin notas aclaratorias.</div>;
  }

  return (
    <div className="p-3 space-y-2 bg-slate-50 rounded-b-lg">
      {notes.map((note) => (
        <div key={note.id} className="border rounded p-3 bg-white">
          <p className="text-sm whitespace-pre-wrap">{note.content}</p>
          <p className="text-xs text-muted-foreground mt-2">
            {new Date(note.created_at).toLocaleString("es-CO")}
          </p>
        </div>
      ))}
    </div>
  );
}

function SessionRow({ session, onOpenSession }: SessionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(session.actual_start);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="grid grid-cols-[auto_1fr_auto] items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-muted-foreground text-lg">
          {expanded ? "▼" : "▶"}
        </span>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-sm font-medium text-[#1E3A5F]">
              {date.toLocaleDateString("es-CO", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="text-xs text-muted-foreground">
              {date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className={cn(
              "text-xs px-2 py-0.5 rounded font-medium",
              session.status === "signed" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
            )}>
              {session.status === "signed" ? "Firmada" : "Borrador"}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>dx: {session.diagnosis_cie11}</span>
            <span>CUPS: {session.cups_code} {CUPS_LABELS[session.cups_code] ? `(${CUPS_LABELS[session.cups_code]})` : ""}</span>
            <span>${Number(session.session_fee).toLocaleString("es-CO")} COP</span>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpenSession(session.id); }}
          className="text-sm text-[#2E86AB] hover:text-[#1E3A5F] hover:underline shrink-0"
        >
          Ver nota
        </button>
      </div>

      {expanded && <SessionNotesExpanded sessionId={session.id} />}
    </div>
  );
}

interface SessionTimelineProps {
  patientId: string;
  onOpenSession: (sessionId: string) => void;
}

export function SessionTimeline({ patientId, onOpenSession }: SessionTimelineProps) {
  const { data, isLoading } = useSessions({ patient_id: patientId });

  const sessions = data?.items ?? [];

  const sorted = [...sessions].sort(
    (a, b) => new Date(b.actual_start).getTime() - new Date(a.actual_start).getTime()
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No hay sesiones registradas para este paciente.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((session) => (
        <SessionRow
          key={session.id}
          session={session}
          onOpenSession={onOpenSession}
        />
      ))}
    </div>
  );
}