/**
 * Wrapper nad `fflate` pre rozbaľovanie ZIP archívov.
 *
 * Per prompt sekcia 11/12 — ťažké operácie (rozbaľovanie) NESMÚ bežať
 * na hlavnom vlákne. Tento modul je navrhnutý tak, aby ho mohol volať
 * worker (`archive.worker.ts`). Na hlavnom vlákne sa nesmie volať rozbaľovanie
 * pre súbory väčšie ako ~10 MB — to sa kontroluje tu.
 *
 * Komentáre v slovenčine.
 */
import { unzip, type Unzipped } from "fflate";
import type { ArchiveEntry } from "@/types/detection";
import { RetroCloudError } from "@/types/errors";

/** Veľkosť, nad ktorú odporúčame volanie z workera, nie z hlavného vlákna. */
export const MAX_MAIN_THREAD_ZIP_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Detekcia, či sa dá na hlavnom vlákne bezpečne rozbaľovať.
 * UI by nemalo volať `listZipEntries` / `extractZipEntries` pre väčšie
 * súbory — nech je to vo workery.
 */
export function isSafeForMainThread(byteLength: number): boolean {
  return byteLength <= MAX_MAIN_THREAD_ZIP_BYTES;
}

/**
 * Detekcia kontextu — v workery `window` neexistuje, takže kontrolu
 * veľkosti preskakujeme (worker môže spracovávať súbory ľubovoľnej
 * veľkosti, pretože beží na samostatnom vlákne a neblokuje UI).
 */
function isMainThread(): boolean {
  return typeof window !== "undefined";
}

/**
 * Rozbalí ZIP archív do objektu `{ [cesta]: Uint8Array }`.
 * Interná pomocná funkcia — wrapuje fflate callback do Promise.
 */
function unzipAsync(data: Uint8Array, signal?: AbortSignal): Promise<Unzipped> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new RetroCloudError("UNKNOWN_ERROR", "Rozbaľovanie zrušené pred štartom."));
      return;
    }
    unzip(data, (err, result) => {
      if (err) {
        reject(
          new RetroCloudError(
            "CORRUPTED_ARCHIVE",
            `Nepodarilo sa rozbaliť ZIP: ${err.message}`,
            { cause: err, technicalDetail: `code=${err.code}` }
          )
        );
        return;
      }
      resolve(result);
    });
  });
}

/**
 * Vypíše zoznam záznamov ZIP archívu.
 *
 * Interné: fflate nemá "list-only" API, takže archív musí byť rozbalený.
 * Pre efektívnosť sa tu používa async `unzip` (nie `unzipSync`), ktorá
 * neblokuje event loop. Pri väčších súboroch volajte z workera.
 *
 * @throws RetroCloudError ak je súbor väčší ako MAX_MAIN_THREAD_ZIP_BYTES
 *   pri volaní z hlavného vlákna, alebo ak je archív poškodený / zašifrovaný.
 */
export async function listZipEntries(data: Uint8Array): Promise<ArchiveEntry[]> {
  if (isMainThread() && !isSafeForMainThread(data.byteLength)) {
    throw new RetroCloudError(
      "INSUFFICIENT_MEMORY",
      `ZIP (${data.byteLength} B) je príliš veľký pre hlavné vlákno — použite worker.`,
      { technicalDetail: `byteLength=${data.byteLength}` }
    );
  }
  const unzipped = await unzipAsync(data);
  const entries: ArchiveEntry[] = [];
  for (const [path, fileData] of Object.entries(unzipped)) {
    const isDirectory = path.endsWith("/");
    entries.push({
      path,
      size: isDirectory ? 0 : fileData.byteLength,
      isDirectory,
      // fflate neposkytuje kompresnú veľkosť v Unzipped — neznáma
      compressedSize: undefined,
    });
  }
  return entries;
}

/**
 * Rozbalí ZIP archív a pre každý súbor zavolá `onEntry`.
 *
 * Podporuje zrušenie cez `AbortSignal`. Po zrušení sa ďalšie súbory
 * nespracujú a funkcia vyhodí `RetroCloudError` so správou o zrušení.
 *
 * Pri veľkých archívoch sa odporúča volať z workera (`archive.worker.ts`).
 *
 * @throws RetroCloudError ak je súbor väčší ako MAX_MAIN_THREAD_ZIP_BYTES
 *   pri volaní z hlavného vlákna.
 */
export async function extractZipEntries(
  data: Uint8Array,
  onEntry: (path: string, fileData: Uint8Array) => Promise<void>,
  signal?: AbortSignal
): Promise<void> {
  if (isMainThread() && !isSafeForMainThread(data.byteLength)) {
    throw new RetroCloudError(
      "INSUFFICIENT_MEMORY",
      `ZIP (${data.byteLength} B) je príliš veľký pre hlavné vlákno — použite worker.`,
      { technicalDetail: `byteLength=${data.byteLength}` }
    );
  }
  const unzipped = await unzipAsync(data, signal);

  for (const [path, fileData] of Object.entries(unzipped)) {
    if (signal?.aborted) {
      throw new RetroCloudError("UNKNOWN_ERROR", "Rozbaľovanie zrušené používateľom.");
    }
    if (path.endsWith("/")) {
      // adresáre preskakujeme — OPFS vrstva ich vytvorí pri zápise súboru
      continue;
    }
    await onEntry(path, fileData);
  }
}
