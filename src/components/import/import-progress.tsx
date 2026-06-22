"use client";

/**
 * ImportProgress — progress overlay pre import pipeline.
 *
 * Per prompt sekcia ETAPA 3. Zobrazuje:
 *  - názov súboru
 *  - aktuálny krok
 *  - percentá
 *  - počet súborov (processed/total)
 *  - spracované bajty / celková veľkosť
 *  - rozbalená veľkosť (extracted bytes)
 *  - upozornenia (warnings)
 *  - tlačidlo Zrušiť (AbortController)
 *
 * Komentáre v slovenčine.
 */
import { useMemo } from "react";
import { X, AlertTriangle, FileWarning, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ImportJobRecord } from "@/types/game";

interface ImportProgressProps {
  job: ImportJobRecord;
  /** Volá sa pri kliknutí na Zrušiť. */
  onCancel: () => void;
  /** Volá sa pri kliknutí na Zavrieť (po dokončení / chybe). */
  onDismiss?: () => void;
}

/** Formátuje veľkosť v bajtoch na ľudsky čitateľný reťazec. */
function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Preloží status job-u do slovenského popisu. */
function stepLabel(job: ImportJobRecord): string {
  switch (job.status) {
    case "idle":
      return "Pripravený";
    case "selecting":
      return "Výber súborov";
    case "reading":
      return "Čítanie súboru";
    case "validating":
      return "Validácia archívu";
    case "extracting":
      return "Rozbaľovanie archívu";
    case "detecting":
      return "Detekcia platformy";
    case "awaiting-user-selection":
      return "Čaká na výber používateľa";
    case "storing":
      return "Ukladanie do OPFS";
    case "ready":
      return "Hotovo";
    case "error":
      return "Chyba";
    case "cancelled":
      return "Zrušené";
    default:
      return job.status;
  }
}

export function ImportProgress({ job, onCancel, onDismiss }: ImportProgressProps) {
  const percent = useMemo(() => {
    if (job.totalBytes > 0) {
      return Math.min(100, Math.round((job.processedBytes / job.totalBytes) * 100));
    }
    return 0;
  }, [job.processedBytes, job.totalBytes]);

  const isFinished = job.status === "ready" || job.status === "error" || job.status === "cancelled";
  const isRunning = !isFinished;

  return (
    <div
      role="dialog"
      aria-label="Priebeh importu"
      aria-busy={isRunning}
      className="rounded-lg border border-border bg-card p-5 shadow-lg"
    >
      {/* Hlavička */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {isFinished ? (
            job.status === "ready" ? (
              <CheckCircle2 className="size-5 text-primary" aria-hidden="true" />
            ) : (
              <AlertTriangle className="size-5 text-destructive" aria-hidden="true" />
            )
          ) : (
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {job.fileName || "Import hry"}
            </h3>
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {stepLabel(job)}
            </Badge>
          </div>
          {job.currentStep && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground" title={job.currentStep}>
              {job.currentStep}
            </p>
          )}
        </div>
        <div className="shrink-0">
          {isFinished ? (
            onDismiss && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onDismiss}
                aria-label="Zavrieť"
                className="size-8"
              >
                <X className="size-4" />
              </Button>
            )
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="min-h-9"
            >
              <X className="size-4" />
              Zrušiť
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4 space-y-2">
        <Progress value={percent} aria-label={`Priebeh: ${percent}%`} />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{percent}%</span>
          <span>
            {formatBytes(job.processedBytes)} / {formatBytes(job.totalBytes)}
          </span>
        </div>
      </div>

      {/* Štatistiky */}
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <Stat label="Súbory" value={`${job.processedFiles} / ${job.fileCount || "?"}`} />
        <Stat label="Spracované" value={formatBytes(job.processedBytes)} />
        <Stat label="Celkom" value={formatBytes(job.totalBytes)} />
        <Stat label="Rozbalené" value={formatBytes(job.extractedBytes)} />
      </div>

      {/* Chyba */}
      {job.status === "error" && job.error && (
        <div
          className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
          role="alert"
        >
          <p className="font-medium">Import zlyhal:</p>
          <p className="mt-1 break-words">{job.error}</p>
        </div>
      )}

      {/* Varovania */}
      {job.warnings.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <FileWarning className="size-3.5" aria-hidden="true" />
            <span>Upozornenia ({job.warnings.length})</span>
          </div>
          <ScrollArea className="h-28 rounded-md border border-border bg-background/40">
            <ul className="space-y-1 p-2 text-xs">
              {job.warnings.map((w, i) => (
                <li
                  key={i}
                  className="flex items-start gap-1.5 break-words text-muted-foreground"
                >
                  <span className="mt-0.5 text-primary">•</span>
                  <span className="break-words">{w}</span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-xs text-foreground">{value}</p>
    </div>
  );
}
