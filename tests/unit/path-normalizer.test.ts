import { describe, it, expect } from "vitest";
import { normalizePath, isPathSafe, joinPath, dirname, basename, extname } from "@/lib/security/path-normalizer";
import { PathSecurityError } from "@/lib/security/path-normalizer";

describe("normalizePath", () => {
  it("keeps a simple relative path", () => {
    expect(normalizePath("game.exe")).toBe("game.exe");
    expect(normalizePath("folder/file.txt")).toBe("folder/file.txt");
  });

  it("converts backslashes to forward slashes", () => {
    expect(normalizePath("folder\\sub\\file.txt")).toBe("folder/sub/file.txt");
  });

  it("strips leading slashes", () => {
    expect(normalizePath("/absolute/path")).toBe("absolute/path");
    expect(normalizePath("/leading")).toBe("leading");
  });

  it("rejects traversal segments", () => {
    expect(() => normalizePath("../etc/passwd")).toThrow(PathSecurityError);
    expect(() => normalizePath("foo/../../bar")).toThrow(PathSecurityError);
    expect(() => normalizePath("foo/bar/..")).toThrow(PathSecurityError);
  });

  it("rejects null bytes", () => {
    expect(() => normalizePath("foo\0bar")).toThrow(PathSecurityError);
  });

  it("rejects Windows drive letters", () => {
    expect(() => normalizePath("C:\\Windows\\system32")).toThrow(PathSecurityError);
    expect(() => normalizePath("D:/data/file")).toThrow(PathSecurityError);
  });

  it("rejects UNC paths", () => {
    expect(() => normalizePath("\\\\server\\share")).toThrow(PathSecurityError);
    expect(() => normalizePath("//server/share")).toThrow(PathSecurityError);
  });

  it("rejects paths too long", () => {
    const long = "a".repeat(400);
    expect(() => normalizePath(long)).toThrow(PathSecurityError);
  });

  it("rejects too-deep directory structures", () => {
    const deep = Array.from({ length: 25 }, (_, i) => `d${i}`).join("/");
    expect(() => normalizePath(deep)).toThrow(PathSecurityError);
  });

  it("collapses multiple slashes", () => {
    expect(normalizePath("a//b///c")).toBe("a/b/c");
  });

  it("trims trailing slashes", () => {
    expect(normalizePath("a/b/")).toBe("a/b");
    expect(normalizePath("a/b///")).toBe("a/b");
  });
});

describe("isPathSafe", () => {
  it("returns true for safe paths", () => {
    expect(isPathSafe("game.exe")).toBe(true);
    expect(isPathSafe("dir/subdir/file.bin")).toBe(true);
  });

  it("returns false for unsafe paths", () => {
    expect(isPathSafe("../etc/passwd")).toBe(false);
    expect(isPathSafe("C:\\Windows")).toBe(false);
    expect(isPathSafe("foo\0bar")).toBe(false);
  });
});

describe("path utilities", () => {
  it("joinPath", () => {
    expect(joinPath("a", "b", "c")).toBe("a/b/c");
    expect(joinPath("/a/", "b/")).toBe("a/b");
    expect(joinPath("", "a", "")).toBe("a");
  });

  it("dirname", () => {
    expect(dirname("a/b/c.txt")).toBe("a/b");
    expect(dirname("file.txt")).toBe("");
  });

  it("basename", () => {
    expect(basename("a/b/c.txt")).toBe("c.txt");
    expect(basename("file.txt")).toBe("file.txt");
    expect(basename("a\\b\\c.txt")).toBe("c.txt");
  });

  it("extname", () => {
    expect(extname("game.exe")).toBe("exe");
    expect(extname("a/b/c.BIN")).toBe("bin");
    expect(extname("noext")).toBe("");
  });
});
