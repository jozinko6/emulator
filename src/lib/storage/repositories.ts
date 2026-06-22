/**
 * IndexedDB wrapper with versioning and migrations, using idb library.
 * Per prompt section 13 — stores ONLY metadata + small data.
 * Large game files go to OPFS, never here.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  GameRecord,
  GameFileRecord,
  BiosRecord,
  SaveStateRecord,
  ControllerProfileRecord,
  EmulatorSettingsRecord,
  ImportJobRecord,
  PlaySessionRecord,
  UserPreferenceRecord,
} from "@/types/game";
import type { StoredSaveState } from "@/types/emulator";

const DB_NAME = "retrocloud";
const DB_VERSION = 2;

interface RetroCloudDB extends DBSchema {
  games: { key: string; value: GameRecord; indexes: { platform: string; updatedAt: number; lastPlayedAt: number } };
  gameFiles: { key: string; value: GameFileRecord; indexes: { gameId: string } };
  saves: { key: string; value: SaveStateRecord; indexes: { gameId: string; slot: number } };
  bios: { key: string; value: BiosRecord; indexes: { platform: string } };
  controllers: { key: string; value: ControllerProfileRecord; indexes: { platform: string } };
  settings: { key: string; value: EmulatorSettingsRecord };
  importJobs: { key: string; value: ImportJobRecord };
  playSessions: { key: string; value: PlaySessionRecord; indexes: { gameId: string } };
  preferences: { key: string; value: UserPreferenceRecord };
}

let dbPromise: Promise<IDBPDatabase<RetroCloudDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<RetroCloudDB>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (!dbPromise) {
    dbPromise = openDB<RetroCloudDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        // v1 → v2: initial schema
        if (oldVersion < 1) {
          const games = db.createObjectStore("games", { keyPath: "id" });
          games.createIndex("platform", "platform");
          games.createIndex("updatedAt", "updatedAt");
          games.createIndex("lastPlayedAt", "lastPlayedAt");

          const gameFiles = db.createObjectStore("gameFiles", { keyPath: "id" });
          gameFiles.createIndex("gameId", "gameId");

          const saves = db.createObjectStore("saves", { keyPath: "id" });
          saves.createIndex("gameId", "gameId");
          saves.createIndex("slot", "slot");

          const bios = db.createObjectStore("bios", { keyPath: "id" });
          bios.createIndex("platform", "platform");

          const controllers = db.createObjectStore("controllers", { keyPath: "id" });
          controllers.createIndex("platform", "platform");

          db.createObjectStore("settings", { keyPath: "platform" });
          db.createObjectStore("importJobs", { keyPath: "id" });

          const playSessions = db.createObjectStore("playSessions", { keyPath: "id" });
          playSessions.createIndex("gameId", "gameId");

          db.createObjectStore("preferences", { keyPath: "key" });
        }

        // v1 → v2: deduplicate save state records
        // Per prompt section 14 — deterministické ID `${gameId}:${slot}`
        if (oldVersion < 2) {
          (async () => {
            try {
              const saves = transaction.objectStore("saves");
              const allSaves = await saves.getAll();
              // Group by (gameId, slot)
              const groups = new Map<string, SaveStateRecord[]>();
              for (const save of allSaves) {
                const key = `${save.gameId}:${save.slot}`;
                const arr = groups.get(key) ?? [];
                arr.push(save as SaveStateRecord);
                groups.set(key, arr);
              }
              for (const [key, group] of groups) {
                if (group.length === 0) continue;
                // Sort by updatedAt desc
                group.sort((a, b) => b.updatedAt - a.updatedAt);
                const newest = group[0];
                if (newest.id === key) continue; // already deterministic
                // Delete duplicates (keep newest)
                for (let i = 1; i < group.length; i++) {
                  await saves.delete(group[i].id);
                }
                // Update newest with deterministic ID
                const updated = { ...newest, id: key };
                await saves.delete(newest.id);
                await saves.put(updated);
              }
            } catch (e) {
              console.warn("v2 save state migration failed:", e);
            }
          })();
        }
      },
    });
  }
  return dbPromise;
}

// === Games ===
export async function getAllGames(): Promise<GameRecord[]> {
  try {
    const db = await getDB();
    const all = await db.getAllFromIndex("games", "updatedAt");
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (e) {
    // Ak IndexedDB nie je dostupné (napr. sandbox, starý prehliadač),
    // vrátime prázdnu knižnicu, ale chybu zaznamenáme, aby ju vývojár
    // videl v konzole a vedel o nej.
    console.warn("[repositories] getAllGames zlyhal — vraciam prázdne pole:", e);
    return [];
  }
}

export async function getGame(id: string): Promise<GameRecord | undefined> {
  const db = await getDB();
  return db.get("games", id);
}

export async function putGame(game: GameRecord): Promise<void> {
  const db = await getDB();
  await db.put("games", game);
}

export async function deleteGame(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("games", id);
  // Cascade delete game files + save states
  const files = await db.getAllFromIndex("gameFiles", "gameId", id);
  await Promise.all(files.map((f) => db.delete("gameFiles", f.id)));
  const saves = await db.getAllFromIndex("saves", "gameId", id);
  await Promise.all(saves.map((s) => db.delete("saves", s.id)));
}

// === Game files ===
export async function getGameFiles(gameId: string): Promise<GameFileRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex("gameFiles", "gameId", gameId);
}

export async function putGameFile(file: GameFileRecord): Promise<void> {
  const db = await getDB();
  await db.put("gameFiles", file);
}

// === Save states ===
export async function getSaveStates(gameId: string): Promise<SaveStateRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex("saves", "gameId", gameId);
}

export async function putSaveState(s: SaveStateRecord): Promise<void> {
  const db = await getDB();
  await db.put("saves", s);
}

export async function deleteSaveState(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("saves", id);
}

export function saveStateRecordToStored(s: SaveStateRecord): StoredSaveState {
  return {
    slot: s.slot,
    gameId: s.gameId,
    fileSize: s.fileSize,
    opfsPath: s.opfsPath,
    screenshotPath: s.screenshotPath,
    note: s.note,
    isAutoSave: s.isAutoSave,
    emulatorCore: s.emulatorCore,
    emulatorVersion: s.emulatorVersion,
    gameFingerprint: s.gameFingerprint,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

// === BIOS ===
export async function getAllBios(): Promise<BiosRecord[]> {
  const db = await getDB();
  return db.getAll("bios");
}

export async function getBiosForPlatform(platform: string): Promise<BiosRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex("bios", "platform", platform);
}

export async function putBios(bios: BiosRecord): Promise<void> {
  const db = await getDB();
  await db.put("bios", bios);
}

export async function deleteBios(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("bios", id);
}

// === Controller profiles ===
export async function getAllControllers(): Promise<ControllerProfileRecord[]> {
  const db = await getDB();
  return db.getAll("controllers");
}

export async function putController(c: ControllerProfileRecord): Promise<void> {
  const db = await getDB();
  await db.put("controllers", c);
}

export async function deleteController(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("controllers", id);
}

// === Settings ===
export async function getAllEmulatorSettings(): Promise<EmulatorSettingsRecord[]> {
  const db = await getDB();
  return db.getAll("settings");
}

export async function putEmulatorSettings(s: EmulatorSettingsRecord): Promise<void> {
  const db = await getDB();
  await db.put("settings", s);
}

// === Import jobs ===
export async function putImportJob(job: ImportJobRecord): Promise<void> {
  const db = await getDB();
  await db.put("importJobs", job);
}

export async function getImportJobs(): Promise<ImportJobRecord[]> {
  const db = await getDB();
  return db.getAll("importJobs");
}

// === Play sessions ===
export async function putPlaySession(s: PlaySessionRecord): Promise<void> {
  const db = await getDB();
  await db.put("playSessions", s);
}

export async function getPlaySessions(gameId: string): Promise<PlaySessionRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex("playSessions", "gameId", gameId);
}

// === Preferences ===
export async function getUserPreferences(): Promise<UserPreferenceRecord[]> {
  const db = await getDB();
  return db.getAll("preferences");
}

export async function putUserPreference(p: UserPreferenceRecord): Promise<void> {
  const db = await getDB();
  await db.put("preferences", p);
}
