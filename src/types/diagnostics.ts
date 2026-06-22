import type { EmulatorPlatform } from "./emulator";

export interface DiagnosticsReport {
  collectedAt: number;
  userAgent: string;
  operatingSystem: string;
  deviceType: "mobile" | "tablet" | "desktop" | "unknown";
  cpuCores: number;
  deviceMemoryGb?: number;
  capabilities: {
    webAssembly: boolean;
    webAssemblyThreads?: boolean;
    webgl: boolean;
    webgl2: boolean;
    webglRenderer?: string;
    sharedArrayBuffer: boolean;
    crossOriginIsolated: boolean;
    audioContext: boolean;
    gamepadApi: boolean;
    indexedDB: boolean;
    opfs: boolean;
    serviceWorker: boolean;
    storageApi: boolean;
    fileSystemAccess: boolean;
    pointerEvents: boolean;
    touch: boolean;
    vibration: boolean;
    simd?: boolean;
  };
  storage?: {
    quota?: number;
    usage?: number;
    persistent?: boolean;
  };
  connectedGamepads: Array<{
    index: number;
    id: string;
    mapping: string;
    buttons: number;
    axes: number;
  }>;
  activeEmulatorCore?: EmulatorPlatform;
  performance?: {
    fps?: number;
    frameTimeMs?: number;
    audioLatencyMs?: number;
  };
  recentErrors: Array<{ code: string; message: string; timestamp: number }>;
}

export interface CapabilityProbe {
  webAssembly: boolean;
  webAssemblyThreads: boolean;
  webgl: boolean;
  webgl2: boolean;
  webglRenderer: string | null;
  sharedArrayBuffer: boolean;
  crossOriginIsolated: boolean;
  audioContext: boolean;
  gamepadApi: boolean;
  indexedDB: boolean;
  opfs: boolean;
  serviceWorker: boolean;
  storageApi: boolean;
  fileSystemAccess: boolean;
  pointerEvents: boolean;
  touch: boolean;
  vibration: boolean;
  simd: boolean;
}
