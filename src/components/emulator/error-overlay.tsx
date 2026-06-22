"use client";

/**
 * ErrorOverlay — prekryvný panel pri chybe emulátora.
 *
 * Per prompt ETAPA 9. Zobrazí nadpis, príčinu, návrh riešenia
 * a voliteľný technický detail. Tlačidlo „Skúsiť znova" / „Späť do knižnice".
 *
 * Komentáre v slovenčine.
 */
import { AlertTriangle, RotateCcw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isRetroCloudError } from "@/lib/errors-helpers";

interface ErrorOverlayProps {
  error: unknown;
  onRetry?: () => void;
  onExit?: () => void;
}

export function ErrorOverlay({ error, onRetry, onExit }: ErrorOverlayProps) {
  let title = "Nastala chyba";
  let cause = "Vyskytla sa neočakávaná chyba.";
  let resolution = "Skúste to znova. Ak problém pretrváva, pozrite diagnostiku.";
  let technical: string | undefined;

  if (isRetroCloudError(error)) {
    const u = error.toUserFacing();
    title = u.title;
    cause = u.cause;
    resolution = u.resolution;
    technical = u.technical;
  } else if (error instanceof Error) {
    cause = error.message;
  } else if (typeof error === "string") {
    cause = error;
  }

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-background/90 p-6 text-center backdrop-blur"
      role="alertdialog"
      aria-labelledby="error-overlay-title"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-7" aria-hidden="true" />
      </div>
      <h2 id="error-overlay-title" className="text-lg font-semibold text-foreground">
        {title}
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">{cause}</p>
      <p className="max-w-md text-xs text-muted-foreground">{resolution}</p>
      {technical && (
        <pre className="max-w-md overflow-x-auto rounded-md bg-secondary/50 p-2 text-left text-[10px] text-muted-foreground">
          <code>{technical}</code>
        </pre>
      )}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {onRetry && (
          <Button onClick={onRetry} className="min-h-11">
            <RotateCcw className="size-4" aria-hidden="true" />
            Skúsiť znova
          </Button>
        )}
        {onExit && (
          <Button onClick={onExit} variant="outline" className="min-h-11">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Späť do knižnice
          </Button>
        )}
      </div>
    </div>
  );
}
