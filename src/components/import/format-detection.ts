/**
 * Formát detection helper pre import wizard.
 * Rozpozná formát podľa prípony súboru — používa sa na rozhodnutie,
 * či súbor rozbaľovať cez archive worker alebo importovať priamo.
 *
 * Komentáre v slovenčine.
 */
import type { ArchiveFormat } from "@/lib/archive/archive-types";

/** Podporované "voľné" formáty hier (nie archívy). */
export type LooseGameFormat =
  | "iso"
  | "bin"
  | "cue"
  | "chd"
  | "cso"
  | "pbp"
  | "elf"
  | "jsdos"
  | "exe"
  | "bat"
  | "com";

export type ImportableFormat = ArchiveFormat | LooseGameFormat | "unknown";

/** Zoznam akceptovaných prípon pre file picker. */
export const ACCEPTED_EXTENSIONS = [
  ".zip",
  ".rar",
  ".7z",
  ".iso",
  ".bin",
  ".cue",
  ".chd",
  ".cso",
  ".pbp",
  ".elf",
  ".jsdos",
  ".exe",
  ".bat",
  ".com",
];

/** Akceptovací reťazec pre <input type="file" accept="...">. */
export const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(",");

/**
 * Rozpozná formát súboru podľa prípony.
 */
export function detectFormat(fileName: string): ImportableFormat {
  const lower = fileName.toLowerCase();
  const idx = lower.lastIndexOf(".");
  if (idx === -1) return "unknown";
  const ext = lower.slice(idx);
  switch (ext) {
    case ".zip":
      return "zip";
    case ".rar":
      return "rar";
    case ".7z":
      return "7z";
    case ".iso":
      return "iso";
    case ".bin":
      return "bin";
    case ".cue":
      return "cue";
    case ".chd":
      return "chd";
    case ".cso":
      return "cso";
    case ".pbp":
      return "pbp";
    case ".elf":
      return "elf";
    case ".jsdos":
      return "jsdos";
    case ".exe":
      return "exe";
    case ".bat":
      return "bat";
    case ".com":
      return "com";
    default:
      return "unknown";
  }
}

/** Vráti true, ak je súbor archív, ktorý treba rozbaliť. */
export function isArchive(format: ImportableFormat): format is "zip" | "rar" | "7z" {
  return format === "zip" || format === "rar" || format === "7z";
}

/** Vráti true, ak je formát podporovaný (nie "unknown"). */
export function isSupported(format: ImportableFormat): format is Exclude<ImportableFormat, "unknown"> {
  return format !== "unknown";
}
