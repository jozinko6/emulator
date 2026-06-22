/**
 * Core emulator types — shared across all adapters.
 * Per prompt section 5: unified EmulatorAdapter interface.
 */

export type EmulatorPlatform = "dos" | "ps1" | "ps2";

export type EmulatorLifecycleState =
  | "idle"
  | "initializing"
  | "loading"
  | "ready"
  | "running"
  | "paused"
  | "stopping"
  | "error"
  | "destroyed";

export type EmulatorEventType =
  | "initialized"
  | "game-loading"
  | "game-ready"
  | "started"
  | "paused"
  | "resumed"
  | "state-saved"
  | "state-loaded"
  | "error"
  | "destroyed"
  | "performance-update"
  | "input"
  | "fullscreen-entered"
  | "fullscreen-exited";

export interface EmulatorInputEvent {
  type:
    | "button-down"
    | "button-up"
    | "axis"
    | "key-down"
    | "key-up"
    | "pointer";
  control: string;
  value?: number;
  x?: number;
  y?: number;
  timestamp?: number;
}

export interface EmulatorEvent<T = unknown> {
  type: EmulatorEventType;
  payload?: T;
  timestamp: number;
  error?: { code: string; message: string; details?: unknown };
}

export interface EmulatorPerformanceStats {
  fps: number;
  frameTimeMs: number;
  audioLatencyMs?: number;
  cpuUsage?: number;
  memoryMb?: number;
  timestamp: number;
}

export interface ImportedGame {
  id: string;
  platform: EmulatorPlatform;
  name: string;
  mainFile: string;
  files: GameFileManifest[];
  sourceType: ImportSourceType;
  sourceReference?: string;
  createdAt: number;
}

export interface GameFileManifest {
  relativePath: string;
  size: number;
  hash?: string;
  mimeType?: string;
  opfsPath: string;
}

export type ImportSourceType =
  | "local-file"
  | "zip"
  | "rar"
  | "7z"
  | "jsdos"
  | "google-drive"
  | "google-drive-link"
  | "file-system-access";

export interface StoredSaveState {
  slot: number;
  gameId: string;
  fileSize: number;
  opfsPath: string;
  screenshotPath?: string;
  note?: string;
  isAutoSave: boolean;
  emulatorCore: string;
  emulatorVersion: string;
  gameFingerprint: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * The unified adapter interface.
 * UI MUST NOT talk to js-dos / EmulatorJS / Play!.js directly — only through this.
 */
export interface EmulatorAdapter {
  readonly platform: EmulatorPlatform;
  readonly state: EmulatorLifecycleState;

  initialize(container: HTMLElement): Promise<void>;
  loadGame(game: ImportedGame): Promise<void>;
  start(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  reset(): Promise<void>;

  sendInput(event: EmulatorInputEvent): void;

  saveState(slot: number): Promise<StoredSaveState>;
  loadState(slot: number): Promise<void>;
  deleteState(slot: number): Promise<void>;

  setVolume(volume: number): void;
  setMuted(muted: boolean): void;

  enterFullscreen(): Promise<void>;
  exitFullscreen(): Promise<void>;

  getPerformanceStats(): EmulatorPerformanceStats;
  destroy(): Promise<void>;

  subscribe(listener: (event: EmulatorEvent) => void): () => void;
}

export const EMULATOR_CORE_VERSIONS: Record<EmulatorPlatform, { core: string; version: string }> = {
  dos: { core: "jsdos", version: "v8.00.0" },
  ps1: { core: "pcsx-rearmed", version: "r24l" },
  ps2: { core: "play-js", version: "unavailable" },
};
