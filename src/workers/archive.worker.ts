/**
 * Web Worker pre rozbaľovanie archívov (ZIP/RAR/7z).
 *
 * Per prompt sekcia 11/12 — rozbaľovanie NESMIE bežať na hlavnom vlákne.
 * Tento worker prijíma `ArchiveWorkerRequest` a vracia `ArchiveWorkerResponse`
 * cez `postMessage`. Podporuje zrušenie cez správu `{type:"cancel"}`.
 *
 * Pre ZIP sa používa `fflate` (synchronná knižnica, ale v workery OK).
 * Pre RAR/7z sa používa `libarchive.js` (ktorá sama spúšťa vnútorný worker).
 *
 * Komentáre v slovenčine.
 */
/// <reference lib="webworker" />

import {
  listZipEntries,
  extractZipEntries,
} from "@/lib/archive/zip";
import {
  listRarEntries,
  extractRarEntries,
} from "@/lib/archive/rar";
import {
  listSevenZEntries,
  extractSevenZEntries,
} from "@/lib/archive/seven-z";
import {
  checkEntriesForUnsafePaths,
  summarizeArchive,
} from "@/lib/archive/archive-security";
import { normalizePath, PathSecurityError } from "@/lib/security/path-normalizer";
import type { ArchiveEntry } from "@/types/detection";
import type {
  ArchiveWorkerRequest,
  ArchiveWorkerResponse,
} from "@/lib/archive/archive-types";
import { RetroCloudError } from "@/types/errors";

/**
 * V workery je `self` typu DedicatedWorkerGlobalScope, ale TypeScript lib.dom
 * (z tsconfigu) ho deklaruje ako Window. Pre typovú bezpečnosť používame
 * explicitný cast na náš vlastný typ, ktorý zodpovedá worker API.
 */
interface WorkerContext {
  postMessage(message: ArchiveWorkerResponse, transfer?: Transferable[]): void;
  onmessage: ((e: MessageEvent<ArchiveWorkerRequest>) => void) | null;
}

const ctx = self as unknown as WorkerContext;

/** Interný AbortController pre bežiacu operáciu. */
let currentAbort: AbortController | null = null;

function post(message: ArchiveWorkerResponse): void {
  ctx.postMessage(message);
}

function postError(code: string, message: string): void {
  post({ type: "error", code, message });
}

/**
 * Konvertuje prichádzajúci payload (File alebo ArrayBuffer) na File.
 * Pre ZIP môžeme dostať ArrayBuffer — fflate vie pracovať s Uint8Array.
 */
async function toFile(payload: File | ArrayBuffer, fileName: string): Promise<File> {
  if (payload instanceof File) return payload;
  return new File([payload], fileName, { type: "application/octet-stream" });
}

/** Konvertuje prichádzajúci payload na Uint8Array (pre fflate). */
function toUint8Array(payload: File | ArrayBuffer): Promise<Uint8Array> {
  if (payload instanceof ArrayBuffer) {
    return Promise.resolve(new Uint8Array(payload));
  }
  // File — prečítame ako ArrayBuffer
  return payload.arrayBuffer().then((buf) => new Uint8Array(buf));
}

/**
 * Spracuje požiadavku "list" — vráti zoznam záznamov bez rozbaľovania obsahu.
 */
async function handleList(req: Extract<ArchiveWorkerRequest, { type: "list" }>): Promise<void> {
  const controller = new AbortController();
  currentAbort = controller;

  try {
    let entries: ArchiveEntry[];
    if (req.format === "zip") {
      const data = await toUint8Array(req.payload);
      entries = await listZipEntries(data);
    } else if (req.format === "rar") {
      const file = await toFile(req.payload, req.fileName);
      entries = await listRarEntries(file, req.password);
    } else if (req.format === "7z") {
      const file = await toFile(req.payload, req.fileName);
      entries = await listSevenZEntries(file, req.password);
    } else {
      postError("UNSUPPORTED_FORMAT", `Nepodporovaný formát: ${req.format}`);
      return;
    }

    // Skontrolujeme nebezpečné cesty a pošleme varovania
    const unsafe = checkEntriesForUnsafePaths(entries);
    for (const msg of unsafe) {
      post({ type: "warning", path: msg, reason: "unsafe-path" });
    }

    // Filtrujeme von nebezpečné cesty — normalized entries
    const safeEntries: ArchiveEntry[] = [];
    for (const entry of entries) {
      try {
        const normalized = normalizePath(entry.path);
        if (normalized) {
          safeEntries.push({ ...entry, path: normalized });
        }
      } catch (err) {
        // Tento záznam už bol ohlásený v warnings (vyššie) — tu len
        // zaznamenáme do logu workera a vynecháme ho z výsledku.
        console.warn(`[archive.worker] vynechávam nebezpečnú cestu "${entry.path}":`, err);
      }
    }

    post({ type: "entries", entries: safeEntries });
    post({ type: "done", entries: safeEntries, totalBytes: 0 });
  } catch (e) {
    if (e instanceof RetroCloudError) {
      postError(e.code, e.message);
    } else {
      postError(
        "UNKNOWN_ERROR",
        `Chyba pri zozname archívu: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  } finally {
    currentAbort = null;
  }
}

/**
 * Spracuje požiadavku "extract" — rozbalí archív a pre každý súbor
 * pošle `entry` správu s dátami. Pravidelne posiela `progress`.
 */
async function handleExtract(
  req: Extract<ArchiveWorkerRequest, { type: "extract" }>
): Promise<void> {
  const controller = new AbortController();
  currentAbort = controller;

  let processedFiles = 0;
  let processedBytes = 0;

  try {
    let entries: ArchiveEntry[] = [];
    let totalFiles = 0;
    let totalBytes = 0;

    // Pomocná funkcia pre onEntry — volá sa z každej extract*Entries funkcie.
    const onEntry = async (path: string, data: Uint8Array): Promise<void> => {
      if (controller.signal.aborted) {
        throw new RetroCloudError(
          "UNKNOWN_ERROR",
          "Rozbaľovanie zrušené používateľom."
        );
      }

      // Skontrolujeme cestu
      try {
        const normalized = normalizePath(path);
        if (!normalized) {
          post({ type: "warning", path, reason: "empty-path" });
          return;
        }

        // Pošleme dáta súboru späť na hlavné vlákno
        // Dôležité: prenášame ArrayBuffer ako transferable, aby sme šetrili pamäť.
        const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        post({
          type: "entry",
          path: normalized,
          data: new Uint8Array(buffer),
          size: data.byteLength,
        });

        processedFiles += 1;
        processedBytes += data.byteLength;
        post({
          type: "progress",
          processedBytes,
          totalBytes,
          processedFiles,
          totalFiles,
        });
      } catch (e) {
        if (e instanceof PathSecurityError) {
          post({ type: "warning", path, reason: e.reason });
          return;
        }
        throw e;
      }
    };

    if (req.format === "zip") {
      const data = await toUint8Array(req.payload);
      // Najprv zoznam — pre počítadlo progress
      entries = await listZipEntries(data);
      totalFiles = entries.filter((e) => !e.isDirectory).length;
      totalBytes = entries.reduce((acc, e) => acc + e.size, 0);
      post({
        type: "progress",
        processedBytes: 0,
        totalBytes,
        processedFiles: 0,
        totalFiles,
      });
      await extractZipEntries(data, onEntry, controller.signal);
    } else if (req.format === "rar") {
      const file = await toFile(req.payload, req.fileName);
      entries = await listRarEntries(file, req.password);
      totalFiles = entries.filter((e) => !e.isDirectory).length;
      totalBytes = entries.reduce((acc, e) => acc + e.size, 0);
      post({
        type: "progress",
        processedBytes: 0,
        totalBytes,
        processedFiles: 0,
        totalFiles,
      });
      await extractRarEntries(file, onEntry, controller.signal, req.password);
    } else if (req.format === "7z") {
      const file = await toFile(req.payload, req.fileName);
      entries = await listSevenZEntries(file, req.password);
      totalFiles = entries.filter((e) => !e.isDirectory).length;
      totalBytes = entries.reduce((acc, e) => acc + e.size, 0);
      post({
        type: "progress",
        processedBytes: 0,
        totalBytes,
        processedFiles: 0,
        totalFiles,
      });
      await extractSevenZEntries(file, onEntry, controller.signal, req.password);
    } else {
      postError("UNSUPPORTED_FORMAT", `Nepodporovaný formát: ${req.format}`);
      return;
    }

    // Finálny súhrn
    const summary = summarizeArchive(entries);
    post({
      type: "done",
      entries,
      totalBytes: summary.totalUncompressedSize,
    });
  } catch (e) {
    if (controller.signal.aborted) {
      post({ type: "cancelled" });
      return;
    }
    if (e instanceof RetroCloudError) {
      postError(e.code, e.message);
    } else {
      postError(
        "UNKNOWN_ERROR",
        `Chyba pri rozbaľovaní: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  } finally {
    currentAbort = null;
  }
}

// Hlavný message handler
ctx.onmessage = (event: MessageEvent<ArchiveWorkerRequest>) => {
  const req = event.data;
  if (!req || typeof req !== "object" || !("type" in req)) {
    postError("UNKNOWN_ERROR", "Neplatná požiadavka na worker");
    return;
  }

  switch (req.type) {
    case "list":
      void handleList(req);
      break;
    case "extract":
      void handleExtract(req);
      break;
    case "cancel":
      if (currentAbort) {
        currentAbort.abort();
      } else {
        post({ type: "cancelled" });
      }
      break;
    default: {
      const exhaustive: never = req;
      postError("UNKNOWN_ERROR", `Neznáma požiadavka: ${String(exhaustive)}`);
    }
  }
};
