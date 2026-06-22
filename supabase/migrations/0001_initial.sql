-- ============================================================
-- RETROCLOUD initial schema
-- All tables RLS-enabled with policy: auth.uid() = user_id
-- Per prompt section 21.
-- ============================================================

-- 1. PROFILES — user profile metadata
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  preferences jsonb default '{}'::jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "profiles_delete_own"
  on public.profiles for delete
  using (auth.uid() = user_id);

-- 2. GAME_LIBRARY_METADATA — synced game metadata (NOT ROM/ISO/BIOS)
create table if not exists public.game_library_metadata (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  name text not null,
  platform text not null check (platform in ('dos', 'ps1', 'ps2')),
  source_type text,
  main_file text,
  cover_url text,
  size_bytes bigint,
  is_favorite boolean default false,
  compatibility_status text default 'unknown',
  emulator_version text,
  file_fingerprint text,
  total_play_time_seconds bigint default 0,
  last_played_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, game_id)
);

alter table public.game_library_metadata enable row level security;

create policy "game_meta_select_own"
  on public.game_library_metadata for select
  using (auth.uid() = user_id);

create policy "game_meta_insert_own"
  on public.game_library_metadata for insert
  with check (auth.uid() = user_id);

create policy "game_meta_update_own"
  on public.game_library_metadata for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "game_meta_delete_own"
  on public.game_library_metadata for delete
  using (auth.uid() = user_id);

-- 3. PLAY_SESSIONS — history of play sessions
create table if not exists public.play_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds bigint default 0,
  save_state_slot_used integer,
  created_at timestamptz default now() not null
);

alter table public.play_sessions enable row level security;

create policy "play_sessions_select_own"
  on public.play_sessions for select
  using (auth.uid() = user_id);

create policy "play_sessions_insert_own"
  on public.play_sessions for insert
  with check (auth.uid() = user_id);

create policy "play_sessions_update_own"
  on public.play_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "play_sessions_delete_own"
  on public.play_sessions for delete
  using (auth.uid() = user_id);

-- 4. SAVE_STATES — synced save state METADATA (actual save data stays in OPFS)
create table if not exists public.save_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  slot integer not null,
  is_auto_save boolean default false,
  file_size bigint not null,
  note text,
  emulator_core text not null,
  emulator_version text not null,
  game_fingerprint text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, game_id, slot)
);

alter table public.save_states enable row level security;

create policy "save_states_select_own"
  on public.save_states for select
  using (auth.uid() = user_id);

create policy "save_states_insert_own"
  on public.save_states for insert
  with check (auth.uid() = user_id);

create policy "save_states_update_own"
  on public.save_states for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "save_states_delete_own"
  on public.save_states for delete
  using (auth.uid() = user_id);

-- 5. CONTROLLER_PROFILES — synced controller mappings
create table if not exists public.controller_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  platform text not null check (platform in ('dos', 'ps1', 'ps2')),
  mapping jsonb not null default '{}'::jsonb,
  is_default boolean default false,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.controller_profiles enable row level security;

create policy "controller_profiles_select_own"
  on public.controller_profiles for select
  using (auth.uid() = user_id);

create policy "controller_profiles_insert_own"
  on public.controller_profiles for insert
  with check (auth.uid() = user_id);

create policy "controller_profiles_update_own"
  on public.controller_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "controller_profiles_delete_own"
  on public.controller_profiles for delete
  using (auth.uid() = user_id);

-- 6. EMULATOR_SETTINGS — per-platform emulator settings
create table if not exists public.emulator_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text primary key check (platform in ('dos', 'ps1', 'ps2')),
  volume real default 0.8,
  muted boolean default false,
  aspect_ratio text default '4:3',
  performance_profile text default 'balanced',
  auto_save boolean default true,
  updated_at timestamptz default now() not null
);

alter table public.emulator_settings enable row level security;

create policy "emulator_settings_select_own"
  on public.emulator_settings for select
  using (auth.uid() = user_id);

create policy "emulator_settings_insert_own"
  on public.emulator_settings for insert
  with check (auth.uid() = user_id);

create policy "emulator_settings_update_own"
  on public.emulator_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "emulator_settings_delete_own"
  on public.emulator_settings for delete
  using (auth.uid() = user_id);

-- 7. USER_PREFERENCES — generic key/value preferences
create table if not exists public.user_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb,
  updated_at timestamptz default now() not null,
  primary key (user_id, key)
);

alter table public.user_preferences enable row level security;

create policy "user_preferences_select_own"
  on public.user_preferences for select
  using (auth.uid() = user_id);

create policy "user_preferences_insert_own"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

create policy "user_preferences_update_own"
  on public.user_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_preferences_delete_own"
  on public.user_preferences for delete
  using (auth.uid() = user_id);

-- Indexes for common queries
create index if not exists idx_game_metadata_user on public.game_library_metadata(user_id);
create index if not exists idx_play_sessions_user_game on public.play_sessions(user_id, game_id);
create index if not exists idx_save_states_user_game on public.save_states(user_id, game_id);
create index if not exists idx_controller_profiles_user on public.controller_profiles(user_id);
