import { describe, it, expect } from "vitest";
import { parseDriveUrl } from "@/lib/google-drive/url-parser";

describe("parseDriveUrl", () => {
  it("parses /file/d/FILE_ID/view format", () => {
    const r = parseDriveUrl("https://drive.google.com/file/d/1ABC123def456/view");
    expect(r.ok).toBe(true);
    expect(r.fileId).toBe("1ABC123def456");
  });

  it("parses /open?id=FILE_ID format", () => {
    const r = parseDriveUrl("https://drive.google.com/open?id=1XYZ987");
    expect(r.ok).toBe(true);
    expect(r.fileId).toBe("1XYZ987");
  });

  it("parses /uc?id=FILE_ID format", () => {
    const r = parseDriveUrl("https://drive.google.com/uc?id=1UC456");
    expect(r.ok).toBe(true);
    expect(r.fileId).toBe("1UC456");
  });

  it("parses export=download&id=FILE_ID format", () => {
    const r = parseDriveUrl("https://drive.google.com/uc?export=download&id=1DL999");
    expect(r.ok).toBe(true);
    expect(r.fileId).toBe("1DL999");
  });

  it("accepts URLs without protocol", () => {
    const r = parseDriveUrl("drive.google.com/file/d/1PROTO-less/view");
    expect(r.ok).toBe(true);
    expect(r.fileId).toBe("1PROTO-less");
  });

  it("rejects non-drive domains", () => {
    expect(parseDriveUrl("https://example.com/file/d/abc").ok).toBe(false);
    expect(parseDriveUrl("https://evil.com/open?id=abc").ok).toBe(false);
  });

  it("rejects empty input", () => {
    expect(parseDriveUrl("").ok).toBe(false);
    expect(parseDriveUrl("   ").ok).toBe(false);
  });

  it("rejects malformed URLs", () => {
    expect(parseDriveUrl("not a url at all").ok).toBe(false);
  });

  it("rejects drive URLs with unknown path", () => {
    expect(parseDriveUrl("https://drive.google.com/unknown/path").ok).toBe(false);
  });
});
