/**
 * Supabase metadata sync — optional, only runs when Supabase is enabled.
 * Per prompt section 21 — synchronises ONLY metadata.
 * NEVER syncs ROM, ISO, BIN, CHD, CSO, BIOS or full archives.
 */
import { getSupabaseClient, isSupabaseEnabled } from "@/lib/supabase/client";
import type { GameRecord, EmulatorSettingsRecord, SaveStateRecord, ControllerProfileRecord, PlaySessionRecord } from "@/types/game";

export async function syncGameMetadata(game: GameRecord): Promise<void> {
  if (!isSupabaseEnabled()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("game_library_metadata").upsert({
    user_id: user.id,
    game_id: game.id,
    name: game.name,
    platform: game.platform,
    source_type: game.sourceType,
    main_file: game.mainFile,
    cover_url: game.coverUrl ?? null,
    size_bytes: game.size,
    is_favorite: game.isFavorite,
    compatibility_status: game.compatibilityStatus,
    emulator_version: game.emulatorVersion,
    file_fingerprint: game.fileFingerprint,
    total_play_time_seconds: game.totalPlayTimeSeconds,
    last_played_at: game.lastPlayedAt ? new Date(game.lastPlayedAt).toISOString() : null,
    created_at: new Date(game.createdAt).toISOString(),
    updated_at: new Date(game.updatedAt).toISOString(),
  }, {
    onConflict: "user_id,game_id",
  });
}

export async function syncEmulatorSettings(s: EmulatorSettingsRecord): Promise<void> {
  if (!isSupabaseEnabled()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("emulator_settings").upsert({
    user_id: user.id,
    platform: s.platform,
    volume: s.volume,
    muted: s.muted,
    aspect_ratio: s.aspectRatio,
    performance_profile: s.performanceProfile,
    auto_save: s.autoSave,
    updated_at: new Date(s.updatedAt).toISOString(),
  }, {
    onConflict: "user_id,platform",
  });
}

export async function syncSaveStateMetadata(s: SaveStateRecord): Promise<void> {
  if (!isSupabaseEnabled()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("save_states").upsert({
    user_id: user.id,
    game_id: s.gameId,
    slot: s.slot,
    is_auto_save: s.isAutoSave,
    file_size: s.fileSize,
    note: s.note ?? null,
    emulator_core: s.emulatorCore,
    emulator_version: s.emulatorVersion,
    game_fingerprint: s.gameFingerprint,
    created_at: new Date(s.createdAt).toISOString(),
    updated_at: new Date(s.updatedAt).toISOString(),
  }, {
    onConflict: "user_id,game_id,slot",
  });
}

export async function syncControllerProfile(c: ControllerProfileRecord): Promise<void> {
  if (!isSupabaseEnabled()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("controller_profiles").upsert({
    user_id: user.id,
    name: c.name,
    platform: c.platform,
    mapping: c.mapping,
    is_default: c.isDefault,
    created_at: new Date(c.createdAt).toISOString(),
    updated_at: new Date(c.updatedAt).toISOString(),
  });
}

export async function syncPlaySession(p: PlaySessionRecord): Promise<void> {
  if (!isSupabaseEnabled()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("play_sessions").insert({
    user_id: user.id,
    game_id: p.gameId,
    started_at: new Date(p.startedAt).toISOString(),
    ended_at: p.endedAt ? new Date(p.endedAt).toISOString() : null,
    duration_seconds: p.durationSeconds,
    save_state_slot_used: p.saveStateSlotUsed ?? null,
  });
}

/**
 * Pull all remote metadata and merge into IndexedDB.
 * This does NOT download ROM/ISO — those stay local only.
 */
export async function pullRemoteChanges(): Promise<void> {
  if (!isSupabaseEnabled()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { putGame, putEmulatorSettings, putSaveState, putController } = await import("@/lib/storage/repositories");

  // Pull game metadata
  const { data: games } = await supabase.from("game_library_metadata").select("*").eq("user_id", user.id);
  if (games) {
    for (const g of games) {
      // Only update metadata fields — preserve local-only fields like opfsPath
      const existing = await import("@/lib/storage/repositories").then(({ getGame }) => getGame(g.game_id));
      if (!existing) continue; // game files not present on this device
      await putGame({
        ...existing,
        name: g.name,
        isFavorite: g.is_favorite,
        compatibilityStatus: g.compatibility_status,
        emulatorVersion: g.emulator_version,
        totalPlayTimeSeconds: g.total_play_time_seconds,
        lastPlayedAt: g.last_played_at ? new Date(g.last_played_at).getTime() : existing.lastPlayedAt,
        updatedAt: Date.now(),
      });
    }
  }

  // Pull settings
  const { data: settings } = await supabase.from("emulator_settings").select("*").eq("user_id", user.id);
  if (settings) {
    for (const s of settings) {
      await putEmulatorSettings({
        platform: s.platform,
        volume: s.volume,
        muted: s.muted,
        aspectRatio: s.aspect_ratio,
        performanceProfile: s.performance_profile,
        autoSave: s.auto_save,
        updatedAt: Date.now(),
      });
    }
  }
}
