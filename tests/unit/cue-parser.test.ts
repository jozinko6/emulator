import { describe, it, expect } from "vitest";
import { parseCue, findMissingBinFiles, cueTimeToSeconds, getBinFileNames } from "@/emulators/ps1/cue-parser";

describe("cueTimeToSeconds", () => {
  it("parses 00:00:00", () => {
    expect(cueTimeToSeconds("00:00:00")).toBe(0);
  });

  it("parses MM:SS:FF correctly (75 frames per second)", () => {
    // 2 minutes, 0 seconds, 0 frames = 120s
    expect(cueTimeToSeconds("02:00:00")).toBe(120);
    // 0 min, 1 sec, 0 frames = 1s
    expect(cueTimeToSeconds("00:01:00")).toBe(1);
    // 0 min, 0 sec, 75 frames = 1s
    expect(cueTimeToSeconds("00:00:75")).toBe(1);
    // 0 min, 0 sec, 38 frames = 0.5s
    expect(cueTimeToSeconds("00:00:38")).toBeCloseTo(0.50666666, 4);
  });
});

describe("parseCue", () => {
  it("parses single-track single-file CUE", () => {
    const cue = `FILE "game.bin" BINARY
  TRACK 01 MODE1/2352
    INDEX 01 00:00:00
`;
    const sheet = parseCue(cue);
    expect(sheet.files).toHaveLength(1);
    expect(sheet.files[0].name).toBe("game.bin");
    expect(sheet.files[0].type).toBe("BINARY");
    expect(sheet.files[0].tracks).toHaveLength(1);
    expect(sheet.files[0].tracks[0].number).toBe(1);
    expect(sheet.files[0].tracks[0].mode).toBe("MODE1/2352");
    expect(sheet.files[0].tracks[0].indexes).toHaveLength(1);
    expect(sheet.files[0].tracks[0].indexes[0].number).toBe(1);
    expect(sheet.files[0].tracks[0].indexes[0].time).toBe("00:00:00");
  });

  it("parses multi-track multi-file CUE", () => {
    const cue = `FILE "track1.bin" BINARY
  TRACK 01 MODE1/2352
    INDEX 01 00:00:00
FILE "track2.bin" BINARY
  TRACK 02 AUDIO
    INDEX 00 02:00:00
    INDEX 01 02:02:00
`;
    const sheet = parseCue(cue);
    expect(sheet.files).toHaveLength(2);
    expect(sheet.files[0].name).toBe("track1.bin");
    expect(sheet.files[1].name).toBe("track2.bin");
    expect(sheet.files[1].tracks[0].indexes).toHaveLength(2);
  });

  it("preserves raw text", () => {
    const raw = `FILE "g.bin" BINARY
  TRACK 01 MODE1/2352
    INDEX 01 00:00:00
`;
    expect(parseCue(raw).raw).toBe(raw);
  });

  it("handles case-insensitive keywords", () => {
    const cue = `file "game.bin" binary
  track 01 mode1/2352
    index 01 00:00:00
`;
    const sheet = parseCue(cue);
    expect(sheet.files).toHaveLength(1);
    expect(sheet.files[0].name).toBe("game.bin");
  });

  it("returns empty files array for empty input", () => {
    const sheet = parseCue("");
    expect(sheet.files).toHaveLength(0);
  });
});

describe("findMissingBinFiles", () => {
  it("returns empty if all BIN files present", () => {
    const cue = `FILE "game.bin" BINARY
  TRACK 01 MODE1/2352
    INDEX 01 00:00:00
`;
    const sheet = parseCue(cue);
    expect(findMissingBinFiles(sheet, ["game.bin"])).toEqual([]);
  });

  it("returns missing file names", () => {
    const cue = `FILE "track1.bin" BINARY
  TRACK 01 MODE1/2352
    INDEX 01 00:00:00
FILE "track2.bin" BINARY
  TRACK 02 AUDIO
    INDEX 01 02:00:00
`;
    const sheet = parseCue(cue);
    expect(findMissingBinFiles(sheet, ["track1.bin"])).toEqual(["track2.bin"]);
  });

  it("is case-insensitive on sibling files", () => {
    const cue = `FILE "Game.BIN" BINARY
  TRACK 01 MODE1/2352
    INDEX 01 00:00:00
`;
    const sheet = parseCue(cue);
    expect(findMissingBinFiles(sheet, ["game.bin"])).toEqual([]);
  });
});

describe("getBinFileNames", () => {
  it("returns unique file names", () => {
    const cue = `FILE "a.bin" BINARY
  TRACK 01 MODE1/2352
    INDEX 01 00:00:00
FILE "b.bin" BINARY
  TRACK 02 AUDIO
    INDEX 01 02:00:00
`;
    const sheet = parseCue(cue);
    expect(getBinFileNames(sheet)).toEqual(["a.bin", "b.bin"]);
  });
});
