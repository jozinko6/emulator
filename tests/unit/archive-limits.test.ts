import { describe, it, expect } from "vitest";
import {
  DEFAULT_ARCHIVE_LIMITS,
  MAX_GAME_SIZE_BYTES,
  checkCompressionRatio,
  isNestedArchive,
} from "@/lib/security/limits";

describe("archive limits", () => {
  it("default limits are sensible", () => {
    expect(DEFAULT_ARCHIVE_LIMITS.maxFiles).toBe(10_000);
    expect(DEFAULT_ARCHIVE_LIMITS.maxPathLength).toBe(300);
    expect(DEFAULT_ARCHIVE_LIMITS.maxDirectoryDepth).toBe(20);
    expect(DEFAULT_ARCHIVE_LIMITS.maxNestedArchiveDepth).toBe(1);
    expect(DEFAULT_ARCHIVE_LIMITS.maxCompressionRatio).toBe(1000);
  });

  it("platform size limits match spec", () => {
    expect(MAX_GAME_SIZE_BYTES.dos).toBe(2 * 1024 * 1024 * 1024);
    expect(MAX_GAME_SIZE_BYTES.ps1).toBe(4 * 1024 * 1024 * 1024);
    expect(MAX_GAME_SIZE_BYTES.ps2).toBe(10 * 1024 * 1024 * 1024);
  });

  it("compression ratio check", () => {
    expect(checkCompressionRatio(1000, 100).exceeded).toBe(false); // ratio 10
    expect(checkCompressionRatio(1001, 1).exceeded).toBe(true); // ratio 1001 > 1000
    expect(checkCompressionRatio(1_000_000, 1).exceeded).toBe(true);
    expect(checkCompressionRatio(0, 0).exceeded).toBe(false);
  });

  it("nested archive detection", () => {
    expect(isNestedArchive("foo.zip")).toBe(true);
    expect(isNestedArchive("foo.rar")).toBe(true);
    expect(isNestedArchive("foo.7z")).toBe(true);
    expect(isNestedArchive("foo.tar")).toBe(true);
    expect(isNestedArchive("foo.gz")).toBe(true);
    expect(isNestedArchive("foo.exe")).toBe(false);
    expect(isNestedArchive("foo.bin")).toBe(false);
    expect(isNestedArchive("foo")).toBe(false);
  });
});
