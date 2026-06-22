import type { EmulatorPlatform } from "./emulator";

export interface DetectionResult {
  platform: EmulatorPlatform | null;
  confidence: number; // 0..1
  reasons: string[];
  requiresUserSelection: boolean;
  possiblePlatforms: EmulatorPlatform[];
  mainFile?: string;
  warnings: string[];
}

export interface DetectionInput {
  fileName: string;
  fileSize: number;
  fileHeader?: Uint8Array; // first 64 bytes
  siblingFiles?: string[]; // for CUE+BIN
  cueContent?: string;
  isoSystemIndicator?: "ps1" | "ps2" | null;
  chdMetadata?: Record<string, string>;
}

export interface ArchiveEntry {
  path: string;
  size: number;
  isDirectory: boolean;
  compressedSize?: number;
}

export interface ArchiveSummary {
  totalFiles: number;
  totalUncompressedSize: number;
  totalCompressedSize: number;
  compressionRatio: number;
  maxDirectoryDepth: number;
  hasNestedArchive: boolean;
  entries: ArchiveEntry[];
}
