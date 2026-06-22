import type { EmulatorPlatform } from "./emulator";

export interface GameRecord {
  id: string;
  name: string;
  platform: EmulatorPlatform;
  sourceType: string;
  sourceReference?: string;
  mainFile: string;
  coverUrl?: string;
  size: number;
  createdAt: number;
  updatedAt: number;
  lastPlayedAt?: number;
  totalPlayTimeSeconds: number;
  isFavorite: boolean;
  compatibilityStatus: CompatibilityStatus;
  emulatorVersion: string;
  fileFingerprint: string;
}

export interface GameFileRecord {
  id: string;
  gameId: string;
  relativePath: string;
  opfsPath: string;
  fileName: string;
  extension: string;
  size: number;
  hash?: string;
  mimeType?: string;
}

export interface SaveStateRecord {
  id: string;
  gameId: string;
  slot: number;
  createdAt: number;
  updatedAt: number;
  fileSize: number;
  screenshotPath?: string;
  note?: string;
  isAutoSave: boolean;
  emulatorCore: string;
  emulatorVersion: string;
  gameFingerprint: string;
  opfsPath: string;
}

export type CompatibilityStatus = "unknown" | "works" | "playable" | "issues" | "broken";

export interface BiosRecord {
  id: string;
  platform: EmulatorPlatform;
  fileName: string;
  size: number;
  hash: string;
  region?: string;
  savedAt: number;
  opfsPath: string;
}

export interface ControllerProfileRecord {
  id: string;
  name: string;
  platform: EmulatorPlatform;
  mapping: Record<string, string>;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface EmulatorSettingsRecord {
  platform: EmulatorPlatform;
  volume: number;
  muted: boolean;
  aspectRatio: AspectRatio;
  performanceProfile: PerformanceProfile;
  autoSave: boolean;
  updatedAt: number;
}

export type AspectRatio = "native" | "4:3" | "16:9" | "stretch";
export type PerformanceProfile = "performance" | "balanced" | "quality";

export interface ImportJobRecord {
  id: string;
  status: ImportJobStatus;
  sourceType: string;
  fileName: string;
  totalBytes: number;
  processedBytes: number;
  extractedBytes: number;
  fileCount: number;
  processedFiles: number;
  currentStep: string;
  warnings: string[];
  error?: string;
  createdAt: number;
  updatedAt: number;
  gameId?: string;
}

export type ImportJobStatus =
  | "idle"
  | "selecting"
  | "reading"
  | "validating"
  | "extracting"
  | "detecting"
  | "awaiting-user-selection"
  | "storing"
  | "ready"
  | "error"
  | "cancelled";

export interface PlaySessionRecord {
  id: string;
  gameId: string;
  startedAt: number;
  endedAt?: number;
  durationSeconds: number;
  saveStateSlotUsed?: number;
}

export interface UserPreferenceRecord {
  key: string;
  value: unknown;
  updatedAt: number;
}
