/**
 * DOS launcher — hľadanie štartovacieho súboru v zozname súborov hry.
 *
 * Per prompt ETAPA 4. Priorita štartovacích súborov:
 *   1. START.BAT
 *   2. PLAY.BAT
 *   3. RUN.BAT
 *   4. GAME.BAT
 *   5. GAME.EXE
 *   6. START.EXE
 *   7. PLAY.EXE
 *   8. RUN.EXE
 *   9. iný BAT/EXE/COM (vyžaduje user selection)
 *
 * Skip súbory (never used as launcher):
 *   INSTALL.EXE, SETUP.EXE, UNINSTALL.EXE, CONFIG.EXE, SOUND.EXE, SETUP.BAT
 *
 * Komentáre v slovenčine.
 */
import type { ArchiveEntry } from "@/types/detection";

export interface DosLauncherResult {
  /** Nájdený štartovací súbor (relatívna cesta) alebo `null`. */
  mainFile: string | null;
  /** True, ak bolo nájdených viac možností a používateľ musí vybrať. */
  requiresUserSelection: boolean;
  /** Zoznam všetkých kandidátov (ak `requiresUserSelection`). */
  candidates: string[];
  /** Dôvody v slovenčine pre `DetectionResult.reasons`. */
  reasons: string[];
}

/** Prioritný zoznam názvov (case-insensitive). */
const PRIORITY_LAUNCHERS = [
  "START.BAT",
  "PLAY.BAT",
  "RUN.BAT",
  "GAME.BAT",
  "GAME.EXE",
  "START.EXE",
  "PLAY.EXE",
  "RUN.EXE",
] as const;

/** Súbory, ktoré sa NESMÚ použiť ako launcher (utility, inštalátory). */
const SKIP_FILES = new Set([
  "INSTALL.EXE",
  "SETUP.EXE",
  "UNINSTALL.EXE",
  "CONFIG.EXE",
  "SOUND.EXE",
  "SETUP.BAT",
  "UNINSTAL.EXE", // skrátená verzia názvu
  "INSTALL.BAT",
  "DOS4GW.EXE", // DOS extender — nie je hra
  "DOS4GW",
]);

/**
 * Získa len názov súboru z cesty (veľké písmená pre porovnávanie).
 */
function getUpperFileName(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  const name = idx === -1 ? normalized : normalized.slice(idx + 1);
  return name.toUpperCase();
}

/**
 * Rozhodne, či je súbor potenciálnym launcherom (BAT/EXE/COM).
 */
function isExecutable(name: string): boolean {
  return name.endsWith(".BAT") || name.endsWith(".EXE") || name.endsWith(".COM");
}

/**
 * Nájde štartovací súbor v zozname archívnych záznamov.
 *
 * @param entries zoznam extrahovaných súborov
 * @returns DosLauncherResult s nájdeným main file alebo zoznamom kandidátov
 */
export function findDosLauncher(entries: ArchiveEntry[]): DosLauncherResult {
  const reasons: string[] = [];

  // Ak sú záznamy len s cestou (bez dát) — použijeme len názvy súborov
  const allFiles = entries.filter((e) => !e.isDirectory && e.size > 0);
  if (allFiles.length === 0) {
    return {
      mainFile: null,
      requiresUserSelection: false,
      candidates: [],
      reasons: ["V archíve sa nenašli žiadne súbory"],
    };
  }

  // Najprv skúsme presné zhody s prioritným zoznamom
  for (const launcherName of PRIORITY_LAUNCHERS) {
    const matches = allFiles.filter((e) => getUpperFileName(e.path) === launcherName);
    if (matches.length > 0) {
      // Ak je viac zhôd (napr. v rôznych podadresároch), vezmi prvý
      // z koreňového adresára ak existuje, inak prvý nájdený.
      const inRoot = matches.find((e) => !e.path.includes("/"));
      const chosen = inRoot ?? matches[0];
      reasons.push(`Nájdený prioritný štartovací súbor: ${chosen.path}`);
      return {
        mainFile: chosen.path,
        requiresUserSelection: false,
        candidates: [chosen.path],
        reasons,
      };
    }
  }

  // Žiadny prioritný — hľadáme iný BAT/EXE/COM (preskakujeme SKIP_FILES)
  const candidates = allFiles.filter((e) => {
    const name = getUpperFileName(e.path);
    if (SKIP_FILES.has(name)) return false;
    return isExecutable(name);
  });

  if (candidates.length === 0) {
    reasons.push("Nenašiel sa žiadny .BAT/.EXE/.COM súbor okrem preskakovaných utility");
    return {
      mainFile: null,
      requiresUserSelection: false,
      candidates: [],
      reasons,
    };
  }

  if (candidates.length === 1) {
    reasons.push(`Nájdený jediný spustiteľný súbor: ${candidates[0].path}`);
    return {
      mainFile: candidates[0].path,
      requiresUserSelection: false,
      candidates: [candidates[0].path],
      reasons,
    };
  }

  // Viacero kandidátov — používateľ musí vybrať
  reasons.push(
    `Nájdených ${candidates.length} kandidátov na štartovací súbor — vyžaduje sa výber používateľa`
  );
  return {
    mainFile: null,
    requiresUserSelection: true,
    candidates: candidates.map((c) => c.path),
    reasons,
  };
}
