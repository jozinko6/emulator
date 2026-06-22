/**
 * Bezpečnostná vrstva pre archívy.
 *
 * Per prompt sekcia 11 — ochrana proti:
 *  - ZIP/RAR bombám (vysoký kompresný pomer)
 *  - path traversal (../, absolútne cesty, UNC, drive letter)
 *  - príliš hlbokým vnoreniam adresárov
 *  - vnoreným archívom (maxNestedArchiveDepth)
 *  - príliš veľkému počtu súborov
 *  - príliš dlhým cestám
 *
 * Komentáre v slovenčine.
 */
import type { ArchiveEntry, ArchiveSummary } from "@/types/detection";
import type { ArchiveLimits } from "@/lib/security/limits";
import { isNestedArchive } from "@/lib/security/limits";
import { normalizePath, PathSecurityError } from "@/lib/security/path-normalizer";
import { extname } from "@/lib/security/path-normalizer";

/**
 * Spočíta súhrn archívu: počet súborov, veľkosti, kompresný pomer,
 * maximálnu hĺbku adresárovej štruktúry a príznak vnoreného archívu.
 *
 * Nespadá na nebezpečných cestách — tie sa len zaznamenajú do `entries`,
 * konkrétne cesty sa kontrolujú samostatnou funkciou `checkEntriesForUnsafePaths`.
 */
export function summarizeArchive(entries: ArchiveEntry[]): ArchiveSummary {
  let totalFiles = 0;
  let totalUncompressedSize = 0;
  let totalCompressedSize = 0;
  let maxDirectoryDepth = 0;
  let hasNestedArchive = false;

  for (const entry of entries) {
    if (!entry.isDirectory) {
      totalFiles += 1;
      totalUncompressedSize += entry.size;
      if (typeof entry.compressedSize === "number") {
        totalCompressedSize += entry.compressedSize;
      } else {
        // Ak nie je známa kompresná veľkosť, považujeme ju za rovnakú ako veľkosť
        totalCompressedSize += entry.size;
      }
    }

    // Hĺbka adresárovej štruktúry — počet segmentov cesty
    const segments = entry.path.split("/").filter(Boolean);
    if (segments.length > maxDirectoryDepth) {
      maxDirectoryDepth = segments.length;
    }

    // Vnorený archív —檔 s príponou .zip/.rar/.7z atď.
    if (!entry.isDirectory && isNestedArchive(entry.path)) {
      hasNestedArchive = true;
    }
  }

  // Kompresný pomer — chránime proti deleniu nulou
  const compressionRatio =
    totalCompressedSize > 0 ? totalUncompressedSize / totalCompressedSize : 1;

  return {
    totalFiles,
    totalUncompressedSize,
    totalCompressedSize,
    compressionRatio,
    maxDirectoryDepth,
    hasNestedArchive,
    entries,
  };
}

/**
 * Validuje ArchiveSummary oproti limitom (ArchiveLimits).
 *
 * Vracia objekt s `ok` a zoznamom dôvodov (v slovenčine), prečo validácia
 * zlyhala. Ak `ok === true`, zoznam `reasons` je prázdny.
 */
export function validateSummary(
  summary: ArchiveSummary,
  limits: ArchiveLimits
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (summary.totalFiles > limits.maxFiles) {
    reasons.push(
      `Príliš veľa súborov v archíve: ${summary.totalFiles} (limit ${limits.maxFiles}).`
    );
  }

  if (summary.compressionRatio > limits.maxCompressionRatio) {
    reasons.push(
      `Podozrivo vysoký kompresný pomer: ${summary.compressionRatio.toFixed(1)} (limit ${limits.maxCompressionRatio}) — podozrenie na archívnu bombu.`
    );
  }

  if (summary.maxDirectoryDepth > limits.maxDirectoryDepth) {
    reasons.push(
      `Príliš hlboká adresárová štruktúra: ${summary.maxDirectoryDepth} úrovní (limit ${limits.maxDirectoryDepth}).`
    );
  }

  if (summary.hasNestedArchive && limits.maxNestedArchiveDepth < 1) {
    reasons.push(
      "Archív obsahuje vnorené archívy, čo nie je povolené (maxNestedArchiveDepth = 0)."
    );
  }

  // Skontrolujeme aj maximálnu dĺžku cesty naprieč všetkými záznamami
  for (const entry of summary.entries) {
    if (entry.path.length > limits.maxPathLength) {
      reasons.push(
        `Cesta v archíve je príliš dlhá: ${entry.path.length} znakov (limit ${limits.maxPathLength}).`
      );
      break; // stačí prvý náraz, ďalšie by len duplikovali dôvod
    }
  }

  return { ok: reasons.length === 0, reasons };
}

/**
 * Skontroluje všetky záznamy archívu na nebezpečné cesty.
 *
 * Vracia zoznam reťazcov v tváre `${path} — ${dôvod}`. Ak je zoznam prázdny,
 * všetky cesty sú bezpečné.
 *
 * Používa `normalizePath` z `path-normalizer.ts`, ktorá kontroluje:
 *  - null bajty
 *  - Windows drive letter (C:\)
 *  - UNC cesty (\\server\share)
 *  - absolútne cesty (sú pustené, ale berie sa len relatívna časť)
 *  - `..` segmenty (path traversal)
 *  - príliš dlhé cesty
 *  - príliš hlboké adresáre
 */
export function checkEntriesForUnsafePaths(entries: ArchiveEntry[]): string[] {
  const unsafe: string[] = [];
  for (const entry of entries) {
    try {
      // normalizePath vráti bezpečnú relatívnu cestu alebo vyhodí PathSecurityError
      const normalized = normalizePath(entry.path);
      if (!normalized) {
        unsafe.push(`${entry.path} — prázdna cesta po normalizácii`);
      }
    } catch (e) {
      if (e instanceof PathSecurityError) {
        unsafe.push(`${entry.path} — ${e.reason}: ${e.message}`);
      } else if (e instanceof Error) {
        unsafe.push(`${entry.path} — ${e.message}`);
      } else {
        unsafe.push(`${entry.path} — neznáma chyba`);
      }
    }
  }
  return unsafe;
}

/**
 * Z balíka súborov vyberie "hlavný súbor" hry — ten, ktorý sa použije
 * na detekciu platformy. Priorita: najväčší súbor s rozoznateľnou príponou.
 *
 * Toto je pomocná funkcia, ktorá sa nevyužíva v archive-security priamo,
 * ale je tu pre pohodlie import pipeliny.
 */
export function pickMainFileCandidate(entries: ArchiveEntry[]): ArchiveEntry | null {
  const files = entries.filter(
    (e) => !e.isDirectory && e.size > 0 && extname(e.path).length > 0
  );
  if (files.length === 0) return null;
  files.sort((a, b) => b.size - a.size);
  return files[0];
}
