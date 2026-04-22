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
      <p className="text-sm font-medium text-[#E74C3C] mb-1">{title}</p>
      <p className="text-xs text-muted-foreground max-w-xs">{message}</p>
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