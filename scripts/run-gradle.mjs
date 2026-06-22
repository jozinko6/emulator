#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const androidDir = join(root, "android");
const wrapper = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const wrapperPath = join(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew");

if (!existsSync(wrapperPath)) {
  console.error(`Gradle wrapper not found at ${wrapperPath}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const result = spawnSync(wrapper, args, {
  cwd: androidDir,
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
