"use client";

/**
 * Native Android file picker — per prompt section 11.
 *
 * Používa Android Storage Access Framework (ACTION_OPEN_DOCUMENT / ACTION_OPEN_DOCUMENT_TREE)
 * cez Capacitor plugin alebo natívny Kotlin bridge.
 *
 * Dôležité: veľké súbory sa NEkopírujú cez Base64 alebo ArrayBuffer.
 * Natívna vrstva súbor priamo streamuje do app-specific storage
 * a JavaScriptu odovzdá iba metadata (cesta, názov, veľkosť, MIME).
 */
import { getRuntimeInfo } from "./native-platform";

export interface PickedAndroidFile {
  /** Bezpečná interná cesta v app-specific storage (kam bol súbor skopírovaný). */
  internalPath: string;
  /** Pôvodný názov súboru. */
  name: string;
  /** Veľkosť v bajtoch. */
  size: number;
  /** MIME typ. */
  mimeType: string;
  /** Pôvodný Content URI (pre prípadné ďalšie operácie). */
  sourceUri: string;
}

export interface PickedAndroidDirectory {
  /** Bezpečná interná cesta k priečinku (kam boli súbory skopírované). */
  internalPath: string;
  /** Zoznam súborov v priečinku (vrátane podpriečinkov). */
  files: PickedAndroidFile[];
  /** Pôvodný Content URI priečinka. */
  sourceUri: string;
}

export interface CopyResult {
  success: boolean;
  internalPath: string;
  size: number;
  error?: string;
}

export interface FilePickerOptions {
  multiple?: boolean;
  mimeTypes?: string[];
  /** Povoliť výber priečinka (default = false). */
  allowDirectory?: boolean;
}

export interface AndroidFilePickerPlugin {
  pickFiles(options: FilePickerOptions): Promise<PickedAndroidFile[]>;
  pickDirectory(): Promise<PickedAndroidDirectory>;
  copyToAppStorage(uri: string, destinationPath: string): Promise<CopyResult>;
  releasePermission(uri: string): Promise<void>;
}

let cachedPlugin: AndroidFilePickerPlugin | null = null;

/**
 * Vráti Android file picker plugin, ak je dostupný.
 * V prehliadači (web/PWA) vracia null — tam sa použije štandardný file picker.
 */
export function getAndroidFilePicker(): AndroidFilePickerPlugin | null {
  if (typeof window === "undefined") return null;
  const info = getRuntimeInfo();
  if (!info.isNativeAndroid) return null;

  if (cachedPlugin) return cachedPlugin;

  // Try Capacitor plugin first
  const capacitorPlugin = (window.Capacitor?.Plugins?.AndroidFilePicker as unknown as AndroidFilePickerPlugin | undefined);
  if (capacitorPlugin) {
    cachedPlugin = capacitorPlugin;
    return cachedPlugin;
  }

  // Try custom Android bridge
  if (window.AndroidBridge && typeof (window.AndroidBridge as unknown as AndroidFilePickerPlugin).pickFiles === "function") {
    cachedPlugin = window.AndroidBridge as unknown as AndroidFilePickerPlugin;
    return cachedPlugin;
  }

  return null;
}

/**
 * Helper — vyberie jeden alebo viac súborov.
 * V Androide použije SAF, v prehliadači vráti null (použiť input[type=file]).
 */
export async function pickAndroidFiles(
  options: FilePickerOptions = {}
): Promise<PickedAndroidFile[] | null> {
  const plugin = getAndroidFilePicker();
  if (!plugin) return null;
  return plugin.pickFiles(options);
}

/**
 * Helper — vyberie priečinok a skopíruje jeho obsah do app storage.
 */
export async function pickAndroidDirectory(): Promise<PickedAndroidDirectory | null> {
  const plugin = getAndroidFilePicker();
  if (!plugin) return null;
  return plugin.pickDirectory();
}
