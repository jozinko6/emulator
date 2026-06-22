import { describe, it, expect } from "vitest";
import { findDosLauncher } from "@/emulators/dos/dos-launcher";
import type { ArchiveEntry } from "@/types/detection";

function entry(path: string): ArchiveEntry {
  return { path, size: 1024, isDirectory: false };
}

describe("findDosLauncher", () => {
  it("prefers START.BAT", () => {
    const result = findDosLauncher([
      entry("GAME.EXE"),
      entry("START.BAT"),
      entry("PLAY.BAT"),
    ]);
    expect(result.mainFile).toBe("START.BAT");
    expect(result.requiresUserSelection).toBe(false);
  });

  it("prefers PLAY.BAT over RUN.BAT", () => {
    const result = findDosLauncher([entry("PLAY.BAT"), entry("RUN.BAT")]);
    expect(result.mainFile).toBe("PLAY.BAT");
  });

  it("full priority order: START > PLAY > RUN > GAME.BAT > GAME.EXE > START.EXE > PLAY.EXE > RUN.EXE", () => {
    const result = findDosLauncher([
      entry("RUN.EXE"),
      entry("START.EXE"),
      entry("GAME.EXE"),
      entry("GAME.BAT"),
      entry("RUN.BAT"),
      entry("PLAY.BAT"),
      entry("START.BAT"),
    ]);
    expect(result.mainFile).toBe("START.BAT");
  });

  it("skips INSTALL.EXE, SETUP.EXE, UNINSTALL.EXE, CONFIG.EXE, SOUND.EXE, SETUP.BAT", () => {
    const result = findDosLauncher([
      entry("INSTALL.EXE"),
      entry("SETUP.EXE"),
      entry("UNINSTALL.EXE"),
      entry("CONFIG.EXE"),
      entry("SOUND.EXE"),
      entry("SETUP.BAT"),
    ]);
    expect(result.mainFile).toBeNull();
    expect(result.requiresUserSelection).toBe(false);
  });

  it("requires user selection when multiple non-priority executables exist", () => {
    const result = findDosLauncher([entry("DOOM.EXE"), entry("DOOM2.EXE")]);
    expect(result.requiresUserSelection).toBe(true);
    expect(result.candidates.length).toBe(2);
  });

  it("returns null for empty archive", () => {
    const result = findDosLauncher([]);
    expect(result.mainFile).toBeNull();
  });

  it("accepts lowercase extensions", () => {
    const result = findDosLauncher([entry("start.bat")]);
    expect(result.mainFile).toBe("start.bat");
  });

  it("prefers root-level file when matches exist in subdir too", () => {
    const result = findDosLauncher([
      entry("docs/START.BAT"),
      entry("START.BAT"),
    ]);
    expect(result.mainFile).toBe("START.BAT");
  });

  it("returns single candidate when only one non-priority executable", () => {
    const result = findDosLauncher([entry("DOOM.EXE")]);
    expect(result.mainFile).toBe("DOOM.EXE");
    expect(result.requiresUserSelection).toBe(false);
  });
});
