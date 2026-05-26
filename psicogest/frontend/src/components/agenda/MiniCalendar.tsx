import { useState } from "react";
import type { AppointmentSummary } from "@/lib/api";

const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const DAY_HEADERS = ["L","M","X","J","V","S","D"];

interface Props {
  appointments: AppointmentSummary[];
  onDayClick: (date: Date) => void;
}

export function MiniCalendar({ appointments, onDayClick }: Props) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const apptDays = new Set(
    appointments.map((a) => {
      const d = new Date(a.scheduled_start);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  let startDow = firstOfMonth.getDay() - 1;
  if (startDow < 0) startDow = 6;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const next = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={prev}
          className="text-[12px] w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
          style={{ color: "var(--psy-ink-3)" }}
        >‹</button>
        <span className="text-[11px] font-semibold" style={{ color: "var(--psy-ink-1)" }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={next}
          className="text-[12px] w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
          style={{ color: "var(--psy-ink-3)" }}
        >›</button>
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {DAY_HEADERS.map((h) => (
          <div key={h} className="text-center text-[9px] font-semibold uppercase py-0.5" style={{ color: "var(--psy-ink-3)" }}>
            {h}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} className="h-5" />;
          const isToday =
            day === today.getDate() &&
            viewMonth === today.getMonth() &&
            viewYear === today.getFullYear();
          const hasAppt = apptDays.has(`${viewYear}-${viewMonth}-${day}`);
          return (
            <button
              key={`d-${day}-${i}`}
              type="button"
              onClick={() => onDayClick(new Date(viewYear, viewMonth, day))}
              className="relative flex items-center justify-center rounded text-[10px] h-5 transition-colors hover:bg-gray-100"
              style={{
                background: isToday ? "var(--psy-primary)" : undefined,
                color: isToday ? "#fff" : "var(--psy-ink-2)",
                fontWeight: isToday ? 700 : 400,
              }}
            >
              {day}
              {hasAppt && !isToday && (
                <span
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: "var(--psy-primary)" }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
