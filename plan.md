# Jaňo še chce bavkac â€” Implementation Plan

> LokĂˇlne orientovanĂ˝ online emulĂˇtor a sprĂˇvca vlastnĂ˝ch zĂˇloĹľnĂ˝ch kĂłpiĂ­ hier pre DOS, PlayStation 1 a PlayStation 2 (experimentĂˇlne).

## 1. CieÄľ

VytvoriĹĄ produkÄŤne pouĹľiteÄľnĂş webovĂş aplikĂˇciu (PWA) v Next.js 16, ktorĂˇ:

- beĹľĂ­ lokĂˇlne v prehliadaÄŤi bez povinnĂ©ho ĂşÄŤtu,
- importuje vlastnĂ© hry zo zariadenia / ZIP / RAR / 7z / Google Drive,
- ukladĂˇ ROM/ISO vĂ˝hradne do OPFS (Origin Private File System),
- ukladĂˇ metadata do IndexedDB,
- spĂşĹˇĹĄa DOS hry cez js-dos (reĂˇlne WASM jadro),
- spĂşĹˇĹĄa PS1 hry cez EmulatorJS / PCSX-ReARMed (lokĂˇlne hostovanĂ© assety),
- PS2 je za feature flagom `NEXT_PUBLIC_ENABLE_PS2=false` a NEpredstiera funkÄŤnosĹĄ,
- funguje ako inĹˇtalovateÄľnĂˇ PWA offline,
- nikdy neposiela hernĂ© sĂşbory na server.

## 2. CieÄľovĂˇ architektĂşra

```
src/
  app/
    layout.tsx                 # Root layout, PWA meta, fonts
    page.tsx                   # Home dashboard
    library/page.tsx           # Grid/list kniĹľnica
    import/page.tsx            # Import wizard
    game/[id]/page.tsx         # Detail hry
    play/[id]/page.tsx         # HernĂˇ obrazovka (lazy-loaded emulĂˇtor)
    saves/page.tsx             # SprĂˇva save states
    settings/page.tsx          # Nastavenia emulĂˇtora, ovlĂˇdania, ĂşloĹľiska
    profile/page.tsx           # VoliteÄľnĂ˝ ĂşÄŤet (Supabase)
    diagnostics/page.tsx       # Diagnostika prehliadaÄŤa
    legal/page.tsx             # PrĂˇvne informĂˇcie
    privacy/page.tsx           # Ochrana sĂşkromia
    terms/page.tsx             # Podmienky pouĹľĂ­vania
    api/
      drive/route.ts           # Google Drive metadata proxy (iba metadĂˇ, nie ISO)
      supabase/health/route.ts # VoliteÄľnĂ˝ health check

  components/
    layout/                    # AppShell, Sidebar, MobileNav, SafeArea
    library/                   # GameCard, GameGrid, GameList, FilterBar
    import/                    # ImportWizard, DropZone, ProgressOverlay, ArchiveWarnings
    emulator/                  # EmulatorCanvas, EmulatorControls, PerformanceOverlay
    controls/                  # VirtualGamepad, DosKeyboard, Touchpad, GamepadMapper
    storage/                   # StorageMeter, BiosManager, SaveStateList
    auth/                      # AuthDialog, ProfileMenu
    pwa/                       # InstallPrompt, UpdatePrompt
    ui/                        # shadcn/ui (uĹľ existuje)

  emulators/
    core/
      emulator-adapter.ts      # Rozhranie EmulatorAdapter
      emulator-factory.ts      # VĂ˝ber adapteru podÄľa platformy
      emulator-events.ts       # Typy udalostĂ­
      emulator-input.ts        # EmulatorInputEvent normalizĂˇcia
    dos/
      dos-adapter.ts           # js-dos integrĂˇcia
      dos-launcher.ts          # HÄľadanie START.BAT / GAME.EXE
      jsdos-builder.ts         # Vytvorenie .jsdos balĂ­ka
    ps1/
      ps1-adapter.ts           # EmulatorJS integrĂˇcia
      cue-parser.ts            # CUE sheet parser
      bios-validator.ts        # PS1 BIOS validĂˇcia
    ps2/
      ps2-adapter.ts           # Play!.js (zatiaÄľ feature-flag off)
      ps2-availability.ts      # Detekcia dostupnosti

  lib/
    archive/
      zip.ts                   # fflate wrapper
      rar.ts                   # libarchive.js wrapper
      seven-z.ts               # voliteÄľnĂ© 7z
      archive-security.ts      # ZIP bomb / path traversal ochrana
      archive-types.ts
    detection/
      platform-detector.ts     # HlavnĂˇ detekcia
      header-magic.ts          # Magic bytes
      iso-analyzer.ts          # ISO9660 + PS1/PS2 indikĂˇtory
      chd-analyzer.ts
    storage/
      opfs.ts                  # OPFS utilities
      indexeddb.ts             # DB wrapper s migrĂˇciami
      repositories.ts          # GameRecord, SaveState, Bios... repos
      storage-estimate.ts      # navigator.storage.estimate()
      streaming-writer.ts      # Chunked write do OPFS
    google-drive/
      picker.ts                # Google Picker API
      url-parser.ts            # Parser verejnĂ˝ch odkazov
      downloader.ts            # Streaming do OPFS
    security/
      path-normalizer.ts       # normalizePath, sanitize
      limits.ts                # maxFiles, maxPathLength...
      hashing.ts               # SHA-256 (SubtleCrypto)
    diagnostics/
      capability-probe.ts      # WebGL, WASM, OPFS, SharedArrayBuffer...
      report-builder.ts        # KopĂ­rovateÄľnĂ˝ diagnostickĂ˝ report
    supabase/
      client.ts                # VoliteÄľnĂ˝ klient (len ak env existuje)
      sync.ts                  # Metadata sync
    pwa/
      register-sw.ts           # Service worker registration
      install-prompt.ts        # beforeinstallprompt handler

  workers/
    archive.worker.ts          # RozbaÄľovanie ZIP/RAR/7z
    detection.worker.ts        # Detekcia platformy
    hashing.worker.ts          # SHA-256 vĂ˝poÄŤty
    file-copy.worker.ts        # KopĂ­rovanie chunkov do OPFS

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
  offline/                     # Offline fallback strĂˇnka
  demo/                        # LegĂˇlne testovacie ROM (prĂˇzdne)

supabase/
  migrations/                  # SQL migrĂˇcie s RLS

tests/
  unit/
  integration/
  e2e/
```

## 3. Etapy implementĂˇcie

### ETAPA 1 â€” ZĂˇklad (main agent)
- `next.config.ts`: `reactStrictMode: true`, odstrĂˇniĹĄ `ignoreBuildErrors`, pridaĹĄ cross-origin headers pre `/play/*`
- `tsconfig.json`: strict mode uĹľ nastavenĂ˝, overiĹĄ
- Design system: tmavĂˇ tĂ©ma, retro akcenty, Tailwind 4 tokens v `globals.css`
- Root `layout.tsx`: PWA meta, manifest, fonts, AppShell
- Routes skeleton pre vĹˇetky sekcie
- Stores: `library-store`, `import-store`, `emulator-store`, `settings-store`, `controller-store`, `auth-store`
- SpoloÄŤnĂ© typy v `src/types/`
- PWA manifest + ikony

### ETAPA 2 â€” LokĂˇlne ĂşloĹľisko (subagent A)
- `lib/storage/indexeddb.ts` â€” wrapper s verzovanĂ­m a migrĂˇciami
- `lib/storage/repositories.ts` â€” CRUD pre vĹˇetky entity
- `lib/storage/opfs.ts` â€” normalizePath, ensureDirectory, writeStream, readSlice, deleteRecursive, calculateDirectorySize, listDirectory, cleanupPartialImport
- `lib/storage/streaming-writer.ts` â€” chunked write cez `FileSystemSyncAccessHandle`
- `lib/storage/storage-estimate.ts` â€” `navigator.storage.estimate()`, `persist()`
- Rollback pri neĂşspeĹˇnom importe

### ETAPA 3 â€” Import (subagent A)
- `components/import/ImportWizard.tsx` â€” stavovĂ˝ automat (idle â†’ selecting â†’ reading â†’ validating â†’ extracting â†’ detecting â†’ awaiting-user-selection â†’ storing â†’ ready / error / cancelled)
- `components/import/DropZone.tsx` â€” drag&drop + file picker + multi-select + File System Access API
- `workers/archive.worker.ts` â€” rozbaÄľovanie cez fflate (ZIP) a libarchive.js (RAR/7z)
- `lib/archive/archive-security.ts` â€” ochrana pred ZIP bombou, path traversal, vnorenĂ˝mi archĂ­vmi
- Progress overlay s percentami, veÄľkosĹĄami, moĹľnosĹĄou zruĹˇenia (AbortController)

### ETAPA 4 â€” Detekcia (subagent A)
- `lib/detection/platform-detector.ts` â€” kombinuje prĂ­ponu, hlaviÄŤku, CUE, ISO ĹˇtruktĂşru
- `lib/detection/header-magic.ts` â€” magic bytes pre ISO9660, CHD, PBP, ELF, JSDOS
- `lib/detection/iso-analyzer.ts` â€” hÄľadĂˇ PS1/PS2 systĂ©movĂ© indikĂˇtory
- `emulators/ps1/cue-parser.ts` â€” CUE sheet parser s validĂˇciou BIN referenciĂ­
- `emulators/dos/dos-launcher.ts` â€” priorita START.BAT â†’ PLAY.BAT â†’ RUN.BAT â†’ GAME.BAT â†’ GAME.EXE...

### ETAPA 5 â€” DOS emulĂˇcia (subagent B)
- `emulators/dos/dos-adapter.ts` â€” reĂˇlna js-dos integrĂˇcia cez `window.emulators.jsdos()`
- `emulators/dos/jsdos-builder.ts` â€” vytvorenie .jsdos balĂ­ka (ZIP s .jsdos content-type)
- ImplementovaĹĄ initialize, loadGame, start, pause, resume, reset, sendInput, saveState, loadState, setVolume, enterFullscreen, destroy
- Auto-save pri ukonÄŤenĂ­
- Cleanup: revokes Blob URLs, removes listeners, removes dynamic elements

### ETAPA 6 â€” PS1 emulĂˇcia (subagent B)
- `emulators/ps1/ps1-adapter.ts` â€” EmulatorJS cez `window.EJS_*` config object
- `emulators/ps1/bios-validator.ts` â€” veÄľkosĹĄ + hash + regiĂłn
- `components/storage/BiosManager.tsx` â€” upload, list, delete
- Podpora BIN+CUE (viacero BIN trackov), CHD, PBP, ISO, viacdiskovĂ© hry
- Memory card, save states, prepĂ­nanie diskov
- Cleanup: AudioContext, Blob URLs, EJS config

### ETAPA 7 â€” OvlĂˇdanie (subagent B)
- `lib/gamepad/gamepad-manager.ts` â€” Gamepad API polling, deadzone, mapovanie, profily
- `components/controls/VirtualGamepad.tsx` â€” PS1/PS2 D-pad, analĂłgy, tlaÄŤidlĂˇ, L1/L2/R1/R2, Start/Select
- `components/controls/DosTouchpad.tsx` â€” virtuĂˇlna klĂˇvesnica + touchpad
- Pointer Events, multitouch, pointer capture, haptickĂˇ odozva
- NastaviteÄľnĂˇ veÄľkosĹĄ, priehÄľadnosĹĄ, vlastnĂ© rozloĹľenie

### ETAPA 8 â€” Google Drive (subagent C)
- `lib/google-drive/picker.ts` â€” Google Identity Services + Picker API, scope `drive.file`
- `lib/google-drive/url-parser.ts` â€” parser pre 4 formĂˇty odkazov
- `lib/google-drive/downloader.ts` â€” streamovanie priamo do OPFS (ak CORS dovolĂ­), inak fallback
- `app/api/drive/route.ts` â€” iba metadata proxy, nikdy neproxyuje ISO obsah

### ETAPA 9 â€” UI kniĹľnica a UX (subagent C)
- Home dashboard: Continue Playing, Recently Played, Favorites, DOS/PS1/PS2 sekcie, Quick Import, Storage Status
- Library: grid/list, search, filter, sort
- Game detail: cover, metadata, save states, settings, akcie
- Saves: zoznam, export/import
- Settings: emulĂˇtor, ovlĂˇdanie, ĂşloĹľisko, jazyk
- Diagnostics: capability probe + copy report

### ETAPA 10 â€” PS2 (subagent C)
- `emulators/ps2/ps2-adapter.ts` â€” skeleton, ktorĂ˝ NEpredstiera emulĂˇciu
- `emulators/ps2/ps2-availability.ts` â€” vracia `false` ak `NEXT_PUBLIC_ENABLE_PS2=false`
- UI: ak nie je dostupnĂ©, zobrazĂ­ `"PS2 emulaÄŤnĂ© jadro zatiaÄľ nie je v tomto zostavenĂ­ dostupnĂ©."`
- Ĺ˝iadne faloĹˇnĂ© save state / reset tlaÄŤidlĂˇ

### ETAPA 11 â€” Supabase (subagent C)
- `lib/supabase/client.ts` â€” vytvorĂ­ klienta len ak `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` existujĂş
- SQL migrĂˇcie s RLS: profiles, game_library_metadata, play_sessions, save_states, controller_profiles, emulator_settings, user_preferences
- Auth: email/password, magic link, Google OAuth, logout
- Sync len metadĂˇt â€” nikdy ROM/ISO/BIOS

### ETAPA 12 â€” Testy, CI, docs (main agent)
- Vitest: URL parser, path normalizer, path traversal, archive limits, platform detector, DOS launcher, CUE parser, IndexedDB repo, OPFS utils, emulator factory, gamepad mapping, save state compat
- React Testing Library: import dialog, platform selection, BIOS manager, virtual gamepad, error display, game detail
- Playwright: smoke test (otvorenie, import, uloĹľenie, spustenie, save state, ukonÄŤenie, obnovenie, zmazanie)
- GitHub Actions: `npm ci && npm run typecheck && npm run lint && npm run test && npm run build`
- `.env.example` so vĹˇetkĂ˝mi env premennĂ˝mi
- `README.md`
- `IMPLEMENTATION_REPORT.md`

## 4. KÄľĂşÄŤovĂ© bezpeÄŤnostnĂ© rozhodnutia

1. **LokĂˇlna priorita**: vĹˇetky ROM/ISO/BIN/CHD/BIOS zostĂˇvajĂş v zariadenĂ­. Ĺ˝iadny server-side proxy pre obsah hier.
2. **OPFS pre veÄľkĂ© sĂşbory**: Ĺľiadne `file.arrayBuffer()` pre viac ako ~256 MB. Streamovanie po chunkoch.
3. **Web Workers pre CPU-bound**: rozbaÄľovanie, hashing, detekcia.
4. **BezpeÄŤnostnĂ© limity**: maxFiles=10000, maxPathLength=300, maxDirectoryDepth=20, maxNestedArchiveDepth=1, maxCompressionRatio=1000.
5. **Path traversal ochrana**: normalizePath + reject absolĂştnych / Windows drive / UNC / null byte paths.
6. **BIOS validĂˇcia**: veÄľkosĹĄ + SHA-256 hash + regiĂłn (ak moĹľno rozpoznaĹĄ).
7. **Save state kompatibilita**: uloĹľĂ­ sa `emulatorCore` + `emulatorVersion` + `gameFingerprint`. Pri nekompatibilite upozornenie.
8. **PS2 feature flag**: `NEXT_PUBLIC_ENABLE_PS2=false` â€” Ĺľiadny placeholder, ktorĂ˝ by predstieral emulĂˇciu.
9. **Service role key**: nikdy v klientskom bundle. Iba v API routes.
10. **OAuth tokeny**:SessionStorage alebo pamĂ¤ĹĄ, nie localStorage.

## 5. Obmedzenia prostredia (sandbox)

Tento sandbox mĂˇ obmedzenia, ktorĂ© treba reĹˇpektovaĹĄ:
- `bun run dev` beĹľĂ­ automaticky na porte 3000 â€” nespĂşĹˇĹĄaĹĄ manuĂˇlne
- NemoĹľno spustiĹĄ `bun run build` â€” overĂ­ sa `bun run lint` + `bunx tsc --noEmit`
- Dev server log je v `/home/z/my-project/dev.log`
- Caddy gateway s `XTransformPort` query parametrom pre mini-servisy
- `z-ai-web-dev-sdk` iba na backend

## 6. Stav emulĂˇtorov

| Platforma | Stav | PoznĂˇmka |
|-----------|------|----------|
| DOS | âś… ImplementovanĂ© | js-dos reĂˇlne WASM jadro |
| PS1 | âś… ImplementovanĂ© | EmulatorJS / PCSX-ReARMed lokĂˇlne |
| PS2 | â›” VypnutĂ© | `NEXT_PUBLIC_ENABLE_PS2=false`, Ĺľiadna faloĹˇnĂˇ emulĂˇcia |
