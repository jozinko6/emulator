"use client";

/**
 * ImportWizard — hlavný stavový automat pre import hier.
 *
 * Per prompt sekcia ETAPA 3. Stavy:
 *   idle → selecting → reading → validating → extracting → detecting
 *        → awaiting-user-selection (ak requiresUserSelection)
 *        → storing → ready / error / cancelled
 *
 * Používa `useImportStore` zo `src/stores/import-store.ts`.
 * Pri prvom importe zobrazuje právne potvrdenie.
 *
 * Komentáre v slovenčine.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Gamepad2,
  Loader2,
  Package,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
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
import { gameFilePath, cleanupPartialImport, readFile } from "@/lib/storage/opfs";
import { putGame, putGameFile } from "@/lib/storage/repositories";
import { fingerprintGame } from "@/lib/security/hashing";
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

/** Vytvorí nový ImportJobRecord. */
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
    currentStep: "Pripravený na spracovanie",
    warnings: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function ImportWizard() {
  const {
    currentJob,
    setJob,
    updateJob,
    finalizeJob,
    legalConfirmed,
    setLegalConfirmed,
    reset,
  } = useImportStore();
  const addGame = useLibraryStore((s) => s.addGame);
  const { toast } = useToast();

  // Lokálny stav
  const [legalChecked, setLegalChecked] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<EmulatorPlatform | null>(null);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [extractedEntries, setExtractedEntries] = useState<ArchiveEntry[]>([]);

  // Refy pre async operácie
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

  /**
   * Začne import — volá sa z DropZone po výbere súborov.
   * Spracuje len prvý súbor (ostatné preskočí s upozornením).
   */
  const handleFilesSelected = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      if (!legalConfirmed) return;

      const file = files[0];
      const fmt = detectFormat(file.name);
      if (!isSupported(fmt)) {
        toast({
          title: "Nepodporovaný súbor",
          description: `Súbor ${file.name} nie je podporovaného formátu.`,
          variant: "destructive",
        });
        return;
      }

      if (files.length > 1) {
        toast({
          title: "Viac súborov",
          description: `Bude sa importovať iba ${file.name}. Ostatné presuňte neskôr.`,
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
   * Hlavná pipeline — spúšťa jednotlivé fázy importu.
   * Je izolovaná do jednej async funkcie kvôli čitateľnosti.
   */
  const runPipeline = useCallback(
    async (file: File, format: ImportableFormat, initialJob: ImportJobRecord) => {
      const jobId = initialJob.id;
      const gameId = uuid();
      gameIdRef.current = gameId;
      const abort = new AbortController();
      abortRef.current = abort;

      try {
        // === READING ===
        updateJob({ status: "reading", currentStep: "Čítanie súboru..." });

        // Pre archívy potrebujeme načítať dáta (pre ZIP) alebo File (pre RAR/7z)
        // Streamer sa postará o OPFS neskôr.
        let entries: ArchiveEntry[] = [];

        if (isArchive(format)) {
          // === VALIDATING ===
          updateJob({ status: "validating", currentStep: "Validácia archívu..." });

          // Pre ZIP potrebujeme Uint8Array — ak je súbor veľký, varujeme.
          // Pre RAR/7z pošleme File priamo do workera.
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

          // Skontrolujeme bezpečnosť archívu
          const summary = summarizeArchive(entries);
          const validation = validateSummary(summary, DEFAULT_ARCHIVE_LIMITS);
          if (!validation.ok) {
            // Pridáme varovania do job-u
            updateJob({ warnings: [...(currentJob?.warnings ?? []), ...validation.reasons] });
            // Ak je to archívna bomba alebo path traversal, zastavíme
            const critical = validation.reasons.some(
              (r) => r.includes("archívnu bombu") || r.includes("path traversal")
            );
            if (critical) {
              throw new RetroCloudError(
                "ARCHIVE_BOMB_DETECTED",
                "Archív bol zamietnutý z bezpečnostných dôvodov."
              );
            }
          }

          // Skontrolujeme nebezpečné cesty
          const unsafePaths = checkEntriesForUnsafePaths(entries);
          if (unsafePaths.length > 0) {
            updateJob({
              warnings: [
                ...(currentJob?.warnings ?? []),
                ...unsafePaths.slice(0, 50).map((p) => `Nebezpečná cesta: ${p}`),
              ],
            });
            // Filtrujeme von nebezpečné cesty — používateľovi už boli
            // ohlásené v `unsafePaths` zozname, takže ich len ticho vynecháme.
            entries = entries.filter((e) => {
              try {
                normalizePath(e.path);
                return true;
              } catch (err) {
                // Nebezpečná cesta — už zaradená v warnings, preskakujeme.
                console.debug("[import] vynechávam nebezpečnú cestu:", e.path, err);
                return false;
              }
            });
          }

          // === EXTRACTING (streaming do OPFS) ===
          updateJob({
            status: "extracting",
            currentStep: "Rozbaľovanie archívu a zápis do OPFS...",
            fileCount: summary.totalFiles,
            totalBytes: summary.totalUncompressedSize,
          });

          // Worker už rozbalil a poslal entries — writes už prebehli v runArchiveWorker.
          extractedEntriesRef.current = entries;
          setExtractedEntries(entries);
        } else {
          // Voľný súbor — žiadny archív na rozbalenie
          updateJob({
            status: "validating",
            currentStep: "Kontrola súboru...",
            fileCount: 1,
            totalBytes: file.size,
          });

          if (isStreamRequired(file.size)) {
            // Veľký súbor — streamujeme priamo v "storing" fáze
            updateJob({
              warnings: [
                ...(currentJob?.warnings ?? []),
                `Súbor je väčší ako 256 MB (${(file.size / 1024 / 1024).toFixed(0)} MB) — bude sa streamovať.`,
              ],
            });
          }

          // Vytvoríme "pseudo-entry" pre detekciu
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
            currentStep: "Zápis súboru do OPFS...",
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

        // Pre CUE súbory — prečítaj obsah z OPFS
        let cueContent: string | undefined;
        if (mainFile.toLowerCase().endsWith(".cue")) {
          try {
            const file = await readFile(gameFilePath(gameId, mainFile));
            cueContent = await file.text();
          } catch (err) {
            console.warn("[import] nepodarilo sa prečítať CUE obsah:", err);
          }
        }

        // Pre nezákladné súbory — prečítaj hlavičku (prvých ~33 KB pre ISO detekciu)
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
            // Pre ostatné formáty stačí 8 bajtov
            const headerSize = mainFileLower.endsWith(".iso") ? 33_800 : 16;
            const buf = await file.slice(0, Math.min(headerSize, file.size)).arrayBuffer();
            fileHeader = new Uint8Array(buf);
          } catch (err) {
            console.warn("[import] nepodarilo sa prečítať hlavičku súboru:", err);
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

        // === AWAITING USER SELECTION (ak potrebné) ===
        if (detection.requiresUserSelection || !detection.platform) {
          updateJob({
            status: "awaiting-user-selection",
            currentStep: "Vyberte platformu hry",
          });
          // Tu sa pipeline pozastaví — pokračuje sa až po kliknutí na tlačidlo
          return;
        }

        // Pokračujeme priamo na finalization
        await finalizeImport(detection.platform);

         
      } catch (e: unknown) {
        if (abort.signal.aborted) {
          updateJob({
            status: "cancelled",
            currentStep: "Import bol zrušený",
          });
          // Cleanup OPFS
          await cleanupPartialImport(gameId).catch((cleanupErr: unknown) => {
            console.warn("[import] cleanupPartialImport po zrušení zlyhal:", cleanupErr);
          });
          return;
        }
        const message = e instanceof Error ? e.message : String(e);
        const code = e instanceof RetroCloudError ? e.code : "UNKNOWN_ERROR";
        updateJob({
          status: "error",
          currentStep: "Import zlyhal",
          error: `${message}${code !== "UNKNOWN_ERROR" ? ` (kód: ${code})` : ""}`,
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
   * Spustí archive worker pre rozbalenie archívu.
   * Vráti zoznam extrahovaných záznamov a súčasne streamuje dáta do OPFS.
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
        let processedFiles = 0;
        let processedBytes = 0;
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
              const warning = `${msg.path} — ${msg.reason}`;
              updateJob({
                warnings: [...(useImportStore.getState().currentJob?.warnings ?? []), warning],
              });
              break;
            }
            case "entry": {
              // Pridáme do fronty na OPFS zápis
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
              processedFiles += 1;
              processedBytes += msg.size;
              // Spustíme flush ak nie je aktívny
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
              // Počkáme na vyprázdnenie write fronty
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
              finish(new RetroCloudError("UNKNOWN_ERROR", "Rozbaľovanie zrušené."));
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
              // Ignorujeme — používame entry správy
              break;
            default:
              // Neznáma správa — ignorujeme
              break;
          }
        };

        // Pošleme extract požiadavku
        const request: ArchiveWorkerRequest = {
          type: "extract",
          format,
          payload,
          fileName,
        };
        // Pre ArrayBuffer použijeme transfer list
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
   * Postupne zapíše frontu extrahovaných záznamov do OPFS.
   * Sériovo — aby sme nezaťažili OPFS paralelnými zápismi.
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
          throw new RetroCloudError("UNKNOWN_ERROR", "Zápis zrušený.");
        }
        const item = writeQueueRef.current.shift()!;
        const opfsPath = gameFilePath(gameId, item.path);
        // Kopírujeme dáta do čistého ArrayBufferu, aby sme vyhli TS problémom
        // s Uint8Array<ArrayBufferLike> v Blob konštruktore.
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
   * Spustí detection worker s reálnou detekciou (ETAPA 4).
   *
   * Posiela `DetectionInput` so všetkými dostupnými signálmi:
   *  - fileName + fileSize (vždy)
   *  - siblingFiles (pre DOS launcher detekciu z ZIP)
   *  - cueContent (ak mainFile je .cue)
   *  - isoSystemIndicator (ak máme rozpoznaný indikátor)
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
              reject(new Error("Detekcia zlyhala — prázdny výsledok"));
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
        // Pošleme priamo DetectionRequest (worker očakáva {id, input})
        worker.postMessage({
          id,
          input,
        });
      });
    },
    []
  );

  /**
   * Finalizuje import — uloží GameRecord + GameFileRecords do IndexedDB.
   */
  const finalizeImport = useCallback(
    async (platform: EmulatorPlatform) => {
      if (!currentJob) return;
      const gameId = gameIdRef.current;
      const entries = extractedEntriesRef.current;
      const mainFile = mainFileRef.current || entries[0]?.path || "unknown";

      updateJob({
        status: "storing",
        currentStep: "Ukladanie metadát...",
      });

      // Pre voľné súbory sme už streamovali — pre archívy sme streamovali počas extrakcie.
      // Tu len uložíme metadáta.

      // Vytvoríme GameFileRecord pre každý extrahovaný súbor
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
        currentStep: "Import dokončený",
        gameId,
        processedFiles: fileRecords.length,
        fileCount: fileRecords.length,
      });

      toast({
        title: "Import dokončený",
        description: `Hra "${game.name}" bola pridaná do knižnice.`,
      });
    },
     
    [currentJob, updateJob, addGame, toast]
  );

  /**
   * Handler pre klik na tlačidlo "Pokračovať" po užívateľskej voľbe platformy.
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
   * Zrušenie importu.
   */
  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    if (workerRef.current) {
      const cancelReq: ArchiveWorkerRequest = { type: "cancel" };
      workerRef.current.postMessage(cancelReq);
    }
  }, []);

  /**
   * Reset wizardu — späť na začiatok.
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

  // Právne potvrdenie pri prvom importe
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

  // Ak je job v programe (alebo dokončený), ukáž progress
  if (currentJob && currentJob.status !== "idle" && currentJob.status !== "selecting") {
    // Ak čaká na výber platformy, ukáž výber
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
                <p className="font-medium">Hra bola importovaná</p>
                <p className="text-sm text-muted-foreground">
                  {currentJob.fileName} — {currentJob.extractedBytes} bajtov
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild variant="default" className="min-h-11">
                  <Link href="/library">
                    <Package className="size-4" />
                    Otvoriť knižnicu
                  </Link>
                </Button>
                <Button variant="outline" onClick={handleReset} className="min-h-11">
                  <RotateCcw className="size-4" />
                  Importovať ďalšiu
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Default — DropZone
  return (
    <div className="space-y-4">
      <DropZone onFilesSelected={handleFilesSelected} />
      <Card>
        <CardContent className="p-4 text-xs text-muted-foreground">
          <p>
            <strong className="text-foreground">Tip:</strong> Pre DOS hry použite .jsdos
            balík alebo ZIP s START.BAT / GAME.EXE. Pre PS1 použite .cue + .bin alebo .iso.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Vyberie "main file" hry z extrahovaných záznamov.
 * Priorita: najväčší súbor s rozoznateľnou príponou.
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
 * Odvodí názov hry z názvu súboru (bez prípony).
 */
function deriveGameName(mainFile: string): string {
  const base = mainFile.split("/").pop() ?? mainFile;
  const idx = base.lastIndexOf(".");
  const name = idx === -1 ? base : base.slice(0, idx);
  // Nahradíme podčiarkovníky a pomlčky medzerami
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
          Právne potvrdenie
        </CardTitle>
        <CardDescription>
          Pred importom hier potvrďte, že máte právo ich používať.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
          <p className="leading-relaxed">
            Potvrdzujem, že nahrávam vlastnú legálne získanú záložnú kópiu hry
            a mám právo tento obsah používať. RETROCLOUD slúži výhradne na
            správu a prehrávanie vlastných záloh — nesprístupňuje, nedistribuuje
            ani neukladá herný obsah tretích strán.
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
            Čítal(a) som a súhlasím s právnym vyhlásením vyššie.
          </Label>
        </div>
        <Button
          onClick={onConfirm}
          disabled={!checked}
          className="w-full min-h-11"
        >
          Pokračovať
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
      desc: "Experimentálne (môže byť vypnuté)",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gamepad2 className="size-5 text-primary" aria-hidden="true" />
          Výber platformy
        </CardTitle>
        <CardDescription>
          Nebolo možné jednoznačne určiť platformu pre <strong>{fileName}</strong>.
          Vyberte platformu manuálne.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {detection && detection.reasons.length > 0 && (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
            <p className="mb-1 font-medium">Dôvody detekcie:</p>
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
              Extrakované súbory ({entries.length}):
            </p>
            <div className="max-h-32 overflow-y-auto rounded-md border border-border bg-background/40 p-2 text-xs">
              <ul className="space-y-0.5">
                {entries.slice(0, 20).map((e, i) => (
                  <li key={i} className="truncate text-muted-foreground">
                    {e.isDirectory ? "📁 " : "📄 "}
                    {e.path} {e.size > 0 && `(${(e.size / 1024).toFixed(0)} KB)`}
                  </li>
                ))}
                {entries.length > 20 && (
                  <li className="text-muted-foreground">...a ďalších {entries.length - 20}</li>
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
          Potvrdiť a dokončiť import
        </Button>
      </CardContent>
    </Card>
  );
}
