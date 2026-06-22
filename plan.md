# RETROCLOUD — Implementation Plan

> Lokálne orientovaný online emulátor a správca vlastných záložných kópií hier pre DOS, PlayStation 1 a PlayStation 2 (experimentálne).

## 1. Cieľ

Vytvoriť produkčne použiteľnú webovú aplikáciu (PWA) v Next.js 16, ktorá:

- beží lokálne v prehliadači bez povinného účtu,
- importuje vlastné hry zo zariadenia / ZIP / RAR / 7z / Google Drive,
- ukladá ROM/ISO výhradne do OPFS (Origin Private File System),
- ukladá metadata do IndexedDB,
- spúšťa DOS hry cez js-dos (reálne WASM jadro),
- spúšťa PS1 hry cez EmulatorJS / PCSX-ReARMed (lokálne hostované assety),
- PS2 je za feature flagom `NEXT_PUBLIC_ENABLE_PS2=false` a NEpredstiera funkčnosť,
- funguje ako inštalovateľná PWA offline,
- nikdy neposiela herné súbory na server.

## 2. Cieľová architektúra

```
src/
  app/
    layout.tsx                 # Root layout, PWA meta, fonts
    page.tsx                   # Home dashboard
    library/page.tsx           # Grid/list knižnica
    import/page.tsx            # Import wizard
    game/[id]/page.tsx         # Detail hry
    play/[id]/page.tsx         # Herná obrazovka (lazy-loaded emulátor)
    saves/page.tsx             # Správa save states
    settings/page.tsx          # Nastavenia emulátora, ovládania, úložiska
    profile/page.tsx           # Voliteľný účet (Supabase)
    diagnostics/page.tsx       # Diagnostika prehliadača
    legal/page.tsx             # Právne informácie
    privacy/page.tsx           # Ochrana súkromia
    terms/page.tsx             # Podmienky používania
    api/
      drive/route.ts           # Google Drive metadata proxy (iba metadá, nie ISO)
      supabase/health/route.ts # Voliteľný health check

  components/
    layout/                    # AppShell, Sidebar, MobileNav, SafeArea
    library/                   # GameCard, GameGrid, GameList, FilterBar
    import/                    # ImportWizard, DropZone, ProgressOverlay, ArchiveWarnings
    emulator/                  # EmulatorCanvas, EmulatorControls, PerformanceOverlay
    controls/                  # VirtualGamepad, DosKeyboard, Touchpad, GamepadMapper
    storage/                   # StorageMeter, BiosManager, SaveStateList
    auth/                      # AuthDialog, ProfileMenu
    pwa/                       # InstallPrompt, UpdatePrompt
    ui/                        # shadcn/ui (už existuje)

  emulators/
    core/
      emulator-adapter.ts      # Rozhranie EmulatorAdapter
      emulator-factory.ts      # Výber adapteru podľa platformy
      emulator-events.ts       # Typy udalostí
      emulator-input.ts        # EmulatorInputEvent normalizácia
    dos/
      dos-adapter.ts           # js-dos integrácia
      dos-launcher.ts          # Hľadanie START.BAT / GAME.EXE
      jsdos-builder.ts         # Vytvorenie .jsdos balíka
    ps1/
      ps1-adapter.ts           # EmulatorJS integrácia
      cue-parser.ts            # CUE sheet parser
      bios-validator.ts        # PS1 BIOS validácia
    ps2/
      ps2-adapter.ts           # Play!.js (zatiaľ feature-flag off)
      ps2-availability.ts      # Detekcia dostupnosti

  lib/
    archive/
      zip.ts                   # fflate wrapper
      rar.ts                   # libarchive.js wrapper
      seven-z.ts               # voliteľné 7z
      archive-security.ts      # ZIP bomb / path traversal ochrana
      archive-types.ts
    detection/
      platform-detector.ts     # Hlavná detekcia
      header-magic.ts          # Magic bytes
      iso-analyzer.ts          # ISO9660 + PS1/PS2 indikátory
      chd-analyzer.ts
    storage/
      opfs.ts                  # OPFS utilities
      indexeddb.ts             # DB wrapper s migráciami
      repositories.ts          # GameRecord, SaveState, Bios... repos
      storage-estimate.ts      # navigator.storage.estimate()
      streaming-writer.ts      # Chunked write do OPFS
    google-drive/
      picker.ts                # Google Picker API
      url-parser.ts            # Parser verejných odkazov
      downloader.ts            # Streaming do OPFS
    security/
      path-normalizer.ts       # normalizePath, sanitize
      limits.ts                # maxFiles, maxPathLength...
      hashing.ts               # SHA-256 (SubtleCrypto)
    diagnostics/
      capability-probe.ts      # WebGL, WASM, OPFS, SharedArrayBuffer...
      report-builder.ts        # Kopírovateľný diagnostický report
    supabase/
      client.ts                # Voliteľný klient (len ak env existuje)
      sync.ts                  # Metadata sync
    pwa/
      register-sw.ts           # Service worker registration
      install-prompt.ts        # beforeinstallprompt handler

  workers/
    archive.worker.ts          # Rozbaľovanie ZIP/RAR/7z
    detection.worker.ts        # Detekcia platformy
    hashing.worker.ts          # SHA-256 výpočty
    file-copy.worker.ts        # Kopírovanie chunkov do OPFS

  stores/
    navigation-store.ts
    library-store.ts
    import-store.ts
    emulator-store.ts
    settings-store.ts
    controller-store.ts
    auth-store.ts

  types/
    emulator.ts                # EmulatorPlatform, EmulatorAdapter, ...
    game.ts                    # GameRecord, GameFileRecord
    saves.ts                   # SaveStateRecord
    bios.ts                    # BiosRecord
    import.ts                  # ImportJobRecord, ImportState
    detection.ts               # DetectionResult
    controller.ts              # ControllerProfileRecord
    settings.ts                # EmulatorSettingsRecord
    diagnostics.ts
    api.ts

public/
  emulator-assets/             # js-dos + EmulatorJS WASM/jadier (lazy loaded)
  icons/                       # PWA ikony 192/512/maskable
  offline/                     # Offline fallback stránka
  demo/                        # Legálne testovacie ROM (prázdne)

supabase/
  migrations/                  # SQL migrácie s RLS

tests/
  unit/
  integration/
  e2e/
```

## 3. Etapy implementácie

### ETAPA 1 — Základ (main agent)
- `next.config.ts`: `reactStrictMode: true`, odstrániť `ignoreBuildErrors`, pridať cross-origin headers pre `/play/*`
- `tsconfig.json`: strict mode už nastavený, overiť
- Design system: tmavá téma, retro akcenty, Tailwind 4 tokens v `globals.css`
- Root `layout.tsx`: PWA meta, manifest, fonts, AppShell
- Routes skeleton pre všetky sekcie
- Stores: `library-store`, `import-store`, `emulator-store`, `settings-store`, `controller-store`, `auth-store`
- Spoločné typy v `src/types/`
- PWA manifest + ikony

### ETAPA 2 — Lokálne úložisko (subagent A)
- `lib/storage/indexeddb.ts` — wrapper s verzovaním a migráciami
- `lib/storage/repositories.ts` — CRUD pre všetky entity
- `lib/storage/opfs.ts` — normalizePath, ensureDirectory, writeStream, readSlice, deleteRecursive, calculateDirectorySize, listDirectory, cleanupPartialImport
- `lib/storage/streaming-writer.ts` — chunked write cez `FileSystemSyncAccessHandle`
- `lib/storage/storage-estimate.ts` — `navigator.storage.estimate()`, `persist()`
- Rollback pri neúspešnom importe

### ETAPA 3 — Import (subagent A)
- `components/import/ImportWizard.tsx` — stavový automat (idle → selecting → reading → validating → extracting → detecting → awaiting-user-selection → storing → ready / error / cancelled)
- `components/import/DropZone.tsx` — drag&drop + file picker + multi-select + File System Access API
- `workers/archive.worker.ts` — rozbaľovanie cez fflate (ZIP) a libarchive.js (RAR/7z)
- `lib/archive/archive-security.ts` — ochrana pred ZIP bombou, path traversal, vnorenými archívmi
- Progress overlay s percentami, veľkosťami, možnosťou zrušenia (AbortController)

### ETAPA 4 — Detekcia (subagent A)
- `lib/detection/platform-detector.ts` — kombinuje príponu, hlavičku, CUE, ISO štruktúru
- `lib/detection/header-magic.ts` — magic bytes pre ISO9660, CHD, PBP, ELF, JSDOS
- `lib/detection/iso-analyzer.ts` — hľadá PS1/PS2 systémové indikátory
- `emulators/ps1/cue-parser.ts` — CUE sheet parser s validáciou BIN referencií
- `emulators/dos/dos-launcher.ts` — priorita START.BAT → PLAY.BAT → RUN.BAT → GAME.BAT → GAME.EXE...

### ETAPA 5 — DOS emulácia (subagent B)
- `emulators/dos/dos-adapter.ts` — reálna js-dos integrácia cez `window.emulators.jsdos()`
- `emulators/dos/jsdos-builder.ts` — vytvorenie .jsdos balíka (ZIP s .jsdos content-type)
- Implementovať initialize, loadGame, start, pause, resume, reset, sendInput, saveState, loadState, setVolume, enterFullscreen, destroy
- Auto-save pri ukončení
- Cleanup: revokes Blob URLs, removes listeners, removes dynamic elements

### ETAPA 6 — PS1 emulácia (subagent B)
- `emulators/ps1/ps1-adapter.ts` — EmulatorJS cez `window.EJS_*` config object
- `emulators/ps1/bios-validator.ts` — veľkosť + hash + región
- `components/storage/BiosManager.tsx` — upload, list, delete
- Podpora BIN+CUE (viacero BIN trackov), CHD, PBP, ISO, viacdiskové hry
- Memory card, save states, prepínanie diskov
- Cleanup: AudioContext, Blob URLs, EJS config

### ETAPA 7 — Ovládanie (subagent B)
- `lib/gamepad/gamepad-manager.ts` — Gamepad API polling, deadzone, mapovanie, profily
- `components/controls/VirtualGamepad.tsx` — PS1/PS2 D-pad, analógy, tlačidlá, L1/L2/R1/R2, Start/Select
- `components/controls/DosTouchpad.tsx` — virtuálna klávesnica + touchpad
- Pointer Events, multitouch, pointer capture, haptická odozva
- Nastaviteľná veľkosť, priehľadnosť, vlastné rozloženie

### ETAPA 8 — Google Drive (subagent C)
- `lib/google-drive/picker.ts` — Google Identity Services + Picker API, scope `drive.file`
- `lib/google-drive/url-parser.ts` — parser pre 4 formáty odkazov
- `lib/google-drive/downloader.ts` — streamovanie priamo do OPFS (ak CORS dovolí), inak fallback
- `app/api/drive/route.ts` — iba metadata proxy, nikdy neproxyuje ISO obsah

### ETAPA 9 — UI knižnica a UX (subagent C)
- Home dashboard: Continue Playing, Recently Played, Favorites, DOS/PS1/PS2 sekcie, Quick Import, Storage Status
- Library: grid/list, search, filter, sort
- Game detail: cover, metadata, save states, settings, akcie
- Saves: zoznam, export/import
- Settings: emulátor, ovládanie, úložisko, jazyk
- Diagnostics: capability probe + copy report

### ETAPA 10 — PS2 (subagent C)
- `emulators/ps2/ps2-adapter.ts` — skeleton, ktorý NEpredstiera emuláciu
- `emulators/ps2/ps2-availability.ts` — vracia `false` ak `NEXT_PUBLIC_ENABLE_PS2=false`
- UI: ak nie je dostupné, zobrazí `"PS2 emulačné jadro zatiaľ nie je v tomto zostavení dostupné."`
- Žiadne falošné save state / reset tlačidlá

### ETAPA 11 — Supabase (subagent C)
- `lib/supabase/client.ts` — vytvorí klienta len ak `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` existujú
- SQL migrácie s RLS: profiles, game_library_metadata, play_sessions, save_states, controller_profiles, emulator_settings, user_preferences
- Auth: email/password, magic link, Google OAuth, logout
- Sync len metadát — nikdy ROM/ISO/BIOS

### ETAPA 12 — Testy, CI, docs (main agent)
- Vitest: URL parser, path normalizer, path traversal, archive limits, platform detector, DOS launcher, CUE parser, IndexedDB repo, OPFS utils, emulator factory, gamepad mapping, save state compat
- React Testing Library: import dialog, platform selection, BIOS manager, virtual gamepad, error display, game detail
- Playwright: smoke test (otvorenie, import, uloženie, spustenie, save state, ukončenie, obnovenie, zmazanie)
- GitHub Actions: `npm ci && npm run typecheck && npm run lint && npm run test && npm run build`
- `.env.example` so všetkými env premennými
- `README.md`
- `IMPLEMENTATION_REPORT.md`

## 4. Kľúčové bezpečnostné rozhodnutia

1. **Lokálna priorita**: všetky ROM/ISO/BIN/CHD/BIOS zostávajú v zariadení. Žiadny server-side proxy pre obsah hier.
2. **OPFS pre veľké súbory**: žiadne `file.arrayBuffer()` pre viac ako ~256 MB. Streamovanie po chunkoch.
3. **Web Workers pre CPU-bound**: rozbaľovanie, hashing, detekcia.
4. **Bezpečnostné limity**: maxFiles=10000, maxPathLength=300, maxDirectoryDepth=20, maxNestedArchiveDepth=1, maxCompressionRatio=1000.
5. **Path traversal ochrana**: normalizePath + reject absolútnych / Windows drive / UNC / null byte paths.
6. **BIOS validácia**: veľkosť + SHA-256 hash + región (ak možno rozpoznať).
7. **Save state kompatibilita**: uloží sa `emulatorCore` + `emulatorVersion` + `gameFingerprint`. Pri nekompatibilite upozornenie.
8. **PS2 feature flag**: `NEXT_PUBLIC_ENABLE_PS2=false` — žiadny placeholder, ktorý by predstieral emuláciu.
9. **Service role key**: nikdy v klientskom bundle. Iba v API routes.
10. **OAuth tokeny**:SessionStorage alebo pamäť, nie localStorage.

## 5. Obmedzenia prostredia (sandbox)

Tento sandbox má obmedzenia, ktoré treba rešpektovať:
- `bun run dev` beží automaticky na porte 3000 — nespúšťať manuálne
- Nemožno spustiť `bun run build` — overí sa `bun run lint` + `bunx tsc --noEmit`
- Dev server log je v `/home/z/my-project/dev.log`
- Caddy gateway s `XTransformPort` query parametrom pre mini-servisy
- `z-ai-web-dev-sdk` iba na backend

## 6. Stav emulátorov

| Platforma | Stav | Poznámka |
|-----------|------|----------|
| DOS | ✅ Implementované | js-dos reálne WASM jadro |
| PS1 | ✅ Implementované | EmulatorJS / PCSX-ReARMed lokálne |
| PS2 | ⛔ Vypnuté | `NEXT_PUBLIC_ENABLE_PS2=false`, žiadna falošná emulácia |
