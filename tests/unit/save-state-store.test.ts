import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto";
import {
  makeSaveStateId,
  SLOT_AUTO,
  SLOT_MANUAL,
  SLOT_BACKUP,
  getSaveState,
  getSaveStatesForGame,
  getLatestSaveForGame,
  validateSaveStateRecord,
  saveStateAtomically,
  deleteSaveState,
  deleteAllSaveStatesForGame,
  migrateSaveStatesToDeterministicIds,
} from "@/lib/storage/save-state-store";

// Mock OPFS functions to avoid real file IO in tests
const opfsMemory = new Map<string, Uint8Array>();

vi.mock("@/lib/storage/opfs", () => ({
  saveStatePath: (gameId: string, slot: number) => `saves/${gameId}/slot-${slot}.sav`,
  screenshotPath: (gameId: string, slot: number) => `saves/${gameId}/slot-${slot}.png`,
  deleteRecursive: vi.fn((path: string) => {
    opfsMemory.delete(path);
    return Promise.resolve();
  }),
  writeStream: vi.fn(async (path: string, stream: ReadableStream<Uint8Array>) => {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        size += value.byteLength;
      }
    }
    const data = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.byteLength;
    }
    opfsMemory.set(path, data);
    return { path, size };
  }),
  readFile: vi.fn((path: string) => {
    const data = opfsMemory.get(path) ?? new Uint8Array();
    const buffer = new ArrayBuffer(data.byteLength);
    new Uint8Array(buffer).set(data);
    return Promise.resolve(new File([buffer], path));
  }),
}));

// Mock repositories to use fake-indexeddb
vi.mock("@/lib/storage/repositories", () => ({
  getDB: async () => {
    const { openDB } = await import("idb");
    return openDB("test-retrocloud", 2, {
      upgrade(db) {
        const saves = db.createObjectStore("saves", { keyPath: "id" });
        saves.createIndex("gameId", "gameId");
        saves.createIndex("slot", "slot");
      },
    });
  },
}));

// Mock hashing
vi.mock("@/lib/security/hashing", () => ({
  sha256: vi.fn(() => Promise.resolve("fake-hash")),
}));

beforeEach(() => {
  opfsMemory.clear();
});

describe("makeSaveStateId", () => {
  it("creates deterministic ID", () => {
    expect(makeSaveStateId("game-1", 0)).toBe("game-1:0");
    expect(makeSaveStateId("game-1", 1)).toBe("game-1:1");
    expect(makeSaveStateId("game-2", 2)).toBe("game-2:2");
  });

  it("is stable — same input gives same ID", () => {
    expect(makeSaveStateId("g", 1)).toBe(makeSaveStateId("g", 1));
  });

  it("differs for different gameId or slot", () => {
    expect(makeSaveStateId("g1", 1)).not.toBe(makeSaveStateId("g2", 1));
    expect(makeSaveStateId("g1", 1)).not.toBe(makeSaveStateId("g1", 2));
  });
});

describe("Slot constants", () => {
  it("defines standard slots", () => {
    expect(SLOT_AUTO).toBe(0);
    expect(SLOT_MANUAL).toBe(1);
    expect(SLOT_BACKUP).toBe(2);
  });
});

describe("getSaveState", () => {
  it("returns null when no save exists", async () => {
    const result = await getSaveState("nonexistent-game", SLOT_MANUAL);
    expect(result).toBeNull();
  });
});

describe("getSaveStatesForGame", () => {
  it("returns empty array when no saves exist", async () => {
    const result = await getSaveStatesForGame("nonexistent-game");
    expect(result).toEqual([]);
  });
});

describe("getLatestSaveForGame", () => {
  it("returns null when no saves exist", async () => {
    const result = await getLatestSaveForGame("nonexistent-game");
    expect(result).toBeNull();
  });
});

describe("saveStateAtomically", () => {
  it("saves a new state with deterministic ID", async () => {
    const data = new ArrayBuffer(100);
    const record = await saveStateAtomically("game-1", SLOT_MANUAL, data, {
      emulatorCore: "jsdos",
      emulatorVersion: "v8.00",
      gameFingerprint: "fp-1",
      isAutoSave: false,
    });

    expect(record.id).toBe("game-1:1");
    expect(record.gameId).toBe("game-1");
    expect(record.slot).toBe(SLOT_MANUAL);
    expect(record.fileSize).toBe(100);
    expect(record.stateHash).toBe("fake-hash");
    expect(record.emulatorCore).toBe("jsdos");
    expect(record.emulatorVersion).toBe("v8.00");
    expect(record.gameFingerprint).toBe("fp-1");
    expect(record.isAutoSave).toBe(false);
  });

  it("rejects empty save data", async () => {
    const empty = new ArrayBuffer(0);
    await expect(
      saveStateAtomically("game-empty", SLOT_MANUAL, empty, {
        emulatorCore: "jsdos",
        emulatorVersion: "v8.00",
        gameFingerprint: "fp",
        isAutoSave: false,
      })
    ).rejects.toThrow("Save state is empty");
  });

  it("updates existing save (same slot) instead of creating new", async () => {
    const data1 = new ArrayBuffer(50);
    await saveStateAtomically("game-update", SLOT_MANUAL, data1, {
      emulatorCore: "jsdos",
      emulatorVersion: "v8.00",
      gameFingerprint: "fp",
      isAutoSave: false,
    });

    const data2 = new ArrayBuffer(80);
    const updated = await saveStateAtomically("game-update", SLOT_MANUAL, data2, {
      emulatorCore: "jsdos",
      emulatorVersion: "v8.00",
      gameFingerprint: "fp",
      isAutoSave: false,
    });

    // Should still be only one record
    const all = await getSaveStatesForGame("game-update");
    expect(all.length).toBe(2); // manual + backup (previous promoted)
    expect(updated.fileSize).toBe(80);
  });
});

describe("deleteSaveState", () => {
  it("deletes existing save", async () => {
    await saveStateAtomically("game-del", SLOT_MANUAL, new ArrayBuffer(50), {
      emulatorCore: "jsdos",
      emulatorVersion: "v8.00",
      gameFingerprint: "fp",
      isAutoSave: false,
    });

    await deleteSaveState("game-del", SLOT_MANUAL);

    const result = await getSaveState("game-del", SLOT_MANUAL);
    expect(result).toBeNull();
  });

  it("does not throw when deleting non-existent save", async () => {
    await expect(deleteSaveState("nope", SLOT_MANUAL)).resolves.toBeUndefined();
  });
});

describe("deleteAllSaveStatesForGame", () => {
  it("removes all saves for a game", async () => {
    await saveStateAtomically("game-all", SLOT_AUTO, new ArrayBuffer(50), {
      emulatorCore: "jsdos",
      emulatorVersion: "v8.00",
      gameFingerprint: "fp",
      isAutoSave: true,
    });
    await saveStateAtomically("game-all", SLOT_MANUAL, new ArrayBuffer(50), {
      emulatorCore: "jsdos",
      emulatorVersion: "v8.00",
      gameFingerprint: "fp",
      isAutoSave: false,
    });

    await deleteAllSaveStatesForGame("game-all");

    const remaining = await getSaveStatesForGame("game-all");
    expect(remaining).toEqual([]);
  });
});

describe("Latest save decision logic", () => {
  it("prefers manual over auto", async () => {
    // Save auto first (older), then manual (newer)
    const autoData = new ArrayBuffer(50);
    await saveStateAtomically("game-pref", SLOT_AUTO, autoData, {
      emulatorCore: "jsdos",
      emulatorVersion: "v8.00",
      gameFingerprint: "fp",
      isAutoSave: true,
    });
    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 10));
    const manualData = new ArrayBuffer(60);
    await saveStateAtomically("game-pref", SLOT_MANUAL, manualData, {
      emulatorCore: "jsdos",
      emulatorVersion: "v8.00",
      gameFingerprint: "fp",
      isAutoSave: false,
    });

    const latest = await getLatestSaveForGame("game-pref");
    expect(latest).not.toBeNull();
    expect(latest?.slot).toBe(SLOT_MANUAL);
  });

  it("falls back to auto when manual missing", async () => {
    await saveStateAtomically("game-fallback", SLOT_AUTO, new ArrayBuffer(50), {
      emulatorCore: "jsdos",
      emulatorVersion: "v8.00",
      gameFingerprint: "fp",
      isAutoSave: true,
    });

    const latest = await getLatestSaveForGame("game-fallback");
    expect(latest).not.toBeNull();
    expect(latest?.slot).toBe(SLOT_AUTO);
  });

  it("returns null when compatibility metadata does not match", async () => {
    await saveStateAtomically("game-incompat", SLOT_MANUAL, new ArrayBuffer(50), {
      emulatorCore: "jsdos",
      emulatorVersion: "v8.00",
      gameFingerprint: "fp",
      isAutoSave: false,
    });

    const latest = await getLatestSaveForGame("game-incompat", "pcsx", "v1", "different");
    expect(latest).toBeNull();
  });

  it("validates save state hash and size before load", async () => {
    const record = await saveStateAtomically("game-verify", SLOT_MANUAL, new ArrayBuffer(50), {
      emulatorCore: "jsdos",
      emulatorVersion: "v8.00",
      gameFingerprint: "fp",
      isAutoSave: false,
    });

    const result = await validateSaveStateRecord(record, {
      gameId: "game-verify",
      emulatorCore: "jsdos",
      emulatorVersion: "v8.00",
      gameFingerprint: "fp",
    });

    expect(result.ok).toBe(true);
  });
});

describe("Migration to deterministic IDs", () => {
  it("is callable and returns a result", async () => {
    const result = await migrateSaveStatesToDeterministicIds();
    expect(result).toHaveProperty("migrated");
    expect(result).toHaveProperty("duplicatesRemoved");
    expect(typeof result.migrated).toBe("number");
    expect(typeof result.duplicatesRemoved).toBe("number");
  });
});
