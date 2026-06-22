// Cross-platform build script — replaces Linux-only `cp` commands.
// Runs `next build` then copies static + public into standalone output.
import { existsSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const nextDir = join(root, ".next");
const standaloneDir = join(nextDir, "standalone");
const staticDir = join(nextDir, "static");
const publicDir = join(root, "public");

console.log("[build] Running next build...");
execSync("next build", { stdio: "inherit", env: { ...process.env, NODE_ENV: "production" } });

if (!existsSync(standaloneDir)) {
  console.error(`[build] Standalone directory not found: ${standaloneDir}`);
  process.exit(1);
}

console.log("[build] Copying static files into standalone...");
const standaloneStaticDir = join(standaloneDir, ".next", "static");
if (existsSync(staticDir)) {
  cpSync(staticDir, standaloneStaticDir, { recursive: true });
}

console.log("[build] Copying public/ into standalone...");
const standalonePublicDir = join(standaloneDir, "public");
if (existsSync(publicDir)) {
  cpSync(publicDir, standalonePublicDir, { recursive: true });
}

console.log("[build] Done. Standalone output:", standaloneDir);
