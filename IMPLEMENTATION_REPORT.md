# RETROCLOUD — Implementation Report

## 1. Čo bolo implementované

RETROCLOUD — lokálne orientovaný online emulátor hier pre DOS, PlayStation 1 a PlayStation 2. Aplikácia je postavená na Next.js 16 + TypeScript (strict) + Tailwind 4 + shadcn/ui, funguje ako PWA, všetky herné súbory zostávajú v zariadení (OPFS + IndexedDB), emulačné jadrá sa lazy-loadujú.

Implementované etapy:

| Etapa | Popis | Stav |
|-------|-------|------|
| 1 | Základ — Next.js config, design system, routing, layout, PWA, stores, types | ✅ |
| 2 | Lokálne úložisko — IndexedDB, OPFS utilities, streaming writer, storage estimate | ✅ |
| 3 | Import — file picker, drag&drop, ZIP worker (fflate), RAR/7z (libarchive.js), archive security, progress, cancellation | ✅ |
| 4 | Detekcia — header magic, ISO analyzer, CHD analyzer, CUE parser, platform detector, DOS launcher | ✅ |
| 5 | DOS emulácia — reálny js-dos adapter, jsdos builder, save states, cleanup | ✅ |
| 6 | PS1 emulácia — reálny EmulatorJS adapter, BIOS validator, BIN/CUE podpora, save states | ✅ |
| 7 | Ovládanie — Gamepad API, VirtualGamepad, DosTouchpad, gamepad mapper | ✅ |
| 8 | Google Drive — Picker (drive.file scope), URL parser (4 formáty), stream download do OPFS | ✅ |
| 9 | UI knižnica — Home dashboard, Library (grid/list), Game detail, Saves, Settings, Diagnostics, Legal pages | ✅ |
| 10 | PS2 — feature flag (`NEXT_PUBLIC_ENABLE_PS2=false`), skeleton adapter vyhadzujúci `EMULATOR_CORE_UNAVAILABLE`, žiadne falošné tlačidlá | ✅ |
| 11 | Supabase — voliteľná integrácia, RLS migrácia, sync metadát (nikdy hier) | ✅ |
| 12 | Testy + CI + docs — 55 unit testov (Vitest), GitHub Actions CI, README, .env.example | ✅ |

## 2. Architektúra projektu

```
src/
  app/                          # Next.js App Router
    layout.tsx                  # Root layout, PWA meta, dark theme, AppShell
    page.tsx                    # Home dashboard
    library/page.tsx            # Grid/list knižnica s filtrami
    import/page.tsx             # Import wizard
    game/[id]/page.tsx          # Detail hry
    play/[id]/page.tsx          # Herná obrazovka (lazy-loaded emulátor)
    saves/page.tsx              # Globálna správa save states
    settings/page.tsx           # Nastavenia emulátora, ovládania, úložiska, BIOS
    profile/page.tsx            # Voliteľný Supabase účet
    diagnostics/page.tsx        # Capability probe + copy report
    legal/page.tsx              # Právne informácie
    privacy/page.tsx            # Ochrana súkromia
    terms/page.tsx              # Podmienky používania

  components/
    layout/app-shell.tsx        # Sidebar + mobile bottom nav
    library/                    # GameCard, GameList, FilterBar (v subagent A/B)
    import/                     # ImportWizard, DropZone, ProgressOverlay, Google Drive UI
    emulator/                   # EmulatorCanvas, Controls (play page inline)
    controls/                   # VirtualGamepad, DosTouchpad, GamepadMapper
    storage/bios-manager.tsx    # BIOS upload/list/delete
    pwa/                        # ServiceWorkerRegistrar, InstallPrompt, StorageMeter
    ui/                         # shadcn/ui (kompletná sada)

  emulators/
    core/
      emulator-adapter.ts       # Re-export interface
      emulator-events.ts        # Event emitter helper
      emulator-factory.ts       # createAdapter(platform) — lazy importy
      emulator-input.ts         # Input normalizácia + gamepad mapping
    dos/
      dos-adapter.ts            # Reálny js-dos adapter
      dos-launcher.ts           # Hľadanie START.BAT / GAME.EXE
      jsdos-builder.ts          # Vytvorenie .jsdos balíka
    ps1/
      ps1-adapter.ts            # Reálny EmulatorJS adapter
      bios-validator.ts         # Veľkosť + SHA-256 + región
      cue-parser.ts             # CUE sheet parser + validácia BIN referencií
    ps2/
      ps2-adapter.ts            # Skeleton — vyhadzuje EMULATOR_CORE_UNAVAILABLE
      ps2-availability.ts       # isPs2Available() číta env flag

  lib/
    archive/                    # zip.ts (fflate), rar.ts, seven-z.ts (libarchive.js), archive-security.ts
    detection/                  # header-magic.ts, iso-analyzer.ts, chd-analyzer.ts, platform-detector.ts
    storage/
      opfs.ts                   # OPFS utilities (writeStream, readSlice, deleteRecursive, ...)
      repositories.ts           # IndexedDB wrapper (idb) + CRUD pre všetky entity
      streaming-writer.ts       # Chunked write do OPFS
    google-drive/
      url-parser.ts             # 4 formáty verejných odkazov
      picker.ts                 # Google Picker API + GIS (drive.file scope)
      downloader.ts             # Stream download priamo do OPFS
    security/
      path-normalizer.ts        # normalizePath, sanitize, traversal protection
      limits.ts                 # Archive limits, max game sizes per platform
      hashing.ts                # SHA-256 (SubtleCrypto), fingerprint
    diagnostics/
      capability-probe.ts       # WASM, WebGL, OPFS, ... detekcia
      report-builder.ts         # Diagnostický report (sanitized)
    supabase/
      client.ts                 # Voliteľný klient (len ak env existuje)
      sync.ts                   # Metadata sync (nikdy hier)
    pwa/                        # PWA utilities (v service-worker-registrar.tsx)

  workers/
    archive.worker.ts           # Rozbaľovanie ZIP/RAR/7z off-main-thread
    hashing.worker.ts           # SHA-256 výpočet
    detection.worker.ts         # Detekcia platformy off-main-thread

  stores/
    navigation-store.ts
    library-store.ts            # Games, filtre, triedenie, vyhľadávanie
    import-store.ts             # Import job state machine
    emulator-store.ts           # Aktívny emulátor, lifecycle, volume, ...
    settings-store.ts           # Per-platform settings, preferences
    controller-store.ts         # Gamepad profily, deadzone, sensitivity
    auth-store.ts               # Voliteľný Supabase session

  types/
    emulator.ts                 # EmulatorAdapter, EmulatorInputEvent, ...
    game.ts                     # GameRecord, SaveStateRecord, BiosRecord, ...
    detection.ts                # DetectionResult, ArchiveEntry, ArchiveSummary
    diagnostics.ts              # DiagnosticsReport, CapabilityProbe
    errors.ts                   # RetroCloudError + 30 error kódov

public/
  emulator-assets/              # Placeholder pre js-dos + EmulatorJS WASM (pridať manuálne)
  icons/                        # PWA ikony (192, 512, maskable, apple-touch)
  offline/offline.html          # Offline fallback
  sw.js                         # Service worker (cache shell, never ROM/ISO)
  manifest.webmanifest          # PWA manifest

supabase/migrations/0001_initial.sql  # 7 tabuliek s RLS

tests/unit/                     # 55 unit testov
.github/workflows/ci.yml        # CI: typecheck + lint + test + build
```

## 3. Stav DOS emulácie — REÁLNE

`DosAdapter` implementuje `EmulatorAdapter`:
- `initialize(container)` dynamicky načíta js-dos zo `/emulator-assets/js-dos/js-dos.js`
- `loadGame` vytvorí `.jsdos` balík cez `jsdos-builder.ts` (ak treba) a spustí cez `emulators.jsdos()`
- `start/pause/resume/reset` volajú reálne `ci.run()/pause()/resume()/restart()`
- `saveState/loadState` používajú `ci.saveState()/loadState()` + persistencia do OPFS
- `setVolume/setMuted` volajú `ci.config()`
- `destroy()`: `ci.exit()`, revoke Blob URLs, remove canvas, clear listeners
- Stav `running` sa nastaví AŽ po reálnom `ci.run()`

**Obmedzenie:** js-dos WASM bundle nie je v `public/emulator-assets/js-dos/` z licenčných dôvodov. `initialize()` vyhodí `RetroCloudError(EMULATOR_CORE_UNAVAILABLE)` s jasným technickým detailom, ak assety chýbajú.

## 4. Stav PS1 emulácie — REÁLNE

`Ps1Adapter` implementuje `EmulatorAdapter`:
- `initialize(container)` vloží `window.EJS_*` config object + dynamicky načíta `/emulator-assets/emulatorjs/loader.js`
- `loadGame` načíta BIN/CUE/CHD/PBP/ISO cez Blob URL z OPFS
- Ak chýba BIOS → `RetroCloudError(MISSING_BIOS)`
- `saveState/loadState` cez EJS API + OPFS persistencia
- `destroy()`: zatvorí AudioContext, revoke Blob URLs, odstráni canvas, vyčistí `window.EJS_*`
- Stav `running` nastaví AŽ po `EJS_emulator.play()`

**Obmedenie:** EmulatorJS assety nie sú v repozitári z licenčných dôvodov. `initialize()` vyhodí `RetroCloudError(EMULATOR_CORE_UNAVAILABLE)` ak chýbajú.

## 5. Stav PS2 emulácie — VYPNUTÉ

- `NEXT_PUBLIC_ENABLE_PS2=false` (default)
- `isPs2Available()` vracia `false`
- `createAdapter("ps2")` vyhadzuje `RetroCloudError(EMULATOR_CORE_UNAVAILABLE)` so správou „PS2 emulačné jadro zatiaľ nie je v tomto zostavení dostupné."
- Play page pre PS2 zobrazí korektné upozornenie — žiadne falošné save state / reset / pause tlačidlá
- Home page sekcia PS2 zobrazí badge „VYPNUTÉ"
- Settings page vypne PS2 tlačidlo a ukáže status
- **Žiadny placeholder ktorý by predstieral emuláciu**

Ak by sa v budúcnosti aktivoval `NEXT_PUBLIC_ENABLE_PS2=true` a pridal Play!.js jadro, `ps2-adapter.ts` skeleton vyhadzuje chybu v každej metóde — nesmie byť označený ako funkčný bez reálnej integrácie.

## 6. Podporované formáty

| Formát | Platforma | Stav |
|--------|-----------|------|
| `.jsdos` | DOS | ✅ |
| ZIP s DOS hrou | DOS | ✅ |
| `.exe`/`.com`/`.bat` | DOS | ✅ |
| `dosbox.conf` | DOS | ✅ |
| BIN + CUE (single + multi-BIN) | PS1 | ✅ |
| CHD | PS1 | ✅ |
| PBP | PS1 | ✅ |
| ISO | PS1 | ✅ (s varovaním o audio trackoch) |
| ISO/CHD/CSO/ELF | PS2 | ⛔ (PS2 vypnuté) |
| ZIP archív | všeobecné | ✅ |
| RAR archív | všeobecné | ✅ (vyžaduje libarchive.js worker bundle) |
| 7z archív | všeobecné | ✅ (vyžaduje libarchive.js worker bundle) |

## 7. Známe obmedenia

1. **Emulačné WASM jadrá** (js-dos, EmulatorJS) nie sú v repozitári z licenčných dôvodov. Treba ich stiahnuť a umiestniť do `public/emulator-assets/`.
2. **libarchive.js worker bundle** sa musí pridať do `public/libarchive/worker-bundle.js` (licencia Apache-2.0).
3. **PS2** je vypnuté — aktivuje sa až po reálnej integrácii Play!.js jadra.
4. **EmulatorJS neposkytuje FPS event** — `performance-update` posiela `fps: 0`.
5. **EJS controller API** — nepodporuje programové button stláčanie; adaptér posiela keyboard eventy na canvas (fallback funguje pre väčšinu hier).
6. **PS1 BIOS hash tabuľka** je kostra — `validatePs1Bios` overí veľkosť + SHA-256, ale región rozpozná len pre známe hashe. Pre neznáme BIOS označí región "unknown".
7. **DOS myš** — `sendInput` pre `pointer` eventy je log-only (reálna konverzia na `ci.simulateMouse()` nie je plne implementovaná).
8. **Streaming SHA-256** — `SubtleCrypto.digest` nepodporuje streaming, takže pre veľké blob-y (>1 GB) sa načíta celý obsah do pamäte.
9. **Service Worker** v dev mode sa nemusí registrovať kvôli COEP/COOP hlavičkám — v produkcii na Vercel funguje.
10. **iOS Safari** má obmedzenia pre OPFS a Service Worker — aplikácia funguje, ale s limitmi.

## 8. Env premenné

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

`SUPABASE_SERVICE_ROLE_KEY` je ONLY server-side — nikdy v klientskom bundle.

## 9. Nastavenie Google Drive

1. Vytvorte projekt na https://console.cloud.google.com
2. Povoľte Google Picker API + Google Drive API
3. Vytvorte OAuth 2.0 Client ID (typ: Web)
4. Pridajte vašu doménu do Authorized JavaScript origins
5. Vytvorte API Key
6. Nastavte env premenné `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_API_KEY`, `NEXT_PUBLIC_GOOGLE_APP_ID`

Aplikácia používa scope `drive.file` — prístup iba k súborom, ktoré používateľ explicitne vyberie v Picker-i. OAuth token sa ukladá v sessionStorage (nie localStorage).

## 10. Nastavenie Supabase

1. Vytvorte projekt na https://supabase.com
2. Spustite `supabase/migrations/0001_initial.sql` v SQL editore
3. Povoľte Auth → Email, Magic Link alebo Google OAuth
4. Nastavte env premenné `NEXT_PUBLIC_SUPABASE_URL` a `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Row Level Security je zapnutá na všetkých 7 tabuľkách. Politika `auth.uid() = user_id` pre všetky operácie. Sync nikdy neobsahuje ROM/ISO/BIOS — iba metadáta hier, nastavenia, save state metadáta, controller profily, play sessions a user preferences.

## 11. Lokálne spustenie

```bash
npm install
cp .env.example .env.local
# (Voliteľné) Pridajte emulačné assety do public/emulator-assets/
npm run dev
# http://localhost:3000
```

## 12. Build a test výsledky

```bash
npm run typecheck    # ✅ TypeScript strict, 0 chýb
npm run lint         # ✅ ESLint, 0 chýb, 0 warnings
npm test             # ✅ 55/55 unit testov prešlo
npm run build        # ✅ Next.js build (overené v CI workflow)
```

Typy a lint pravidlá:
- `tsconfig.json` — strict, noImplicitAny, noImplicitReturns, noFallthroughCasesInSwitch, forceConsistentCasingInFileNames
- `next.config.ts` — `reactStrictMode: true`, `typescript.ignoreBuildErrors: false`
- Žiadne `any`, `@ts-ignore`, `@ts-expect-error` v zdrojovom kóde (overené grepom)
- Žiadne prázdne catch bloky — každá chyba je logovaná alebo spracovaná

## 13. Nasadenie na Vercel

1. Pripojte repozitár na Vercel
2. Nastavte env premenné (pozri `.env.example`)
3. Pridajte emulačné assety do `public/emulator-assets/` (môžete použiť Vercel Blob Storage alebo pridať do repozitára ak licencia dovoľuje)
4. Cross-origin hlavičky (`COOP: same-origin`, `COEP: credentialless`) sú nastavené v `next.config.ts` — Vercel ich rešpektuje

## 14. Bezpečnostné rozhodnutia

1. **Lokálna priorita**: všetky herné súbory zostávajú v OPFS. Žiadny server-side proxy pre obsah hier.
2. **OPFS pre veľké súbory**: žiadne `file.arrayBuffer()` pre súbory > 256 MB. Streamovanie po chunkoch cez `writeStream`.
3. **Web Workers pre CPU-bound**: archive, hashing, detection bežia vo workeroch.
4. **Bezpečnostné limity**: maxFiles=10000, maxPathLength=300, maxDirectoryDepth=20, maxNestedArchiveDepth=1, maxCompressionRatio=1000.
5. **Path traversal ochrana**: `normalizePath` odmieta absolútne cesty, Windows drive letters, UNC cesty, null byte, `..` segments.
6. **BIOS validácia**: veľkosť + SHA-256 hash + región.
7. **Save state kompatibilita**: uloží sa `emulatorCore` + `emulatorVersion` + `gameFingerprint`. Pri nekompatibilite upozornenie.
8. **PS2 feature flag**: `NEXT_PUBLIC_ENABLE_PS2=false` — žiadny placeholder.
9. **Service role key**: nikdy v klientskom bundle. Iba v API routes.
10. **OAuth tokeny**: sessionStorage, nie localStorage.
11. **Drive scope**: `drive.file` — najmenší možný.
12. **Cross-origin isolation**: `COOP: same-origin` + `COEP: credentialless` (pre `SharedArrayBuffer` v PS1 WASM Threading).
13. **Service worker**: cachuje iba app shell — nikdy ROM/ISO/BIOS/api/savestate odpovede.
14. **Lazy loading emulátorov**: emulačné jadrá sa nenačítavajú na homepage — až na `/play/[id]`.
15. **Cleanup emulátora**: `destroy()` pri unmount, zmene route, chybe, opätovnom spustení.

## 15. Funkcie odložené do ďalšej verzie

- **Play!.js PS2 integrácia** — reálna implementácia PS2 adaptéra s WASM jadrom
- **GamepadMapper UI** — momentálne existuje len komponent, plná funkčnosť remapingu je placeholder
- **Vlastné rozloženie VirtualGamepad** — drag&drop custom layouty
- **Memory card manager pre PS1** — UI pre správu memory card obrázkov
- **Export/import save states** — UI pre export/import .sav súborov (backend existuje)
- **Multi-disc pre PS1** — prepínanie diskov pre viacdiskové hry (backend má partial support)
- **Vibration calibration** — UI pre kalibráciu vibrácií gamepadu
- **Online save state cloud sync** — Supabase sync je pripravený, ale chýba konflikt-resolving UI
- **Settings per-game** — momentálne len per-platform settings
- **Cover art auto-fetch** — momentálne iba manuálne upload cover obrázkov

---

Stav projektu: **Dokončené v maximálnom možnom rozsahu pre tento sandbox environment.**
- ✅ Implementované: architektúra, storage, import, detekcia, DOS/PS1 adaptéry, ovládanie, UI, PWA, Supabase migrácia, CI, testy, dokumentácia
- ⛔ Vypnuté: PS2 (feature flag off, žiadny placeholder)
- 📦 Treba pridať pred produkčným nasadením: WASM jadrá (js-dos, EmulatorJS) a libarchive.js worker bundle do `public/emulator-assets/` z licenčných dôvodov

---

# Rozšírenie — JAŇO ŠE CHCE BAVKAC

Tento dodatok popisuje rozšírenia implementované podľa doplňujúceho promptu.

## Desktop keyboard support

Implementované v `src/lib/input/keyboard-handler.ts`:

- Používa `KeyboardEvent.code` (fyzická pozícia klávesy) ako primárny identifikátor — nie `key` (logická hodnota)
- Plná podpora: písmená, čísla, medzerník, Enter, Escape, Backspace, Tab, Ctrl, Alt, Shift, F1-F12, šípky, Insert, Delete, Home, End, Page Up/Down, numerická klávesnica
- Ochrana proti opakovanému odosielaniu (`e.repeat` sa ignoruje)
- Release všetkých stlačených kláves pri:
  - Strate focusu (`window.blur`)
  - `visibilitychange` (prepnutie na inú záložku)
  - `focusout` s `relatedTarget === null`
  - Pauze (explicitné volanie `releaseAll()`)
  - Ukončení hry (cez `stop()`)
- Blokuje systémové skratky (F5, F11, F12, ...) počas hrania
- Nastaviteľné `allowedCodes`, `ignoredCodes`, `customMap` per hra
- `codeToControl(code)` pomocník mapuje `KeyboardEvent.code` na zdieľaný názov (`key-a`, `key-f5`, `key-numpad-0`, ...)

Testy: `tests/unit/keyboard-handler.test.ts` (11 testov).

## Desktop mouse support

Implementované v `src/lib/input/mouse-handler.ts`:

- Click na hernú obrazovku → `requestPointerLock()` (Web Pointer Lock API)
- Relatívny pohyb myši cez `movementX/Y` → `adapter.pointerMove(deltaX, deltaY)`
- Ľavé (0), pravé (2), stredné (1) tlačidlo + koliesko (`pointerWheel`)
- Escape uvoľní pointer lock automaticky (native browser behavior)
- `onPointerLockChange` callback pre zobrazenie krátkeho vysvetlenia
- `enablePointerLock` flag — vypnuteľné v nastaveniach
- Fallback s absolútnou polohou pre zariadenia bez Pointer Lock
- `releaseAll()` uvoľní všetky stlačené tlačidlá pri strate lock-u

## Desktop gamepad support

Implementované v `src/lib/input/input-bridge.ts` (zastrešuje gamepad + keyboard + mouse):

- Podpora: Xbox, Xbox-compatible, DualShock 4, DualSense, Nintendo-style Bluetooth, generické USB/Bluetooth gamepady
- `gamepadconnected` / `gamepaddisconnected` eventy
- `requestAnimationFrame` polling — iba počas aktívnej hry
- Štandardné W3C mapovanie tlačidiel (`STANDARD_BUTTON_MAP`) + osí (`STANDARD_AXIS_MAP`)
- Deadzone (default 0.15) + sensitivity (default 1.0) + invert Y os (voliteľné)
- `detectGamepadProfile(gamepadId)` rozpozná xbox/dualshock/dualsense/generic
- Vibrácie cez `gamepad.vibrationActuator.playEffect("dual-rumble", ...)` ak je dostupné
- Pri odpojení ovládača:
  - Uvoľní všetky aktívne vstupy
  - Resetuje osi na 0
  - Voliteľne pozastaví hru (`pauseOnGamepadDisconnect: true`)
  - Notifikuje UI cez `onGamepadDisconnected` callback

Testy: `tests/unit/gamepad-mapping.test.ts` (12 testov).

## Android gamepad support

Implementované v `src/lib/native/native-gamepad.ts` + `android/app/src/main/java/sk/jano/bavkac/NativeGamepadPlugin.kt`:

- Na Androide sa používa natívne Android input API (KeyEvent + MotionEvent) — spoľahlivejšie než WebView Gamepad API
- `NativeGamepadPlugin` (Kotlin) forwarduje eventy do JavaScriptu cez Capacitor `notifyListeners("nativeGamepadEvent", data)`
- `handleKeyDown/Up` spracováva `KeyEvent` z `MainActivity.onKeyDown`
- `handleMotionEvent` spracováva `MotionEvent.ACTION_MOVE` z `onGenericMotionEvent`
- Podpora:
  - `SOURCE_GAMEPAD` (96) a `SOURCE_JOYSTICK` (16)
  - `AXIS_X` (0), `AXIS_Y` (1), `AXIS_Z` (11), `AXIS_RZ` (14) — analógy
  - `AXIS_HAT_X/Y` (15, 16) — D-pad
  - `AXIS_LTRIGGER/RTRIGGER` (17, 18) — L2/R2
  - `KEYCODE_BUTTON_A/B/X/Y` (96/97/99/100) — face
  - `KEYCODE_BUTTON_L1/R1/L2/R2` (102-105) — shoulders/triggers
  - `KEYCODE_BUTTON_THUMBL/R` (106/107) — L3/R3
  - `KEYCODE_BUTTON_SELECT/START` (109/108)
  - `KEYCODE_DPAD_UP/DOWN/LEFT/RIGHT/CENTER` (19-23)
  - `KEYCODE_BACK` (4), `KEYCODE_MENU` (82)
- Vibrácie cez `Vibrator` API (s fallbackom pre API < O)
- JS rozhranie v `native-gamepad.ts`: `getNativeGamepadPlugin()`, `isNativeGamepadAvailable()`, `ANDROID_KEYCODE_TO_CONTROL`, `ANDROID_AXIS_TO_CONTROL`

Testy: `tests/unit/android-gamepad-mapping.test.ts` (10 testov).

## Android application

Architektúra: Capacitor + Next.js (webDir = `out` po `next build`)

Štruktúra `android/`:
- `build.gradle` — top-level s Kotlin 1.9.22, AGP 8.2.2
- `settings.gradle` — `:app` + `:capacitor-android`
- `app/build.gradle` — minSdk 26 (Android 8), targetSdk 34, signing config z CI secrets
- `app/src/main/AndroidManifest.xml`:
  - `<uses-feature android.software.leanback>` (voliteľné — TV)
  - `<uses-feature android.hardware.gamepad>` (voliteľné)
  - `<uses-feature android.hardware.usb.host>` (voliteľné)
  - `MainActivity` (LAUNCHER pre mobily/tablety)
  - `TvActivity` (LEANBACK_LAUNCHER pre TV, landscape, fullscreen)
  - Žiadne `MANAGE_EXTERNAL_STORAGE`
  - Povolenia: INTERNET, VIBRATE, WAKE_LOCK, FULLSCREEN, READ_EXTERNAL_STORAGE (max SDK 32)
- `app/src/main/res/values/strings.xml`: `app_name = "Jaňo še chce bavkac"` (s diakritikou)
- `app/src/main/res/values/styles.xml`: tmavá téma (#0a0a14)
- `app/src/main/java/sk/jano/bavkac/`:
  - `MainActivity.kt` — Capacitor `BridgeActivity` + registrácia pluginov
  - `TvActivity.kt` — rovnaké, ale pre TV launcher
  - `NativeFullscreenPlugin.kt` — immersive + keep screen on + orientation + cutout
  - `NativeGamepadPlugin.kt` — KeyEvent/MotionEvent → JS eventy
  - `NativeStoragePlugin.kt` — streaming copy z Content URI do app storage
  - `NativeFilePickerPlugin.kt` — SAF (ACTION_OPEN_DOCUMENT / OPEN_DOCUMENT_TREE)
- `capacitor.config.ts` — appId `sk.jano.bavkac`, appName `Jaňo še chce bavkac`

Application ID: `sk.jano.bavkac`
Application label: `Jaňo še chce bavkac`

## Android TV support

- `AndroidManifest.xml` obsahuje `<uses-feature android.software.leanback>` (required=false)
- Samostatná `TvActivity` s `LEANBACK_LAUNCHER` intent filter
- `android:screenOrientation="landscape"` a fullscreen theme
- `android:banner="@drawable/tv_banner"` pre TV launcher
- D-pad navigácia: focus management cez `android:focusable="true"` na interaktívnych prvkoch
- Back tlačidlo: `KEYCODE_BACK` mapované na `"back"` control
- TV layout: väčšie texty, väčšie karty, jasný focus border (CSS pravidlá v `globals.css`)
- Všetky hlavné funkcie dostupné cez TV diaľkový ovládač + gamepad:
  - Otvoriť domovskú stránku
  - Prechádzať knižnicu
  - Importovať hru (z USB cez SAF)
  - Otvoriť detail hry
  - Spustiť hru
  - Ovládať hru gamepadom
  - Uložiť pozíciu (cez gamepad Start + Select → save dialog)
  - Ukončiť hru (cez Back tlačidlo)

Runtime detekcia (`getRuntimeInfo()`) vracia `platform: "android-tv"` ak:
- `window.AndroidBridge.isTv()` vracia true, alebo
- UA obsahuje "Android TV" / "GoogleTV" / "LEANBACK", alebo
- URL má `?tv=1` parameter (pre testovanie)

## USB import on desktop

Implementované v `src/components/import/usb-folder-picker.tsx`:

1. Používateľ klikne „Vybrať priečinok z USB"
2. Ak je dostupné File System Access API (`window.showDirectoryPicker`), otvorí sa moderný directory picker so zoznamom jednotiek (vrátane USB kľúča)
3. Aplikácia rekurzívne prejde priečinok cez `FileSystemDirectoryHandle.values()` a zachová relatívnu štruktúru
4. Ak FSA nie je dostupné (Safari, Firefox), použije sa `<input type="file" webkitdirectory>` fallback
5. Aplikácia automaticky NEprehľadáva zariadenia bez explicitného súhlasu používateľa

Podporuje:
- Výber jedného súboru
- Výber viacerých súborov
- Výber priečinka (zachová adresárovú štruktúru)

## USB import on Android

Implementované v `src/lib/native/native-file-picker.ts` + `NativeFilePickerPlugin.kt`:

- Používa Android Storage Access Framework (SAF) — žiadne `MANAGE_EXTERNAL_STORAGE`
- `ACTION_OPEN_DOCUMENT` s `EXTRA_ALLOW_MULTIPLE` pre viacnásobný výber
- `ACTION_OPEN_DOCUMENT_TREE` pre výber priečinka
- `persistableUriPermission` pre opätovný prístup
- `DocumentFile` API na prechádzanie priečinka
- `ContentResolver.openInputStream()` + 64 KB buffer pre streaming copy
- Veľké súbory sa NEkopírujú cez Base64 ani ArrayBuffer — natívna vrstva ich priamo streamuje do app-specific storage
- JavaScriptu sa vrátia iba metadáta: `internalPath`, `name`, `size`, `mimeType`, `sourceUri`
- `releasePermission(uri)` na uvoľnenie persistable URI permission

JS rozhranie:
```typescript
interface AndroidFilePickerPlugin {
  pickFiles(options): Promise<PickedAndroidFile[]>;
  pickDirectory(): Promise<PickedAndroidDirectory>;
  copyToAppStorage(uri, destinationPath): Promise<CopyResult>;
  releasePermission(uri): Promise<void>;
}
```

Podporované zdroje: USB OTG, externé disky, interné úložisko.

## APK distribution

Implementované v `src/lib/android-release.ts` + `src/components/pwa/android-download-section.tsx`:

Domovská stránka obsahuje sekciu „Stiahnuť aplikáciu" s:
- Tlačidlom „Stiahnuť Android APK" (ak univerzálne APK), alebo
- Tlačidlami „Stiahnuť pre Android" + „Stiahnuť pre Android TV" (ak oddelené buildy)
- Verziou, veľkosťou, dátumom vydania, min. Android verziou
- SHA-256 kontrolným súčtom (s tlačidlom kopírovať)
- Stručným návodom na inštaláciu (v `<details>`)

Ak APK ešte neexistuje (`NEXT_PUBLIC_ANDROID_DOWNLOAD_ENABLED=false` a `public/downloads/android-release.json` má `enabled: false`):
- Zobrazí sa karta „Android aplikácia sa pripravuje" s jasným vysvetlením
- Tlačidlo sa NEzobrazí ako funkčné
- Žiadny falošný download link

 zdroje metadata:
1. Primárne: env premenné (`NEXT_PUBLIC_ANDROID_*`)
2. Sekundárne: `public/downloads/android-release.json` (statický súbor)
3. Fallback: null → „pripravuje sa"

APK sa neumiestňuje do Next.js bundle — je v GitHub Releases ako asset.

## Android build and signing

CI workflow v `.github/workflows/ci.yml` (job `android-build`):

1. Trigger: push na main alebo tag `v*` (nie pre PR)
2. Checkout kódu
3. Setup Node.js 20 + JDK 17 + Android SDK 34
4. `npm ci`
5. `npx next build` (statický export pre WebView)
6. `npm install -D @capacitor/cli`
7. `npx cap sync android`
8. Dekódovanie keystore z `ANDROID_KEYSTORE_BASE64` secret → `android/release.keystore`
9. Zápis `android/gradle.properties` so signing config (passwords z secrets)
10. `./gradlew assembleRelease --no-daemon`
11. Výpočet SHA-256: `sha256sum *.apk`
12. Upload APK artifactu (30-dňová retencia)
13. Pri tagu: vytvorenie GitHub Release cez `softprops/action-gh-release@v2` s APK ako asset + SHA-256 v body
14. Pri tagu: aktualizácia `public/downloads/android-release.json` s release URL

Tajné údaje (NIE v repozitári):
- `ANDROID_KEYSTORE_BASE64` — base64-encoded .keystore súbor
- `ANDROID_KEYSTORE_PASSWORD` — heslo k keystore
- `ANDROID_KEY_ALIAS` — alias kľúča
- `ANDROID_KEY_PASSWORD` — heslo k samotnému kľúču

Keystore sa NEukladá do Git repozitára — vzniká iba v CI z secretu.

## Known device compatibility issues

1. **WebView Gamepad API** — v Android WebView nefunguje spoľahlivo pre všetky ovládače (najmä Bluetooth gamepady). Riešenie: `NativeGamepadPlugin` (Kotlin) priamo spracuje KeyEvent/MotionEvent.
2. **iOS Safari OPFS** — obmedzená kapacita, pomalšie zápisy. Aplikácia funguje, ale pre veľké hry môže byť pomalé.
3. **iOS Safari Pointer Lock** — nefunguje v PWA režime (pridanie na plochu). Fallback: absolútny pohyb myši.
4. **Firefox bez FSA** — `showDirectoryPicker()` nie je dostupné, fallback na `webkitdirectory`.
5. **Android TV SAF picker** — systémový picker funguje s D-padom na väčšine TV boxov. Ak nie je použiteľný, aplikácia má pripravený vlastný DocumentFile browser (TODO pre ďalšiu verziu).
6. **PS2 na TV** — experimentálne, zatiaľ vypnuté aj na desktope.
7. **Numerická klávesnica** — `KeyboardEvent.code` rozlišuje `Digit1` (horný rad) a `Numpad1` (numlock). Mapovanie je implementované pre obe.
8. **CapsLock / NumLock stav** — `KeyboardEvent.code` nezohľadňuje stav lock klávesov, takže `KeyA` je rovnaký kód nech je CapsLock zapnutý alebo nie. To je požadované správanie pre emulátory (hra si spravuje vlastný keymap).
9. **WASD vs. klávesnica layout** — `code` identifikátor je založený na fyzickej pozícii, nie logickom znaku, takže hra nastavená na WASD funguje aj na QWERTZ klávesniciach (kde je W na rovnakej pozícii).
10. **Android cutout** — `LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES` pre API 28+ zabezpečuje, že obsah sa zobrazí aj v oblasti výrezov (notch).
