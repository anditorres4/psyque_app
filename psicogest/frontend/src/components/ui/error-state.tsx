import { Button } from "./button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Algo salió mal",
  message = "No pudimos cargar los datos. Verifica tu conexión.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="text-3xl mb-3">⚠️</div>
      <p className="text-sm font-medium mb-1" style={{ color: "var(--psy-danger)" }}>{title}</p>
      <p className="text-xs max-w-xs" style={{ color: "var(--psy-ink-3)" }}>{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={onRetry}
        >
          Reintentar
        </Button>
      )}
    </div>
  );
}