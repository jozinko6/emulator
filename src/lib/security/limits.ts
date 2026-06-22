/**
 * Configurable safety limits for archives and imports.
 * Per prompt section 11.
 */
import type { EmulatorPlatform } from "@/types/emulator";

export interface ArchiveLimits {
  maxFiles: number;
  maxPathLength: number;
  maxDirectoryDepth: number;
  maxNestedArchiveDepth: number;
  maxCompressionRatio: number;
}

export const DEFAULT_ARCHIVE_LIMITS: ArchiveLimits = {
  maxFiles: 10_000,
  maxPathLength: 300,
  maxDirectoryDepth: 20,
  maxNestedArchiveDepth: 1,
  maxCompressionRatio: 1000,
};

export const MAX_GAME_SIZE_BYTES: Record<EmulatorPlatform, number> = {
  dos: 2 * 1024 * 1024 * 1024, // 2 GB
  ps1: 4 * 1024 * 1024 * 1024, // 4 GB
  ps2: 10 * 1024 * 1024 * 1024, // 10 GB
};

export const NESTED_ARCHIVE_EXTENSIONS = [
  ".zip",
  ".rar",
  ".7z",
  ".tar",
  ".gz",
  ".bz2",
  ".xz",
];

export function isNestedArchive(path: string): boolean {
  const lower = path.toLowerCase();
  return NESTED_ARCHIVE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export interface CompressionRatioCheck {
  ratio: number;
  exceeded: boolean;
}

export function checkCompressionRatio(
  uncompressed: number,
  compressed: number
): CompressionRatioCheck {
  if (compressed === 0) return { ratio: 1, exceeded: false };
  const ratio = uncompressed / compressed;
  return { ratio, exceeded: ratio > DEFAULT_ARCHIVE_LIMITS.maxCompressionRatio };
}
