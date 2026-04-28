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