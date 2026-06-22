"use client";

/**
 * SaveStateList — zoznam save states pre konkrétnu hru.
 *
 * Per prompt ETAPA 9. Akcie:
 *  - Load (zavolá `onLoad`)
 *  - Export (stiahne súbor z OPFS ako blob)
 *  - Delete (zavolá `onDelete` + zmaže OPFS súbor)
 *
 * Komentáre v slovenčine.
 */
import { useCallback, useEffect, useState } from "react";
import { Save, Download, Trash2, Clock, AlertCircle } from "lucide-react";
import type { SaveStateRecord } from "@/types/game";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSaveStates, deleteSaveState } from "@/lib/storage/repositories";
import { deleteRecursive, readFile } from "@/lib/storage/opfs";
import { useToast } from "@/hooks/use-toast";
import { formatBytes, formatDateTime } from "@/lib/format";

interface SaveStateListProps {
  gameId: string;
  onLoad?: (slot: number) => void;
  /** Volané po zmene zoznamu (load/delete). */
  onChanged?: () => void;
}

export function SaveStateList({ gameId, onLoad, onChanged }: SaveStateListProps) {
  const [saves, setSaves] = useState<SaveStateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getSaveStates(gameId);
      list.sort((a, b) => b.createdAt - a.createdAt);
      setSaves(list);
    } catch (e) {
      console.warn("[save-state-list] refresh zlyhal:", e);
      setSaves([]);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleDelete = useCallback(
    async (save: SaveStateRecord) => {
      if (!confirm(`Naozaj odstrániť save state slot ${save.slot}?`)) return;
      try {
        await deleteSaveState(save.id);
        if (save.opfsPath) {
          await deleteRecursive(save.opfsPath).catch((e: unknown) => {
            console.warn("[save-state-list] deleteRecursive opfsPath zlyhal:", e);
          });
        }
        if (save.screenshotPath) {
          await deleteRecursive(save.screenshotPath).catch((e: unknown) => {
            console.warn("[save-state-list] deleteRecursive screenshot zlyhal:", e);
          });
        }
        await refresh();
        onChanged?.();
        toast({ title: "Save state odstránený", description: `Slot ${save.slot}` });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast({
          title: "Odstránenie zlyhalo",
          description: msg,
          variant: "destructive",
        });
      }
    },
    [refresh, toast, onChanged]
  );

  const handleExport = useCallback(async (save: SaveStateRecord) => {
    try {
      const file = await readFile(save.opfsPath);
      const blob = new Blob([await file.arrayBuffer()], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${save.gameId}-slot-${save.slot}.sav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        title: "Export zlyhal",
        description: msg,
        variant: "destructive",
      });
    }
  }, [toast]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Save className="size-4 text-primary" aria-hidden="true" />
          Save states ({saves.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Načítavam…</p>
        ) : saves.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Žiadne save states. Uložte stav počas hrania cez tlačidlo „Save".
          </p>
        ) : (
          <ul className="space-y-2 max-h-96 overflow-y-auto rc-scroll" role="list">
            {saves.map((s) => (
              <li
                key={s.id}
                className="flex flex-col gap-2 rounded-md border border-border bg-background/40 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Slot {s.slot}</Badge>
                    {s.isAutoSave && (
                      <Badge variant="secondary" className="gap-1">
                        <Clock className="size-3" aria-hidden="true" />
                        Auto
                      </Badge>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      {formatDateTime(s.createdAt)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {formatBytes(s.fileSize)} · {s.emulatorCore} {s.emulatorVersion}
                  </p>
                  {s.note && (
                    <p className="truncate text-xs text-muted-foreground" title={s.note}>
                      {s.note}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  {onLoad && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onLoad(s.slot)}
                      className="min-h-9"
                    >
                      <Save className="size-3.5" aria-hidden="true" />
                      Load
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => void handleExport(s)}
                    aria-label={`Exportovať save state slot ${s.slot}`}
                    className="min-h-9"
                  >
                    <Download className="size-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => void handleDelete(s)}
                    aria-label={`Odstrániť save state slot ${s.slot}`}
                    className="min-h-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
          <AlertCircle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
          Save states sú viazané na verziu emulačného jadra. Po aktualizácii jadra
          môžu byť nekompatibilné.
        </p>
      </CardContent>
    </Card>
  );
}
