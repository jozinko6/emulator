/**
 * Builds a diagnostics report — sanitised, no tokens/passwords/BIOS content.
 */
import { probeCapabilities, detectOS, detectDeviceType } from "@/lib/diagnostics/capability-probe";
import type { DiagnosticsReport } from "@/types/diagnostics";

export async function buildDiagnosticsReport(): Promise<DiagnosticsReport> {
  const caps = await probeCapabilities();

  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const connected = nav?.getGamepads ? Array.from(nav.getGamepads()).filter(Boolean) : [];

  let storage: DiagnosticsReport["storage"];
  if (nav?.storage?.estimate) {
    try {
      const est = await nav.storage.estimate();
      const persisted = nav.storage.persisted ? await nav.storage.persisted() : false;
      storage = {
        quota: est.quota,
        usage: est.usage,
        persistent: persisted,
      };
    } catch {
      storage = undefined;
    }
  }

  return {
    collectedAt: Date.now(),
    userAgent: nav?.userAgent ?? "unknown",
    operatingSystem: detectOS(),
    deviceType: detectDeviceType(),
    cpuCores: nav?.hardwareConcurrency ?? 0,
    deviceMemoryGb: (nav as Navigator & { deviceMemory?: number })?.deviceMemory,
    capabilities: {
      webAssembly: caps.webAssembly,
      webAssemblyThreads: caps.webAssemblyThreads,
      webgl: caps.webgl,
      webgl2: caps.webgl2,
      webglRenderer: caps.webglRenderer ?? undefined,
      sharedArrayBuffer: caps.sharedArrayBuffer,
      crossOriginIsolated: caps.crossOriginIsolated,
      audioContext: caps.audioContext,
      gamepadApi: caps.gamepadApi,
      indexedDB: caps.indexedDB,
      opfs: caps.opfs,
      serviceWorker: caps.serviceWorker,
      storageApi: caps.storageApi,
      fileSystemAccess: caps.fileSystemAccess,
      pointerEvents: caps.pointerEvents,
      touch: caps.touch,
      vibration: caps.vibration,
    },
    storage,
    emulatorAssets: await probeEmulatorAssets(),
    nativePlugins: probeNativePlugins(),
    connectedGamepads: connected.map((g) => ({
      index: g!.index,
      id: g!.id,
      mapping: g!.mapping,
      buttons: g!.buttons.length,
      axes: g!.axes.length,
    })),
    recentErrors: readRecentErrors(),
  };
}

async function probeUrl(path: string): Promise<boolean> {
  if (typeof fetch === "undefined") return false;
  try {
    const response = await fetch(path, { method: "HEAD", cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

async function probeEmulatorAssets(): Promise<DiagnosticsReport["emulatorAssets"]> {
  const [manifest, jsDos, emulatorJs, libarchive] = await Promise.all([
    probeUrl("/emulator-assets/emulator-assets.manifest.json"),
    probeUrl("/emulator-assets/js-dos/js-dos.js"),
    probeUrl("/emulator-assets/emulatorjs/loader.js"),
    probeUrl("/emulator-assets/libarchive/worker-bundle.js"),
  ]);
  return { manifest, jsDos, emulatorJs, libarchive };
}

function probeNativePlugins(): DiagnosticsReport["nativePlugins"] {
  const capacitor = typeof window !== "undefined"
    ? (window.Capacitor as { isPluginAvailable?: (name: string) => boolean } | undefined)
    : undefined;
  const isAvailable = (name: string) => capacitor?.isPluginAvailable?.(name) === true;
  return {
    NativeGamepad: isAvailable("NativeGamepad"),
    NativeStorage: isAvailable("NativeStorage"),
    NativeFilePicker: isAvailable("NativeFilePicker"),
    NativeFullscreen: isAvailable("NativeFullscreen"),
  };
}

/**
 * Read recent errors from a sessionStorage log (kept by app error boundaries).
 * Sanitised — only codes + messages, never stack traces with file paths.
 */
function readRecentErrors(): Array<{ code: string; message: string; timestamp: number }> {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem("rc_error_log");
    if (!raw) return [];
    const arr = JSON.parse(raw) as Array<{ code: string; message: string; timestamp: number }>;
    return arr.slice(-20);
  } catch {
    return [];
  }
}
