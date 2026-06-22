import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for "Jaňo še chce bavkac" Android app.
 *
 * Per prompt section 6 — Android app via Capacitor.
 *
 * Application ID: sk.jano.bavkac
 * Min Android: 8 (API 26)
 * Targets: Android phone, tablet, Android TV, Google TV, TV boxes.
 *
 * Native plugins (custom Kotlin, in android/app/src/main/java/sk/jano/bavkac/):
 *   - NativeFullscreenPlugin
 *   - NativeGamepadPlugin
 *   - NativeStoragePlugin
 *   - NativeFilePickerPlugin
 *
 * Local assets (offline-ready):
 *   - public/emulator-assets/* are bundled into the APK via Capacitor
 *     (webDir = "static" after `next build`)
 *   - The Android app does NOT fetch assets from a remote server.
 */
const config: CapacitorConfig = {
  appId: "sk.jano.bavkac",
  appName: "Jaňo še chce bavkac",
  webDir: "out",
  backgroundColor: "#0a0a14",
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
    allowMixedContent: false,
    // Required for cross-origin isolation headers (SharedArrayBuffer for PS1 WASM threading)
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: "#0a0a14",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      androidSplashResourceName: "splash",
    },
    NativeFullscreen: {},
    NativeGamepad: {},
    NativeStorage: {},
    NativeFilePicker: {},
  },
  server: {
    androidScheme: "https",
    // Force local assets only — no remote loading
    cleartext: false,
  },
};

export default config;
