import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  useRevenueReport,
  useAttendanceReport,
  useSessionTypeReport,
  useNewPatientsReport,
  useReportsSummary,
} from "@/hooks/useReports";
import { PageHeader, PsyCard, AiCard, KPI } from "@/components/ui/psy";
import { Skeleton } from "@/components/ui/skeleton";

const SPARK_REV  = [40, 55, 48, 62, 57, 72, 80, 68, 90, 84, 98, 105];
const SPARK_SESS = [8, 12, 10, 14, 13, 16, 18, 15, 20, 18, 22, 24];
const SPARK_ATT  = [88, 90, 92, 89, 95, 94, 96, 98, 97, 95, 96, 98];
const SPARK_PAT  = [1, 2, 1, 3, 2, 1, 2, 3, 2, 1, 3, 2];

const PSY_PRIMARY = "#0F2A4A";
const PSY_SAGE    = "#7C9885";
const PSY_WARN    = "#D97706";
const PSY_DANGER  = "#C0392B";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0,
  }).format(value);
}

function PsyTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-[var(--radius)] px-3 py-2 text-[12px] psy-mono shadow-md"
      style={{ background: "var(--psy-surface)", border: "1px solid var(--psy-line)" }}
    >
      <div className="font-semibold mb-1" style={{ color: "var(--psy-ink-2)" }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: "var(--psy-ink-1)" }}>
          {p.name ? `${p.name}: ` : ""}{typeof p.value === "number" && p.value > 10000 ? formatCurrency(p.value) : p.value}
        </div>
      ))}
    </div>
  );
}

export function ReportsPage() {
  const [months, setMonths] = useState(12);

  const { data: revenueData, isLoading: loadingRev } = useRevenueReport(months);
  const { data: attendanceData } = useAttendanceReport(months);
  const { data: sessionTypesData } = useSessionTypeReport(months);
  const { data: newPatientsData } = useNewPatientsReport(months);
  const { data: summary, isLoading: loadingSummary } = useReportsSummary(months);

  const isLoading = loadingRev || loadingSummary;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reportes"
        subtitle="Análisis de tu consultorio"
        actions={
          <div className="flex items-center gap-1">
            {([3, 6, 12] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMonths(m)}
                className="psy-mono text-[11px] px-3 py-1.5 rounded-full transition-colors"
                style={{
                  background: months === m ? "var(--psy-primary)" : "var(--psy-surface)",
                  color: months === m ? "#fff" : "var(--psy-ink-3)",
                  border: "1px solid var(--psy-line)",
                }}
              >
                {m}m
              </button>
            ))}
          </div>
        }
      />

      {/* AI narrative */}
      {summary && (
        <AiCard label={`Resumen · últimos ${months} meses`}>
          En este período cerraste <em>{summary.total_sessions} sesión{summary.total_sessions !== 1 ? "es" : ""}</em> con una asistencia del{" "}
          <strong style={{ color: "var(--psy-ok)" }}>{summary.attendance_rate}%</strong>.{" "}
          Los ingresos totales fueron <strong>{formatCurrency(summary.total_revenue)}</strong>.
          {summary.attendance_rate >= 90
            ? " La tasa de asistencia es excelente — por encima del 90%."
            : summary.attendance_rate >= 80
              ? " La asistencia es buena. Considera revisar los no-shows recurrentes."
              : " La asistencia está por debajo del 80% — vale revisar los patrones de cancelación."
          }
        </AiCard>
      )}

      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI
            label="Ingresos del período"
            value={summary ? `$${(summary.total_revenue / 1_000_000).toFixed(1)}M` : "—"}
            sparkline={SPARK_REV}
            sparklineColor="var(--psy-ok)"
            accent="ok"
          />
          <KPI
            label="Sesiones firmadas"
            value={summary?.total_sessions ?? "—"}
            sparkline={SPARK_SESS}
            accent="info"
          />
          <KPI
            label="Asistencia"
            value={summary?.attendance_rate ?? "—"}
            unit={summary ? "%" : undefined}
            sparkline={SPARK_ATT}
            sparklineColor="var(--psy-sage)"
            accent={summary && summary.attendance_rate >= 90 ? "ok" : "warn"}
          />
          <KPI
            label="Pacientes nuevos"
            value={newPatientsData?.data?.reduce((s, d) => s + d.count, 0) ?? "—"}
            sparkline={SPARK_PAT}
            sparklineColor="var(--psy-terracotta)"
          />
        </div>
      )}

      {/* Charts grid */}
      <div className="psy-grid-split-reports">
        {/* Revenue bar chart */}
        <PsyCard title="Ingresos por mes">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueData?.data || []} barSize={20}>
              <CartesianGrid stroke="var(--psy-line)" strokeDasharray="4 2" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--psy-ink-3)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--psy-ink-3)" }}
                tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip content={<PsyTooltip />} cursor={{ fill: "var(--psy-bg-soft)" }} />
              <Bar dataKey="revenue" radius={[3, 3, 0, 0]}>
                {(revenueData?.data || []).map((_, i, arr) => (
                  <Cell
                    key={i}
                    fill={i === arr.length - 1 ? PSY_SAGE : PSY_PRIMARY}
                    fillOpacity={i === arr.length - 1 ? 1 : 0.7}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </PsyCard>

        {/* Attendance stacked */}
        <PsyCard title="Citas por estado">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={attendanceData?.data || []} barSize={16}>
              <CartesianGrid stroke="var(--psy-line)" strokeDasharray="4 2" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--psy-ink-3)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--psy-ink-3)" }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip content={<PsyTooltip />} cursor={{ fill: "var(--psy-bg-soft)" }} />
              <Bar dataKey="completed" name="Completadas" stackId="a" fill={PSY_SAGE} />
              <Bar dataKey="cancelled" name="Canceladas" stackId="a" fill={PSY_DANGER} fillOpacity={0.7} />
              <Bar dataKey="noshow" name="No-show" stackId="a" fill={PSY_WARN} fillOpacity={0.7} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </PsyCard>

        {/* CUPS distribution — horizontal bars */}
        <PsyCard title="Distribución por CUPS">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              layout="vertical"
              data={(sessionTypesData?.data || []).slice(0, 6)}
              barSize={14}
            >
              <CartesianGrid stroke="var(--psy-line)" strokeDasharray="4 2" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--psy-ink-3)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                dataKey="cups_code"
                type="category"
                tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--psy-ink-2)" }}
                axisLine={false}
                tickLine={false}
                width={70}
              />
              <Tooltip content={<PsyTooltip />} cursor={{ fill: "var(--psy-bg-soft)" }} />
              <Bar dataKey="count" fill={PSY_PRIMARY} fillOpacity={0.8} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </PsyCard>

        {/* New patients */}
        <PsyCard title="Pacientes nuevos por mes">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={newPatientsData?.data || []} barSize={20}>
              <CartesianGrid stroke="var(--psy-line)" strokeDasharray="4 2" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--psy-ink-3)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--psy-ink-3)" }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip content={<PsyTooltip />} cursor={{ fill: "var(--psy-bg-soft)" }} />
              <Bar dataKey="count" fill={PSY_SAGE} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </PsyCard>
      </div>
    </div>
  );
}
