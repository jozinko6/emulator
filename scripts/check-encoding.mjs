#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const forbidden = [
  "\u00c4\u201a",
  "\u00c4\u2026",
  "\u0102\u201e",
  "\u0102\u02c6",
  "\u0102\u201a",
  "\ufffd",
  "Ja\u00c4\u2026",
  "S\u00c4\u201a",
  "na\u0102\u201e",
  "ulo\u00c4\u2026",
  "s\u00c4\u201a\u0139\u00ba",
  "\u0139\u02c7",
  "\u0139\u02c6",
  "\u00e2\u20ac\u201d",
  "\u00e2\u2020\u2019",
  "\u00e2\u015b",
];

const include = [
  "package.json",
  "README.md",
  "FIX_REPORT.md",
  "IMPLEMENTATION_REPORT.md",
  "FINAL_FIX_REPORT.md",
  "FINAL_REPAIR_REPORT.md",
  "src/app",
  "src/components/import",
  "src/lib/import",
  "android/app/src/main/res/values",
  "android/app/src/main/AndroidManifest.xml",
  "scripts",
  ".github/workflows",
];

const ignored = /(^|[\\/])(node_modules|\.next|\.git|android-shell[\\/]dist|android[\\/]\.gradle|\.tmp)([\\/]|$)/;
const files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((file) => !ignored.test(file))
  .filter((file) => include.some((entry) => file === entry || file.startsWith(`${entry}/`)))
  .filter((file) => file !== "scripts/check-encoding.mjs")
  .filter((file) => /\.(tsx?|jsx?|mjs|cjs|json|md|xml|yml|yaml|kt)$/.test(file));

const failures = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  if (text.charCodeAt(0) === 0xfeff) failures.push(`${file}: contains UTF-8 BOM`);
  for (const pattern of forbidden) {
    if (text.includes(pattern)) {
      failures.push(`${file}: contains mojibake marker ${JSON.stringify(pattern)}`);
      break;
    }
  }
}

if (failures.length > 0) {
  console.error("Encoding check failed:");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`Encoding check passed (${files.length} files).`);
