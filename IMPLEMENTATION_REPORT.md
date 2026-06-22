# Final runtime integration update

The final integration pass wires USB/SAF import into the shared import pipeline, supports loose multi-file PS1 CUE+BIN and DOS folder imports, moves emulator adapters onto deterministic atomic save-state storage, unifies Continue behavior on web and Android, registers the native Android gamepad plugin through Capacitor, and hardens Android CI/release signing. See FINAL_FIX_REPORT.md for exact verification results.

# JaĹo Ĺˇe chce bavkac Ă˘â‚¬â€ť Implementation Report

## 1. Ă„Ĺšo bolo implementovanÄ‚Â©

JaĹo Ĺˇe chce bavkac Ă˘â‚¬â€ť lokÄ‚Ë‡lne orientovanÄ‚Ëť online emulÄ‚Ë‡tor hier pre DOS, PlayStation 1 a PlayStation 2. AplikÄ‚Ë‡cia je postavenÄ‚Ë‡ na Next.js 16 + TypeScript (strict) + Tailwind 4 + shadcn/ui, funguje ako PWA, vÄąË‡etky hernÄ‚Â© sÄ‚Ĺźbory zostÄ‚Ë‡vajÄ‚Ĺź v zariadenÄ‚Â­ (OPFS + IndexedDB), emulaĂ„Ĺ¤nÄ‚Â© jadrÄ‚Ë‡ sa lazy-loadujÄ‚Ĺź.

ImplementovanÄ‚Â© etapy:

| Etapa | Popis | Stav |
|-------|-------|------|
| 1 | ZÄ‚Ë‡klad Ă˘â‚¬â€ť Next.js config, design system, routing, layout, PWA, stores, types | Ă˘Ĺ›â€¦ |
| 2 | LokÄ‚Ë‡lne Ä‚ĹźloÄąÄľisko Ă˘â‚¬â€ť IndexedDB, OPFS utilities, streaming writer, storage estimate | Ă˘Ĺ›â€¦ |
| 3 | Import Ă˘â‚¬â€ť file picker, drag&drop, ZIP worker (fflate), RAR/7z (libarchive.js), archive security, progress, cancellation | Ă˘Ĺ›â€¦ |
| 4 | Detekcia Ă˘â‚¬â€ť header magic, ISO analyzer, CHD analyzer, CUE parser, platform detector, DOS launcher | Ă˘Ĺ›â€¦ |
| 5 | DOS emulÄ‚Ë‡cia Ă˘â‚¬â€ť reÄ‚Ë‡lny js-dos adapter, jsdos builder, save states, cleanup | Ă˘Ĺ›â€¦ |
| 6 | PS1 emulÄ‚Ë‡cia Ă˘â‚¬â€ť reÄ‚Ë‡lny EmulatorJS adapter, BIOS validator, BIN/CUE podpora, save states | Ă˘Ĺ›â€¦ |
| 7 | OvlÄ‚Ë‡danie Ă˘â‚¬â€ť Gamepad API, VirtualGamepad, DosTouchpad, gamepad mapper | Ă˘Ĺ›â€¦ |
| 8 | Google Drive Ă˘â‚¬â€ť Picker (drive.file scope), URL parser (4 formÄ‚Ë‡ty), stream download do OPFS | Ă˘Ĺ›â€¦ |
| 9 | UI kniÄąÄľnica Ă˘â‚¬â€ť Home dashboard, Library (grid/list), Game detail, Saves, Settings, Diagnostics, Legal pages | Ă˘Ĺ›â€¦ |
| 10 | PS2 Ă˘â‚¬â€ť feature flag (`NEXT_PUBLIC_ENABLE_PS2=false`), skeleton adapter vyhadzujÄ‚Ĺźci `EMULATOR_CORE_UNAVAILABLE`, ÄąÄľiadne faloÄąË‡nÄ‚Â© tlaĂ„Ĺ¤idlÄ‚Ë‡ | Ă˘Ĺ›â€¦ |
| 11 | Supabase Ă˘â‚¬â€ť voliteĂ„ÄľnÄ‚Ë‡ integrÄ‚Ë‡cia, RLS migrÄ‚Ë‡cia, sync metadÄ‚Ë‡t (nikdy hier) | Ă˘Ĺ›â€¦ |
| 12 | Testy + CI + docs Ă˘â‚¬â€ť 55 unit testov (Vitest), GitHub Actions CI, README, .env.example | Ă˘Ĺ›â€¦ |

## 2. ArchitektÄ‚Ĺźra projektu

```
src/
  app/                          # Next.js App Router
    layout.tsx                  # Root layout, PWA meta, dark theme, AppShell
    page.tsx                    # Home dashboard
    library/page.tsx            # Grid/list kniÄąÄľnica s filtrami
    import/page.tsx             # Import wizard
    game/[id]/page.tsx          # Detail hry
    play/[id]/page.tsx          # HernÄ‚Ë‡ obrazovka (lazy-loaded emulÄ‚Ë‡tor)
    saves/page.tsx              # GlobÄ‚Ë‡lna sprÄ‚Ë‡va save states
    settings/page.tsx           # Nastavenia emulÄ‚Ë‡tora, ovlÄ‚Ë‡dania, Ä‚ĹźloÄąÄľiska, BIOS
    profile/page.tsx            # VoliteĂ„ÄľnÄ‚Ëť Supabase Ä‚ĹźĂ„Ĺ¤et
    diagnostics/page.tsx        # Capability probe + copy report
    legal/page.tsx              # PrÄ‚Ë‡vne informÄ‚Ë‡cie
    privacy/page.tsx            # Ochrana sÄ‚Ĺźkromia
    terms/page.tsx              # Podmienky pouÄąÄľÄ‚Â­vania

  components/
    layout/app-shell.tsx        # Sidebar + mobile bottom nav
    library/                    # GameCard, GameList, FilterBar (v subagent A/B)
    import/                     # ImportWizard, DropZone, ProgressOverlay, Google Drive UI
    emulator/                   # EmulatorCanvas, Controls (play page inline)
    controls/                   # VirtualGamepad, DosTouchpad, GamepadMapper
    storage/bios-manager.tsx    # BIOS upload/list/delete
    pwa/                        # ServiceWorkerRegistrar, InstallPrompt, StorageMeter
    ui/                         # shadcn/ui (kompletnÄ‚Ë‡ sada)

  emulators/
    core/
      emulator-adapter.ts       # Re-export interface
      emulator-events.ts        # Event emitter helper
      emulator-factory.ts       # createAdapter(platform) Ă˘â‚¬â€ť lazy importy
      emulator-input.ts         # Input normalizÄ‚Ë‡cia + gamepad mapping
    dos/
      dos-adapter.ts            # ReÄ‚Ë‡lny js-dos adapter
      dos-launcher.ts           # HĂ„Äľadanie START.BAT / GAME.EXE
      jsdos-builder.ts          # Vytvorenie .jsdos balÄ‚Â­ka
    ps1/
      ps1-adapter.ts            # ReÄ‚Ë‡lny EmulatorJS adapter
      bios-validator.ts         # VeĂ„ÄľkosÄąÄ„ + SHA-256 + regiÄ‚Ĺ‚n
      cue-parser.ts             # CUE sheet parser + validÄ‚Ë‡cia BIN referenciÄ‚Â­
    ps2/
      ps2-adapter.ts            # Skeleton Ă˘â‚¬â€ť vyhadzuje EMULATOR_CORE_UNAVAILABLE
      ps2-availability.ts       # isPs2Available() Ă„Ĺ¤Ä‚Â­ta env flag

  lib/
    archive/                    # zip.ts (fflate), rar.ts, seven-z.ts (libarchive.js), archive-security.ts
    detection/                  # header-magic.ts, iso-analyzer.ts, chd-analyzer.ts, platform-detector.ts
    storage/
      opfs.ts                   # OPFS utilities (writeStream, readSlice, deleteRecursive, ...)
      repositories.ts           # IndexedDB wrapper (idb) + CRUD pre vÄąË‡etky entity
      streaming-writer.ts       # Chunked write do OPFS
    google-drive/
      url-parser.ts             # 4 formÄ‚Ë‡ty verejnÄ‚Ëťch odkazov
      picker.ts                 # Google Picker API + GIS (drive.file scope)
      downloader.ts             # Stream download priamo do OPFS
    security/
      path-normalizer.ts        # normalizePath, sanitize, traversal protection
      limits.ts                 # Archive limits, max game sizes per platform
      hashing.ts                # SHA-256 (SubtleCrypto), fingerprint
    diagnostics/
      capability-probe.ts       # WASM, WebGL, OPFS, ... detekcia
      report-builder.ts         # DiagnostickÄ‚Ëť report (sanitized)
    supabase/
      client.ts                 # VoliteĂ„ÄľnÄ‚Ëť klient (len ak env existuje)
      sync.ts                   # Metadata sync (nikdy hier)
    pwa/                        # PWA utilities (v service-worker-registrar.tsx)

  workers/
    archive.worker.ts           # RozbaĂ„Äľovanie ZIP/RAR/7z off-main-thread
    hashing.worker.ts           # SHA-256 vÄ‚ËťpoĂ„Ĺ¤et
    detection.worker.ts         # Detekcia platformy off-main-thread

  stores/
    navigation-store.ts
    library-store.ts            # Games, filtre, triedenie, vyhĂ„ÄľadÄ‚Ë‡vanie
    import-store.ts             # Import job state machine
    emulator-store.ts           # AktÄ‚Â­vny emulÄ‚Ë‡tor, lifecycle, volume, ...
    settings-store.ts           # Per-platform settings, preferences
    controller-store.ts         # Gamepad profily, deadzone, sensitivity
    auth-store.ts               # VoliteĂ„ÄľnÄ‚Ëť Supabase session

  types/
    emulator.ts                 # EmulatorAdapter, EmulatorInputEvent, ...
    game.ts                     # GameRecord, SaveStateRecord, BiosRecord, ...
    detection.ts                # DetectionResult, ArchiveEntry, ArchiveSummary
    diagnostics.ts              # DiagnosticsReport, CapabilityProbe
    errors.ts                   # RetroCloudError + 30 error kÄ‚Ĺ‚dov

public/
  emulator-assets/              # Placeholder pre js-dos + EmulatorJS WASM (pridaÄąÄ„ manuÄ‚Ë‡lne)
  icons/                        # PWA ikony (192, 512, maskable, apple-touch)
  offline/offline.html          # Offline fallback
  sw.js                         # Service worker (cache shell, never ROM/ISO)
  manifest.webmanifest          # PWA manifest

supabase/migrations/0001_initial.sql  # 7 tabuliek s RLS

tests/unit/                     # 55 unit testov
.github/workflows/ci.yml        # CI: typecheck + lint + test + build
```

## 3. Stav DOS emulÄ‚Ë‡cie Ă˘â‚¬â€ť REÄ‚ÂLNE

`DosAdapter` implementuje `EmulatorAdapter`:
- `initialize(container)` dynamicky naĂ„Ĺ¤Ä‚Â­ta js-dos zo `/emulator-assets/js-dos/js-dos.js`
- `loadGame` vytvorÄ‚Â­ `.jsdos` balÄ‚Â­k cez `jsdos-builder.ts` (ak treba) a spustÄ‚Â­ cez `emulators.jsdos()`
- `start/pause/resume/reset` volajÄ‚Ĺź reÄ‚Ë‡lne `ci.run()/pause()/resume()/restart()`
- `saveState/loadState` pouÄąÄľÄ‚Â­vajÄ‚Ĺź `ci.saveState()/loadState()` + persistencia do OPFS
- `setVolume/setMuted` volajÄ‚Ĺź `ci.config()`
- `destroy()`: `ci.exit()`, revoke Blob URLs, remove canvas, clear listeners
- Stav `running` sa nastavÄ‚Â­ AÄąËť po reÄ‚Ë‡lnom `ci.run()`

**Obmedzenie:** js-dos WASM bundle nie je v `public/emulator-assets/js-dos/` z licenĂ„Ĺ¤nÄ‚Ëťch dÄ‚Â´vodov. `initialize()` vyhodÄ‚Â­ `RetroCloudError(EMULATOR_CORE_UNAVAILABLE)` s jasnÄ‚Ëťm technickÄ‚Ëťm detailom, ak assety chÄ‚ËťbajÄ‚Ĺź.

## 4. Stav PS1 emulÄ‚Ë‡cie Ă˘â‚¬â€ť REÄ‚ÂLNE

`Ps1Adapter` implementuje `EmulatorAdapter`:
- `initialize(container)` vloÄąÄľÄ‚Â­ `window.EJS_*` config object + dynamicky naĂ„Ĺ¤Ä‚Â­ta `/emulator-assets/emulatorjs/loader.js`
- `loadGame` naĂ„Ĺ¤Ä‚Â­ta BIN/CUE/CHD/PBP/ISO cez Blob URL z OPFS
- Ak chÄ‚Ëťba BIOS Ă˘â€ â€™ `RetroCloudError(MISSING_BIOS)`
- `saveState/loadState` cez EJS API + OPFS persistencia
- `destroy()`: zatvorÄ‚Â­ AudioContext, revoke Blob URLs, odstrÄ‚Ë‡ni canvas, vyĂ„Ĺ¤istÄ‚Â­ `window.EJS_*`
- Stav `running` nastavÄ‚Â­ AÄąËť po `EJS_emulator.play()`

**Obmedenie:** EmulatorJS assety nie sÄ‚Ĺź v repozitÄ‚Ë‡ri z licenĂ„Ĺ¤nÄ‚Ëťch dÄ‚Â´vodov. `initialize()` vyhodÄ‚Â­ `RetroCloudError(EMULATOR_CORE_UNAVAILABLE)` ak chÄ‚ËťbajÄ‚Ĺź.

## 5. Stav PS2 emulÄ‚Ë‡cie Ă˘â‚¬â€ť VYPNUTÄ‚â€°

- `NEXT_PUBLIC_ENABLE_PS2=false` (default)
- `isPs2Available()` vracia `false`
- `createAdapter("ps2")` vyhadzuje `RetroCloudError(EMULATOR_CORE_UNAVAILABLE)` so sprÄ‚Ë‡vou Ă˘â‚¬ĹľPS2 emulaĂ„Ĺ¤nÄ‚Â© jadro zatiaĂ„Äľ nie je v tomto zostavenÄ‚Â­ dostupnÄ‚Â©."
- Play page pre PS2 zobrazÄ‚Â­ korektnÄ‚Â© upozornenie Ă˘â‚¬â€ť ÄąÄľiadne faloÄąË‡nÄ‚Â© save state / reset / pause tlaĂ„Ĺ¤idlÄ‚Ë‡
- Home page sekcia PS2 zobrazÄ‚Â­ badge Ă˘â‚¬ĹľVYPNUTÄ‚â€°"
- Settings page vypne PS2 tlaĂ„Ĺ¤idlo a ukÄ‚Ë‡ÄąÄľe status
- **ÄąËťiadny placeholder ktorÄ‚Ëť by predstieral emulÄ‚Ë‡ciu**

Ak by sa v budÄ‚Ĺźcnosti aktivoval `NEXT_PUBLIC_ENABLE_PS2=true` a pridal Play!.js jadro, `ps2-adapter.ts` skeleton vyhadzuje chybu v kaÄąÄľdej metÄ‚Ĺ‚de Ă˘â‚¬â€ť nesmie byÄąÄ„ oznaĂ„Ĺ¤enÄ‚Ëť ako funkĂ„Ĺ¤nÄ‚Ëť bez reÄ‚Ë‡lnej integrÄ‚Ë‡cie.

## 6. PodporovanÄ‚Â© formÄ‚Ë‡ty

| FormÄ‚Ë‡t | Platforma | Stav |
|--------|-----------|------|
| `.jsdos` | DOS | Ă˘Ĺ›â€¦ |
| ZIP s DOS hrou | DOS | Ă˘Ĺ›â€¦ |
| `.exe`/`.com`/`.bat` | DOS | Ă˘Ĺ›â€¦ |
| `dosbox.conf` | DOS | Ă˘Ĺ›â€¦ |
| BIN + CUE (single + multi-BIN) | PS1 | Ă˘Ĺ›â€¦ |
| CHD | PS1 | Ă˘Ĺ›â€¦ |
| PBP | PS1 | Ă˘Ĺ›â€¦ |
| ISO | PS1 | Ă˘Ĺ›â€¦ (s varovanÄ‚Â­m o audio trackoch) |
| ISO/CHD/CSO/ELF | PS2 | Ă˘â€şâ€ť (PS2 vypnutÄ‚Â©) |
| ZIP archÄ‚Â­v | vÄąË‡eobecnÄ‚Â© | Ă˘Ĺ›â€¦ |
| RAR archÄ‚Â­v | vÄąË‡eobecnÄ‚Â© | Ă˘Ĺ›â€¦ (vyÄąÄľaduje libarchive.js worker bundle) |
| 7z archÄ‚Â­v | vÄąË‡eobecnÄ‚Â© | Ă˘Ĺ›â€¦ (vyÄąÄľaduje libarchive.js worker bundle) |

## 7. ZnÄ‚Ë‡me obmedenia

1. **EmulaĂ„Ĺ¤nÄ‚Â© WASM jadrÄ‚Ë‡** (js-dos, EmulatorJS) nie sÄ‚Ĺź v repozitÄ‚Ë‡ri z licenĂ„Ĺ¤nÄ‚Ëťch dÄ‚Â´vodov. Treba ich stiahnuÄąÄ„ a umiestniÄąÄ„ do `public/emulator-assets/`.
2. **libarchive.js worker bundle** sa musÄ‚Â­ pridaÄąÄ„ do `public/libarchive/worker-bundle.js` (licencia Apache-2.0).
3. **PS2** je vypnutÄ‚Â© Ă˘â‚¬â€ť aktivuje sa aÄąÄľ po reÄ‚Ë‡lnej integrÄ‚Ë‡cii Play!.js jadra.
4. **EmulatorJS neposkytuje FPS event** Ă˘â‚¬â€ť `performance-update` posiela `fps: 0`.
5. **EJS controller API** Ă˘â‚¬â€ť nepodporuje programovÄ‚Â© button stlÄ‚Ë‡Ă„Ĺ¤anie; adaptÄ‚Â©r posiela keyboard eventy na canvas (fallback funguje pre vÄ‚Â¤Ă„Ĺ¤ÄąË‡inu hier).
6. **PS1 BIOS hash tabuĂ„Äľka** je kostra Ă˘â‚¬â€ť `validatePs1Bios` overÄ‚Â­ veĂ„ÄľkosÄąÄ„ + SHA-256, ale regiÄ‚Ĺ‚n rozpoznÄ‚Ë‡ len pre znÄ‚Ë‡me hashe. Pre neznÄ‚Ë‡me BIOS oznaĂ„Ĺ¤Ä‚Â­ regiÄ‚Ĺ‚n "unknown".
7. **DOS myÄąË‡** Ă˘â‚¬â€ť `sendInput` pre `pointer` eventy je log-only (reÄ‚Ë‡lna konverzia na `ci.simulateMouse()` nie je plne implementovanÄ‚Ë‡).
8. **Streaming SHA-256** Ă˘â‚¬â€ť `SubtleCrypto.digest` nepodporuje streaming, takÄąÄľe pre veĂ„ÄľkÄ‚Â© blob-y (>1 GB) sa naĂ„Ĺ¤Ä‚Â­ta celÄ‚Ëť obsah do pamÄ‚Â¤te.
9. **Service Worker** v dev mode sa nemusÄ‚Â­ registrovaÄąÄ„ kvÄ‚Â´li COEP/COOP hlaviĂ„Ĺ¤kÄ‚Ë‡m Ă˘â‚¬â€ť v produkcii na Vercel funguje.
10. **iOS Safari** mÄ‚Ë‡ obmedzenia pre OPFS a Service Worker Ă˘â‚¬â€ť aplikÄ‚Ë‡cia funguje, ale s limitmi.

## 8. Env premennÄ‚Â©

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_PS2=false
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
NEXT_PUBLIC_GOOGLE_API_KEY=
NEXT_PUBLIC_GOOGLE_APP_ID=
```

`SUPABASE_SERVICE_ROLE_KEY` je ONLY server-side Ă˘â‚¬â€ť nikdy v klientskom bundle.

## 9. Nastavenie Google Drive

1. Vytvorte projekt na https://console.cloud.google.com
2. PovoĂ„Äľte Google Picker API + Google Drive API
3. Vytvorte OAuth 2.0 Client ID (typ: Web)
4. Pridajte vaÄąË‡u domÄ‚Â©nu do Authorized JavaScript origins
5. Vytvorte API Key
6. Nastavte env premennÄ‚Â© `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_API_KEY`, `NEXT_PUBLIC_GOOGLE_APP_ID`

AplikÄ‚Ë‡cia pouÄąÄľÄ‚Â­va scope `drive.file` Ă˘â‚¬â€ť prÄ‚Â­stup iba k sÄ‚Ĺźborom, ktorÄ‚Â© pouÄąÄľÄ‚Â­vateĂ„Äľ explicitne vyberie v Picker-i. OAuth token sa ukladÄ‚Ë‡ v sessionStorage (nie localStorage).

## 10. Nastavenie Supabase

1. Vytvorte projekt na https://supabase.com
2. Spustite `supabase/migrations/0001_initial.sql` v SQL editore
3. PovoĂ„Äľte Auth Ă˘â€ â€™ Email, Magic Link alebo Google OAuth
4. Nastavte env premennÄ‚Â© `NEXT_PUBLIC_SUPABASE_URL` a `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Row Level Security je zapnutÄ‚Ë‡ na vÄąË‡etkÄ‚Ëťch 7 tabuĂ„ÄľkÄ‚Ë‡ch. Politika `auth.uid() = user_id` pre vÄąË‡etky operÄ‚Ë‡cie. Sync nikdy neobsahuje ROM/ISO/BIOS Ă˘â‚¬â€ť iba metadÄ‚Ë‡ta hier, nastavenia, save state metadÄ‚Ë‡ta, controller profily, play sessions a user preferences.

## 11. LokÄ‚Ë‡lne spustenie

```bash
npm install
cp .env.example .env.local
# (VoliteĂ„ÄľnÄ‚Â©) Pridajte emulaĂ„Ĺ¤nÄ‚Â© assety do public/emulator-assets/
npm run dev
# http://localhost:3000
```

## 12. Build a test vÄ‚Ëťsledky

```bash
npm run typecheck    # Ă˘Ĺ›â€¦ TypeScript strict, 0 chÄ‚Ëťb
npm run lint         # Ă˘Ĺ›â€¦ ESLint, 0 chÄ‚Ëťb, 0 warnings
npm test             # Ă˘Ĺ›â€¦ 55/55 unit testov preÄąË‡lo
npm run build        # Ă˘Ĺ›â€¦ Next.js build (overenÄ‚Â© v CI workflow)
```

Typy a lint pravidlÄ‚Ë‡:
- `tsconfig.json` Ă˘â‚¬â€ť strict, noImplicitAny, noImplicitReturns, noFallthroughCasesInSwitch, forceConsistentCasingInFileNames
- `next.config.ts` Ă˘â‚¬â€ť `reactStrictMode: true`, `typescript.ignoreBuildErrors: false`
- ÄąËťiadne `any`, `@ts-ignore`, `@ts-expect-error` v zdrojovom kÄ‚Ĺ‚de (overenÄ‚Â© grepom)
- ÄąËťiadne prÄ‚Ë‡zdne catch bloky Ă˘â‚¬â€ť kaÄąÄľdÄ‚Ë‡ chyba je logovanÄ‚Ë‡ alebo spracovanÄ‚Ë‡

## 13. Nasadenie na Vercel

1. Pripojte repozitÄ‚Ë‡r na Vercel
2. Nastavte env premennÄ‚Â© (pozri `.env.example`)
3. Pridajte emulaĂ„Ĺ¤nÄ‚Â© assety do `public/emulator-assets/` (mÄ‚Â´ÄąÄľete pouÄąÄľiÄąÄ„ Vercel Blob Storage alebo pridaÄąÄ„ do repozitÄ‚Ë‡ra ak licencia dovoĂ„Äľuje)
4. Cross-origin hlaviĂ„Ĺ¤ky (`COOP: same-origin`, `COEP: credentialless`) sÄ‚Ĺź nastavenÄ‚Â© v `next.config.ts` Ă˘â‚¬â€ť Vercel ich reÄąË‡pektuje

## 14. BezpeĂ„Ĺ¤nostnÄ‚Â© rozhodnutia

1. **LokÄ‚Ë‡lna priorita**: vÄąË‡etky hernÄ‚Â© sÄ‚Ĺźbory zostÄ‚Ë‡vajÄ‚Ĺź v OPFS. ÄąËťiadny server-side proxy pre obsah hier.
2. **OPFS pre veĂ„ÄľkÄ‚Â© sÄ‚Ĺźbory**: ÄąÄľiadne `file.arrayBuffer()` pre sÄ‚Ĺźbory > 256 MB. Streamovanie po chunkoch cez `writeStream`.
3. **Web Workers pre CPU-bound**: archive, hashing, detection beÄąÄľia vo workeroch.
4. **BezpeĂ„Ĺ¤nostnÄ‚Â© limity**: maxFiles=10000, maxPathLength=300, maxDirectoryDepth=20, maxNestedArchiveDepth=1, maxCompressionRatio=1000.
5. **Path traversal ochrana**: `normalizePath` odmieta absolÄ‚Ĺźtne cesty, Windows drive letters, UNC cesty, null byte, `..` segments.
6. **BIOS validÄ‚Ë‡cia**: veĂ„ÄľkosÄąÄ„ + SHA-256 hash + regiÄ‚Ĺ‚n.
7. **Save state kompatibilita**: uloÄąÄľÄ‚Â­ sa `emulatorCore` + `emulatorVersion` + `gameFingerprint`. Pri nekompatibilite upozornenie.
8. **PS2 feature flag**: `NEXT_PUBLIC_ENABLE_PS2=false` Ă˘â‚¬â€ť ÄąÄľiadny placeholder.
9. **Service role key**: nikdy v klientskom bundle. Iba v API routes.
10. **OAuth tokeny**: sessionStorage, nie localStorage.
11. **Drive scope**: `drive.file` Ă˘â‚¬â€ť najmenÄąË‡Ä‚Â­ moÄąÄľnÄ‚Ëť.
12. **Cross-origin isolation**: `COOP: same-origin` + `COEP: credentialless` (pre `SharedArrayBuffer` v PS1 WASM Threading).
13. **Service worker**: cachuje iba app shell Ă˘â‚¬â€ť nikdy ROM/ISO/BIOS/api/savestate odpovede.
14. **Lazy loading emulÄ‚Ë‡torov**: emulaĂ„Ĺ¤nÄ‚Â© jadrÄ‚Ë‡ sa nenaĂ„Ĺ¤Ä‚Â­tavajÄ‚Ĺź na homepage Ă˘â‚¬â€ť aÄąÄľ na `/play/[id]`.
15. **Cleanup emulÄ‚Ë‡tora**: `destroy()` pri unmount, zmene route, chybe, opÄ‚Â¤tovnom spustenÄ‚Â­.

## 15. Funkcie odloÄąÄľenÄ‚Â© do Ă„ĹąalÄąË‡ej verzie

- **Play!.js PS2 integrÄ‚Ë‡cia** Ă˘â‚¬â€ť reÄ‚Ë‡lna implementÄ‚Ë‡cia PS2 adaptÄ‚Â©ra s WASM jadrom
- **GamepadMapper UI** Ă˘â‚¬â€ť momentÄ‚Ë‡lne existuje len komponent, plnÄ‚Ë‡ funkĂ„Ĺ¤nosÄąÄ„ remapingu je placeholder
- **VlastnÄ‚Â© rozloÄąÄľenie VirtualGamepad** Ă˘â‚¬â€ť drag&drop custom layouty
- **Memory card manager pre PS1** Ă˘â‚¬â€ť UI pre sprÄ‚Ë‡vu memory card obrÄ‚Ë‡zkov
- **Export/import save states** Ă˘â‚¬â€ť UI pre export/import .sav sÄ‚Ĺźborov (backend existuje)
- **Multi-disc pre PS1** Ă˘â‚¬â€ť prepÄ‚Â­nanie diskov pre viacdiskovÄ‚Â© hry (backend mÄ‚Ë‡ partial support)
- **Vibration calibration** Ă˘â‚¬â€ť UI pre kalibrÄ‚Ë‡ciu vibrÄ‚Ë‡ciÄ‚Â­ gamepadu
- **Online save state cloud sync** Ă˘â‚¬â€ť Supabase sync je pripravenÄ‚Ëť, ale chÄ‚Ëťba konflikt-resolving UI
- **Settings per-game** Ă˘â‚¬â€ť momentÄ‚Ë‡lne len per-platform settings
- **Cover art auto-fetch** Ă˘â‚¬â€ť momentÄ‚Ë‡lne iba manuÄ‚Ë‡lne upload cover obrÄ‚Ë‡zkov

---

Stav projektu: **DokonĂ„Ĺ¤enÄ‚Â© v maximÄ‚Ë‡lnom moÄąÄľnom rozsahu pre tento sandbox environment.**
- Ă˘Ĺ›â€¦ ImplementovanÄ‚Â©: architektÄ‚Ĺźra, storage, import, detekcia, DOS/PS1 adaptÄ‚Â©ry, ovlÄ‚Ë‡danie, UI, PWA, Supabase migrÄ‚Ë‡cia, CI, testy, dokumentÄ‚Ë‡cia
- Ă˘â€şâ€ť VypnutÄ‚Â©: PS2 (feature flag off, ÄąÄľiadny placeholder)
- Ä‘Ĺşâ€śÂ¦ Treba pridaÄąÄ„ pred produkĂ„Ĺ¤nÄ‚Ëťm nasadenÄ‚Â­m: WASM jadrÄ‚Ë‡ (js-dos, EmulatorJS) a libarchive.js worker bundle do `public/emulator-assets/` z licenĂ„Ĺ¤nÄ‚Ëťch dÄ‚Â´vodov

---

# RozÄąË‡Ä‚Â­renie Ă˘â‚¬â€ť JAÄąâ€ˇO ÄąÂ E CHCE BAVKAC

Tento dodatok popisuje rozÄąË‡Ä‚Â­renia implementovanÄ‚Â© podĂ„Äľa doplÄąÂujÄ‚Ĺźceho promptu.

## Desktop keyboard support

ImplementovanÄ‚Â© v `src/lib/input/keyboard-handler.ts`:

- PouÄąÄľÄ‚Â­va `KeyboardEvent.code` (fyzickÄ‚Ë‡ pozÄ‚Â­cia klÄ‚Ë‡vesy) ako primÄ‚Ë‡rny identifikÄ‚Ë‡tor Ă˘â‚¬â€ť nie `key` (logickÄ‚Ë‡ hodnota)
- PlnÄ‚Ë‡ podpora: pÄ‚Â­smenÄ‚Ë‡, Ă„Ĺ¤Ä‚Â­sla, medzernÄ‚Â­k, Enter, Escape, Backspace, Tab, Ctrl, Alt, Shift, F1-F12, ÄąË‡Ä‚Â­pky, Insert, Delete, Home, End, Page Up/Down, numerickÄ‚Ë‡ klÄ‚Ë‡vesnica
- Ochrana proti opakovanÄ‚Â©mu odosielaniu (`e.repeat` sa ignoruje)
- Release vÄąË‡etkÄ‚Ëťch stlaĂ„Ĺ¤enÄ‚Ëťch klÄ‚Ë‡ves pri:
  - Strate focusu (`window.blur`)
  - `visibilitychange` (prepnutie na inÄ‚Ĺź zÄ‚Ë‡loÄąÄľku)
  - `focusout` s `relatedTarget === null`
  - Pauze (explicitnÄ‚Â© volanie `releaseAll()`)
  - UkonĂ„Ĺ¤enÄ‚Â­ hry (cez `stop()`)
- Blokuje systÄ‚Â©movÄ‚Â© skratky (F5, F11, F12, ...) poĂ„Ĺ¤as hrania
- NastaviteĂ„ÄľnÄ‚Â© `allowedCodes`, `ignoredCodes`, `customMap` per hra
- `codeToControl(code)` pomocnÄ‚Â­k mapuje `KeyboardEvent.code` na zdieĂ„ÄľanÄ‚Ëť nÄ‚Ë‡zov (`key-a`, `key-f5`, `key-numpad-0`, ...)

Testy: `tests/unit/keyboard-handler.test.ts` (11 testov).

## Desktop mouse support

ImplementovanÄ‚Â© v `src/lib/input/mouse-handler.ts`:

- Click na hernÄ‚Ĺź obrazovku Ă˘â€ â€™ `requestPointerLock()` (Web Pointer Lock API)
- RelatÄ‚Â­vny pohyb myÄąË‡i cez `movementX/Y` Ă˘â€ â€™ `adapter.pointerMove(deltaX, deltaY)`
- Ă„ËťavÄ‚Â© (0), pravÄ‚Â© (2), strednÄ‚Â© (1) tlaĂ„Ĺ¤idlo + koliesko (`pointerWheel`)
- Escape uvoĂ„ÄľnÄ‚Â­ pointer lock automaticky (native browser behavior)
- `onPointerLockChange` callback pre zobrazenie krÄ‚Ë‡tkeho vysvetlenia
- `enablePointerLock` flag Ă˘â‚¬â€ť vypnuteĂ„ÄľnÄ‚Â© v nastaveniach
- Fallback s absolÄ‚Ĺźtnou polohou pre zariadenia bez Pointer Lock
- `releaseAll()` uvoĂ„ÄľnÄ‚Â­ vÄąË‡etky stlaĂ„Ĺ¤enÄ‚Â© tlaĂ„Ĺ¤idlÄ‚Ë‡ pri strate lock-u

## Desktop gamepad support

ImplementovanÄ‚Â© v `src/lib/input/input-bridge.ts` (zastreÄąË‡uje gamepad + keyboard + mouse):

- Podpora: Xbox, Xbox-compatible, DualShock 4, DualSense, Nintendo-style Bluetooth, generickÄ‚Â© USB/Bluetooth gamepady
- `gamepadconnected` / `gamepaddisconnected` eventy
- `requestAnimationFrame` polling Ă˘â‚¬â€ť iba poĂ„Ĺ¤as aktÄ‚Â­vnej hry
- ÄąÂ tandardnÄ‚Â© W3C mapovanie tlaĂ„Ĺ¤idiel (`STANDARD_BUTTON_MAP`) + osÄ‚Â­ (`STANDARD_AXIS_MAP`)
- Deadzone (default 0.15) + sensitivity (default 1.0) + invert Y os (voliteĂ„ÄľnÄ‚Â©)
- `detectGamepadProfile(gamepadId)` rozpoznÄ‚Ë‡ xbox/dualshock/dualsense/generic
- VibrÄ‚Ë‡cie cez `gamepad.vibrationActuator.playEffect("dual-rumble", ...)` ak je dostupnÄ‚Â©
- Pri odpojenÄ‚Â­ ovlÄ‚Ë‡daĂ„Ĺ¤a:
  - UvoĂ„ÄľnÄ‚Â­ vÄąË‡etky aktÄ‚Â­vne vstupy
  - Resetuje osi na 0
  - VoliteĂ„Äľne pozastavÄ‚Â­ hru (`pauseOnGamepadDisconnect: true`)
  - Notifikuje UI cez `onGamepadDisconnected` callback

Testy: `tests/unit/gamepad-mapping.test.ts` (12 testov).

## Android gamepad support

ImplementovanÄ‚Â© v `src/lib/native/native-gamepad.ts` + `android/app/src/main/java/sk/jano/bavkac/NativeGamepadPlugin.kt`:

- Na Androide sa pouÄąÄľÄ‚Â­va natÄ‚Â­vne Android input API (KeyEvent + MotionEvent) Ă˘â‚¬â€ť spoĂ„ÄľahlivejÄąË‡ie neÄąÄľ WebView Gamepad API
- `NativeGamepadPlugin` (Kotlin) forwarduje eventy do JavaScriptu cez Capacitor `notifyListeners("nativeGamepadEvent", data)`
- `handleKeyDown/Up` spracovÄ‚Ë‡va `KeyEvent` z `MainActivity.onKeyDown`
- `handleMotionEvent` spracovÄ‚Ë‡va `MotionEvent.ACTION_MOVE` z `onGenericMotionEvent`
- Podpora:
  - `SOURCE_GAMEPAD` (96) a `SOURCE_JOYSTICK` (16)
  - `AXIS_X` (0), `AXIS_Y` (1), `AXIS_Z` (11), `AXIS_RZ` (14) Ă˘â‚¬â€ť analÄ‚Ĺ‚gy
  - `AXIS_HAT_X/Y` (15, 16) Ă˘â‚¬â€ť D-pad
  - `AXIS_LTRIGGER/RTRIGGER` (17, 18) Ă˘â‚¬â€ť L2/R2
  - `KEYCODE_BUTTON_A/B/X/Y` (96/97/99/100) Ă˘â‚¬â€ť face
  - `KEYCODE_BUTTON_L1/R1/L2/R2` (102-105) Ă˘â‚¬â€ť shoulders/triggers
  - `KEYCODE_BUTTON_THUMBL/R` (106/107) Ă˘â‚¬â€ť L3/R3
  - `KEYCODE_BUTTON_SELECT/START` (109/108)
  - `KEYCODE_DPAD_UP/DOWN/LEFT/RIGHT/CENTER` (19-23)
  - `KEYCODE_BACK` (4), `KEYCODE_MENU` (82)
- VibrÄ‚Ë‡cie cez `Vibrator` API (s fallbackom pre API < O)
- JS rozhranie v `native-gamepad.ts`: `getNativeGamepadPlugin()`, `isNativeGamepadAvailable()`, `ANDROID_KEYCODE_TO_CONTROL`, `ANDROID_AXIS_TO_CONTROL`

Testy: `tests/unit/android-gamepad-mapping.test.ts` (10 testov).

## Android application

ArchitektÄ‚Ĺźra: Capacitor + Next.js (webDir = `out` po `next build`)

ÄąÂ truktÄ‚Ĺźra `android/`:
- `build.gradle` Ă˘â‚¬â€ť top-level s Kotlin 1.9.22, AGP 8.2.2
- `settings.gradle` Ă˘â‚¬â€ť `:app` + `:capacitor-android`
- `app/build.gradle` Ă˘â‚¬â€ť minSdk 26 (Android 8), targetSdk 34, signing config z CI secrets
- `app/src/main/AndroidManifest.xml`:
  - `<uses-feature android.software.leanback>` (voliteĂ„ÄľnÄ‚Â© Ă˘â‚¬â€ť TV)
  - `<uses-feature android.hardware.gamepad>` (voliteĂ„ÄľnÄ‚Â©)
  - `<uses-feature android.hardware.usb.host>` (voliteĂ„ÄľnÄ‚Â©)
  - `MainActivity` (LAUNCHER pre mobily/tablety)
  - `TvActivity` (LEANBACK_LAUNCHER pre TV, landscape, fullscreen)
  - ÄąËťiadne `MANAGE_EXTERNAL_STORAGE`
  - Povolenia: INTERNET, VIBRATE, WAKE_LOCK, FULLSCREEN, READ_EXTERNAL_STORAGE (max SDK 32)
- `app/src/main/res/values/strings.xml`: `app_name = "JaÄąÂo ÄąË‡e chce bavkac"` (s diakritikou)
- `app/src/main/res/values/styles.xml`: tmavÄ‚Ë‡ tÄ‚Â©ma (#0a0a14)
- `app/src/main/java/sk/jano/bavkac/`:
  - `MainActivity.kt` Ă˘â‚¬â€ť Capacitor `BridgeActivity` + registrÄ‚Ë‡cia pluginov
  - `TvActivity.kt` Ă˘â‚¬â€ť rovnakÄ‚Â©, ale pre TV launcher
  - `NativeFullscreenPlugin.kt` Ă˘â‚¬â€ť immersive + keep screen on + orientation + cutout
  - `NativeGamepadPlugin.kt` Ă˘â‚¬â€ť KeyEvent/MotionEvent Ă˘â€ â€™ JS eventy
  - `NativeStoragePlugin.kt` Ă˘â‚¬â€ť streaming copy z Content URI do app storage
  - `NativeFilePickerPlugin.kt` Ă˘â‚¬â€ť SAF (ACTION_OPEN_DOCUMENT / OPEN_DOCUMENT_TREE)
- `capacitor.config.ts` Ă˘â‚¬â€ť appId `sk.jano.bavkac`, appName `JaÄąÂo ÄąË‡e chce bavkac`

Application ID: `sk.jano.bavkac`
Application label: `JaÄąÂo ÄąË‡e chce bavkac`

## Android TV support

- `AndroidManifest.xml` obsahuje `<uses-feature android.software.leanback>` (required=false)
- SamostatnÄ‚Ë‡ `TvActivity` s `LEANBACK_LAUNCHER` intent filter
- `android:screenOrientation="landscape"` a fullscreen theme
- `android:banner="@drawable/tv_banner"` pre TV launcher
- D-pad navigÄ‚Ë‡cia: focus management cez `android:focusable="true"` na interaktÄ‚Â­vnych prvkoch
- Back tlaĂ„Ĺ¤idlo: `KEYCODE_BACK` mapovanÄ‚Â© na `"back"` control
- TV layout: vÄ‚Â¤Ă„Ĺ¤ÄąË‡ie texty, vÄ‚Â¤Ă„Ĺ¤ÄąË‡ie karty, jasnÄ‚Ëť focus border (CSS pravidlÄ‚Ë‡ v `globals.css`)
- VÄąË‡etky hlavnÄ‚Â© funkcie dostupnÄ‚Â© cez TV diaĂ„ÄľkovÄ‚Ëť ovlÄ‚Ë‡daĂ„Ĺ¤ + gamepad:
  - OtvoriÄąÄ„ domovskÄ‚Ĺź strÄ‚Ë‡nku
  - PrechÄ‚Ë‡dzaÄąÄ„ kniÄąÄľnicu
  - ImportovaÄąÄ„ hru (z USB cez SAF)
  - OtvoriÄąÄ„ detail hry
  - SpustiÄąÄ„ hru
  - OvlÄ‚Ë‡daÄąÄ„ hru gamepadom
  - UloÄąÄľiÄąÄ„ pozÄ‚Â­ciu (cez gamepad Start + Select Ă˘â€ â€™ save dialog)
  - UkonĂ„Ĺ¤iÄąÄ„ hru (cez Back tlaĂ„Ĺ¤idlo)

Runtime detekcia (`getRuntimeInfo()`) vracia `platform: "android-tv"` ak:
- `window.AndroidBridge.isTv()` vracia true, alebo
- UA obsahuje "Android TV" / "GoogleTV" / "LEANBACK", alebo
- URL mÄ‚Ë‡ `?tv=1` parameter (pre testovanie)

## USB import on desktop

ImplementovanÄ‚Â© v `src/components/import/usb-folder-picker.tsx`:

1. PouÄąÄľÄ‚Â­vateĂ„Äľ klikne Ă˘â‚¬ĹľVybraÄąÄ„ prieĂ„Ĺ¤inok z USB"
2. Ak je dostupnÄ‚Â© File System Access API (`window.showDirectoryPicker`), otvorÄ‚Â­ sa modernÄ‚Ëť directory picker so zoznamom jednotiek (vrÄ‚Ë‡tane USB kĂ„ÄľÄ‚ĹźĂ„Ĺ¤a)
3. AplikÄ‚Ë‡cia rekurzÄ‚Â­vne prejde prieĂ„Ĺ¤inok cez `FileSystemDirectoryHandle.values()` a zachovÄ‚Ë‡ relatÄ‚Â­vnu ÄąË‡truktÄ‚Ĺźru
4. Ak FSA nie je dostupnÄ‚Â© (Safari, Firefox), pouÄąÄľije sa `<input type="file" webkitdirectory>` fallback
5. AplikÄ‚Ë‡cia automaticky NEprehĂ„ÄľadÄ‚Ë‡va zariadenia bez explicitnÄ‚Â©ho sÄ‚Ĺźhlasu pouÄąÄľÄ‚Â­vateĂ„Äľa

Podporuje:
- VÄ‚Ëťber jednÄ‚Â©ho sÄ‚Ĺźboru
- VÄ‚Ëťber viacerÄ‚Ëťch sÄ‚Ĺźborov
- VÄ‚Ëťber prieĂ„Ĺ¤inka (zachovÄ‚Ë‡ adresÄ‚Ë‡rovÄ‚Ĺź ÄąË‡truktÄ‚Ĺźru)

## USB import on Android

ImplementovanÄ‚Â© v `src/lib/native/native-file-picker.ts` + `NativeFilePickerPlugin.kt`:

- PouÄąÄľÄ‚Â­va Android Storage Access Framework (SAF) Ă˘â‚¬â€ť ÄąÄľiadne `MANAGE_EXTERNAL_STORAGE`
- `ACTION_OPEN_DOCUMENT` s `EXTRA_ALLOW_MULTIPLE` pre viacnÄ‚Ë‡sobnÄ‚Ëť vÄ‚Ëťber
- `ACTION_OPEN_DOCUMENT_TREE` pre vÄ‚Ëťber prieĂ„Ĺ¤inka
- `persistableUriPermission` pre opÄ‚Â¤tovnÄ‚Ëť prÄ‚Â­stup
- `DocumentFile` API na prechÄ‚Ë‡dzanie prieĂ„Ĺ¤inka
- `ContentResolver.openInputStream()` + 64 KB buffer pre streaming copy
- VeĂ„ÄľkÄ‚Â© sÄ‚Ĺźbory sa NEkopÄ‚Â­rujÄ‚Ĺź cez Base64 ani ArrayBuffer Ă˘â‚¬â€ť natÄ‚Â­vna vrstva ich priamo streamuje do app-specific storage
- JavaScriptu sa vrÄ‚Ë‡tia iba metadÄ‚Ë‡ta: `internalPath`, `name`, `size`, `mimeType`, `sourceUri`
- `releasePermission(uri)` na uvoĂ„Äľnenie persistable URI permission

JS rozhranie:
```typescript
interface AndroidFilePickerPlugin {
  pickFiles(options): Promise<PickedAndroidFile[]>;
  pickDirectory(): Promise<PickedAndroidDirectory>;
  copyToAppStorage(uri, destinationPath): Promise<CopyResult>;
  releasePermission(uri): Promise<void>;
}
```

PodporovanÄ‚Â© zdroje: USB OTG, externÄ‚Â© disky, internÄ‚Â© Ä‚ĹźloÄąÄľisko.

## APK distribution

ImplementovanÄ‚Â© v `src/lib/android-release.ts` + `src/components/pwa/android-download-section.tsx`:

DomovskÄ‚Ë‡ strÄ‚Ë‡nka obsahuje sekciu Ă˘â‚¬ĹľStiahnuÄąÄ„ aplikÄ‚Ë‡ciu" s:
- TlaĂ„Ĺ¤idlom Ă˘â‚¬ĹľStiahnuÄąÄ„ Android APK" (ak univerzÄ‚Ë‡lne APK), alebo
- TlaĂ„Ĺ¤idlami Ă˘â‚¬ĹľStiahnuÄąÄ„ pre Android" + Ă˘â‚¬ĹľStiahnuÄąÄ„ pre Android TV" (ak oddelenÄ‚Â© buildy)
- Verziou, veĂ„ÄľkosÄąÄ„ou, dÄ‚Ë‡tumom vydania, min. Android verziou
- SHA-256 kontrolnÄ‚Ëťm sÄ‚ĹźĂ„Ĺ¤tom (s tlaĂ„Ĺ¤idlom kopÄ‚Â­rovaÄąÄ„)
- StruĂ„Ĺ¤nÄ‚Ëťm nÄ‚Ë‡vodom na inÄąË‡talÄ‚Ë‡ciu (v `<details>`)

Ak APK eÄąË‡te neexistuje (`NEXT_PUBLIC_ANDROID_DOWNLOAD_ENABLED=false` a `public/downloads/android-release.json` mÄ‚Ë‡ `enabled: false`):
- ZobrazÄ‚Â­ sa karta Ă˘â‚¬ĹľAndroid aplikÄ‚Ë‡cia sa pripravuje" s jasnÄ‚Ëťm vysvetlenÄ‚Â­m
- TlaĂ„Ĺ¤idlo sa NEzobrazÄ‚Â­ ako funkĂ„Ĺ¤nÄ‚Â©
- ÄąËťiadny faloÄąË‡nÄ‚Ëť download link

 zdroje metadata:
1. PrimÄ‚Ë‡rne: env premennÄ‚Â© (`NEXT_PUBLIC_ANDROID_*`)
2. SekundÄ‚Ë‡rne: `public/downloads/android-release.json` (statickÄ‚Ëť sÄ‚Ĺźbor)
3. Fallback: null Ă˘â€ â€™ Ă˘â‚¬Ĺľpripravuje sa"

APK sa neumiestÄąÂuje do Next.js bundle Ă˘â‚¬â€ť je v GitHub Releases ako asset.

## Android build and signing

CI workflow v `.github/workflows/ci.yml` (job `android-build`):

1. Trigger: push na main alebo tag `v*` (nie pre PR)
2. Checkout kÄ‚Ĺ‚du
3. Setup Node.js 20 + JDK 17 + Android SDK 34
4. `npm ci`
5. `npx next build` (statickÄ‚Ëť export pre WebView)
6. `npm install -D @capacitor/cli`
7. `npx cap sync android`
8. DekÄ‚Ĺ‚dovanie keystore z `ANDROID_KEYSTORE_BASE64` secret Ă˘â€ â€™ `android/release.keystore`
9. ZÄ‚Ë‡pis `android/gradle.properties` so signing config (passwords z secrets)
10. `./gradlew assembleRelease --no-daemon`
11. VÄ‚ËťpoĂ„Ĺ¤et SHA-256: `sha256sum *.apk`
12. Upload APK artifactu (30-dÄąÂovÄ‚Ë‡ retencia)
13. Pri tagu: vytvorenie GitHub Release cez `softprops/action-gh-release@v2` s APK ako asset + SHA-256 v body
14. Pri tagu: aktualizÄ‚Ë‡cia `public/downloads/android-release.json` s release URL

TajnÄ‚Â© Ä‚Ĺźdaje (NIE v repozitÄ‚Ë‡ri):
- `ANDROID_KEYSTORE_BASE64` Ă˘â‚¬â€ť base64-encoded .keystore sÄ‚Ĺźbor
- `ANDROID_KEYSTORE_PASSWORD` Ă˘â‚¬â€ť heslo k keystore
- `ANDROID_KEY_ALIAS` Ă˘â‚¬â€ť alias kĂ„ÄľÄ‚ĹźĂ„Ĺ¤a
- `ANDROID_KEY_PASSWORD` Ă˘â‚¬â€ť heslo k samotnÄ‚Â©mu kĂ„ÄľÄ‚ĹźĂ„Ĺ¤u

Keystore sa NEukladÄ‚Ë‡ do Git repozitÄ‚Ë‡ra Ă˘â‚¬â€ť vznikÄ‚Ë‡ iba v CI z secretu.

## Known device compatibility issues

1. **WebView Gamepad API** Ă˘â‚¬â€ť v Android WebView nefunguje spoĂ„Äľahlivo pre vÄąË‡etky ovlÄ‚Ë‡daĂ„Ĺ¤e (najmÄ‚Â¤ Bluetooth gamepady). RieÄąË‡enie: `NativeGamepadPlugin` (Kotlin) priamo spracuje KeyEvent/MotionEvent.
2. **iOS Safari OPFS** Ă˘â‚¬â€ť obmedzenÄ‚Ë‡ kapacita, pomalÄąË‡ie zÄ‚Ë‡pisy. AplikÄ‚Ë‡cia funguje, ale pre veĂ„ÄľkÄ‚Â© hry mÄ‚Â´ÄąÄľe byÄąÄ„ pomalÄ‚Â©.
3. **iOS Safari Pointer Lock** Ă˘â‚¬â€ť nefunguje v PWA reÄąÄľime (pridanie na plochu). Fallback: absolÄ‚Ĺźtny pohyb myÄąË‡i.
4. **Firefox bez FSA** Ă˘â‚¬â€ť `showDirectoryPicker()` nie je dostupnÄ‚Â©, fallback na `webkitdirectory`.
5. **Android TV SAF picker** Ă˘â‚¬â€ť systÄ‚Â©movÄ‚Ëť picker funguje s D-padom na vÄ‚Â¤Ă„Ĺ¤ÄąË‡ine TV boxov. Ak nie je pouÄąÄľiteĂ„ÄľnÄ‚Ëť, aplikÄ‚Ë‡cia mÄ‚Ë‡ pripravenÄ‚Ëť vlastnÄ‚Ëť DocumentFile browser (TODO pre Ă„ĹąalÄąË‡iu verziu).
6. **PS2 na TV** Ă˘â‚¬â€ť experimentÄ‚Ë‡lne, zatiaĂ„Äľ vypnutÄ‚Â© aj na desktope.
7. **NumerickÄ‚Ë‡ klÄ‚Ë‡vesnica** Ă˘â‚¬â€ť `KeyboardEvent.code` rozliÄąË‡uje `Digit1` (hornÄ‚Ëť rad) a `Numpad1` (numlock). Mapovanie je implementovanÄ‚Â© pre obe.
8. **CapsLock / NumLock stav** Ă˘â‚¬â€ť `KeyboardEvent.code` nezohĂ„ÄľadÄąÂuje stav lock klÄ‚Ë‡vesov, takÄąÄľe `KeyA` je rovnakÄ‚Ëť kÄ‚Ĺ‚d nech je CapsLock zapnutÄ‚Ëť alebo nie. To je poÄąÄľadovanÄ‚Â© sprÄ‚Ë‡vanie pre emulÄ‚Ë‡tory (hra si spravuje vlastnÄ‚Ëť keymap).
9. **WASD vs. klÄ‚Ë‡vesnica layout** Ă˘â‚¬â€ť `code` identifikÄ‚Ë‡tor je zaloÄąÄľenÄ‚Ëť na fyzickej pozÄ‚Â­cii, nie logickom znaku, takÄąÄľe hra nastavenÄ‚Ë‡ na WASD funguje aj na QWERTZ klÄ‚Ë‡vesniciach (kde je W na rovnakej pozÄ‚Â­cii).
10. **Android cutout** Ă˘â‚¬â€ť `LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES` pre API 28+ zabezpeĂ„Ĺ¤uje, ÄąÄľe obsah sa zobrazÄ‚Â­ aj v oblasti vÄ‚Ëťrezov (notch).
