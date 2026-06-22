import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("emulator asset scripts", () => {
  it("setup downloads only runtime assets and records a manifest", () => {
    const script = readFileSync("scripts/setup-emulator-assets.mjs", "utf8");

    expect(script).toContain("emulator-assets.manifest.json");
    expect(script).toContain("js-dos@8.4.0");
    expect(script).toContain("cdn.emulatorjs.org/stable/data/loader.js");
    expect(script).toContain("libarchive.js");
    expect(script).toContain("No BIOS, ROM, ISO, or game content");
  });

  it("verify checks size and SHA-256 from the manifest", () => {
    const script = readFileSync("scripts/verify-emulator-assets.mjs", "utf8");

    expect(script).toContain("SHA-256 mismatch");
    expect(script).toContain("Size mismatch");
    expect(script).toContain("Missing asset");
  });
});
