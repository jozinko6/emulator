#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { pipeline } from "node:stream/promises";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const tmpDir = join(root, ".tmp", "emulator-assets");
const publicAssets = join(root, "public", "emulator-assets");
const manifestPath = join(publicAssets, "emulator-assets.manifest.json");

const downloads = [
  {
    group: "emulatorJs",
    name: "loader.js",
    url: "https://cdn.emulatorjs.org/stable/data/loader.js",
    dest: "emulatorjs/loader.js",
    license: "GPL-3.0",
    source: "EmulatorJS official stable CDN",
  },
  {
    group: "emulatorJs",
    name: "emulator.min.js",
    url: "https://cdn.emulatorjs.org/stable/data/emulator.min.js",
    dest: "emulatorjs/data/emulator.min.js",
    license: "GPL-3.0",
    source: "EmulatorJS official stable CDN",
  },
  {
    group: "emulatorJs",
    name: "emulator.min.css",
    url: "https://cdn.emulatorjs.org/stable/data/emulator.min.css",
    dest: "emulatorjs/data/emulator.min.css",
    license: "GPL-3.0",
    source: "EmulatorJS official stable CDN",
  },
  {
    group: "emulatorJs",
    name: "pcsx_rearmed-wasm.data",
    url: "https://cdn.emulatorjs.org/stable/data/cores/pcsx_rearmed-wasm.data",
    dest: "emulatorjs/data/cores/pcsx_rearmed-wasm.data",
    license: "GPL-3.0 / core license in upstream package",
    source: "EmulatorJS official stable CDN",
  },
  {
    group: "emulatorJs",
    name: "version.json",
    url: "https://cdn.emulatorjs.org/stable/data/version.json",
    dest: "emulatorjs/data/version.json",
    license: "GPL-3.0",
    source: "EmulatorJS official stable CDN",
  },
];

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

async function downloadFile(asset) {
  const finalPath = join(publicAssets, asset.dest);
  const tempPath = join(tmpDir, `${asset.dest.replace(/[\\/]/g, "__")}.tmp`);
  ensureDir(dirname(finalPath));
  ensureDir(dirname(tempPath));

  if (existsSync(finalPath) && statSync(finalPath).size > 0) {
    return describe(asset, finalPath);
  }

  const response = await fetch(asset.url);
  if (!response.ok || !response.body) {
    throw new Error(`Download failed for ${asset.url}: HTTP ${response.status}`);
  }
  await pipeline(response.body, createWriteStream(tempPath));
  if (statSync(tempPath).size === 0) {
    throw new Error(`Downloaded empty file for ${asset.url}`);
  }
  renameSync(tempPath, finalPath);
  return describe(asset, finalPath);
}

function describe(asset, path) {
  return {
    name: asset.name,
    path: relative(root, path).replaceAll("\\", "/"),
    url: asset.url,
    source: asset.source,
    license: asset.license,
    size: statSync(path).size,
    sha256: sha256(path),
  };
}

function npmPack(packageSpec) {
  ensureDir(tmpDir);
  const result = spawnSync("npm", ["pack", packageSpec, "--pack-destination", tmpDir], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    shell: process.platform === "win32",
  });
  if (result.status !== 0) throw new Error(`npm pack failed for ${packageSpec}`);
  return join(tmpDir, result.stdout.trim().split(/\r?\n/).pop());
}

function extractTarball(tarball, outDir) {
  rmSync(outDir, { recursive: true, force: true });
  ensureDir(outDir);
  const result = spawnSync("tar", ["-xzf", tarball, "-C", outDir], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) throw new Error(`tar extraction failed for ${tarball}`);
  return join(outDir, "package");
}

function copyAsset(group, name, sourcePath, dest, meta) {
  if (!existsSync(sourcePath)) throw new Error(`Missing source asset: ${sourcePath}`);
  const finalPath = join(publicAssets, dest);
  ensureDir(dirname(finalPath));
  copyFileSync(sourcePath, finalPath);
  const manifestPath = relative(root, finalPath).replaceAll("\\", "/");
  return {
    name,
    path: manifestPath,
    url: meta.url,
    source: meta.source,
    license: meta.license,
    size: statSync(finalPath).size,
    sha256: sha256(finalPath),
  };
}

async function main() {
  ensureDir(publicAssets);
  ensureDir(tmpDir);

  const manifest = {
    generatedAt: new Date().toISOString(),
    note: "No BIOS, ROM, ISO, or game content is downloaded by this script.",
    jsDos: [],
    emulatorJs: [],
    libarchive: [],
  };

  const jsDosTarball = npmPack("js-dos@8.4.0");
  const jsDosRoot = extractTarball(jsDosTarball, join(tmpDir, "js-dos"));
  const jsDosMeta = {
    url: "https://registry.npmjs.org/js-dos/-/js-dos-8.4.0.tgz",
    source: "npm package js-dos@8.4.0",
    license: "GPL-2.0",
  };
  for (const file of ["js-dos.js", "js-dos.css"]) {
    manifest.jsDos.push(copyAsset("jsDos", file, join(jsDosRoot, "dist", file), `js-dos/${file}`, jsDosMeta));
  }
  for (const file of [
    "emulators.js",
    "wdosbox.js",
    "wdosbox.wasm",
    "wdosbox-x.js",
    "wdosbox-x.wasm",
    "wlibzip.js",
    "wlibzip.wasm",
  ]) {
    manifest.jsDos.push(copyAsset("jsDos", file, join(jsDosRoot, "dist", "emulators", file), `js-dos/${file}`, jsDosMeta));
  }

  for (const asset of downloads) {
    manifest[asset.group].push(await downloadFile(asset));
  }

  const libarchiveMeta = {
    url: "https://registry.npmjs.org/libarchive.js/-/libarchive.js-2.0.2.tgz",
    source: "npm package libarchive.js@2.0.2 installed by npm ci",
    license: "MIT",
  };
  for (const file of ["worker-bundle.js", "libarchive.wasm"]) {
    manifest.libarchive.push(copyAsset("libarchive", file, join(root, "node_modules", "libarchive.js", "dist", file), `libarchive/${file}`, libarchiveMeta));
  }

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  rmSync(tmpDir, { recursive: true, force: true });
  console.log(`Prepared emulator assets manifest: ${manifestPath}`);
  console.log("PS1 BIOS is not included. Pre niektoré PS1 hry je potrebný vlastný PlayStation BIOS. Aplikácia BIOS neposkytuje.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
