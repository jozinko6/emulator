/**
 * Wrapper nad `libarchive.js` pre rozbaľovanie 7z archívov.
 *
 * Implementácia je zdieľaná s `rar.ts` — libarchive.js rozpozná formát
 * podľa magic bytes automaticky (7z má signatúru `37 7A BC AF 27 1C`).
 * Tento súbor len poskytuje 7z-špecifické pomenovanie funkcií pre
 * prehľadnosť API.
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
 * Vypíše zoznam záznamov 7z archívu.
 *
 * @param file 7z súbor
 * @param password voliteľné heslo pre chránené 7z archívy
 */
export async function listSevenZEntries(
  file: File,
  password?: string
): Promise<ArchiveEntry[]> {
  return listLibarchiveEntries(file, password);
}

/**
 * Rozbalí 7z archív a pre každý súbor zavolá `onEntry`.
 *
 * @param file 7z súbor
 * @param onEntry callback, ktorý dostane cestu a dáta súboru
 * @param signal voliteľný AbortSignal pre zrušenie
 * @param password voliteľné heslo pre chránené 7z archívy
 */
export async function extractSevenZEntries(
  file: File,
  onEntry: (path: string, data: Uint8Array) => Promise<void>,
  signal?: AbortSignal,
  password?: string
): Promise<void> {
  return extractLibarchiveEntries(file, onEntry, signal, password);
}
