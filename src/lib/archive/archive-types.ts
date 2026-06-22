/**
 * Typy pre archive layer.
 *
 * `ArchiveEntry` a `ArchiveSummary` sú definované v `src/types/detection.ts`
 * (zdieľané s detekčným podsvetím). Tu ich len re-exportujeme a pridávame
 * archive-špecifické doplnky — najmä označenie formátu a správy workerov.
 */
import type { ArchiveEntry, ArchiveSummary } from "@/types/detection";

export type { ArchiveEntry, ArchiveSummary };

/** Podporované archívne formáty v import pipeline. */
export type ArchiveFormat = "zip" | "rar" | "7z" | "tar" | "gz" | "unknown";

/** Rozšírený záznam archívu s metadatami o kompresii a formáte. */
export interface ArchiveEntryWithMeta extends ArchiveEntry {
  format: ArchiveFormat;
  /** True ak je záznam vnorený archív (zip/rar/7z/...). */
  isNestedArchive: boolean;
}

/** Výsledok detekcie formátu podľa magic bytes. */
export interface FormatDetectionResult {
  format: ArchiveFormat;
  /** Prvých N bajtov, ktoré sa použili na detekciu. */
  matchedSignature: string;
}

/**
 * Správy medzi hlavným vláknom a `archive.worker.ts`.
 * Worker komunikuje cez `postMessage` a prijíma `ArchiveWorkerRequest`.
 */
export type ArchiveWorkerRequest =
  | {
      type: "extract";
      format: ArchiveFormat;
      /** Buď File (ak je worker sprístupnený cez Blob URL) alebo ArrayBuffer. */
      payload: File | ArrayBuffer;
      fileName: string;
      password?: string;
    }
  | {
      type: "list";
      format: ArchiveFormat;
      payload: File | ArrayBuffer;
      fileName: string;
      password?: string;
    }
  | { type: "cancel" };

export type ArchiveWorkerResponse =
  | {
      type: "progress";
      processedBytes: number;
      totalBytes: number;
      processedFiles: number;
      totalFiles: number;
    }
  | { type: "warning"; path: string; reason: string }
  | { type: "entries"; entries: ArchiveEntry[] }
  | { type: "entry"; path: string; data: Uint8Array; size: number }
  | { type: "done"; entries: ArchiveEntry[]; totalBytes: number }
  | { type: "error"; code: string; message: string }
  | { type: "cancelled" };

/** Konfigurácia pre archive worker — limity a či prideľovať Blob URL. */
export interface ArchiveWorkerConfig {
  /** Max veľkosť súboru, ktorú worker prijme (kontrola proti preťaženiu pamäte). */
  maxInputBytes: number;
  /** Voliteľné heslo pre chránené archívy. */
  password?: string;
}

export const DEFAULT_ARCHIVE_WORKER_CONFIG: ArchiveWorkerConfig = {
  maxInputBytes: 8 * 1024 * 1024 * 1024, // 8 GB — je to v workery, nie v hlavnej pamäti
};
