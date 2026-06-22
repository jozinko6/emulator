import { parseCue } from "@/emulators/ps1/cue-parser";
import { findDosLauncher } from "@/emulators/dos/dos-launcher";
import { extname, normalizePath } from "@/lib/security/path-normalizer";
import type { EmulatorPlatform } from "@/types/emulator";
import type { ArchiveEntry } from "@/types/detection";

export interface ImportSourceEntry {
  relativePath: string;
  name: string;
  size: number;
  mimeType: string;
  file?: File;
  internalPath?: string;
  sourceUri?: string;
}

export interface MainFileDecision {
  mainFile: string;
  platform: EmulatorPlatform | null;
  requiresLauncherSelection: boolean;
  launcherCandidates: string[];
  warnings: string[];
}

const PS1_EXTENSIONS = new Set(["cue", "chd", "pbp", "iso", "bin"]);
const DOS_EXTENSIONS = new Set(["jsdos", "bat", "exe", "com"]);

export function fileListToImportEntries(files: File[]): ImportSourceEntry[] {
  return files.map((file) => {
    const rel =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath?.trim() ||
      file.name;
    return {
      relativePath: normalizeImportPath(rel),
      name: file.name,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      file,
    };
  });
}

export function normalizeImportPath(path: string): string {
  return normalizePath(path.replace(/\\/g, "/"));
}

export function archiveEntriesFromSources(entries: ImportSourceEntry[]): ArchiveEntry[] {
  return entries.map((entry) => ({
    path: entry.relativePath,
    size: entry.size,
    isDirectory: false,
  }));
}

export async function chooseMainFile(
  entries: ImportSourceEntry[],
  readText: (entry: ImportSourceEntry) => Promise<string>
): Promise<MainFileDecision> {
  const warnings: string[] = [];
  const files = entries.filter((entry) => entry.size > 0);
  if (files.length === 0) {
    throw new Error("Vybraný zdroj neobsahuje žiadne súbory.");
  }

  const cue = files.find((entry) => extname(entry.relativePath) === "cue");
  if (cue) {
    const cueContent = await readText(cue);
    const missing = validateCueReferences(cue.relativePath, cueContent, files.map((f) => f.relativePath));
    if (missing.length > 0) {
      throw new Error(`CUE odkazuje na chýbajúci súbor: ${missing.join(", ")}`);
    }
    return {
      mainFile: cue.relativePath,
      platform: "ps1",
      requiresLauncherSelection: false,
      launcherCandidates: [],
      warnings,
    };
  }

  const ps1Single = files.find((entry) => ["chd", "pbp", "iso"].includes(extname(entry.relativePath)));
  if (ps1Single) {
    return {
      mainFile: ps1Single.relativePath,
      platform: "ps1",
      requiresLauncherSelection: false,
      launcherCandidates: [],
      warnings,
    };
  }

  const dosLauncher = findDosLauncher(archiveEntriesFromSources(files));
  if (dosLauncher.requiresUserSelection) {
    return {
      mainFile: dosLauncher.candidates[0],
      platform: "dos",
      requiresLauncherSelection: true,
      launcherCandidates: dosLauncher.candidates,
      warnings: [...warnings, ...dosLauncher.reasons],
    };
  }
  if (dosLauncher.mainFile) {
    return {
      mainFile: dosLauncher.mainFile,
      platform: "dos",
      requiresLauncherSelection: false,
      launcherCandidates: dosLauncher.candidates,
      warnings: [...warnings, ...dosLauncher.reasons],
    };
  }

  const firstSupported = files.find((entry) => {
    const ext = extname(entry.relativePath);
    return PS1_EXTENSIONS.has(ext) || DOS_EXTENSIONS.has(ext);
  });
  if (firstSupported) {
    const ext = extname(firstSupported.relativePath);
    return {
      mainFile: firstSupported.relativePath,
      platform: PS1_EXTENSIONS.has(ext) ? "ps1" : "dos",
      requiresLauncherSelection: false,
      launcherCandidates: [],
      warnings,
    };
  }

  throw new Error("Nepodarilo sa nájsť podporovaný hlavný súbor hry.");
}

export function validateCueReferences(
  cuePath: string,
  cueContent: string,
  availablePaths: string[]
): string[] {
  const cue = parseCue(cueContent);
  const cueDir = cuePath.includes("/") ? cuePath.slice(0, cuePath.lastIndexOf("/")) : "";
  const available = new Set(availablePaths.map((path) => normalizeImportPath(path).toLowerCase()));
  const missing: string[] = [];

  for (const file of cue.files) {
    const referenced = normalizeImportPath(cueDir ? `${cueDir}/${file.name}` : file.name).toLowerCase();
    if (!available.has(referenced)) {
      missing.push(file.name);
    }
  }

  return missing;
}

export function sourceTypeForEntries(entries: ImportSourceEntry[]): string {
  if (entries.some((entry) => entry.internalPath)) return "file-system-access";
  if (entries.length > 1) return "file-system-access";
  const ext = extname(entries[0]?.relativePath ?? "");
  if (ext === "zip" || ext === "rar" || ext === "7z" || ext === "jsdos") return ext;
  return "local-file";
}
