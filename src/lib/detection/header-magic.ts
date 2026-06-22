/**
 * Magic bytes — identifikácia formátu podľa hlavičky súboru.
 *
 * Per prompt ETAPA 4. Podporované signatúry:
 *  - ISO9660:  `01 43 44 30 31 01` na offsete 0x8001 (sektor 16, "CD001")
 *  - CHD:      `"MComprHD"` na začiatku (8 bajtov ASCII)
 *  - PBP:      `00 50 42 50` ("PBP" s NUL prefixom) na začiatku
 *  - ELF:      `7F 45 4C 46` ("\x7FELF") na začiatku
 *  - JSDOS:    ZIP obsahujúci `.jsdos/content/` directory (overuje sa volajúcim
 *              archívnym parserom — tu vrátime len "zip" a caller sa rozhodne)
 *  - RAR:      `52 61 72 21 1A 07` ("Rar!\x1a\x07")
 *  - ZIP:      `50 4B 03 04` ("PK\x03\x04")
 *
 * Komentáre v slovenčine.
 */

export type MagicFormat =
  | "iso9660"
  | "chd"
  | "pbp"
  | "elf"
  | "zip"
  | "rar"
  | "unknown";

export interface MagicMatch {
  format: MagicFormat;
  /** Reťazcová reprezentácia signatúry, ktorá sa zhodovala. */
  signature: string;
}

/** ISO9660 hlavička "CD001" sa nachádza na offsete 0x8001 (sektor 16 * 2048 + 1). */
const ISO9660_HEADER_OFFSET = 0x8001;
const ISO9660_SIGNATURE = [0x01, 0x43, 0x44, 0x30, 0x31, 0x01] as const;

const CHD_SIGNATURE = "MComprHD";
const PBP_SIGNATURE = [0x00, 0x50, 0x42, 0x50] as const;
const ELF_SIGNATURE = [0x7f, 0x45, 0x4c, 0x46] as const;
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04] as const;
const RAR_SIGNATURE = [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07] as const;

/** Koľko bajtov potrebuje `detectMagic` načítaných na overenie všetkých signatúr. */
export const MAGIC_HEADER_BYTES_NEEDED = ISO9660_HEADER_OFFSET + ISO9660_SIGNATURE.length;

/**
 * Skontroluje, či sa bajty na danom offsete zhodujú s očakávanou signatúrou.
 */
function matchesAt(
  data: Uint8Array,
  offset: number,
  signature: readonly number[]
): boolean {
  if (offset + signature.length > data.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (data[offset + i] !== signature[i]) return false;
  }
  return true;
}

/**
 * Identifikuje formát súboru podľa prvých bajtov hlavičky.
 *
 * Pre ISO9660 je potrebných aspoň `MAGIC_HEADER_BYTES_NEEDED` bajtov
 * (0x8007 ≈ 32 kB), inak sa ISO9660 nedá overiť. Pre ostatné formáty
 * stačí len prvých 8 bajtov.
 *
 * @param header prvých N bajtov súboru
 * @returns objekt s identifikovaným formátom; `"unknown"` ak sa nerozpoznal
 */
export function detectMagic(header: Uint8Array): MagicMatch {
  if (header.length === 0) {
    return { format: "unknown", signature: "" };
  }

  // CHD — 8 bajtov ASCII "MComprHD"
  if (header.length >= CHD_SIGNATURE.length) {
    let matches = true;
    for (let i = 0; i < CHD_SIGNATURE.length; i++) {
      if (header[i] !== CHD_SIGNATURE.charCodeAt(i)) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return { format: "chd", signature: CHD_SIGNATURE };
    }
  }

  // PBP — 4 bajty `00 50 42 50`
  if (matchesAt(header, 0, PBP_SIGNATURE)) {
    return { format: "pbp", signature: "PBP" };
  }

  // ELF — 4 bajty `7F 45 4C 46`
  if (matchesAt(header, 0, ELF_SIGNATURE)) {
    return { format: "elf", signature: "ELF" };
  }

  // ZIP — 4 bajty `50 4B 03 04`
  if (matchesAt(header, 0, ZIP_SIGNATURE)) {
    return { format: "zip", signature: "PK\\x03\\x04" };
  }

  // RAR — 6 bajtov `52 61 72 21 1A 07`
  if (matchesAt(header, 0, RAR_SIGNATURE)) {
    return { format: "rar", signature: "Rar!\\x1a\\x07" };
  }

  // ISO9660 — 6 bajtov `01 43 44 30 31 01` na offsete 0x8001
  if (header.length >= ISO9660_HEADER_OFFSET + ISO9660_SIGNATURE.length) {
    if (matchesAt(header, ISO9660_HEADER_OFFSET, ISO9660_SIGNATURE)) {
      return { format: "iso9660", signature: "CD001" };
    }
  }

  return { format: "unknown", signature: "" };
}

/**
 * Skontroluje, či ZIP archív obsahuje `.jsdos/content/` adresár.
 *
 * Pre js-dos balíky je typické, že vnútri ZIP-u je priečinok `.jsdos/`
 * obsahujúci `content/...` (herné súbory) a `jsdos.json` (konfigurácia).
 * Túto kontrolu voláme z `platform-detector.ts`, keď rozpoznáme ZIP —
 * tým rozlíšime medzi .jsdos balíkom a bežným ZIP archívom.
 *
 * @param entryPaths zoznam ciest v archíve (napr. `[".jsdos/content/START.BAT", ...]`)
 */
export function isJsdosBundle(entryPaths: string[]): boolean {
  return entryPaths.some((p) => {
    // Normalizuj cestu — Windows cesty s `\` nahraď `/`
    const normalized = p.replace(/\\/g, "/");
    // Buď priamo `.jsdos/content/` alebo `./jsdos/content/`
    return (
      normalized.startsWith(".jsdos/content/") ||
      normalized.startsWith("./.jsdos/content/") ||
      normalized === ".jsdos/content" ||
      normalized === "./.jsdos/content"
    );
  });
}
