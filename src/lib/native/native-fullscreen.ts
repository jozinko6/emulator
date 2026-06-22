"use client";

/**
 * Native Android fullscreen — per prompt section 15.
 *
 * Implementuje:
 *   - FLAG_KEEP_SCREEN_ON (zabránenie zhasnutia displeja)
 *   - WindowInsetsController immersive sticky mode
 *   - Respektovanie display cutout a safe area
 *   - Obnova pôvodného režimu po ukončení hry
 *   - Landscape preference pre hranie (mobil/tablet)
 *   - Na Android TV iba fullscreen (orientácia sa nemení)
 */
import { getRuntimeInfo } from "./native-platform";

export interface NativeFullscreenPlugin {
  /** Zapne immersive sticky mode + keep screen on. */
  enterImmersive(): Promise<void>;
  /** Vypne immersive mode + vypne keep screen on. */
  exitImmersive(): Promise<void>;
  /** Nastaví orientáciu (landscape / portrait / auto). */
  setOrientation(orientation: "landscape" | "portrait" | "auto"): Promise<void>;
  /** Povolí keep screen on (zabráni zhasnutiu displeja). */
  setKeepScreenOn(enabled: boolean): Promise<void>;
  /** Rešpektuj display cutout (pretablety / mobily s notch). */
  setCutoutMode(respect: boolean): Promise<void>;
}

let cachedPlugin: NativeFullscreenPlugin | null = null;
let enteredImmersive = false;
let originalOrientation: "landscape" | "portrait" | "auto" | null = null;

export function isNativeFullscreenAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return getRuntimeInfo().isNativeAndroid && !!(
    window.Capacitor?.Plugins?.NativeFullscreen ?? window.AndroidBridge?.nativeFullscreen
  );
}

export function getNativeFullscreenPlugin(): NativeFullscreenPlugin | null {
  if (!isNativeFullscreenAvailable()) return null;
  if (cachedPlugin) return cachedPlugin;
  const capacitor = window.Capacitor?.Plugins?.NativeFullscreen as NativeFullscreenPlugin | undefined;
  const bridge = window.AndroidBridge?.nativeFullscreen as NativeFullscreenPlugin | undefined;
  cachedPlugin = capacitor ?? bridge ?? null;
  return cachedPlugin;
}

/**
 * Zapne immersive režim pre hru.
 * - Na Androide: native immersive + landscape + keep screen on
 * - V prehliadači: Web Fullscreen API + screen orientation lock
 */
export async function enterGameFullscreen(
  target: HTMLElement,
  opts: { preferLandscape?: boolean; isTv?: boolean } = {}
): Promise<void> {
  const info = getRuntimeInfo();
  const native = getNativeFullscreenPlugin();

  if (native) {
    if (!opts.isTv && opts.preferLandscape !== false) {
      originalOrientation = "auto";
      await native.setOrientation("landscape");
    }
    await native.enterImmersive();
    await native.setKeepScreenOn(true);
    enteredImmersive = true;
    return;
  }

  // Web fallback
  if (target.requestFullscreen) {
    try {
      await target.requestFullscreen();
    } catch {
      // May fail without user gesture
    }
  }
  // Screen orientation lock (Web API)
  if (opts.preferLandscape !== false && !opts.isTv) {
    try {
      // Some browsers don't have lock() — guard with feature detection
      const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      await orientation.lock?.("landscape");
    } catch {
      // Not all browsers support
    }
  }
  // Keep screen on (Wake Lock API)
  if ("wakeLock" in navigator) {
    try {
      const lock = await (navigator as Navigator & { wakeLock: { request: (t: string) => Promise<unknown> } }).wakeLock.request("screen");
      // Store on element to release later
      (target as HTMLElement & { _wakeLock?: unknown })._wakeLock = lock;
    } catch {
      // Ignored
    }
  }
}

export async function exitGameFullscreen(): Promise<void> {
  const native = getNativeFullscreenPlugin();

  if (native && enteredImmersive) {
    await native.exitImmersive();
    await native.setKeepScreenOn(false);
    if (originalOrientation) {
      await native.setOrientation(originalOrientation);
      originalOrientation = null;
    }
    enteredImmersive = false;
    return;
  }

  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen();
    } catch {
      // Ignored
    }
  }
  try {
    const orientation = screen.orientation as ScreenOrientation & { unlock?: () => void };
    orientation.unlock?.();
  } catch {
    // Ignored
  }
}

/** Hook pre React komponenty — vráti true ak beží na Android TV. */
export function useAndroidTvLayout(): boolean {
  if (typeof window === "undefined") return false;
  return getRuntimeInfo().platform === "android-tv";
}
