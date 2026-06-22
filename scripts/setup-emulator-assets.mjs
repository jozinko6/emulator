#!/usr/bin/env node
/**
 * Setup script for emulator assets — per prompt section 22.
 *
 * Downloads ONLY legally redistributable open-source assets:
 *   - libarchive.js worker bundle (Apache-2.0)
 *
 * Does NOT download:
 *   - js-dos WASM core (GPL-2.0 — user must download manually)
 *   - EmulatorJS / PCSX-ReARMed core (GPL-2.0 — user must download manually)
 *   - PlayStation BIOS (proprietary — user must provide)
 *   - ROM / ISO / games (proprietary — user must provide)
 *
 * For non-redistributable assets, the script prints clear manual instructions.
 *
 * Never pretends success — every missing asset is reported honestly.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const publicDir = join(root, "public");
const assetsDir = join(publicDir, "emulator-assets");
const libarchiveDir = join(publicDir, "libarchive");

// Asset registry — only open-source / redistributable assets.
// SHA-256 hashes verified after download.
const ASSETS = [
  {
    name: "libarchive.js worker bundle",
    url: "https://unpkg.com/libarchive.js@2.0.2/dist/worker-bundle.js",
    dest: join(libarchiveDir, "worker-bundle.js"),
    expectedSha256: null, // libarchive.js publishes without integrity check; we skip
    redistLicense: "Apache-2.0",
    required: true,
  },
];

const MANUAL_STEPS = [
  {
    name: "js-dos (DOS emulator core)",
    license: "GPL-2.0",
    reason: "GPL-2.0 requires source distribution alongside binary; user must download directly.",
    instructions: [
      "1. Visit https://github.com/caiiiycuk/js-dos/releases",
      "2. Download the latest release (e.g. js-dos-8.00.zip)",
      "3. Extract and copy the following files into public/emulator-assets/js-dos/:",
      "   - js-dos.js",
      "   - js-dos.wasm (or js-dos.wasm.js if emulated)",
      "   - dosbox.conf (if present)",
      "4. Verify SHA-256 against the release page.",
    ],
    required: true,
  },
  {
    name: "EmulatorJS / PCSX-ReARMed (PS1 emulator core)",
    license: "GPL-2.0",
    reason: "GPL-2.0 requires source distribution alongside binary; user must download directly.",
    instructions: [
      "1. Visit https://gitlab.com/EmulatorJS/EmulatorJS/-/releases",
      "2. Download the latest release archive",
      "3. Extract and copy the following files into public/emulator-assets/emulatorjs/:",
      "   - loader.js",
      "   - emulator.min.js",
      "   - cores/pcsx-rearmed-linux.data (or -wasm.data for WebAssembly)",
      "   - cores/pcsx-rearmed-linux.wasm",
      "   - Other core files as needed",
      "4. Verify SHA-256 against the release page.",
    ],
    required: true,
  },
  {
    name: "PlayStation 1 BIOS",
    license: "Proprietary — Sony Computer Entertainment",
    reason: "BIOS is copyrighted. The app does NOT provide it.",
    instructions: [
      "1. Use your own legally dumped PS1 BIOS (e.g. SCPH-1001, SCPH-5501).",
      "2. Launch the app, go to Settings → BIOS.",
      "3. Upload your BIOS file. It will be stored locally in OPFS only.",
      "4. The app will never upload your BIOS to any server.",
    ],
    required: false, // BIOS is required to play PS1 games, but optional to setup
  },
];

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.log(`[setup] Created directory: ${dir}`);
  }
}

function sha256(filePath) {
  const buf = readFileSync(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

async function download(url, dest) {
  console.log(`[setup] Downloading ${url}...`);
  return new Promise((resolve, reject) => {
    const result = spawnSync("node", ["-e", `
      const https = require('https');
      const http = require('http');
      const fs = require('fs');
      const dest = ${JSON.stringify(dest)};
      const url = ${JSON.stringify(url)};
      const proto = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(dest);
      proto.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // follow redirect
          const redirectUrl = response.headers.location;
          proto.get(redirectUrl, (r2) => {
            r2.pipe(file);
            file.on('finish', () => { file.close(); process.exit(0); });
          }).on('error', (e) => { console.error(e); process.exit(1); });
        } else if (response.statusCode === 200) {
          response.pipe(file);
          file.on('finish', () => { file.close(); process.exit(0); });
        } else {
          console.error('HTTP ' + response.statusCode);
          process.exit(1);
        }
      }).on('error', (e) => { console.error(e); process.exit(1); });
    `], { stdio: "inherit" });
    if (result.status === 0) {
      resolve();
    } else {
      reject(new Error(`Download failed with status ${result.status}`));
    }
  });
}

async function main() {
  console.log("=== Jaňo še chce bavkac — emulator assets setup ===\n");

  // Step 1: Ensure directories exist
  console.log("[setup] Step 1: Ensure directories...");
  ensureDir(assetsDir);
  ensureDir(join(assetsDir, "js-dos"));
  ensureDir(join(assetsDir, "emulatorjs"));
  ensureDir(libarchiveDir);
  console.log();

  // Step 2: Download redistributable assets
  console.log("[setup] Step 2: Download redistributable assets...");
  let allDownloaded = true;
  for (const asset of ASSETS) {
    if (existsSync(asset.dest)) {
      console.log(`[setup] ✓ ${asset.name} already present at ${asset.dest}`);
      if (asset.expectedSha256) {
        const actual = sha256(asset.dest);
        if (actual !== asset.expectedSha256) {
          console.warn(`[setup] ⚠ SHA-256 mismatch for ${asset.name}`);
          console.warn(`    expected: ${asset.expectedSha256}`);
          console.warn(`    actual:   ${actual}`);
        }
      }
      continue;
    }
    try {
      await download(asset.url, asset.dest);
      console.log(`[setup] ✓ Downloaded ${asset.name} → ${asset.dest}`);
      if (asset.expectedSha256) {
        const actual = sha256(asset.dest);
        if (actual !== asset.expectedSha256) {
          console.warn(`[setup] ⚠ SHA-256 mismatch for ${asset.name}`);
          allDownloaded = false;
        }
      }
    } catch (e) {
      console.error(`[setup] ✗ Failed to download ${asset.name}: ${e.message}`);
      allDownloaded = false;
    }
  }
  console.log();

  // Step 3: Report manual steps for non-redistributable assets
  console.log("[setup] Step 3: Manual steps required for non-redistributable assets:");
  for (const step of MANUAL_STEPS) {
    console.log();
    console.log(`  ${step.required ? "[REQUIRED]" : "[OPTIONAL]"} ${step.name}`);
    console.log(`  License: ${step.license}`);
    console.log(`  Reason: ${step.reason}`);
    console.log(`  Instructions:`);
    for (const line of step.instructions) {
      console.log(`    ${line}`);
    }
  }
  console.log();

  // Step 4: Verify final state
  console.log("[setup] Step 4: Verify final state...");
  const jsDosPresent = existsSync(join(assetsDir, "js-dos", "js-dos.js"));
  const emulatorJsPresent = existsSync(join(assetsDir, "emulatorjs", "loader.js"));
  const libarchivePresent = existsSync(join(libarchiveDir, "worker-bundle.js"));

  console.log(`  libarchive.js worker bundle: ${libarchivePresent ? "✓" : "✗"}`);
  console.log(`  js-dos core (manual):        ${jsDosPresent ? "✓" : "✗ — DOS emulation will not work"}`);
  console.log(`  EmulatorJS core (manual):    ${emulatorJsPresent ? "✓" : "✗ — PS1 emulation will not work"}`);
  console.log();

  if (!jsDosPresent || !emulatorJsPresent) {
    console.log("[setup] ⚠ Emulator cores are missing. The app will run but");
    console.log("    DOS / PS1 emulation will fail with EMULATOR_CORE_UNAVAILABLE.");
    console.log("    Please complete the manual steps above before playing games.");
    console.log();
  }

  if (allDownloaded && libarchivePresent) {
    console.log("[setup] ✓ All redistributable assets installed successfully.");
  } else {
    console.log("[setup] ✗ Some redistributable assets failed to install.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("[setup] Fatal error:", e);
  process.exit(1);
});
