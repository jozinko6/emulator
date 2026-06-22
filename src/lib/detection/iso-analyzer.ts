/**
 * ISO9660 analyzer — hľadá PS1/PS2 systémové indikátory v ISO obraze.
 *
 * Per prompt ETAPA 4:
 *  - PS1: `PSX.EXE` v koreňovom adresári ALEBO `SYSTEM.CNF` s `BOOT = cdrom:\\` a `PS` v hlavičke
 *  - PS2: `SYSTEM.CNF` s `BOOT2 = cdrom0:\\` a `EE` v hlavičke
 *
 * Pre jednoduchosť a výkon táto implementácia robí len "best effort"
 * analýzu — načítava iba relevantné sektory a súbory (nenačítava celý ISO).
 *
 * Komentáre v slovenčine.
 */
import type { ArchiveEntry } from "@/types/detection";

export type IsoSystemIndicator = "ps1" | "ps2" | null;

export interface IsoAnalysisResult {
  indicator: IsoSystemIndicator;
  /** Dôvody v slovenčine (pre `DetectionResult.reasons`). */
  reasons: string[];
  /** Zoznam relevantných systémových súborov, ktoré sa našli. */
  systemFiles: string[];
}

/** Veľkosť ISO9660 sektora — 2048 bajtov (mode 1). */
const ISO_SECTOR_SIZE = 2048;

/** Offset Primary Volume Descriptor — sektor 16. */
const PVD_SECTOR = 16;

/**
 * Načíta PVD (Primary Volume Descriptor) z ISO obrazu.
 * PVD sa nachádza v sektore 16 (offset 0x8000). Z neho vieme získať
 * veľkosť logického bloku a polohu koreňového adresára.
 *
 * Štruktúra PVD (skrátená):
 *  - offset 0:  typ (1 = Primary VD)
 *  - offset 1:  identifikátor "CD001"
 *  - offset 5:  verzia
 *  - offset 6:  unused
 *  - offset 7:  System Identifier (32 bajtov)
 *  - offset 40: Volume Identifier (32 bajtov)
 *  - ...
 *  - offset 156: Root Directory Record (34 bajtov)
 *
 * Pre našu analýzu potrebujeme len offset 156+ pre koreňový adresár.
 */
interface PVDInfo {
  /** Veľkosť logického bloku (obyčajne 2048). */
  blockSize: number;
  /** Počet blokov koreňového adresára. */
  rootDirSize: number;
  /** LBA koreňového adresára (v blokoch). */
  rootDirLba: number;
}

/**
 * Prečíta 32-bitový little-endian integer z bufferu na danom offsete.
 * ISO9660 používa pre väčšinu polí little-endian aj big-endian (7+7 bajtov
 * pre 32-bitové hodnoty). Pre jednoduchosť čítame len little-endian časť.
 */
function readUint32LE(data: Uint8Array, offset: number): number {
  if (offset + 4 > data.length) return 0;
  return (
    data[offset] |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    (data[offset + 3] << 24)
  ) >>> 0;
}

/**
 * Prečíta 16-bitový little-endian integer z bufferu na danom offsete.
 */
function readUint16LE(data: Uint8Array, offset: number): number {
  if (offset + 2 > data.length) return 0;
  return (data[offset] | (data[offset + 1] << 8)) >>> 0;
}

/**
 * Prečíta PVD z ISO obrazu.
 *
 * @param fullIso celý ISO obraz ako Uint8Array
 * @returns PVD info alebo `null`, ak ISO nie je platné
 */
function readPVD(fullIso: Uint8Array): PVDInfo | null {
  const pvdOffset = PVD_SECTOR * ISO_SECTOR_SIZE;
  if (pvdOffset + 200 >= fullIso.length) return null;

  // Over CD001 signatúru na offsete 1
  if (
    fullIso[pvdOffset + 1] !== 0x43 || // 'C'
    fullIso[pvdOffset + 2] !== 0x44 || // 'D'
    fullIso[pvdOffset + 3] !== 0x30 || // '0'
    fullIso[pvdOffset + 4] !== 0x30 || // '0'
    fullIso[pvdOffset + 5] !== 0x31    // '1'
  ) {
    return null;
  }

  // Veľkosť logického bloku — offset 128 (little-endian 16-bit)
  const blockSize = readUint16LE(fullIso, pvdOffset + 128) || ISO_SECTOR_SIZE;

  // Root Directory Record je na offsete 156 (34 bajtový fixný záznam)
  // Štruktúra DirectoryRecord:
  //   offset 0:  dĺžka záznamu
  //   offset 2:  LBA (32-bit LE + 32-bit BE)
  //   offset 10: dátová veľkosť (32-bit LE + 32-bit BE)
  //   offset 18: flags (1 = directory)
  const rootRecordOffset = pvdOffset + 156;
  if (rootRecordOffset + 34 > fullIso.length) return null;
  const rootLba = readUint32LE(fullIso, rootRecordOffset + 2);
  const rootSize = readUint32LE(fullIso, rootRecordOffset + 10);

  if (rootLba === 0 || rootSize === 0) return null;

  return { blockSize, rootDirSize: rootSize, rootDirLba: rootLba };
}

/**
 * Prečíta názov súboru z DirectoryRecord v ISO9660.
 * Názov je uložený ako ASCII bajty; pre jednoduchosť používame len
 * veľké písmená (ISO9660 Level 1 vyžaduje veľké písmená + `_`).
 */
function readDirRecordName(data: Uint8Array, offset: number): {
  name: string;
  isDirectory: boolean;
  lba: number;
  size: number;
  next: number;
} | null {
  if (offset >= data.length) return null;
  const recordLength = data[offset];
  if (recordLength === 0) {
    // PADDING — preskočiť na ďalší sektor boundary
    return null;
  }
  if (offset + recordLength > data.length) return null;

  const lba = readUint32LE(data, offset + 2);
  const size = readUint32LE(data, offset + 10);
  const flags = data[offset + 25];
  const isDirectory = (flags & 0x02) !== 0;

  // Dĺžka názvu je na offsete 32
  const nameLen = data[offset + 32];
  const nameStart = offset + 33;
  if (nameLen === 0 || nameStart + nameLen > data.length) {
    return { name: "", isDirectory, lba, size, next: offset + recordLength };
  }

  // Dekóduj ASCII — ISO9660 názvy sú obyčajne veľké písmená
  let name = "";
  for (let i = 0; i < nameLen; i++) {
    const b = data[nameStart + i];
    // Ponechaj len ASCII; separátor `;1` označuje verziu — odrežeme
    if (b === 0x3b) break; // ';'
    name += String.fromCharCode(b);
  }

  return { name, isDirectory, lba, size, next: offset + recordLength };
}

/**
 * Prečíta obsah súboru z ISO obrazu na základe LBA a veľkosti.
 *
 * @param fullIso celý ISO obraz
 * @param lba logický blok (LBA) štartu súboru
 * @param size veľkosť súboru v bajtoch
 * @param blockSize veľkosť jedného bloku (obyčajne 2048)
 */
function readIsoFile(
  fullIso: Uint8Array,
  lba: number,
  size: number,
  blockSize: number
): Uint8Array {
  const start = lba * blockSize;
  const end = Math.min(start + size, fullIso.length);
  if (start >= fullIso.length) return new Uint8Array(0);
  return fullIso.subarray(start, end);
}

/**
 * Vypíše zoznam súborov v koreňovom adresári ISO obrazu.
 *
 * Interná pomocná funkcia — nehlbíme sa do podadresárov; pre PS1/PS2
 * detekciu nám stačia súbory v koreňovom adresári.
 */
function listRootFiles(fullIso: Uint8Array): { name: string; lba: number; size: number; isDirectory: boolean }[] {
  const pvd = readPVD(fullIso);
  if (!pvd) return [];

  const rootStart = pvd.rootDirLba * pvd.blockSize;
  if (rootStart >= fullIso.length) return [];

  // Root dir zaberá rootDirSize bajtov, ale obyčajne jeden sektor
  const rootEnd = Math.min(rootStart + pvd.rootDirSize, fullIso.length);
  const rootBuf = fullIso.subarray(rootStart, rootEnd);

  const files: { name: string; lba: number; size: number; isDirectory: boolean }[] = [];
  let offset = 0;
  // Sektor-boundary handling — ak recordLength == 0, skoč na ďalší sektor
  const sectorBoundary = pvd.blockSize;
  while (offset < rootBuf.length) {
    const recLen = rootBuf[offset];
    if (recLen === 0) {
      // Posuň na ďalšiu sector boundary
      const nextBoundary = Math.ceil((offset + 1) / sectorBoundary) * sectorBoundary;
      offset = nextBoundary;
      continue;
    }
    const rec = readDirRecordName(rootBuf, offset);
    if (!rec) break;
    if (rec.name !== "" && rec.name !== "." && rec.name !== "..") {
      files.push({
        name: rec.name,
        lba: rec.lba,
        size: rec.size,
        isDirectory: rec.isDirectory,
      });
    }
    offset = rec.next;
  }

  return files;
}

/**
 * Prečíta obsah súboru z koreňového adresára ISO podľa názvu (case-insensitive).
 */
function readRootFile(fullIso: Uint8Array, fileName: string): Uint8Array | null {
  const pvd = readPVD(fullIso);
  if (!pvd) return null;
  const files = listRootFiles(fullIso);
  const target = fileName.toUpperCase();
  for (const f of files) {
    if (f.name.toUpperCase() === target) {
      return readIsoFile(fullIso, f.lba, f.size, pvd.blockSize);
    }
  }
  return null;
}

/**
 * Prečíta obsah `SYSTEM.CNF` ako text (ak existuje v koreňovom adresári ISO).
 */
function readSystemCnf(fullIso: Uint8Array): string | null {
  const data = readRootFile(fullIso, "SYSTEM.CNF");
  if (!data || data.length === 0) return null;
  // SYSTEM.CNF je ASCII text — dekódujeme
  let text = "";
  for (let i = 0; i < data.length; i++) {
    const b = data[i];
    if (b === 0x00) break; // NUL — koniec
    text += String.fromCharCode(b);
  }
  return text;
}

/**
 * Analyzuje ISO9660 obraz a vráti PS1/PS2 systémový indikátor.
 *
 * @param fullIso celý ISO obraz ako Uint8Array
 * @returns IsoAnalysisResult — `indicator` je `null` ak sa nedá rozpoznať
 */
export function analyzeIso(fullIso: Uint8Array): IsoAnalysisResult {
  const reasons: string[] = [];
  const systemFiles: string[] = [];

  // Over, že ide o platný ISO9660
  const pvd = readPVD(fullIso);
  if (!pvd) {
    return { indicator: null, reasons, systemFiles };
  }

  const rootFiles = listRootFiles(fullIso);
  const rootFileNames = rootFiles.map((f) => f.name.toUpperCase());

  // Skontroluj PSX.EXE — silný indikátor PS1
  if (rootFileNames.includes("PSX.EXE")) {
    systemFiles.push("PSX.EXE");
    reasons.push("V koreňovom adresári ISO sa našiel PSX.EXE — silný indikátor PS1");
    return { indicator: "ps1", reasons, systemFiles };
  }

  // Skontroluj SYSTEM.CNF
  const cnfText = readSystemCnf(fullIso);
  if (cnfText) {
    systemFiles.push("SYSTEM.CNF");

    // PS2: BOOT2 = cdrom0:\...
    if (/BOOT2\s*=\s*cdrom0:/i.test(cnfText)) {
      reasons.push("SYSTEM.CNF obsahuje `BOOT2 = cdrom0:\\` — indikátor PS2");
      // Over, či je v hlavičke "EE" (EE_EXEC príkaz)
      if (/\bEE\b/i.test(cnfText)) {
        reasons.push("SYSTEM.CNF obsahuje `EE` — potvrdené PS2");
      }
      return { indicator: "ps2", reasons, systemFiles };
    }

    // PS1: BOOT = cdrom:\...
    if (/BOOT\s*=\s*cdrom:/i.test(cnfText)) {
      reasons.push("SYSTEM.CNF obsahuje `BOOT = cdrom:\\` — indikátor PS1");
      // Over, či je v hlavičke "PS" (PS príkaz pre PSX.EXE)
      if (/\bPS\b/i.test(cnfText)) {
        reasons.push("SYSTEM.CNF obsahuje `PS` — potvrdené PS1");
      }
      return { indicator: "ps1", reasons, systemFiles };
    }
  }

  // Skontroluj prítomnosť PSP_GAME adresára — to je PSP, nie PS1/PS2,
  // ale oznamujeme varovanie (nie je súčasťou PS1/PS2)
  if (rootFileNames.includes("PSP_GAME")) {
    reasons.push("ISO obsahuje `PSP_GAME` — ide o PSP obraz (nepodporované)");
  }

  return { indicator: null, reasons, systemFiles };
}

/**
 * Pomocná funkcia pre platform-detector: zistí indikátor ISO z prvého
 * sektora dostupného v `fileHeader`. Ak `fileHeader` nie je dostatočne
 * dlhý (potrebných ~33 kB), vráti `null`.
 *
 * Túto funkciu volá `platform-detector.ts` pri analýze hlavičky súboru —
 * ak je k dispozícii dostatok bajtov (napr. pri archívoch, ktoré sa rozbalili
 * dočasne), môže sa zavolať priamo `analyzeIso` s plným obsahom.
 */
export function detectIsoFromHeader(fileHeader: Uint8Array): IsoSystemIndicator {
  // Na overenie ISO potrebujeme aspoň PVD sektor (16 * 2048 = 32 kB)
  if (fileHeader.length < (PVD_SECTOR + 1) * ISO_SECTOR_SIZE) {
    return null;
  }
  const result = analyzeIso(fileHeader);
  return result.indicator;
}

/**
 * Pomocná funkcia: otestuje, či je zoznam archívnych záznamov (typicky z
 * rozbaleného ZIP archívu obsahujúceho ISO) konsistentný s daným indikátorom.
 *
 * Túto funkciu volá platform-detector, keď ZIP obsahuje ISO a chceli by sme
 * overiť, či ISO hlavička korešponduje so zoznamom súborov v archíve.
 */
export function isConsistentWithIso(
  entries: ArchiveEntry[],
  indicator: IsoSystemIndicator
): boolean {
  if (indicator === null) return true;
  const upper = entries.map((e) => e.path.toUpperCase());
  if (indicator === "ps1") {
    // PS1 ISO by mal obsahovať PSX.EXE alebo SYSTEM.CNF
    return upper.some((p) => p.endsWith("PSX.EXE") || p.endsWith("SYSTEM.CNF"));
  }
  if (indicator === "ps2") {
    return upper.some((p) => p.endsWith("SYSTEM.CNF"));
  }
  return true;
}
