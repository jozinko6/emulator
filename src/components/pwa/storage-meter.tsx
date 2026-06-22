"use client";

import { useEffect, useState } from "react";
import { HardDrive, Database } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export function StorageMeter() {
  const [est, setEst] = useState<{
    quota: number;
    usage: number;
    available: number;
  } | null>(null);
  const [persisted, setPersisted] = useState<boolean>(false);

  useEffect(() => {
    import("@/lib/storage/opfs")
      .then(({ getStorageEstimate, requestPersistentStorage }) => {
        getStorageEstimate().then(setEst);
        requestPersistentStorage().then(setPersisted);
      })
      .catch(() => {});
  }, []);

  if (!est) {
    return <p className="text-sm text-muted-foreground">Načítavam stav úložiska…</p>;
  }

  const usedPct = est.quota > 0 ? (est.usage / est.quota) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <HardDrive className="h-4 w-4" />
          Použité miesto
        </span>
        <span className="font-mono">
          {formatBytes(est.usage)} / {formatBytes(est.quota)}
        </span>
      </div>
      <Progress value={usedPct} className="h-2" />
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-primary" />
          <span className="text-muted-foreground">Dostupné:</span>
          <span className="font-mono">{formatBytes(est.available)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Persistent storage:</span>
          <span className={persisted ? "text-emerald-400" : "text-amber-400"}>
            {persisted ? "Áno" : "Nie"}
          </span>
        </div>
      </div>
      {!persisted && (
        <p className="text-[10px] text-muted-foreground">
          Pre lepšiu stabilitu odporúčame povoliť perzistentné úložisko v Nastavenia → Úložisko.
        </p>
      )}
    </div>
  );
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
