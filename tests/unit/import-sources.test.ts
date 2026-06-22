import { describe, expect, it } from "vitest";
import { chooseMainFile, validateCueReferences, type ImportSourceEntry } from "@/lib/import/import-sources";

function entry(relativePath: string, size = 1024): ImportSourceEntry {
  return {
    relativePath,
    name: relativePath.split("/").pop() ?? relativePath,
    size,
    mimeType: "application/octet-stream",
  };
}

describe("import source helpers", () => {
  it("accepts CUE with multiple BIN tracks in the same directory", () => {
    const cue = `FILE "track1.bin" BINARY
  TRACK 01 MODE1/2352
    INDEX 01 00:00:00
FILE "track2.bin" BINARY
  TRACK 02 AUDIO
    INDEX 01 02:00:00`;

    expect(validateCueReferences("disc/game.cue", cue, [
      "disc/game.cue",
      "disc/track1.bin",
      "disc/track2.bin",
    ])).toEqual([]);
  });

  it("reports the exact missing BIN referenced by CUE", () => {
    const cue = `FILE "track1.bin" BINARY
  TRACK 01 MODE1/2352
    INDEX 01 00:00:00
FILE "track2.bin" BINARY
  TRACK 02 AUDIO
    INDEX 01 02:00:00`;

    expect(validateCueReferences("disc/game.cue", cue, ["disc/game.cue", "disc/track1.bin"])).toEqual([
      "track2.bin",
    ]);
  });

  it("chooses CUE as the PS1 main file instead of a BIN", async () => {
    const cue = `FILE "game.bin" BINARY
  TRACK 01 MODE1/2352
    INDEX 01 00:00:00`;
    const entries = [entry("game.bin", 10_000), entry("game.cue", 100)];
    const decision = await chooseMainFile(entries, async (source) =>
      source.relativePath === "game.cue" ? cue : ""
    );

    expect(decision.platform).toBe("ps1");
    expect(decision.mainFile).toBe("game.cue");
  });

  it("chooses a priority DOS launcher from a folder import", async () => {
    const entries = [entry("DATA/LEVEL1.DAT"), entry("RUN.BAT")];
    const decision = await chooseMainFile(entries, async () => "");

    expect(decision.platform).toBe("dos");
    expect(decision.mainFile).toBe("RUN.BAT");
  });
});
