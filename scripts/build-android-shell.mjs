// Cross-platform Android shell build script.
// 1. Install android-shell deps
// 2. Run `vite build` (output: android-shell/dist/)
// 3. Copy public/ contents (PWA icons, manifest, emulator-assets) into dist/
//    so Capacitor bundles everything into the APK for offline use.
import { execSync } from "node:child_process";
import { existsSync, cpSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const shellDir = join(root, "android-shell");
const distDir = join(shellDir, "dist");
const publicDir = join(root, "public");

if (!existsSync(shellDir)) {
  console.error(`[android:web] android-shell/ directory not found at ${shellDir}`);
  process.exit(1);
}

console.log("[android:web] Installing android-shell dependencies...");
execSync("npm install", { stdio: "inherit", cwd: shellDir });

console.log("[android:web] Building Vite shell...");
execSync("npx vite build", { stdio: "inherit", cwd: shellDir });

if (!existsSync(distDir)) {
  console.error(`[android:web] Build failed — dist directory not created: ${distDir}`);
  process.exit(1);
}

// Copy public/ (icons, manifest, emulator-assets, offline, downloads) into dist/
if (existsSync(publicDir)) {
  console.log("[android:web] Copying public/ into dist/ (PWA icons, manifest, emulator-assets)...");
  cpSync(publicDir, distDir, {
    recursive: true,
    filter: (src) => {
      // Skip dev-only files
      const rel = src.slice(publicDir.length);
      if (rel.startsWith("/downloads") && rel.endsWith(".apk")) return false;
      return true;
    },
  });
}

console.log("[android:web] Done. Output:", distDir);
console.log("[android:web] Next step: npx cap sync android");
