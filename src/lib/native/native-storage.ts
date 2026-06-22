"use client";

import { registerPlugin } from "@capacitor/core";
import { getRuntimeInfo } from "./native-platform";

export interface NativeStorageInfo {
  availableBytes: number;
  totalBytes: number;
  filesDir: string;
  cacheDir: string;
  externalFilesDir: string | null;
}

export interface NativeFileReference {
  path: string;
  url: string;
  size: number;
}

export interface NativeStoragePlugin {
  getInfo(): Promise<NativeStorageInfo>;
  ensureDir(options: { path: string }): Promise<{ path: string }>;
  copyFromUri(options: { sourceUri: string; destinationPath: string }): Promise<{ size: number }>;
  remove(options: { path: string }): Promise<void>;
  openFile(options: { path: string }): Promise<NativeFileReference>;
  getUrl(options: { path: string }): Promise<{ url: string }>;
}

let cachedPlugin: NativeStoragePlugin | null = null;
const CapacitorNativeStorage = registerPlugin<NativeStoragePlugin>("NativeStorage");

export function isNativeStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return getRuntimeInfo().isNativeAndroid;
}

export function getNativeStoragePlugin(): NativeStoragePlugin | null {
  if (!isNativeStorageAvailable()) return null;
  if (cachedPlugin) return cachedPlugin;
  const bridge = window.AndroidBridge?.nativeStorage as NativeStoragePlugin | undefined;
  cachedPlugin = bridge ?? CapacitorNativeStorage;
  return cachedPlugin;
}
