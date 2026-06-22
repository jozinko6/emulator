"use client";

/**
 * BiosManager â€” UI pre upload a sprĂˇvu BIOS sĂşborov.
 *
 * Per prompt ETAPA 6. Podporuje:
 *  - drag&drop alebo file picker pre upload BIOS sĂşboru
 *  - validĂˇcia cez `validatePs1Bios`
 *  - zoznam nahranĂ˝ch BIOS s regiĂłnom, veÄľkosĹĄou, hashom
 *  - tlaÄŤidlo odstrĂˇniĹĄ
 *
 * UkladĂˇ do OPFS cez `biosPath()`, metadata do IndexedDB.
 *
 * KomentĂˇre v slovenÄŤine.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import {
  Cpu,
  FileUp,
  Loader2,
  ShieldCheck,
  Trash2,
  Globe,
  Hash,
  HardDrive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  getAllBios,
  putBios,
  deleteBios as deleteBiosRepo,
} from "@/lib/storage/repositories";
import { biosPath, deleteRecursive, writeStream } from "@/lib/storage/opfs";
import { validatePs1Bios } from "@/emulators/ps1/bios-validator";
import type { BiosRecord } from "@/types/game";
import type { EmulatorPlatform } from "@/types/emulator";

interface BiosManagerProps {
  /** ObmedzĂ­ zoznam na jednu platformu (ak nie je zadanĂ©, zobrazĂ­ vĹˇetky). */
  platformFilter?: EmulatorPlatform;
}

export function BiosManager({ platformFilter }: BiosManagerProps) {
  const [biosList, setBiosList] = useState<BiosRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const loadBios = useCallback(async () => {
    try {
      const all = await getAllBios();
      const filtered = platformFilter
        ? all.filter((b) => b.platform === platformFilter)
        : all;
      setBiosList(filtered);
    } catch (e) {
      console.warn("[bios-manager] loadBios zlyhal:", e);
      setBiosList([]);
    }
  }, [platformFilter]);

  useEffect(() => {
    void loadBios();
  }, [loadBios]);

  /**
   * Spracuje nahranĂ˝ sĂşbor â€” validuje ho a uloĹľĂ­ do OPFS + IndexedDB.
   */
  const handleFile = useCallback(
    async (file: File, platform: EmulatorPlatform = "ps1") => {
      setUploading(true);
      try {
        // Pre PS1 pouĹľijeme validatePs1Bios
        if (platform !== "ps1") {
          toast({
            title: "NepodporovanĂˇ platforma",
            description: `BIOS upload pre ${platform} nie je zatiaÄľ podporovanĂ˝.`,
            variant: "destructive",
          });
          return;
        }

        const buffer = new Uint8Array(await file.arrayBuffer());
        const result = await validatePs1Bios(buffer);
        if (!result.ok) {
          toast({
            title: "NeplatnĂ˝ BIOS",
            description: result.reasons.join(" "),
            variant: "destructive",
          });
          return;
        }

        // UloĹľ do OPFS
        const opfsPath = biosPath(platform, file.name);
        const blob = new Blob([buffer]);
        const stream = blob.stream() as ReadableStream<Uint8Array>;
        await writeStream(opfsPath, stream);

        // UloĹľ metadata do IndexedDB
        const record: BiosRecord = {
          id: uuid(),
          platform,
          fileName: file.name,
          size: file.size,
          hash: result.hash,
          region: result.region,
          savedAt: Date.now(),
          opfsPath,
        };
        await putBios(record);
        await loadBios();

        toast({
          title: "BIOS nahranĂ˝",
          description: `${file.name} â€” regiĂłn: ${result.region ?? "unknown"}`,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast({
          title: "Upload zlyhal",
          description: msg,
          variant: "destructive",
        });
      } finally {
        setUploading(false);
      }
    },
    [loadBios, toast]
  );

  const handleDelete = useCallback(
    async (bios: BiosRecord) => {
      try {
        await deleteBiosRepo(bios.id);
        await deleteRecursive(bios.opfsPath).catch((e: unknown) => {
          console.warn("[bios-manager] deleteRecursive zlyhal:", e);
        });
        await loadBios();
        toast({
          title: "BIOS odstrĂˇnenĂ˝",
          description: bios.fileName,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast({
          title: "OdstrĂˇnenie zlyhalo",
          description: msg,
          variant: "destructive",
        });
      }
    },
    [loadBios, toast]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (uploading) return;
      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;
      void handleFile(files[0]);
    },
    [handleFile, uploading]
  );

  const onDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!uploading) setDragOver(true);
    },
    [uploading]
  );

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
      e.target.value = "";
    },
    [handleFile]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cpu className="size-5 text-primary" aria-hidden="true" />
          BIOS sĂşbory
        </CardTitle>
        <CardDescription>
          Pre PS1 emulĂˇciu je potrebnĂ˝ vlastnĂ˝ BIOS sĂşbor (napr. SCPH-1001, SCPH-5501).
          SĂşbory sa ukladajĂş len lokĂˇlne do vĂˇĹˇho zariadenia.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={cnDrop(dragOver)}
          role="region"
          aria-label="ZĂłna pre nahranie BIOS sĂşboru"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            {uploading ? (
              <Loader2 className="size-7 animate-spin" aria-hidden="true" />
            ) : (
              <FileUp className="size-7" aria-hidden="true" />
            )}
          </div>
          <div className="space-y-1 text-center">
            <p className="font-medium text-foreground">Pretiahnite sem BIOS sĂşbor</p>
            <p className="text-xs text-muted-foreground">
              PodporovanĂ©: PS1 BIOS (SCPH-1000..SCPH-9000), 512 KB / 2 MB / 4 MB
            </p>
          </div>
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="min-h-11"
          >
            <FileUp className="size-4" />
            VybraĹĄ sĂşbor
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={onInputChange}
            accept=".bin,.rom,.bios"
            className="sr-only"
            aria-label="Vyber BIOS sĂşbor"
          />
        </div>

        {/* List */}
        {biosList.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Ĺ˝iadne BIOS sĂşbory. Nahrajte sĂşbor vyĹˇĹˇie.
          </div>
        ) : (
          <ul className="space-y-2" aria-label="Zoznam nahranĂ˝ch BIOS sĂşborov">
            {biosList.map((bios) => (
              <li
                key={bios.id}
                className="rounded-md border border-border bg-background/40 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate font-medium" title={bios.fileName}>
                      {bios.fileName}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="capitalize">
                        {bios.platform}
                      </Badge>
                      {bios.region && (
                        <Badge variant="outline" className="gap-1">
                          <Globe className="size-3" aria-hidden="true" />
                          {bios.region}
                        </Badge>
                      )}
                      <Badge variant="outline" className="gap-1">
                        <HardDrive className="size-3" aria-hidden="true" />
                        {formatBytes(bios.size)}
                      </Badge>
                    </div>
                    <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Hash className="size-3" aria-hidden="true" />
                      <code className="font-mono">{bios.hash.slice(0, 16)}â€¦</code>
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => void handleDelete(bios)}
                    aria-label={`OdstrĂˇniĹĄ ${bios.fileName}`}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Privacy notice */}
        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p>
            BIOS sĂşbory sa ukladajĂş vĂ˝hradne do vĂˇĹˇho zariadenia (OPFS) a nikdy
            nie sĂş odosielanĂ© na server. Jaňo še chce bavkac nedistribuuje BIOS sĂşbory â€”
            pouĹľĂ­vateÄľ je zodpovednĂ˝ za ich legĂˇlne vlastnĂ­ctvo.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * SkladĂˇ Tailwind class-y pre drop zĂłnu.
 */
function cnDrop(dragOver: boolean): string {
  const base =
    "flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-6 text-center transition-colors";
  return dragOver
    ? `${base} border-primary ring-2 ring-primary/40 bg-primary/5`
    : `${base} border-border`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}
