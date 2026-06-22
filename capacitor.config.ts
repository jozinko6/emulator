import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for "Jaňo še chce bavkac" Android app.
 *
 * Architecture:
 *   - Next.js zostáva pre web (deploy na Vercel alebo iný hosting)
 *   - Pre Android sa používa samostatný Vite + React shell (android-shell/)
 *   - webDir smeruje na android-shell/dist/ — tento priečinok vytvorí
 *     `npm run android:web` (alias pre `node scripts/build-android-shell.mjs`)
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
 *   - android-shell/dist/ obsahuje UI, JS bundle, CSS
 *   - public/ sa skopíruje do APK ako asset directory
 *   - Emulačné jadrá sa pridávajú cez `npm run setup:cores`
 */
const config: CapacitorConfig = {
  appId: "sk.jano.bavkac",
  appName: "Jaňo še chce bavkac",
  webDir: "android-shell/dist",
  backgroundColor: "#0a0a14",
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
    // Required for cross-origin isolation (SharedArrayBuffer for PS1 WASM)
    captureInput: true,
  },
  server: {
    androidScheme: "https",
    // Force local assets only — no remote loading
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: "#0a0a14",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      androidSplashResourceName: "splash",
    },
  },
};

export default config;
