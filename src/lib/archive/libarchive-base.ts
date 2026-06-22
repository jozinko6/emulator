/**
 * Wrapper nad `libarchive.js` — spoločná implementácia pre RAR a 7z.
 *
 * libarchive.js je port libarchive do WebAssembly a beží v samostatnom workery,
 * ktorý knižnica vytvorí sama. Pre správnu inicializáciu je potrebné zavolať
 * `initLibarchive()` aspoň raz pred použitím.
 *
 * Knižnica očakáva, že worker bundle (`worker-bundle.js`) a `libarchive.wasm`
 * sú prístupné z `/libarchive/`. Tieto súbory sa nakopírujú do `public/libarchive/`
 * pri nasadení (out of scope tohto tasku — odporúčame importovať cez CDN alebo
 * skopírovať ručne).
 *
 * Komentáre v slovenčine.
 */
import { Archive } from "libarchive.js";
import type { ArchiveEntry } from "@/types/detection";
import { RetroCloudError } from "@/types/errors";

/** Typ ArchiveReader — knižnica ho neexportuje, takže ho odvodzujeme z Archive.open(). */
type ArchiveReader = Awaited<ReturnType<typeof Archive.open>>;

let initPromise: Promise<void> | null = null;

/**
 * Inicializuje libarchive.js s cestou k worker bundle.
 *
 * Bezpečné volať opakovane — inicializácia sa zabezpečí len raz.
 * Ak inicializácia zlyhá, ďalší pokus sa opakuje (premenná sa resetne).
 */
export async function initLibarchive(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      Archive.init({
        workerUrl: "/libarchive/worker-bundle.js",
      });
    } catch (e) {
      initPromise = null;
      throw new RetroCloudError(
        "UNKNOWN_ERROR",
        "Nepodarilo sa inicializovať libarchive.js",
        { cause: e }
      );
    }
  })();
  return initPromise;
}

/**
 * Otvorí archív (RAR/7z/...) a vráti ArchiveReader.
 * Interná pomocná funkcia — zdieľaná medzi RAR a 7z wrappermi.
 */
async function openArchive(
  file: File,
  password?: string
): Promise<ArchiveReader> {
  await initLibarchive();
  try {
    const reader = await Archive.open(file);
    await reader.open();
    // Skontrolujeme, či je chránený heslom
    const encrypted = await reader.hasEncryptedData();
    if (encrypted) {
      if (!password) {
        await reader.close();
        throw new RetroCloudError(
          "PASSWORD_PROTECTED_ARCHIVE",
          "Archív je chránený heslom. Zadajte heslo."
        );
      }
      try {
        await reader.usePassword(password);
      } catch (e) {
        await reader.close();
        throw new RetroCloudError(
          "WRONG_PASSWORD",
          "Zadané heslo nie je správne.",
          { cause: e }
        );
      }
    }
    return reader;
  } catch (e) {
    if (e instanceof RetroCloudError) throw e;
    throw new RetroCloudError(
      "CORRUPTED_ARCHIVE",
      `Nepodarilo sa otvoriť archív: ${e instanceof Error ? e.message : String(e)}`,
      { cause: e }
    );
  }
}

/** Typová definícia výstupu `getFilesArray()` z libarchive.js. */
interface LibarchiveFileArrayItem {
  file: {
    name: string;
    size: number;
    extract: () => Promise<File>;
  };
  path: string;
}

/**
 * Vypíše zoznam záznamov archívu (RAR, 7z, ...).
 *
 * Interné: knižnica neponúka list-only API, takže sa extrahuje do metadát.
 * Pri veľkých archívoch sa odporúča volať z workera.
 */
export async function listLibarchiveEntries(
  file: File,
  password?: string
): Promise<ArchiveEntry[]> {
  const reader = await openArchive(file, password);
  try {
    const filesArray = (await reader.getFilesArray()) as LibarchiveFileArrayItem[];
    return filesArray.map((item) => {
      const fullPath = item.path ? `${item.path}${item.file.name}` : item.file.name;
      const isDirectory = fullPath.endsWith("/");
      return {
        path: fullPath,
        size: isDirectory ? 0 : item.file.size,
        isDirectory,
        // libarchive.js neposkytuje compressedSize v metadátach
        compressedSize: undefined,
      } satisfies ArchiveEntry;
    });
  } finally {
    await reader.close();
  }
}

/**
 * Rozbalí archív (RAR, 7z, ...) a pre každý súbor zavolá `onEntry`.
 *
 * Podporuje zrušenie cez `AbortSignal`. Po zrušení sa ďalšie súbory
 * nespracujú a funkcia vyhodí RetroCloudError.
 *
 * @param file archív (RAR, 7z, ...)
 * @param onEntry callback, ktorý dostane cestu a dáta súboru
 * @param signal voliteľný AbortSignal pre zrušenie
 * @param password voliteľné heslo pre chránené archívy
 */
export async function extractLibarchiveEntries(
  file: File,
  onEntry: (path: string, data: Uint8Array) => Promise<void>,
  signal?: AbortSignal,
  password?: string
): Promise<void> {
  if (signal?.aborted) {
    throw new RetroCloudError("UNKNOWN_ERROR", "Rozbaľovanie zrušené pred štartom.");
  }

  const reader = await openArchive(file, password);
  try {
    const filesArray = (await reader.getFilesArray()) as LibarchiveFileArrayItem[];

    for (const item of filesArray) {
      if (signal?.aborted) {
        throw new RetroCloudError(
          "UNKNOWN_ERROR",
          "Rozbaľovanie zrušené používateľom."
        );
      }
      const fullPath = item.path ? `${item.path}${item.file.name}` : item.file.name;
      if (fullPath.endsWith("/")) continue;

      const extracted = await item.file.extract();
      const buffer = await extracted.arrayBuffer();
      await onEntry(fullPath, new Uint8Array(buffer));
    }
  } finally {
    await reader.close();
  }
}
