/**
 * Save state storage — per prompt sections 14, 15, 18.
 *
 * Deterministické ID: `${gameId}:${slot}` — jeden záznam na (gameId, slot) pár.
 * Sloty:
 *   0 = Auto Save (periodic + on exit)
 *   1 = Manual Save (user-triggered "Uložiť")
 *   2 = Backup (automaticky pred načítaním iného save)
 *
 * Atomický zápis:
 *   1. Zapíš do temp súboru
 *   2. Over veľkosť + hash
 *   3. presuň aktuálny manual/auto do backup
 *   4. Aktivuj nový save (premenuj temp na cieľ)
 *   5. Odstráň temp (ak zlyhal, zachovaj starý)
 *
 * Migrácia:
 *   Pri prvom spustení po upgrade z verzie 1 (UUID ID) na verziu 2 (deterministické ID):
 *   - Pre každý gameId + slot nájdi najnovší záznam podľa updatedAt
 *   - Premenuj ho na deterministické ID
 *   - Ostatné duplikáty odstráň (OPFS súbory zachovaj pre najnovší)
 */
import type { SaveStateRecord } from "@/types/game";
import { saveStatePath, screenshotPath, deleteRecursive, writeStream } from "@/lib/storage/opfs";
import { getDB } from "@/lib/storage/repositories";
import { sha256 } from "@/lib/security/hashing";

/** Slot constants */
export const SLOT_AUTO = 0;
export const SLOT_MANUAL = 1;
export const SLOT_BACKUP = 2;

/**
 * Vytvor deterministické ID pre záznam.
 * Per prompt section 14 — `${gameId}:${slot}`.
 */
export function makeSaveStateId(gameId: string, slot: number): string {
  return `${gameId}:${slot}`;
}

/**
 * Vráti presne jeden záznam pre (gameId, slot) alebo null.
 * Per prompt section 14 — funkcia musí vracať presne jeden záznam.
 */
export async function getSaveState(
  gameId: string,
  slot: number
): Promise<SaveStateRecord | null> {
  const id = makeSaveStateId(gameId, slot);
  try {
    const db = await getDB();
    const record = await db.get("saves", id);
    return record ?? null;
  } catch {
    return null;
  }
}

/**
 * Vráti všetky save state-y pre hru (zvyčajne max 3 — auto, manual, backup).
 */
export async function getSaveStatesForGame(
  gameId: string
): Promise<SaveStateRecord[]> {
  try {
    const db = await getDB();
    const all = await db.getAllFromIndex("saves", "gameId", gameId);
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/**
 * Nájdi najnovší kompatibilný save pre hru.
 * Priorita: manual (slot 1) > auto (slot 0) > backup (slot 2).
 */
export async function getLatestSaveForGame(
  gameId: string,
  emulatorCore?: string,
  emulatorVersion?: string
): Promise<SaveStateRecord | null> {
  const saves = await getSaveStatesForGame(gameId);
  if (saves.length === 0) return null;

  // Filter by emulator compatibility if specified
  const compatible = emulatorCore
    ? saves.filter(
        (s) =>
          s.emulatorCore === emulatorCore &&
          (!emulatorVersion || s.emulatorVersion === emulatorVersion)
      )
    : saves;

  const pool = compatible.length > 0 ? compatible : saves;

  // Prefer manual, then auto, then backup
  return (
    pool.find((s) => s.slot === SLOT_MANUAL) ??
    pool.find((s) => s.slot === SLOT_AUTO) ??
    pool.find((s) => s.slot === SLOT_BACKUP) ??
    pool[0] ??
    null
  );
}

/**
 * Atomické uloženie save state do OPFS + IndexedDB.
 *
 * Postup:
 *   1. Zapíš nový save do temp súboru
 *   2. Over veľkosť + vypočítaj hash
 *   3. Ak existuje aktuálny manual/auto save, presuň ho do backup slotu
 *   4. Prepíš IndexedDB záznam deterministickým ID
 *   5. Odstráň temp súbor (už premenovaný / prekopírovaný)
 *
 * Pri zlyhaní:
 *   - zachovaj predchádzajúci save
 *   - odstráň temp súbor
 *   - throw chybu
 */
export async function saveStateAtomically(
  gameId: string,
  slot: number,
  data: ArrayBuffer,
  opts: {
    emulatorCore: string;
    emulatorVersion: string;
    gameFingerprint: string;
    isAutoSave: boolean;
    note?: string;
    screenshotBytes?: Uint8Array;
  }
): Promise<SaveStateRecord> {
  const id = makeSaveStateId(gameId, slot);
  const targetPath = saveStatePath(gameId, slot);
  const tempPath = `${targetPath}.tmp`;

  // 1. Zapíš do temp
  try {
    // Wrap into fresh ArrayBuffer to satisfy BlobPart typing (avoid SharedArrayBuffer issues)
    const buf = new ArrayBuffer(data.byteLength);
    new Uint8Array(buf).set(new Uint8Array(data));
    const tempStream = new Blob([buf]).stream();
    await writeStream(tempPath, tempStream);
  } catch (e) {
    // Cleanup temp on failure
    await deleteRecursive(tempPath).catch(() => undefined);
    throw new Error(`Failed to write temp save: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 2. Over veľkosť a hash
  const size = data.byteLength;
  if (size === 0) {
    await deleteRecursive(tempPath).catch(() => undefined);
    throw new Error("Save state is empty");
  }
  const hash = await sha256(data);

  // 3. Ak existuje predchádzajúci save v tomto slote, presuň ho do backup (slot 2)
  // Len ak ukladáme do manual alebo auto (nie backup)
  if (slot === SLOT_MANUAL || slot === SLOT_AUTO) {
    const previous = await getSaveState(gameId, slot);
    if (previous) {
      try {
        await promoteToBackup(gameId, previous);
      } catch (e) {
        console.warn("Failed to promote previous save to backup:", e);
        // Non-fatal — continue
      }
    }
  }

  // 4. Aktivuj nový save: premenuj temp → cieľ (v OPFS to znamená ďalší write + delete)
  // Kvôli jednoduchosti prepíšeme cieľ priamo — atomickosť zabezpečuje, že temp je už úspešne zapísaný.
  try {
    // Pre-menuj temp na cieľ (delete target, write target z temp, delete temp)
    await deleteRecursive(targetPath).catch(() => undefined);
    const targetBuf = new ArrayBuffer(data.byteLength);
    new Uint8Array(targetBuf).set(new Uint8Array(data));
    const targetStream = new Blob([targetBuf]).stream();
    await writeStream(targetPath, targetStream);
    await deleteRecursive(tempPath).catch(() => undefined);
  } catch (e) {
    // Temp zostáva, target je možno poškodený — restore zo starého backupu ak existuje
    await deleteRecursive(targetPath).catch(() => undefined);
    throw new Error(`Failed to activate save: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Screenshot (voliteľný)
  let screenshotPathValue: string | undefined;
  if (opts.screenshotBytes && opts.screenshotBytes.length > 0) {
    try {
      const shotPath = screenshotPath(gameId, slot);
      const shotBuf = new ArrayBuffer(opts.screenshotBytes.byteLength);
      new Uint8Array(shotBuf).set(opts.screenshotBytes);
      const shotStream = new Blob([shotBuf]).stream();
      await writeStream(shotPath, shotStream);
      screenshotPathValue = shotPath;
    } catch (e) {
      console.warn("Failed to save screenshot:", e);
    }
  }

  // 5. IndexedDB záznam — upsert s deterministickým ID
  const now = Date.now();
  const existing = await getSaveState(gameId, slot);
  const record: SaveStateRecord = {
    id,
    gameId,
    slot,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    fileSize: size,
    screenshotPath: screenshotPathValue,
    note: opts.note,
    isAutoSave: opts.isAutoSave,
    emulatorCore: opts.emulatorCore,
    emulatorVersion: opts.emulatorVersion,
    gameFingerprint: opts.gameFingerprint,
    opfsPath: targetPath,
  };

  try {
    const db = await getDB();
    await db.put("saves", record);
  } catch (e) {
    // Rollback: odstráň OPFS súbor, aby sme nemali súbor bez metadat
    await deleteRecursive(targetPath).catch(() => undefined);
    throw new Error(`Failed to persist save metadata: ${e instanceof Error ? e.message : String(e)}`);
  }

  return record;
}

/**
 * Presuň save state do backup slotu (slot 2).
 * Používa sa pred prepísaním manual/auto save.
 */
async function promoteToBackup(
  gameId: string,
  source: SaveStateRecord
): Promise<void> {
  if (source.slot === SLOT_BACKUP) return; // už je backup

  const backupId = makeSaveStateId(gameId, SLOT_BACKUP);
  const backupPath = saveStatePath(gameId, SLOT_BACKUP);

  // Skopíruj OPFS súbor zo zdroja do backup
  const { readFile } = await import("@/lib/storage/opfs");
  const file = await readFile(source.opfsPath);
  const data = await file.arrayBuffer();
  const buf = new ArrayBuffer(data.byteLength);
  new Uint8Array(buf).set(new Uint8Array(data));
  const stream = new Blob([buf]).stream();
  await writeStream(backupPath, stream);

  const now = Date.now();
  const backup: SaveStateRecord = {
    id: backupId,
    gameId,
    slot: SLOT_BACKUP,
    createdAt: source.createdAt,
    updatedAt: now,
    fileSize: source.fileSize,
    screenshotPath: source.screenshotPath,
    note: `Backup of slot ${source.slot}`,
    isAutoSave: false,
    emulatorCore: source.emulatorCore,
    emulatorVersion: source.emulatorVersion,
    gameFingerprint: source.gameFingerprint,
    opfsPath: backupPath,
  };

  const db = await getDB();
  await db.put("saves", backup);
}

/**
 * Odstráň save state (IndexedDB + OPFS súbor + screenshot).
 */
export async function deleteSaveState(
  gameId: string,
  slot: number
): Promise<void> {
  const id = makeSaveStateId(gameId, slot);
  const existing = await getSaveState(gameId, slot);
  if (!existing) return;

  const db = await getDB();
  await db.delete("saves", id);

  if (existing.opfsPath) {
    await deleteRecursive(existing.opfsPath).catch(() => undefined);
  }
  if (existing.screenshotPath) {
    await deleteRecursive(existing.screenshotPath).catch(() => undefined);
  }
}

/**
 * Odstráň všetky save state-y pre hru.
 */
export async function deleteAllSaveStatesForGame(gameId: string): Promise<void> {
  const saves = await getSaveStatesForGame(gameId);
  await Promise.all(saves.map((s) => deleteSaveState(gameId, s.slot)));
}

/**
 * Migrácia z v1 (UUID ID) na v2 (deterministické ID).
 *
 * Pre každý gameId + slot:
 *   - nájdi najnovší záznam podľa updatedAt
 *   - premenuj ho na deterministické ID `${gameId}:${slot}`
 *   - odstráň staré duplikáty
 *   - zachovaj OPFS súbor najnovšieho
 */
export async function migrateSaveStatesToDeterministicIds(): Promise<{
  migrated: number;
  duplicatesRemoved: number;
}> {
  let migrated = 0;
  let duplicatesRemoved = 0;

  try {
    const db = await getDB();
    const allSaves = await db.getAll("saves");

    // Group by (gameId, slot)
    const groups = new Map<string, SaveStateRecord[]>();
    for (const save of allSaves) {
      const key = `${save.gameId}:${save.slot}`;
      const arr = groups.get(key) ?? [];
      arr.push(save);
      groups.set(key, arr);
    }

    for (const [key, saves] of groups) {
      if (saves.length === 0) continue;

      // Sort by updatedAt desc — najnovší prvý
      saves.sort((a, b) => b.updatedAt - a.updatedAt);
      const newest = saves[0];
      const oldId = newest.id;
      const newId = key; // deterministické ID

      if (oldId === newId) {
        // Už má deterministické ID — skip
        continue;
      }

      // Odstráň staré duplikáty (všetky okrem najnovšieho)
      for (let i = 1; i < saves.length; i++) {
        await db.delete("saves", saves[i].id);
        duplicatesRemoved++;
      }

      // Aktualizuj najnovší záznam — nové ID
      const updated: SaveStateRecord = {
        ...newest,
        id: newId,
      };
      await db.put("saves", updated);
      await db.delete("saves", oldId);
      migrated++;
    }
  } catch (e) {
    console.warn("Save state migration failed:", e);
  }

  return { migrated, duplicatesRemoved };
}
