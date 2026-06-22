/**
 * Capability probe — runs in browser, returns what the device supports.
 * Used by /diagnostics and by the PS2 page to gate experimental features.
 */
import type { CapabilityProbe } from "@/types/diagnostics";

export async function probeCapabilities(): Promise<CapabilityProbe> {
  const webgl = detectWebGL();
  const webgl2 = detectWebGL2();

  return {
    webAssembly: typeof WebAssembly !== "undefined" && typeof WebAssembly.instantiate === "function",
    webAssemblyThreads:
      typeof WebAssembly !== "undefined" &&
      typeof WebAssembly.validate === "function" &&
      WebAssembly.validate(
        new Uint8Array([
          0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 5,
          4, 1, 1, 1, 11, 7, 2, 1, 0, 65, 0, 11,
        ])
      ),
    webgl: webgl !== null,
    webgl2: webgl2 !== null,
    webglRenderer: webgl2?.renderer ?? webgl?.renderer ?? null,
    sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
    crossOriginIsolated:
      typeof window !== "undefined" && window.crossOriginIsolated === true,
    audioContext:
      typeof window !== "undefined" &&
      (typeof AudioContext !== "undefined" ||
        typeof (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext !== "undefined"),
    gamepadApi: typeof navigator !== "undefined" && !!navigator.getGamepads,
    indexedDB: typeof indexedDB !== "undefined",
    opfs:
      typeof navigator !== "undefined" &&
      !!navigator.storage &&
      typeof navigator.storage.getDirectory === "function",
    serviceWorker: typeof navigator !== "undefined" && "serviceWorker" in navigator,
    storageApi:
      typeof navigator !== "undefined" &&
      !!navigator.storage &&
      typeof navigator.storage.estimate === "function",
    fileSystemAccess:
      typeof window !== "undefined" &&
      typeof (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker === "function",
    pointerEvents:
      typeof window !== "undefined" && typeof PointerEvent !== "undefined",
    touch:
      typeof window !== "undefined" &&
      (("ontouchstart" in window) || navigator.maxTouchPoints > 0),
    vibration: typeof navigator !== "undefined" && !!navigator.vibrate,
    simd:
      typeof WebAssembly !== "undefined" &&
      WebAssembly.validate(
        new Uint8Array([
          0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10,
          10, 1, 8, 0, 65, 0, 253, 15, 253, 11, 0,
        ])
      ),
  };
}

function detectWebGL(): { renderer: string } | null {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      (canvas.getContext("webgl") as WebGLRenderingContext | null) ??
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = ext
      ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    return { renderer: String(renderer) };
  } catch {
    return null;
  }
}

function detectWebGL2(): { renderer: string } | null {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = ext
      ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    return { renderer: String(renderer) };
  } catch {
    return null;
  }
}

export function detectDeviceType(): "mobile" | "tablet" | "desktop" | "unknown" {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobi|android|iphone/.test(ua)) return "mobile";
  return "desktop";
}

export function detectOS(): string {
  if (typeof navigator === "undefined") return "Unknown";
  const ua = navigator.userAgent;
  if (/Windows NT 10/.test(ua)) return "Windows 10/11";
  if (/Windows NT/.test(ua)) return "Windows";
  if (/Mac OS X ([\d_]+)/.test(ua)) {
    const m = ua.match(/Mac OS X ([\d_]+)/);
    return `macOS ${m ? m[1].replace(/_/g, ".") : ""}`;
  }
  if (/Android ([\d.]+)/.test(ua)) {
    const m = ua.match(/Android ([\d.]+)/);
    return `Android ${m ? m[1] : ""}`;
  }
  if (/iPhone OS ([\d_]+)/.test(ua)) {
    const m = ua.match(/iPhone OS ([\d_]+)/);
    return `iOS ${m ? m[1].replace(/_/g, ".") : ""}`;
  }
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown";
}
