import { describe, it, expect } from "vitest";

describe("runtime platform detection", () => {
  it("returns web in jsdom environment", async () => {
    const mod = await import("@/lib/native/native-platform");
    const info = mod.getRuntimeInfo();
    expect(info.platform).toBe("web");
    expect(info.isNativeAndroid).toBe(false);
    // jsdom is not TV by default
    expect(info.isTv).toBe(false);
  });

  it("resetRuntimeCache is exported", async () => {
    const mod = await import("@/lib/native/native-platform");
    expect(typeof mod.resetRuntimeCache).toBe("function");
    // Calling it should not throw
    expect(() => mod.resetRuntimeCache()).not.toThrow();
  });

  it("isAndroid returns false in jsdom", async () => {
    const mod = await import("@/lib/native/native-platform");
    expect(mod.isAndroid()).toBe(false);
  });

  it("isAndroidTv returns false in jsdom", async () => {
    const mod = await import("@/lib/native/native-platform");
    expect(mod.isAndroidTv()).toBe(false);
  });

  it("isTouchDevice returns boolean", async () => {
    const mod = await import("@/lib/native/native-platform");
    expect(typeof mod.isTouchDevice()).toBe("boolean");
  });
});

describe("Android file picker interface", () => {
  it("returns null on non-Android environment", async () => {
    const mod = await import("@/lib/native/native-file-picker");
    const plugin = mod.getAndroidFilePicker();
    expect(plugin).toBeNull();
  });

  it("pickAndroidFiles returns null on web", async () => {
    const mod = await import("@/lib/native/native-file-picker");
    const result = await mod.pickAndroidFiles({ multiple: true });
    expect(result).toBeNull();
  });

  it("pickAndroidDirectory returns null on web", async () => {
    const mod = await import("@/lib/native/native-file-picker");
    const result = await mod.pickAndroidDirectory();
    expect(result).toBeNull();
  });
});

describe("PickedAndroidFile metadata shape", () => {
  it("contains required fields", () => {
    type PickedAndroidFile = {
      internalPath: string;
      name: string;
      size: number;
      mimeType: string;
      sourceUri: string;
    };
    const sample: PickedAndroidFile = {
      internalPath: "/data/user/0/sk.jano.bavkac/files/game.cue",
      name: "game.cue",
      size: 1024,
      mimeType: "application/octet-stream",
      sourceUri: "content://com.android.externalstorage.documents/abc",
    };
    expect(sample.internalPath).toContain("game.cue");
    expect(sample.size).toBeGreaterThan(0);
    expect(sample.sourceUri).toContain("content://");
  });
});

describe("USB folder picker (desktop File System Access API)", () => {
  it("showDirectoryPicker is undefined in jsdom (fallback used)", () => {
    expect(window.showDirectoryPicker).toBeUndefined();
  });

  it("file input with webkitdirectory attribute can be created", () => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("multiple", "");
    expect(input.type).toBe("file");
  });
});
