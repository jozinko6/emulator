/**
 * CHD (Compressed Hunks of Data) analyzer — číta metadáta z CHD súboru.
 *
 * CHD je archívny formát používaný pre kompresiu herných obrazov (arcade,
 * PS1, PS2, ...). Formát je dokumentovaný v MAME (src/lib/util/chd.cpp).
 *
 * Hlavička CHD:
 *   offset 0:  magic "MComprHD" (8 bajtov ASCII)
 *   offset 8:  verzia (5 bajtov ASCII, napr. "    V5")
 *
 * Verzia 3/4 hlavička (40 bajtov):
 *   offset 0:  magic
 *   offset 8:  length (4 bajty BE) — veľkosť hlavičky
 *   offset 12: version (4 bajty BE)
 *   offset 16: ...
 *
 * Verzia 5 hlavička (124 bajtov):
 *   offset 0:   magic
 *   offset 8:   length (4 bajty BE) — 124
 *   offset 12:  version (4 bajty BE) — 5
 *   offset 16:  compressors (4 × 4 bajty BE alebo 4 ASCII znaky)
 *   offset 32:  logical_bytes (8 bajtov BE)
 *   offset 40:  hunk_bytes (4 bajty BE)
 *   offset 44:  unit_bytes (4 bajtos BE)
 *   offset 48:  hunk_count (8 bajtov BE)
 *   ...
 *
 * Pre detekciu platformy je kľúčové pole `compressors` — podľa neho vieme
 * určiť, či CHD používa "cdzl" (CD audio LZMA — PS1) alebo "cdzs" (CD zlib + audio).
 * Pre presnejšiu detekciu platformy je potrebné prečítať CHD metadata tagy,
 * ktoré sa nachádzajú v traileri súboru — to ale vyžaduje načítať celý trail.
 *
 * Pre túto implementáciu robíme "best effort" — prečítame hlavičku a
 * rozpoznáme verziu, kompresné algoritmy a veľkosti.
 *
 * Komentáre v slovenčine.
 */
export interface ChdMetadata {
  /** Verzia CHD formátu (3, 4 alebo 5). */
  version: number;
  /** Zoznam kompresných algoritmov (4 ASCII znaky na každý). */
  compressors: string[];
  /** Logická veľkosť dát (v bajtoch). */
  logicalBytes: bigint | null;
  /** Veľkosť jedného hunku (v bajtoch). */
  hunkBytes: number | null;
  /** Počet hunkov. */
  hunkCount: bigint | null;
  /** Veľkosť jednotky (v bajtoch). */
  unitBytes: number | null;
  /** Metadáta tagy (textové) — napr. CHD v5 trailer. */
  tags: Record<string, string>;
}

const CHD_MAGIC = "MComprHD";

/** Prečíta 32-bitový big-endian unsigned integer. */
function readUint32BE(data: Uint8Array, offset: number): number {
  if (offset + 4 > data.length) return 0;
  return (
    (data[offset] << 24) |
    (data[offset + 1] << 16) |
    (data[offset + 2] << 8) |
    data[offset + 3]
  ) >>> 0;
}

/** Prečíta 64-bitový big-endian unsigned integer ako BigInt. */
function readUint64BE(data: Uint8Array, offset: number): bigint {
  if (offset + 8 > data.length) return 0n;
  let result = 0n;
  for (let i = 0; i < 8; i++) {
    result = (result << 8n) | BigInt(data[offset + i]);
  }
  return result;
}

/** Prečíta 4 ASCII znaky. */
function readAscii4(data: Uint8Array, offset: number): string {
  if (offset + 4 > data.length) return "";
  let s = "";
  for (let i = 0; i < 4; i++) {
    const b = data[offset + i];
    // Ak je bajt 0, je to "žiadny kompresor"
    if (b === 0) break;
    s += String.fromCharCode(b);
  }
  return s;
}

/**
 * Prečíta CHD hlavičku a vráti metadáta.
 *
 * @param header prvých aspoň 124 bajtov CHD súboru
 * @returns ChdMetadata alebo `null`, ak ide o neplatný CHD
 */
export function analyzeChd(header: Uint8Array): ChdMetadata | null {
  if (header.length < 16) return null;

  // Over magic
  for (let i = 0; i < CHD_MAGIC.length; i++) {
    if (header[i] !== CHD_MAGIC.charCodeAt(i)) return null;
  }

  const version = readUint32BE(header, 12);

  if (version === 5) {
    return analyzeChdV5(header);
  } else if (version === 3 || version === 4) {
    return analyzeChdV3V4(header, version);
  }

  // Neznáma verzia — vrátime aspoň verziu
  return {
    version,
    compressors: [],
    logicalBytes: null,
    hunkBytes: null,
    hunkCount: null,
    unitBytes: null,
    tags: {},
  };
}

/**
 * Analyzuje CHD verzie 5.
 */
function analyzeChdV5(header: Uint8Array): ChdMetadata | null {
  if (header.length < 48) return null;

  // 4 kompresné algoritmy (16 bajtov)
  const compressors: string[] = [];
  for (let i = 0; i < 4; i++) {
    const c = readAscii4(header, 16 + i * 4);
    if (c.length > 0) compressors.push(c);
  }

  // logical_bytes (offset 32, 8 bajtov BE)
  const logicalBytes = readUint64BE(header, 32);
  // hunk_bytes (offset 40, 4 bajty BE)
  const hunkBytes = readUint32BE(header, 40);
  // unit_bytes (offset 44, 4 bajty BE)
  const unitBytes = readUint32BE(header, 44);

  let hunkCount: bigint | null = null;
  if (header.length >= 56) {
    hunkCount = readUint64BE(header, 48);
  }

  // V metadatách (traileri) by mohli byť tagy, ale tie vyžadujú
  // prečítať celý trailer na konci súboru — pre detekciu nám to nestačí.
  const tags: Record<string, string> = {};
  // Ak je k dispozícii CHD tag "CHGT" (CHD Hash Tag), prečítame ho
  // — ale to je zložitejšie a vyžaduje čítanie z konca súboru.

  return {
    version: 5,
    compressors,
    logicalBytes,
    hunkBytes,
    hunkCount,
    unitBytes,
    tags,
  };
}

/**
 * Analyzuje CHD verzie 3 alebo 4.
 *
 * V3/V4 hlavička:
 *   offset 0:  magic
 *   offset 8:  length (4 BE)
 *   offset 12: version (4 BE)
 *   offset 16: flags (4 BE)
 *   offset 20: compressors (4 × 4 BE)
 *   offset 36: hunk_bytes (4 BE)
 *   offset 40: total_hunks (8 BE v V4, 4 BE v V3)
 *   ...
 */
function analyzeChdV3V4(header: Uint8Array, version: number): ChdMetadata | null {
  if (header.length < 40) return null;

  const compressors: string[] = [];
  for (let i = 0; i < 4; i++) {
    const c = readAscii4(header, 20 + i * 4);
    if (c.length > 0) compressors.push(c);
  }

  const hunkBytes = readUint32BE(header, 36);

  // Pre verziu 4 je total_hunks 8 bajtov na offsete 40; pre V3 4 bajty na offsete 40
  let hunkCount: bigint | null = null;
  if (version === 4 && header.length >= 48) {
    hunkCount = readUint64BE(header, 40);
  } else if (version === 3 && header.length >= 44) {
    hunkCount = BigInt(readUint32BE(header, 40));
  }

  return {
    version,
    compressors,
    logicalBytes: null, // V3/V4 nemá priamo logical_bytes v hlavičke
    hunkBytes,
    hunkCount,
    unitBytes: null,
    tags: {},
  };
}

/**
 * Pokúsi sa odhadnúť platformu z metadát CHD.
 *
 * Heuristika:
 *  - Ak `unitBytes` je 2048 (typické pre CD) — môže byť PS1 alebo PS2.
 *  - Ak `compressors` obsahuje `cdzl` alebo `cdzs` (CD LZMA/zlib) — PS1/PS2.
 *  - Bez ďalších indícií (napr. zo SHA-1 metadát) nedokážeme presne
 *    rozlíšiť PS1 vs PS2.
 *
 * @returns zoznam kandidátov (PS1/PS2) alebo prázdne pole, ak to nie je CD
 */
export function guessPlatformFromChd(meta: ChdMetadata): Array<"ps1" | "ps2"> {
  const candidates: Array<"ps1" | "ps2"> = [];

  // CD formát — unit_bytes je obyčajne 2048 (Mode 1) alebo 2352 (raw)
  if (meta.unitBytes === 2048 || meta.unitBytes === 2352) {
    candidates.push("ps1", "ps2");
    return candidates;
  }

  // CD kompresia
  if (meta.compressors.some((c) => c === "cdzl" || c === "cdzs" || c === "cdfl")) {
    candidates.push("ps1", "ps2");
    return candidates;
  }

  // Ak je logicalBytes veľmi veľké (> 1 GB), pravdepodobne PS2
  if (meta.logicalBytes !== null && meta.logicalBytes > 1_000_000_000n) {
    candidates.push("ps2");
    return candidates;
  }

  return candidates;
}
