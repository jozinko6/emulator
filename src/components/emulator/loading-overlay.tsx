"use client";

/**
 * LoadingOverlay — prekryvný panel počas inicializácie / načítania hry.
 *
 * Per prompt ETAPA 9. Zobrazí sa nad plátnom emulátora.
 *
 * Komentáre v slovenčine.
 */
import { Loader2 } from "lucide-react";

interface LoadingOverlayProps {
  message?: string;
  progress?: number; // 0..1
}

export function LoadingOverlay({ message = "Načítavam emulátor…", progress }: LoadingOverlayProps) {
  const pct =
    typeof progress === "number" && Number.isFinite(progress)
      ? Math.max(0, Math.min(100, Math.round(progress * 100)))
      : null;
  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {pct !== null && (
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <span className="sr-only">{message}</span>
    </div>
  );
}
