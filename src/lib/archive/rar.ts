/**
 * Wrapper nad `libarchive.js` pre rozbaľovanie RAR archívov.
 *
 * Implementácia je zdieľaná s `seven-z.ts` — libarchive.js rozpozná formát
 * podľa magic bytes automaticky. Tento súbor len poskytuje RAR-špecifické
 * pomenovanie funkcií pre prehľadnosť API.
 *
 * Komentáre v slovenčine.
 */
import type { ArchiveEntry } from "@/types/detection";
import {
  initLibarchive,
  listLibarchiveEntries,
  extractLibarchiveEntries,
} from "@/lib/archive/libarchive-base";

export { initLibarchive };

/**
 * Vypíše zoznam záznamov RAR archívu.
 * Interné: knižnica neponúka list-only API, takže archív sa otvorí
 * a prečíta sa metadáta súborov.
 *
 * @param file RAR súbor
 * @param password voliteľné heslo pre chránené RAR archívy
 */
export async function listRarEntries(
  file: File,
  password?: string
): Promise<ArchiveEntry[]> {
  return listLibarchiveEntries(file, password);
}

/**
 * Rozbalí RAR archív a pre každý súbor zavolá `onEntry`.
 *
 * @param file RAR súbor
 * @param onEntry callback, ktorý dostane cestu a dáta súboru
 * @param signal voliteľný AbortSignal pre zrušenie
 * @param password voliteľné heslo pre chránené RAR archívy
 */
export async function extractRarEntries(
  file: File,
  onEntry: (path: string, data: Uint8Array) => Promise<void>,
  signal?: AbortSignal,
  password?: string
): Promise<void> {
  return extractLibarchiveEntries(file, onEntry, signal, password);
}
