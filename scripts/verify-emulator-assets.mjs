#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const manifestPath = join(root, "public", "emulator-assets", "emulator-assets.manifest.json");

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function fail(message) {
  console.error(`[verify:cores] ${message}`);
  process.exitCode = 1;
}

if (!existsSync(manifestPath)) {
  fail("Missing public/emulator-assets/emulator-assets.manifest.json. Run npm run setup:cores.");
  process.exit();
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
for (const group of ["jsDos", "emulatorJs", "libarchive"]) {
  if (!Array.isArray(manifest[group]) || manifest[group].length === 0) {
    fail(`Manifest group ${group} is empty.`);
    continue;
  }
  for (const asset of manifest[group]) {
    const path = join(root, asset.path);
    if (!existsSync(path)) {
      fail(`Missing asset ${asset.path}`);
      continue;
    }
    const size = statSync(path).size;
    if (size <= 0 || size !== asset.size) {
      fail(`Size mismatch for ${asset.path}: expected ${asset.size}, got ${size}`);
    }
    const hash = sha256(path);
    if (hash !== asset.sha256) {
      fail(`SHA-256 mismatch for ${asset.path}`);
    }
  }
}

if (process.exitCode) process.exit();
console.log("Emulator asset manifest verified.");
