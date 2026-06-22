"use client";

/**
 * Native Android storage — per prompt section 16.
 *
 * Na Androide sa importované hry ukladajú do app-specific storage
 * (filesDir alebo externalFilesDir). Tento plugin poskytuje JS rozhranie
 * pre natívnu vrstvu, ktorá priamo streamuje súbory bez prechodu cez ArrayBuffer.
 */
import { getRuntimeInfo } from "./native-platform";

export interface NativeStorageInfo {
  /** Dostupné miesto v bajtoch. */
  availableBytes: number;
  /** Celková kapacita v bajtoch. */
  totalBytes: number;
  /** Cesta k app-specific filesDir. */
  filesDir: string;
  /** Cesta k app-specific cacheDir. */
  cacheDir: string;
  /** Cesta k app-specific externalFilesDir (ak je dostupná). */
  externalFilesDir: string | null;
}

export interface NativeStoragePlugin {
  getInfo(): Promise<NativeStorageInfo>;
  /** Vytvorí priečinok v app storage. */
  ensureDir(path: string): Promise<string>;
  /** Skopíruje súbor z Content URI priamo do app storage (streaming, no ArrayBuffer). */
  copyFromUri(sourceUri: string, destinationPath: string): Promise<{ size: number }>;
  /** Odstráni súbor alebo priečinok. */
  remove(path: string): Promise<void>;
  /** Otvorí súbor z app storage ako Blob (pre odovzdanie emulátoru). */
  openAsBlob(path: string): Promise<Blob>;
  /** Získa URL typu blob:// / capacitor:// pre súbor v app storage. */
  getUrl(path: string): Promise<string>;
}

let cachedPlugin: NativeStoragePlugin | null = null;

export function isNativeStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return getRuntimeInfo().isNativeAndroid && !!(
    window.Capacitor?.Plugins?.NativeStorage ?? window.AndroidBridge?.nativeStorage
  );
}

export function getNativeStoragePlugin(): NativeStoragePlugin | null {
  if (!isNativeStorageAvailable()) return null;
  if (cachedPlugin) return cachedPlugin;
  const capacitor = window.Capacitor?.Plugins?.NativeStorage as NativeStoragePlugin | undefined;
  const bridge = window.AndroidBridge?.nativeStorage as NativeStoragePlugin | undefined;
  cachedPlugin = capacitor ?? bridge ?? null;
  return cachedPlugin;
}
