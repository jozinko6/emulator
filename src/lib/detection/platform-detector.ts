/**
 * Platform detector — hlavná detekcia platformy hry.
 *
 * Per prompt ETAPA 4. Kombinuje viaceré signály:
 *  - prípona súboru
 *  - magic bytes z hlavičky
 *  - obsah CUE sheeta (ak je k dispozícii)
 *  - analýza ISO (ak je k dispozícii)
 *  - názov súboru (heuristika)
 *  - veľkosť súboru (PS2 ISO > PS1 ISO typicky)
 *
 * Vracia `DetectionResult` s `confidence`, `reasons`, `possiblePlatforms`,
 * `requiresUserSelection` a voliteľným `mainFile`.
 *
 * Komentáre v slovenčine.
 */
import type { DetectionInput, DetectionResult } from "@/types/detection";
import type { EmulatorPlatform } from "@/types/emulator";
import { detectMagic, isJsdosBundle } from "@/lib/detection/header-magic";
import { analyzeIso, type IsoSystemIndicator } from "@/lib/detection/iso-analyzer";
import { analyzeChd, guessPlatformFromChd } from "@/lib/detection/chd-analyzer";
import {
  parseCue,
  findMissingBinFiles,
  getBinFileNames,
} from "@/emulators/ps1/cue-parser";
import { findDosLauncher } from "@/emulators/dos/dos-launcher";
import { extname } from "@/lib/security/path-normalizer";

interface DetectionSignals {
  extension: string;
  magicFormat: ReturnType<typeof detectMagic>["format"];
  isJsdos: boolean;
  isoIndicator: IsoSystemIndicator;
  cueValid: boolean | null;
  cueBinMissing: string[];
  chdCandidates: Array<"ps1" | "ps2">;
  dosLauncher: ReturnType<typeof findDosLauncher>;
}

/**
 * Zhromaždí všetky signály z vstupu.
 *
 * Interná funkcia — hlavný `detectPlatform` len interpretuje tieto signály
 * a zostaví `DetectionResult`.
 */
function collectSignals(input: DetectionInput): DetectionSignals {
  const extension = extname(input.fileName).toLowerCase();

  // Magic bytes
  const magicMatch = input.fileHeader
    ? detectMagic(input.fileHeader)
    : { format: "unknown" as const, signature: "" };

  // JSDOS detection — ak je ZIP, skontrolujeme, či obsahuje .jsdos/content/
  let isJsdos = false;
  if (magicMatch.format === "zip" && input.siblingFiles && input.siblingFiles.length > 0) {
    isJsdos = isJsdosBundle(input.siblingFiles);
  }

  // ISO analýza — pre presnú analýzu by caller mal poskytnúť isoSystemIndicator
  // (ak ISO nie je rozbalené do entries, tento indikátor je null)
  const isoIndicator: IsoSystemIndicator = input.isoSystemIndicator ?? null;

  // CUE analýza
  let cueValid: boolean | null = null;
  let cueBinMissing: string[] = [];
  if (input.cueContent) {
    try {
      const cue = parseCue(input.cueContent);
      cueBinMissing = findMissingBinFiles(cue, input.siblingFiles ?? []);
      cueValid = cueBinMissing.length === 0 && cue.files.length > 0;
    } catch {
      cueValid = false;
    }
  }

  // CHD analýza
  let chdCandidates: Array<"ps1" | "ps2"> = [];
  if (magicMatch.format === "chd" && input.fileHeader) {
    const meta = analyzeChd(input.fileHeader);
    if (meta) {
      chdCandidates = guessPlatformFromChd(meta);
    }
  }

  // DOS launcher — voláme len ak ide o ZIP s DOS súbormi
  let dosLauncher = findDosLauncher([]);
  if (
    magicMatch.format === "zip" ||
    extension === "zip" ||
    extension === "jsdos" ||
    extension === "bat" ||
    extension === "exe" ||
    extension === "com"
  ) {
    // Pre ZIP môžeme použiť siblingFiles (ak ide o extrahované cesty)
    if (input.siblingFiles && input.siblingFiles.length > 0) {
      const pseudoEntries = input.siblingFiles.map((p) => ({
        path: p,
        size: 0,
        isDirectory: false,
      }));
      dosLauncher = findDosLauncher(pseudoEntries);
    }
  }

  return {
    extension,
    magicFormat: magicMatch.format,
    isJsdos,
    isoIndicator,
    cueValid,
    cueBinMissing,
    chdCandidates,
    dosLauncher,
  };
}

/**
 * Hlavná funkcia detekcie platformy.
 *
 * Algoritmus:
 *  1. Zhromaždí signály (extension, magic, CUE, ISO, CHD, DOS launcher)
 *  2. Skúsi jednoznačnú identifikáciu (vyššia confidence)
 *  3. Ak nie je jednoznačná, vráti `possiblePlatforms` a `requiresUserSelection`
 *
 * @param input DetectionInput
 * @returns DetectionResult
 */
export function detectPlatform(input: DetectionInput): DetectionResult {
  const signals = collectSignals(input);
  const reasons: string[] = [];
  const warnings: string[] = [];
  const possiblePlatforms = new Set<EmulatorPlatform>();

  // === JSDOS balík (DOS) — silný indikátor ===
  if (signals.isJsdos) {
    reasons.push("ZIP obsahuje `.jsdos/content/` — jednoznačne DOS balík pre js-dos");
    return {
      platform: "dos",
      confidence: 1.0,
      reasons,
      requiresUserSelection: false,
      possiblePlatforms: ["dos"],
      mainFile: input.fileName,
      warnings,
    };
  }

  // === PBP — jednoznačne PS1 (PSP eboot s PS1 hrami) ===
  if (signals.magicFormat === "pbp") {
    reasons.push("Magic bytes zodpovedajú PBP — PS1 (PSP eboot s PS1 hrami)");
    return {
      platform: "ps1",
      confidence: 0.95,
      reasons,
      requiresUserSelection: false,
      possiblePlatforms: ["ps1"],
      mainFile: input.fileName,
      warnings,
    };
  }

  // === ELF — môže byť PS1 alebo PS2 (PS2 je bežnejšie) ===
  if (signals.magicFormat === "elf") {
    reasons.push("Magic bytes zodpovedajú ELF — spustiteľný súbor PS1/PS2");
    // Veľkosť — PS2 ELF je väčšinou väčší (300 KB+)
    if (input.fileSize > 300 * 1024) {
      reasons.push(`Veľkosť ELF (${input.fileSize} B) naznačuje PS2`);
      possiblePlatforms.add("ps2");
      return {
        platform: "ps2",
        confidence: 0.7,
        reasons,
        requiresUserSelection: false,
        possiblePlatforms: ["ps2"],
        mainFile: input.fileName,
        warnings,
      };
    }
    possiblePlatforms.add("ps1");
    possiblePlatforms.add("ps2");
    return {
      platform: null,
      confidence: 0.3,
      reasons,
      requiresUserSelection: true,
      possiblePlatforms: Array.from(possiblePlatforms),
      mainFile: input.fileName,
      warnings,
    };
  }

  // === CHD ===
  if (signals.magicFormat === "chd") {
    reasons.push("Magic bytes zodpovedajú CHD — komprimovaný herný obraz");
    if (signals.chdCandidates.length > 0) {
      for (const c of signals.chdCandidates) possiblePlatforms.add(c);
    } else {
      possiblePlatforms.add("ps1");
      possiblePlatforms.add("ps2");
    }
    // Bez ďalších indícií nedokážeme rozlíšiť PS1 vs PS2
    return {
      platform: null,
      confidence: 0.4,
      reasons,
      requiresUserSelection: true,
      possiblePlatforms: Array.from(possiblePlatforms),
      mainFile: input.fileName,
      warnings,
    };
  }

  // === ISO9660 ===
  if (signals.magicFormat === "iso9660" || signals.extension === "iso") {
    reasons.push("Súbor je ISO9660 obraz");
    if (signals.isoIndicator === "ps1") {
      reasons.push("Analýza ISO našla PS1 systémové indikátory (PSX.EXE / BOOT = cdrom:\\)");
      return {
        platform: "ps1",
        confidence: 0.95,
        reasons,
        requiresUserSelection: false,
        possiblePlatforms: ["ps1"],
        mainFile: input.fileName,
        warnings,
      };
    }
    if (signals.isoIndicator === "ps2") {
      reasons.push("Analýza ISO našla PS2 systémové indikátory (BOOT2 = cdrom0:\\)");
      return {
        platform: "ps2",
        confidence: 0.95,
        reasons,
        requiresUserSelection: false,
        possiblePlatforms: ["ps2"],
        mainFile: input.fileName,
        warnings,
      };
    }
    // ISO bez indikátora — vyžaduje user selection (PS1/PS2)
    reasons.push("ISO nemá jednoznačné PS1/PS2 indikátory — vyžaduje sa výber");
    possiblePlatforms.add("ps1");
    possiblePlatforms.add("ps2");
    return {
      platform: null,
      confidence: 0.2,
      reasons,
      requiresUserSelection: true,
      possiblePlatforms: Array.from(possiblePlatforms),
      mainFile: input.fileName,
      warnings,
    };
  }

  // === BIN/CUE ===
  if (signals.extension === "cue") {
    if (input.cueContent) {
      if (signals.cueValid === false) {
        // Skús získať detailné info o chýbajúcich BIN súboroch
        if (signals.cueBinMissing.length > 0) {
          warnings.push(
            `CUE odkazuje na chýbajúce BIN súbory: ${signals.cueBinMissing.join(", ")}`
          );
          return {
            platform: null,
            confidence: 0.0,
            reasons: ["CUE sheet odkazuje na chýbajúce BIN súbory"],
            requiresUserSelection: false,
            possiblePlatforms: [],
            mainFile: input.fileName,
            warnings,
          };
        }
        warnings.push("CUE sheet sa nepodarilo sparsovať");
      } else if (signals.cueValid === true) {
        reasons.push("CUE sheet je platný a všetky BIN súbory existujú");
      }
    } else {
      reasons.push("CUE sheet — analýza BIN referencií sa vykoná po rozbalení");
    }
    // BIN/CUE môže byť PS1 aj PS2
    possiblePlatforms.add("ps1");
    possiblePlatforms.add("ps2");
    return {
      platform: null,
      confidence: 0.3,
      reasons,
      requiresUserSelection: true,
      possiblePlatforms: Array.from(possiblePlatforms),
      mainFile: input.fileName,
      warnings,
    };
  }

  if (signals.extension === "bin") {
    // BIN bez CUE — môže byť čokoľvek
    reasons.push("BIN súbor — vyžaduje sa CUE sheet alebo manuálny výber platformy");
    possiblePlatforms.add("ps1");
    possiblePlatforms.add("ps2");
    return {
      platform: null,
      confidence: 0.2,
      reasons,
      requiresUserSelection: true,
      possiblePlatforms: Array.from(possiblePlatforms),
      mainFile: input.fileName,
      warnings,
    };
  }

  // === DOS — BAT/EXE/COM ako voľný súbor ===
  if (
    signals.extension === "bat" ||
    signals.extension === "exe" ||
    signals.extension === "com"
  ) {
    reasons.push(`Súbor s príponou .${signals.extension} — DOS`);
    return {
      platform: "dos",
      confidence: 0.85,
      reasons,
      requiresUserSelection: false,
      possiblePlatforms: ["dos"],
      mainFile: input.fileName,
      warnings,
    };
  }

  // === JSDOS prípona ===
  if (signals.extension === "jsdos") {
    reasons.push("Súbor s príponou .jsdos — DOS balík pre js-dos");
    return {
      platform: "dos",
      confidence: 0.95,
      reasons,
      requiresUserSelection: false,
      possiblePlatforms: ["dos"],
      mainFile: input.fileName,
      warnings,
    };
  }

  // === ZIP (nie JSDOS) ===
  if (signals.magicFormat === "zip" || signals.extension === "zip") {
    reasons.push("ZIP archív — kontrola obsahu");
    // Ak sme našli DOS launcher → DOS
    if (signals.dosLauncher.mainFile) {
      reasons.push(`Nájdený DOS štartovací súbor: ${signals.dosLauncher.mainFile}`);
      return {
        platform: "dos",
        confidence: 0.9,
        reasons,
        requiresUserSelection: false,
        possiblePlatforms: ["dos"],
        mainFile: signals.dosLauncher.mainFile,
        warnings,
      };
    }
    if (signals.dosLauncher.requiresUserSelection) {
      reasons.push("ZIP obsahuje viacero BAT/EXE — vyžaduje sa výber používateľa");
      warnings.push(
        `Možní štartovací súbor: ${signals.dosLauncher.candidates.slice(0, 5).join(", ")}`
      );
      return {
        platform: "dos",
        confidence: 0.7,
        reasons,
        requiresUserSelection: true,
        possiblePlatforms: ["dos"],
        mainFile: signals.dosLauncher.candidates[0],
        warnings,
      };
    }
    // ZIP môže obsahovať PS1/PS2 obraz alebo DOS hru — vyžaduje user selection
    reasons.push("ZIP bez jednoznačného štartovacieho súboru — vyžaduje sa výber platformy");
    possiblePlatforms.add("dos");
    possiblePlatforms.add("ps1");
    possiblePlatforms.add("ps2");
    return {
      platform: null,
      confidence: 0.1,
      reasons,
      requiresUserSelection: true,
      possiblePlatforms: Array.from(possiblePlatforms),
      mainFile: input.fileName,
      warnings,
    };
  }

  // === RAR ===
  if (signals.magicFormat === "rar" || signals.extension === "rar") {
    reasons.push("RAR archív — kontrola obsahu");
    possiblePlatforms.add("dos");
    possiblePlatforms.add("ps1");
    possiblePlatforms.add("ps2");
    return {
      platform: null,
      confidence: 0.1,
      reasons,
      requiresUserSelection: true,
      possiblePlatforms: Array.from(possiblePlatforms),
      mainFile: input.fileName,
      warnings,
    };
  }

  // === 7z ===
  if (signals.extension === "7z") {
    reasons.push("7z archív — kontrola obsahu");
    possiblePlatforms.add("dos");
    possiblePlatforms.add("ps1");
    possiblePlatforms.add("ps2");
    return {
      platform: null,
      confidence: 0.1,
      reasons,
      requiresUserSelection: true,
      possiblePlatforms: Array.from(possiblePlatforms),
      mainFile: input.fileName,
      warnings,
    };
  }

  // === Neznámy formát ===
  reasons.push(`Nerozpoznaný formát — prípona ".${signals.extension}"`);
  return {
    platform: null,
    confidence: 0.0,
    reasons,
    requiresUserSelection: true,
    possiblePlatforms: [],
    mainFile: input.fileName,
    warnings,
  };
}

/**
 * Re-export pre použitie mimo — parsuje CUE sheet a vráti zoznam BIN názvov.
 * Používa sa v import pipeline pri overovaní BIN referencií.
 */
export { parseCue, getBinFileNames, findMissingBinFiles };
