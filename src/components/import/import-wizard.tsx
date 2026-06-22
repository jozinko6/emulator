"use client";

/**
 * ImportWizard â€” hlavnĂ˝ stavovĂ˝ automat pre import hier.
 *
 * Per prompt sekcia ETAPA 3. Stavy:
 *   idle â†’ selecting â†’ reading â†’ validating â†’ extracting â†’ detecting
 *        â†’ awaiting-user-selection (ak requiresUserSelection)
 *        â†’ storing â†’ ready / error / cancelled
 *
 * PouĹľĂ­va `useImportStore` zo `src/stores/import-store.ts`.
 * Pri prvom importe zobrazuje prĂˇvne potvrdenie.
 *
 * KomentĂˇre v slovenÄŤine.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import {
  CheckCircle2,
  FileText,
  Gamepad2,
  Package,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { DropZone } from "@/components/import/drop-zone";
import { ImportProgress } from "@/components/import/import-progress";
import {
  detectFormat,
  isArchive,
  isSupported,
  type ImportableFormat,
} from "@/components/import/format-detection";
import {
  summarizeArchive,
  validateSummary,
  checkEntriesForUnsafePaths,
} from "@/lib/archive/archive-security";
import { DEFAULT_ARCHIVE_LIMITS } from "@/lib/security/limits";
import { normalizePath, extname } from "@/lib/security/path-normalizer";
import {
  streamFileToOpfs,
  streamBlobToOpfs,
  isStreamRequired,
} from "@/lib/storage/streaming-writer";
import { gameFilePath, cleanupPartialImport, readFile, writeStream } from "@/lib/storage/opfs";
import { putGame, putGameFile } from "@/lib/storage/repositories";
import { fingerprintGame } from "@/lib/security/hashing";
import { getNativeStoragePlugin } from "@/lib/native/native-storage";
import {
  chooseMainFile,
  fileListToImportEntries,
  sourceTypeForEntries,
  type ImportSourceEntry,
} from "@/lib/import/import-sources";
import { useImportStore } from "@/stores/import-store";
import { useLibraryStore } from "@/stores/library-store";
import type { ImportJobRecord } from "@/types/game";
import type { GameRecord, GameFileRecord } from "@/types/game";
import type { EmulatorPlatform } from "@/types/emulator";
import type { ArchiveEntry } from "@/types/detection";
import type { DetectionInput, DetectionResult } from "@/types/detection";
import type {
  ArchiveWorkerRequest,
  ArchiveWorkerResponse,
} from "@/lib/archive/archive-types";
import { RetroCloudError } from "@/types/errors";

/** Source type label pre ImportJobRecord.sourceType. */
function sourceTypeFor(format: string): string {
  if (format === "zip" || format === "rar" || format === "7z") return format;
  if (format === "jsdos") return "jsdos";
  return "local-file";
}

/** VytvorĂ­ novĂ˝ ImportJobRecord. */
function createJob(fileName: string, fileSize: number, sourceType: string): ImportJobRecord {
  const now = Date.now();
  return {
    id: uuid(),
    status: "selecting",
    sourceType,
    fileName,
    totalBytes: fileSize,
    processedBytes: 0,
    extractedBytes: 0,
    fileCount: 0,
    processedFiles: 0,
    currentStep: "PripravenĂ˝ na spracovanie",
    warnings: [],
    createdAt: now,
    updatedAt: now,
  };
}

function toWebViewFileUrl(url: string): string {
  const capacitor = window.Capacitor as unknown as
    | { convertFileSrc?: (filePath: string) => string }
    | undefined;
  return capacitor?.convertFileSrc ? capacitor.convertFileSrc(url) : url;
}

export interface ImportWizardProps {
  /** VolĂˇ sa po ĂşspeĹˇnom importe s ID vytvorenej hry. */
  onComplete?: (gameId: string) => void;
  onOpenLibrary?: () => void;
  sourceEntries?: ImportSourceEntry[] | null;
}

export function ImportWizard({ onComplete, onOpenLibrary, sourceEntries }: ImportWizardProps = {}) {
  const {
    currentJob,
    setJob,
    updateJob,
    legalConfirmed,
    setLegalConfirmed,
    reset,
  } = useImportStore();
  const addGame = useLibraryStore((s) => s.addGame);
  const { toast } = useToast();

  // LokĂˇlny stav
  const [legalChecked, setLegalChecked] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<EmulatorPlatform | null>(null);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [extractedEntries, setExtractedEntries] = useState<ArchiveEntry[]>([]);

  // Refy pre async operĂˇcie
  const abortRef = useRef<AbortController | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const gameIdRef = useRef<string>("");
  const writeQueueRef = useRef<
    Array<{ path: string; data: Uint8Array; size: number }>
  >([]);
  const writePromiseRef = useRef<Promise<void> | null>(null);
  const extractedEntriesRef = useRef<ArchiveEntry[]>([]);
  const mainFileRef = useRef<string>("");

  // Cleanup pri unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!legalConfirmed || !sourceEntries || sourceEntries.length === 0) return;
    void handleSourceEntriesSelected(sourceEntries);
  }, [legalConfirmed, sourceEntries]);

  async function handleSourceEntriesSelected(entries: ImportSourceEntry[]): Promise<void> {
    if (entries.length === 0 || !legalConfirmed) return;

    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const job = createJob(entries[0].name, totalSize, sourceTypeForEntries(entries));
    setJob(job);
    setExtractedEntries([]);
    setDetectionResult(null);
    setSelectedPlatform(null);
    extractedEntriesRef.current = [];
    mainFileRef.current = "";
    writeQueueRef.current = [];
    writePromiseRef.current = null;

    await runSourceEntriesPipeline(entries, job);
  }

  async function readImportEntryText(entry: ImportSourceEntry): Promise<string> {
    if (entry.file) return entry.file.text();
    if (!entry.internalPath) throw new Error(`SĂşbor ${entry.relativePath} nemĂˇ ÄŤitateÄľnĂ˝ zdroj.`);
    const native = getNativeStoragePlugin();
    if (!native) throw new Error("Native storage plugin nie je dostupnĂ˝.");
    const ref = await native.openFile({ path: entry.internalPath });
    const fileUrl = toWebViewFileUrl(ref.url);
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Nepodarilo sa otvoriĹĄ ${entry.relativePath}: HTTP ${response.status}`);
    return response.text();
  }

  async function runSourceEntriesPipeline(
    entries: ImportSourceEntry[],
    initialJob: ImportJobRecord
  ): Promise<void> {
    const gameId = uuid();
    gameIdRef.current = gameId;
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      updateJob({
        status: "validating",
        currentStep: "Kontrola vybranĂ˝ch sĂşborov...",
        fileCount: entries.length,
        totalBytes: initialJob.totalBytes,
      });

      const decision = await chooseMainFile(entries, readImportEntryText);

      updateJob({ status: "storing", currentStep: "ZĂˇpis sĂşborov do OPFS..." });

      let writtenTotal = 0;
      const archiveEntries: ArchiveEntry[] = [];
      for (const entry of entries) {
        if (abort.signal.aborted) throw new RetroCloudError("UNKNOWN_ERROR", "Import bol zruĹˇenĂ˝.");

        const target = gameFilePath(gameId, entry.relativePath);
        if (entry.file) {
          await streamFileToOpfs(
            entry.file,
            target,
            (written) => {
              updateJob({ processedBytes: writtenTotal + written, extractedBytes: writtenTotal + written });
            },
            abort.signal
          );
        } else if (entry.internalPath) {
          const native = getNativeStoragePlugin();
          if (!native) throw new Error("Native storage plugin nie je dostupnĂ˝.");
          const ref = await native.openFile({ path: entry.internalPath });
          const fileUrl = toWebViewFileUrl(ref.url);
          const response = await fetch(fileUrl);
          if (!response.ok || !response.body) {
            throw new Error(`Nepodarilo sa streamovaĹĄ ${entry.relativePath}: HTTP ${response.status}`);
          }
          await writeStream(target, response.body, (written) => {
            updateJob({ processedBytes: writtenTotal + written, extractedBytes: writtenTotal + written });
          });
        } else {
          throw new Error(`SĂşbor ${entry.relativePath} nemĂˇ File ani internalPath.`);
        }

        writtenTotal += entry.size;
        archiveEntries.push({ path: entry.relativePath, size: entry.size, isDirectory: false });
        updateJob({
          processedBytes: writtenTotal,
          extractedBytes: writtenTotal,
          processedFiles: archiveEntries.length,
        });
      }

      extractedEntriesRef.current = archiveEntries;
      setExtractedEntries(archiveEntries);
      mainFileRef.current = decision.mainFile;

      const detection: DetectionResult = {
        platform: decision.platform,
        confidence: decision.platform ? 0.95 : 0,
        reasons: decision.warnings,
        requiresUserSelection: !decision.platform,
        possiblePlatforms: decision.platform ? [decision.platform] : ["dos", "ps1"],
        mainFile: decision.mainFile,
        warnings: decision.warnings,
      };
      setDetectionResult(detection);

      if (!decision.platform) {
        updateJob({
          status: "awaiting-user-selection",
          currentStep: "Vyberte platformu hry",
        });
        return;
      }

      await finalizeImport(decision.platform);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      updateJob({
        status: "error",
        currentStep: "Import zlyhal",
        error: message,
      });
      await cleanupPartialImport(gameId).catch((cleanupErr: unknown) => {
        console.warn("[import] cleanupPartialImport po chybe zlyhal:", cleanupErr);
      });
      toast({
        title: "Import zlyhal",
        description: message,
        variant: "destructive",
      });
    }
  }

  /**
   * ZaÄŤne import â€” volĂˇ sa z DropZone po vĂ˝bere sĂşborov.
   * Spracuje len prvĂ˝ sĂşbor (ostatnĂ© preskoÄŤĂ­ s upozornenĂ­m).
   */
  const handleFilesSelected = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      if (!legalConfirmed) return;

      const entries = fileListToImportEntries(files);
      if (entries.length > 1) {
        void handleSourceEntriesSelected(entries);
        return;
      }

      const file = files[0];
      const fmt = detectFormat(file.name);
      if (!isSupported(fmt)) {
        toast({
          title: "NepodporovanĂ˝ sĂşbor",
          description: `SĂşbor ${file.name} nie je podporovanĂ©ho formĂˇtu.`,
          variant: "destructive",
        });
        return;
      }

      if (files.length > 1) {
        toast({
          title: "Viac sĂşborov",
          description: `Bude sa importovaĹĄ iba ${file.name}. OstatnĂ© presuĹte neskĂ´r.`,
        });
      }

      const sourceType = sourceTypeFor(fmt);
      const job = createJob(file.name, file.size, sourceType);
      setJob(job);
      setExtractedEntries([]);
      setDetectionResult(null);
      setSelectedPlatform(null);
      extractedEntriesRef.current = [];
      mainFileRef.current = "";
      writeQueueRef.current = [];
      writePromiseRef.current = null;

      // Spustenie pipeline
      void runPipeline(file, fmt, job);
    },
     
    [legalConfirmed, setJob, toast]
  );

  /**
   * HlavnĂˇ pipeline â€” spĂşĹˇĹĄa jednotlivĂ© fĂˇzy importu.
   * Je izolovanĂˇ do jednej async funkcie kvĂ´li ÄŤitateÄľnosti.
   */
  const runPipeline = useCallback(
    async (file: File, format: ImportableFormat, initialJob: ImportJobRecord) => {
      const gameId = uuid();
      gameIdRef.current = gameId;
      const abort = new AbortController();
      abortRef.current = abort;

      try {
        // === READING ===
        updateJob({ status: "reading", currentStep: "ÄŚĂ­tanie sĂşboru..." });

        // Pre archĂ­vy potrebujeme naÄŤĂ­taĹĄ dĂˇta (pre ZIP) alebo File (pre RAR/7z)
        // Streamer sa postarĂˇ o OPFS neskĂ´r.
        let entries: ArchiveEntry[] = [];

        if (isArchive(format)) {
          // === VALIDATING ===
          updateJob({ status: "validating", currentStep: "ValidĂˇcia archĂ­vu..." });

          // Pre ZIP potrebujeme Uint8Array â€” ak je sĂşbor veÄľkĂ˝, varujeme.
          // Pre RAR/7z poĹˇleme File priamo do workera.
          const workerPayload: File | ArrayBuffer =
            format === "zip"
              ? await file.arrayBuffer()
              : file;

          // Spustenie workera pre list+extract
          entries = await runArchiveWorker(
            format as "zip" | "rar" | "7z",
            workerPayload,
            file.name,
            abort.signal
          );

          // Skontrolujeme bezpeÄŤnosĹĄ archĂ­vu
          const summary = summarizeArchive(entries);
          const validation = validateSummary(summary, DEFAULT_ARCHIVE_LIMITS);
          if (!validation.ok) {
            // PridĂˇme varovania do job-u
            updateJob({ warnings: [...(currentJob?.warnings ?? []), ...validation.reasons] });
            // Ak je to archĂ­vna bomba alebo path traversal, zastavĂ­me
            const critical = validation.reasons.some(
              (r) => r.includes("archĂ­vnu bombu") || r.includes("path traversal")
            );
            if (critical) {
              throw new RetroCloudError(
                "ARCHIVE_BOMB_DETECTED",
                "ArchĂ­v bol zamietnutĂ˝ z bezpeÄŤnostnĂ˝ch dĂ´vodov."
              );
            }
          }

          // Skontrolujeme nebezpeÄŤnĂ© cesty
          const unsafePaths = checkEntriesForUnsafePaths(entries);
          if (unsafePaths.length > 0) {
            updateJob({
              warnings: [
                ...(currentJob?.warnings ?? []),
                ...unsafePaths.slice(0, 50).map((p) => `NebezpeÄŤnĂˇ cesta: ${p}`),
              ],
            });
            // Filtrujeme von nebezpeÄŤnĂ© cesty â€” pouĹľĂ­vateÄľovi uĹľ boli
            // ohlĂˇsenĂ© v `unsafePaths` zozname, takĹľe ich len ticho vynechĂˇme.
            entries = entries.filter((e) => {
              try {
                normalizePath(e.path);
                return true;
              } catch (err) {
                // NebezpeÄŤnĂˇ cesta â€” uĹľ zaradenĂˇ v warnings, preskakujeme.
                console.debug("[import] vynechĂˇvam nebezpeÄŤnĂş cestu:", e.path, err);
                return false;
              }
            });
          }

          // === EXTRACTING (streaming do OPFS) ===
          updateJob({
            status: "extracting",
            currentStep: "RozbaÄľovanie archĂ­vu a zĂˇpis do OPFS...",
            fileCount: summary.totalFiles,
            totalBytes: summary.totalUncompressedSize,
          });

          // Worker uĹľ rozbalil a poslal entries â€” writes uĹľ prebehli v runArchiveWorker.
          extractedEntriesRef.current = entries;
          setExtractedEntries(entries);
        } else {
          // VoÄľnĂ˝ sĂşbor â€” Ĺľiadny archĂ­v na rozbalenie
          updateJob({
            status: "validating",
            currentStep: "Kontrola sĂşboru...",
            fileCount: 1,
            totalBytes: file.size,
          });

          if (isStreamRequired(file.size)) {
            // VeÄľkĂ˝ sĂşbor â€” streamujeme priamo v "storing" fĂˇze
            updateJob({
              warnings: [
                ...(currentJob?.warnings ?? []),
                `SĂşbor je vĂ¤ÄŤĹˇĂ­ ako 256 MB (${(file.size / 1024 / 1024).toFixed(0)} MB) â€” bude sa streamovaĹĄ.`,
              ],
            });
          }

          // VytvorĂ­me "pseudo-entry" pre detekciu
          const pseudoEntry: ArchiveEntry = {
            path: file.name,
            size: file.size,
            isDirectory: false,
          };
          entries = [pseudoEntry];
          extractedEntriesRef.current = entries;
          setExtractedEntries(entries);

          // === STORING (streaming do OPFS) ===
          updateJob({
            status: "storing",
            currentStep: "ZĂˇpis sĂşboru do OPFS...",
          });

          const opfsPath = gameFilePath(gameId, file.name);
          const result = await streamFileToOpfs(
            file,
            opfsPath,
            (written) => {
              updateJob({
                processedBytes: written,
                extractedBytes: written,
              });
            },
            abort.signal
          );

          updateJob({
            processedBytes: result.size,
            extractedBytes: result.size,
            processedFiles: 1,
          });

          mainFileRef.current = file.name;
        }

        // Vyberieme main file pre detekciu
        const mainFile = pickMainFile(extractedEntriesRef.current);
        mainFileRef.current = mainFile;

        // === DETECTING ===
        updateJob({
          status: "detecting",
          currentStep: "Detekcia platformy...",
        });

        // Pre CUE sĂşbory â€” preÄŤĂ­taj obsah z OPFS
        let cueContent: string | undefined;
        if (mainFile.toLowerCase().endsWith(".cue")) {
          try {
            const file = await readFile(gameFilePath(gameId, mainFile));
            cueContent = await file.text();
          } catch (err) {
            console.warn("[import] nepodarilo sa preÄŤĂ­taĹĄ CUE obsah:", err);
          }
        }

        // Pre nezĂˇkladnĂ© sĂşbory â€” preÄŤĂ­taj hlaviÄŤku (prvĂ˝ch ~33 KB pre ISO detekciu)
        let fileHeader: Uint8Array | undefined;
        const mainFileLower = mainFile.toLowerCase();
        if (
          mainFileLower.endsWith(".iso") ||
          mainFileLower.endsWith(".bin") ||
          mainFileLower.endsWith(".chd") ||
          mainFileLower.endsWith(".pbp") ||
          mainFileLower.endsWith(".elf") ||
          mainFileLower.endsWith(".zip") ||
          mainFileLower.endsWith(".rar")
        ) {
          try {
            const file = await readFile(gameFilePath(gameId, mainFile));
            // Pre ISO potrebujeme ~33 KB (sektor 16 * 2048 = 32 kB + buffer)
            // Pre ostatnĂ© formĂˇty staÄŤĂ­ 8 bajtov
            const headerSize = mainFileLower.endsWith(".iso") ? 33_800 : 16;
            const buf = await file.slice(0, Math.min(headerSize, file.size)).arrayBuffer();
            fileHeader = new Uint8Array(buf);
          } catch (err) {
            console.warn("[import] nepodarilo sa preÄŤĂ­taĹĄ hlaviÄŤku sĂşboru:", err);
          }
        }

        const detectionInput: DetectionInput = {
          fileName: mainFile,
          fileSize: extractedEntriesRef.current.find((e) => e.path === mainFile)?.size ?? 0,
          siblingFiles: extractedEntriesRef.current.map((e) => e.path),
          cueContent,
          fileHeader,
        };
        const detection = await runDetectionWorker(detectionInput);
        setDetectionResult(detection);

        // === AWAITING USER SELECTION (ak potrebnĂ©) ===
        if (detection.requiresUserSelection || !detection.platform) {
          updateJob({
            status: "awaiting-user-selection",
            currentStep: "Vyberte platformu hry",
          });
          // Tu sa pipeline pozastavĂ­ â€” pokraÄŤuje sa aĹľ po kliknutĂ­ na tlaÄŤidlo
          return;
        }

        // PokraÄŤujeme priamo na finalization
        await finalizeImport(detection.platform);

         
      } catch (e: unknown) {
        if (abort.signal.aborted) {
          updateJob({
            status: "cancelled",
            currentStep: "Import bol zruĹˇenĂ˝",
          });
          // Cleanup OPFS
          await cleanupPartialImport(gameId).catch((cleanupErr: unknown) => {
            console.warn("[import] cleanupPartialImport po zruĹˇenĂ­ zlyhal:", cleanupErr);
          });
          return;
        }
        const message = e instanceof Error ? e.message : String(e);
        const code = e instanceof RetroCloudError ? e.code : "UNKNOWN_ERROR";
        updateJob({
          status: "error",
          currentStep: "Import zlyhal",
          error: `${message}${code !== "UNKNOWN_ERROR" ? ` (kĂłd: ${code})` : ""}`,
        });
        // Cleanup OPFS pri chybe
        await cleanupPartialImport(gameId).catch((cleanupErr: unknown) => {
          console.warn("[import] cleanupPartialImport po chybe zlyhal:", cleanupErr);
        });
        toast({
          title: "Import zlyhal",
          description: message,
          variant: "destructive",
        });
      } finally {
        if (workerRef.current) {
          workerRef.current.terminate();
          workerRef.current = null;
        }
      }
    },
     
    [updateJob, currentJob, setJob, toast]
  );

  /**
   * SpustĂ­ archive worker pre rozbalenie archĂ­vu.
   * VrĂˇti zoznam extrahovanĂ˝ch zĂˇznamov a sĂşÄŤasne streamuje dĂˇta do OPFS.
   */
  const runArchiveWorker = useCallback(
    (
      format: "zip" | "rar" | "7z",
      payload: File | ArrayBuffer,
      fileName: string,
      signal: AbortSignal
    ): Promise<ArchiveEntry[]> => {
      return new Promise<ArchiveEntry[]>((resolve, reject) => {
        const worker = new Worker(
          new URL("../../workers/archive.worker.ts", import.meta.url),
          { type: "module" }
        );
        workerRef.current = worker;
        const entries: ArchiveEntry[] = [];
        let totalFiles = 0;
        let totalBytes = 0;
        let resolved = false;

        const finish = (err?: Error) => {
          if (resolved) return;
          resolved = true;
          worker.onmessage = null;
          if (err) {
            reject(err);
          } else {
            resolve(entries);
          }
        };

        worker.onmessage = (e: MessageEvent<ArchiveWorkerResponse>) => {
          const msg = e.data;
          if (!msg || typeof msg !== "object" || !("type" in msg)) return;

          switch (msg.type) {
            case "progress": {
              totalFiles = msg.totalFiles;
              totalBytes = msg.totalBytes;
              updateJob({
                processedBytes: msg.processedBytes,
                totalBytes,
                processedFiles: msg.processedFiles,
                fileCount: totalFiles,
                extractedBytes: msg.processedBytes,
              });
              break;
            }
            case "warning": {
              const warning = `${msg.path} â€” ${msg.reason}`;
              updateJob({
                warnings: [...(useImportStore.getState().currentJob?.warnings ?? []), warning],
              });
              break;
            }
            case "entry": {
              // PridĂˇme do fronty na OPFS zĂˇpis
              writeQueueRef.current.push({
                path: msg.path,
                data: msg.data,
                size: msg.size,
              });
              entries.push({
                path: msg.path,
                size: msg.size,
                isDirectory: false,
              });
              // SpustĂ­me flush ak nie je aktĂ­vny
              if (!writePromiseRef.current) {
                writePromiseRef.current = flushWriteQueue(
                  gameIdRef.current,
                  abortRef.current?.signal ?? new AbortController().signal,
                  (written) => {
                    updateJob({ processedBytes: written });
                  }
                ).finally(() => {
                  writePromiseRef.current = null;
                });
              }
              break;
            }
            case "done": {
              // PoÄŤkĂˇme na vyprĂˇzdnenie write fronty
              const wait = () => {
                if (writePromiseRef.current) {
                  writePromiseRef.current.then(wait, wait);
                } else {
                  finish();
                }
              };
              wait();
              break;
            }
            case "cancelled": {
              finish(new RetroCloudError("UNKNOWN_ERROR", "RozbaÄľovanie zruĹˇenĂ©."));
              break;
            }
            case "error": {
              finish(
                new RetroCloudError(
                  (msg as { code: string }).code as RetroCloudError["code"],
                  (msg as { message: string }).message
                )
              );
              break;
            }
            case "entries":
              // Ignorujeme â€” pouĹľĂ­vame entry sprĂˇvy
              break;
            default:
              // NeznĂˇma sprĂˇva â€” ignorujeme
              break;
          }
        };

        // PoĹˇleme extract poĹľiadavku
        const request: ArchiveWorkerRequest = {
          type: "extract",
          format,
          payload,
          fileName,
        };
        // Pre ArrayBuffer pouĹľijeme transfer list
        if (payload instanceof ArrayBuffer) {
          worker.postMessage(request, [payload]);
        } else {
          worker.postMessage(request);
        }

        // Abort handler
        signal.addEventListener("abort", () => {
          if (workerRef.current) {
            const cancelReq: ArchiveWorkerRequest = { type: "cancel" };
            workerRef.current.postMessage(cancelReq);
          }
        });
      });
    },
    [updateJob]
  );

  /**
   * Postupne zapĂ­Ĺˇe frontu extrahovanĂ˝ch zĂˇznamov do OPFS.
   * SĂ©riovo â€” aby sme nezaĹĄaĹľili OPFS paralelnĂ˝mi zĂˇpismi.
   */
  const flushWriteQueue = useCallback(
    async (
      gameId: string,
      signal: AbortSignal,
      onProgress: (written: number) => void
    ): Promise<void> => {
      let written = 0;
      while (writeQueueRef.current.length > 0) {
        if (signal.aborted) {
          throw new RetroCloudError("UNKNOWN_ERROR", "ZĂˇpis zruĹˇenĂ˝.");
        }
        const item = writeQueueRef.current.shift()!;
        const opfsPath = gameFilePath(gameId, item.path);
        // KopĂ­rujeme dĂˇta do ÄŤistĂ©ho ArrayBufferu, aby sme vyhli TS problĂ©mom
        // s Uint8Array<ArrayBufferLike> v Blob konĹˇtruktore.
        const buffer = new ArrayBuffer(item.data.byteLength);
        new Uint8Array(buffer).set(item.data);
        const blob = new Blob([buffer]);
        const result = await streamBlobToOpfs(blob, opfsPath, (w) => {
          onProgress(written + w);
        }, signal);
        written += result.size;
        onProgress(written);
      }
    },
    []
  );

  /**
   * SpustĂ­ detection worker s reĂˇlnou detekciou (ETAPA 4).
   *
   * Posiela `DetectionInput` so vĹˇetkĂ˝mi dostupnĂ˝mi signĂˇlmi:
   *  - fileName + fileSize (vĹľdy)
   *  - siblingFiles (pre DOS launcher detekciu z ZIP)
   *  - cueContent (ak mainFile je .cue)
   *  - isoSystemIndicator (ak mĂˇme rozpoznanĂ˝ indikĂˇtor)
   */
  const runDetectionWorker = useCallback(
    async (input: DetectionInput): Promise<DetectionResult> => {
      return new Promise<DetectionResult>((resolve, reject) => {
        const worker = new Worker(
          new URL("../../workers/detection.worker.ts", import.meta.url),
          { type: "module" }
        );
        const id = uuid();
        worker.onmessage = (e: MessageEvent) => {
          const msg = e.data as { type: string; id: string; result?: DetectionResult; message?: string };
          if (msg.type === "done" && msg.id === id) {
            worker.terminate();
            if (msg.result) {
              resolve(msg.result);
            } else {
              reject(new Error("Detekcia zlyhala â€” prĂˇzdny vĂ˝sledok"));
            }
          } else if (msg.type === "error") {
            worker.terminate();
            reject(new Error(msg.message ?? "Detekcia zlyhala"));
          }
        };
        worker.onerror = (e) => {
          worker.terminate();
          reject(new Error(`Worker error: ${e.message}`));
        };
        // PoĹˇleme priamo DetectionRequest (worker oÄŤakĂˇva {id, input})
        worker.postMessage({
          id,
          input,
        });
      });
    },
    []
  );

  /**
   * Finalizuje import â€” uloĹľĂ­ GameRecord + GameFileRecords do IndexedDB.
   */
  const finalizeImport = useCallback(
    async (platform: EmulatorPlatform) => {
      if (!currentJob) return;
      const gameId = gameIdRef.current;
      const entries = extractedEntriesRef.current;
      const mainFile = mainFileRef.current || entries[0]?.path || "unknown";

      updateJob({
        status: "storing",
        currentStep: "Ukladanie metadĂˇt...",
      });

      // Pre voÄľnĂ© sĂşbory sme uĹľ streamovali â€” pre archĂ­vy sme streamovali poÄŤas extrakcie.
      // Tu len uloĹľĂ­me metadĂˇta.

      // VytvorĂ­me GameFileRecord pre kaĹľdĂ˝ extrahovanĂ˝ sĂşbor
      const fileRecords: GameFileRecord[] = entries
        .filter((e) => !e.isDirectory)
        .map((e) => {
          const ext = extname(e.path);
          return {
            id: uuid(),
            gameId,
            relativePath: e.path,
            opfsPath: gameFilePath(gameId, e.path),
            fileName: e.path.split("/").pop() ?? e.path,
            extension: ext,
            size: e.size,
          } satisfies GameFileRecord;
        });

      const totalSize = fileRecords.reduce((acc, f) => acc + f.size, 0);
      const fingerprint = fingerprintGame(
        fileRecords.map((f) => ({
          relativePath: f.relativePath,
          size: f.size,
          hash: f.hash,
        }))
      );

      const game: GameRecord = {
        id: gameId,
        name: deriveGameName(mainFile),
        platform,
        sourceType: currentJob.sourceType,
        mainFile,
        size: totalSize,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        totalPlayTimeSeconds: 0,
        isFavorite: false,
        compatibilityStatus: "unknown",
        emulatorVersion: "v0.1.0",
        fileFingerprint: fingerprint,
      };

      await putGame(game);
      await Promise.all(fileRecords.map((f) => putGameFile(f)));
      addGame(game);

      updateJob({
        status: "ready",
        currentStep: "Import dokonÄŤenĂ˝",
        gameId,
        processedFiles: fileRecords.length,
        fileCount: fileRecords.length,
      });

      toast({
        title: "Import dokonÄŤenĂ˝",
        description: `Hra "${game.name}" bola pridanĂˇ do kniĹľnice.`,
      });

      // Notifikuj parent komponent o ĂşspeĹˇnom importe
      onComplete?.(gameId);
    },
     
    [currentJob, updateJob, addGame, toast, onComplete]
  );

  /**
   * Handler pre klik na tlaÄŤidlo "PokraÄŤovaĹĄ" po uĹľĂ­vateÄľskej voÄľbe platformy.
   */
  const handleConfirmPlatform = useCallback(async () => {
    if (!selectedPlatform) return;
    try {
      await finalizeImport(selectedPlatform);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      updateJob({
        status: "error",
        currentStep: "Import zlyhal",
        error: message,
      });
    }
  }, [selectedPlatform, finalizeImport, updateJob]);

  /**
   * ZruĹˇenie importu.
   */
  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    if (workerRef.current) {
      const cancelReq: ArchiveWorkerRequest = { type: "cancel" };
      workerRef.current.postMessage(cancelReq);
    }
  }, []);

  /**
   * Reset wizardu â€” spĂ¤ĹĄ na zaÄŤiatok.
   */
  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    reset();
    setExtractedEntries([]);
    setDetectionResult(null);
    setSelectedPlatform(null);
    extractedEntriesRef.current = [];
    mainFileRef.current = "";
    writeQueueRef.current = [];
    writePromiseRef.current = null;
  }, [reset]);

  // === RENDER ===

  // PrĂˇvne potvrdenie pri prvom importe
  if (!legalConfirmed) {
    return (
      <LegalConfirmation
        checked={legalChecked}
        onChange={setLegalChecked}
        onConfirm={() => {
          setLegalConfirmed(true);
        }}
      />
    );
  }

  // Ak je job v programe (alebo dokonÄŤenĂ˝), ukĂˇĹľ progress
  if (currentJob && currentJob.status !== "idle" && currentJob.status !== "selecting") {
    // Ak ÄŤakĂˇ na vĂ˝ber platformy, ukĂˇĹľ vĂ˝ber
    if (currentJob.status === "awaiting-user-selection") {
      return (
        <PlatformSelection
          detection={detectionResult}
          selected={selectedPlatform}
          onSelect={setSelectedPlatform}
          onConfirm={handleConfirmPlatform}
          entries={extractedEntries}
          fileName={currentJob.fileName}
        />
      );
    }

    return (
      <div className="space-y-4">
        <ImportProgress
          job={currentJob}
          onCancel={handleCancel}
          onDismiss={
            currentJob.status === "ready" || currentJob.status === "error" || currentJob.status === "cancelled"
              ? handleReset
              : undefined
          }
        />
        {currentJob.status === "ready" && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
              <CheckCircle2 className="size-12 text-primary" aria-hidden="true" />
              <div>
                <p className="font-medium">Hra bola importovanĂˇ</p>
                <p className="text-sm text-muted-foreground">
                  {currentJob.fileName} â€” {currentJob.extractedBytes} bajtov
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="default" className="min-h-11" onClick={onOpenLibrary}>
                  <Package className="size-4" />
                  OtvoriĹĄ kniĹľnicu
                </Button>
                <Button variant="outline" onClick={handleReset} className="min-h-11">
                  <RotateCcw className="size-4" />
                  ImportovaĹĄ ÄŹalĹˇiu
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Default â€” DropZone
  return (
    <div className="space-y-4">
      <DropZone onFilesSelected={handleFilesSelected} />
      <Card>
        <CardContent className="p-4 text-xs text-muted-foreground">
          <p>
            <strong className="text-foreground">Tip:</strong> Pre DOS hry pouĹľite .jsdos
            balĂ­k alebo ZIP s START.BAT / GAME.EXE. Pre PS1 pouĹľite .cue + .bin alebo .iso.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Vyberie "main file" hry z extrahovanĂ˝ch zĂˇznamov.
 * Priorita: najvĂ¤ÄŤĹˇĂ­ sĂşbor s rozoznateÄľnou prĂ­ponou.
 */
function pickMainFile(entries: ArchiveEntry[]): string {
  const files = entries.filter(
    (e) => !e.isDirectory && e.size > 0 && extname(e.path).length > 0
  );
  if (files.length === 0) return entries[0]?.path ?? "unknown";
  files.sort((a, b) => b.size - a.size);
  return files[0].path;
}

/**
 * OdvodĂ­ nĂˇzov hry z nĂˇzvu sĂşboru (bez prĂ­pony).
 */
function deriveGameName(mainFile: string): string {
  const base = mainFile.split("/").pop() ?? mainFile;
  const idx = base.lastIndexOf(".");
  const name = idx === -1 ? base : base.slice(0, idx);
  // NahradĂ­me podÄŤiarkovnĂ­ky a pomlÄŤky medzerami
  return name.replace(/[_-]+/g, " ").trim() || base;
}

// === PODKOMPONENTY ===

function LegalConfirmation({
  checked,
  onChange,
  onConfirm,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="size-5 text-primary" aria-hidden="true" />
          PrĂˇvne potvrdenie
        </CardTitle>
        <CardDescription>
          Pred importom hier potvrÄŹte, Ĺľe mĂˇte prĂˇvo ich pouĹľĂ­vaĹĄ.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
          <p className="leading-relaxed">
            Potvrdzujem, Ĺľe nahrĂˇvam vlastnĂş legĂˇlne zĂ­skanĂş zĂˇloĹľnĂş kĂłpiu hry
            a mĂˇm prĂˇvo tento obsah pouĹľĂ­vaĹĄ. Jaňo še chce bavkac slĂşĹľi vĂ˝hradne na
            sprĂˇvu a prehrĂˇvanie vlastnĂ˝ch zĂˇloh â€” nesprĂ­stupĹuje, nedistribuuje
            ani neukladĂˇ hernĂ˝ obsah tretĂ­ch strĂˇn.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox
            id="legal-confirm"
            checked={checked}
            onCheckedChange={(v) => onChange(v === true)}
            className="mt-0.5"
          />
          <Label htmlFor="legal-confirm" className="text-sm leading-relaxed font-normal">
            ÄŚĂ­tal(a) som a sĂşhlasĂ­m s prĂˇvnym vyhlĂˇsenĂ­m vyĹˇĹˇie.
          </Label>
        </div>
        <Button
          onClick={onConfirm}
          disabled={!checked}
          className="w-full min-h-11"
        >
          PokraÄŤovaĹĄ
        </Button>
      </CardContent>
    </Card>
  );
}

function PlatformSelection({
  detection,
  selected,
  onSelect,
  onConfirm,
  entries,
  fileName,
}: {
  detection: DetectionResult | null;
  selected: EmulatorPlatform | null;
  onSelect: (p: EmulatorPlatform) => void;
  onConfirm: () => void;
  entries: ArchiveEntry[];
  fileName: string;
}) {
  const platforms: Array<{ value: EmulatorPlatform; label: string; desc: string }> = [
    { value: "dos", label: "DOS", desc: "js-dos (WASM)" },
    { value: "ps1", label: "PlayStation 1", desc: "PCSX-ReARMed" },
    {
      value: "ps2",
      label: "PlayStation 2",
      desc: "ExperimentĂˇlne (mĂ´Ĺľe byĹĄ vypnutĂ©)",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gamepad2 className="size-5 text-primary" aria-hidden="true" />
          VĂ˝ber platformy
        </CardTitle>
        <CardDescription>
          Nebolo moĹľnĂ© jednoznaÄŤne urÄŤiĹĄ platformu pre <strong>{fileName}</strong>.
          Vyberte platformu manuĂˇlne.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {detection && detection.reasons.length > 0 && (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
            <p className="mb-1 font-medium">DĂ´vody detekcie:</p>
            <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
              {detection.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        <RadioGroup
          value={selected ?? undefined}
          onValueChange={(v) => onSelect(v as EmulatorPlatform)}
        >
          {platforms.map((p) => (
            <div
              key={p.value}
              className="flex items-start gap-3 rounded-md border border-border p-3 has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/5"
            >
              <RadioGroupItem value={p.value} id={`platform-${p.value}`} className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor={`platform-${p.value}`} className="font-medium">
                  {p.label}
                </Label>
                <p className="text-xs text-muted-foreground">{p.desc}</p>
              </div>
            </div>
          ))}
        </RadioGroup>

        {entries.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              ExtrakovanĂ© sĂşbory ({entries.length}):
            </p>
            <div className="max-h-32 overflow-y-auto rounded-md border border-border bg-background/40 p-2 text-xs">
              <ul className="space-y-0.5">
                {entries.slice(0, 20).map((e, i) => (
                  <li key={i} className="truncate text-muted-foreground">
                    {e.isDirectory ? "đź“ " : "đź“„ "}
                    {e.path} {e.size > 0 && `(${(e.size / 1024).toFixed(0)} KB)`}
                  </li>
                ))}
                {entries.length > 20 && (
                  <li className="text-muted-foreground">...a ÄŹalĹˇĂ­ch {entries.length - 20}</li>
                )}
              </ul>
            </div>
          </div>
        )}

        <Button
          onClick={onConfirm}
          disabled={!selected}
          className="w-full min-h-11"
        >
          PotvrdiĹĄ a dokonÄŤiĹĄ import
        </Button>
      </CardContent>
    </Card>
  );
}
