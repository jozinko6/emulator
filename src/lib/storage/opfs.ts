/**
 * OPFS utilities — Origin Private File System.
 * Per prompt section 12 — large game files MUST go here, never as a single ArrayBuffer in RAM.
 *
 * Uses FileSystemSyncAccessHandle inside Web Workers for high-throughput writes,
 * and the async FileSystemFileHandle API on the main thread for smaller operations.
 */
import { normalizePath, joinPath } from "@/lib/security/path-normalizer";

/**
 * Rozšírenie `FileSystemDirectoryHandle` o iterátorové metódy, ktoré sú
 * podporované vo všetkých moderných prehliadačoch (Chrome 86+, Firefox 111+,
 * Safari 15.2+), ale chýbajú v TypeScript lib.dom.d.ts (5.9). Namiesto
 * `@ts-expect-error` / `as any` ich explicitne typujeme.
 */
interface IterableDirectoryHandle extends FileSystemDirectoryHandle {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  keys(): AsyncIterableIterator<string>;
  values(): AsyncIterableIterator<FileSystemHandle>;
}

/** Bezpečne pretypuje `FileSystemDirectoryHandle` na iterovateľný variant. */
function asIterable(dir: FileSystemDirectoryHandle): IterableDirectoryHandle {
  return dir as IterableDirectoryHandle;
}

const GAME_ROOT = "games";
const BIOS_ROOT = "bios";
const SAVES_ROOT = "saves";
const TEMP_ROOT = "tmp";

function isOPFSAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.storage &&
    typeof navigator.storage.getDirectory === "function"
  );
}

async function root(): Promise<FileSystemDirectoryHandle> {
  if (!isOPFSAvailable()) {
    throw new Error("OPFS is not available in this browser");
  }
  return navigator.storage.getDirectory();
}

async function ensureDir(path: string): Promise<FileSystemDirectoryHandle> {
  const parts = path.split("/").filter(Boolean);
  let dir = await root();
  for (const p of parts) {
    dir = await dir.getDirectoryHandle(p, { create: true });
  }
  return dir;
}

export async function ensureGameDir(gameId: string): Promise<FileSystemDirectoryHandle> {
  return ensureDir(joinPath(GAME_ROOT, gameId));
}

export async function ensureSavesDir(): Promise<FileSystemDirectoryHandle> {
  return ensureDir(SAVES_ROOT);
}

export async function ensureBiosDir(): Promise<FileSystemDirectoryHandle> {
  return ensureDir(BIOS_ROOT);
}

export async function ensureTempDir(): Promise<FileSystemDirectoryHandle> {
  return ensureDir(TEMP_ROOT);
}

/**
 * Write a stream of chunks to OPFS at the given path.
 * Returns the final file handle.
 */
export async function writeStream(
  path: string,
  stream: ReadableStream<Uint8Array>,
  onProgress?: (written: number) => void
): Promise<{ path: string; size: number }> {
  const normalized = normalizePath(path);
  const dirPart = normalized.includes("/")
    ? normalized.slice(0, normalized.lastIndexOf("/"))
    : "";
  const fileName = normalized.includes("/")
    ? normalized.slice(normalized.lastIndexOf("/") + 1)
    : normalized;

  const dir = dirPart ? await ensureDir(dirPart) : await root();
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  let total = 0;
  const reader = stream.getReader();
  try {
     
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        // Copy into a fresh ArrayBuffer to satisfy FileSystemWriteChunkType typing
        const buf = new ArrayBuffer(value.byteLength);
        new Uint8Array(buf).set(value);
        await writable.write(buf);
        total += value.byteLength;
        onProgress?.(total);
      }
    }
    await writable.close();
  } catch (e) {
    // Chyba počas zápisu — abortujeme writable (ak sa dá) a odstránime
    // čiastočne zapísaný súbor. Pôvodnú chybu potom znova vyhodíme.
    try {
      await writable.abort();
    } catch (abortErr) {
      // Ak zlyhá aj abort, len to zaznamenáme — pôvodná chyba má prioritu.
      console.warn("[opfs] writable.abort() zlyhal po chybe zápisu:", abortErr);
    }
    // Cleanup partial file
    try {
      await dir.removeEntry(fileName);
    } catch (removeErr) {
      // Ak zlyhá aj odstránenie (napr. súbor neexistuje), zaznamenáme.
      console.warn("[opfs] removeEntry() zlyhal po chybe zápisu:", removeErr);
    }
    throw e;
  }
  return { path: normalized, size: total };
}

/**
 * Read a slice from an OPFS file without loading the whole file into memory.
 */
export async function readSlice(
  path: string,
  start: number,
  end: number
): Promise<ArrayBuffer> {
  const normalized = normalizePath(path);
  const dirPart = normalized.includes("/")
    ? normalized.slice(0, normalized.lastIndexOf("/"))
    : "";
  const fileName = normalized.includes("/")
    ? normalized.slice(normalized.lastIndexOf("/") + 1)
    : normalized;

  const dir = dirPart ? await ensureDir(dirPart) : await root();
  const fileHandle = await dir.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  return file.slice(start, end).arrayBuffer();
}

/**
 * Read entire file as a File (used for streaming to emulator cores).
 */
export async function readFile(path: string): Promise<File> {
  const normalized = normalizePath(path);
  const dirPart = normalized.includes("/")
    ? normalized.slice(0, normalized.lastIndexOf("/"))
    : "";
  const fileName = normalized.includes("/")
    ? normalized.slice(normalized.lastIndexOf("/") + 1)
    : normalized;

  const dir = dirPart ? await ensureDir(dirPart) : await root();
  const fileHandle = await dir.getFileHandle(fileName);
  return fileHandle.getFile();
}

/**
 * Recursive delete — used for cleanup on import failure or game removal.
 */
export async function deleteRecursive(path: string): Promise<void> {
  const normalized = normalizePath(path);
  if (!normalized) return;
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) return;

  const last = parts[parts.length - 1];
  const parentParts = parts.slice(0, -1);
  let dir = await root();
  for (const p of parentParts) {
    dir = await dir.getDirectoryHandle(p);
  }
  try {
    await dir.removeEntry(last, { recursive: true });
  } catch (e) {
    // Väčšinou znamená, že záznam už neexistuje — to je v poriadku pre
    // cleanup operáciu. Iné chyby len zaznamenáme, aby sme nevymazali
    // kontext pôvodnej operácie (napr. import rollback).
    if (e instanceof DOMException && e.name === "NotFoundError") {
      // cieľ už neexistuje — žiadna akcia
      return;
    }
    console.warn(`[opfs] deleteRecursive: removeEntry("${last}") zlyhal:`, e);
  }
}

export async function listDirectory(path: string): Promise<string[]> {
  const normalized = normalizePath(path);
  const dir = normalized ? await ensureDir(normalized) : await root();
  const names: string[] = [];
  for await (const [name] of asIterable(dir).entries()) {
    names.push(name);
  }
  return names;
}

export async function calculateDirectorySize(path: string): Promise<number> {
  const normalized = normalizePath(path);
  if (!normalized) return 0;
  const dir = await ensureDir(normalized);
  let total = 0;
  for await (const entry of asIterable(dir).values()) {
    if (entry.kind === "file") {
      // Po kontrole `kind` je bezpečné pretypovať na `FileSystemFileHandle`.
      const fileHandle = entry as FileSystemFileHandle;
      const f = await fileHandle.getFile();
      total += f.size;
    } else if (entry.kind === "directory") {
      total += await calculateDirectorySize(joinPath(normalized, entry.name));
    }
  }
  return total;
}

/**
 * Rollback a partial import by removing everything written so far.
 */
export async function cleanupPartialImport(gameId: string): Promise<void> {
  await deleteRecursive(joinPath(GAME_ROOT, gameId));
  // Also clean any temp dirs for this import
  await deleteRecursive(joinPath(TEMP_ROOT, gameId));
}

/**
 * Get the canonical OPFS path for a game file.
 */
export function gameFilePath(gameId: string, relativePath: string): string {
  return joinPath(GAME_ROOT, gameId, normalizePath(relativePath));
}

export function biosPath(platform: string, fileName: string): string {
  return joinPath(BIOS_ROOT, platform, fileName);
}

export function saveStatePath(gameId: string, slot: number): string {
  return joinPath(SAVES_ROOT, gameId, `slot-${slot}.sav`);
}

export function screenshotPath(gameId: string, slot: number): string {
  return joinPath(SAVES_ROOT, gameId, `slot-${slot}.png`);
}

/**
 * Estimate available storage quota.
 */
export async function getStorageEstimate(): Promise<{
  quota: number;
  usage: number;
  available: number;
}> {
  if (!navigator.storage?.estimate) {
    return { quota: 0, usage: 0, available: 0 };
  }
  const est = await navigator.storage.estimate();
  const quota = est.quota ?? 0;
  const usage = est.usage ?? 0;
  return { quota, usage, available: Math.max(0, quota - usage) };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
