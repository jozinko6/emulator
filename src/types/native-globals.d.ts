/**
 * Global type augmentations for native bridges.
 * Centralized here to avoid conflicting declarations across modules.
 */

 
type AnyPlugin = any;

interface NativeBridgePlugins {
  NativeFullscreen?: AnyPlugin;
  NativeGamepad?: AnyPlugin;
  NativeStorage?: AnyPlugin;
  NativeFilePicker?: AnyPlugin;
  AndroidFilePicker?: AnyPlugin;
}

interface AndroidBridgeLike {
  getPlatform?: () => string;
  isTv?: () => boolean;
  isTablet?: () => boolean;
  nativeFullscreen?: AnyPlugin;
  nativeGamepad?: AnyPlugin;
  nativeStorage?: AnyPlugin;
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
    showOpenFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle[]>;
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
      Plugins?: NativeBridgePlugins & Record<string, unknown>;
    };
    AndroidBridge?: AndroidBridgeLike;
  }
}

export {};
