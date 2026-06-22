import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("encoding checker", () => {
  it("blocks common mojibake markers", () => {
    const script = readFileSync("scripts/check-encoding.mjs", "utf8");

    for (const marker of ["\\u00c4\\u201a", "\\u00c4\\u2026", "\\ufffd", "Ja\\u00c4\\u2026", "\\u00e2\\u20ac\\u201d"]) {
      expect(script).toContain(marker);
    }
  });
});
