import { describe, it, expect } from "vitest";
import { sha256, fingerprintGame, bufferToHex } from "@/lib/security/hashing";

describe("hashing", () => {
  it("sha256 produces stable hex output", async () => {
    const data = new TextEncoder().encode("hello");
    const hash = await sha256(data);
    expect(hash).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
    expect(hash).toHaveLength(64);
  });

  it("sha256 of Uint8Array vs ArrayBuffer match", async () => {
    const u8 = new TextEncoder().encode("test");
    const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
    expect(await sha256(u8)).toBe(await sha256(ab));
  });

  it("bufferToHex produces correct hex", () => {
    const buf = new Uint8Array([0, 1, 255, 16, 255]).buffer;
    expect(bufferToHex(buf)).toBe("0001ff10ff");
  });

  it("fingerprintGame is deterministic", () => {
    const files = [
      { relativePath: "game.exe", size: 1234, hash: "abc" },
      { relativePath: "data.dat", size: 5678, hash: "def" },
    ];
    const a = fingerprintGame(files);
    const b = fingerprintGame([...files].reverse());
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]+$/);
  });

  it("fingerprintGame differs for different content", () => {
    const a = fingerprintGame([{ relativePath: "a.exe", size: 1 }]);
    const b = fingerprintGame([{ relativePath: "b.exe", size: 1 }]);
    expect(a).not.toBe(b);
  });
});
