# Final runtime integration note

This branch completes the shared import/save/runtime integration work for the private family project Jaňo še chce bavkac. USB/SAF picks now enter the real import pipeline, loose multi-file CUE+BIN and DOS folder imports preserve relative paths, save states use deterministic slots, and web/Android Continue share the same URL contract.

See FINAL_FIX_REPORT.md for verified command results and remaining environment limitations.

# JaĹo Ĺˇe chce bavkac

> SĂşkromnĂ˝ rodinnĂ˝ projekt. LokĂˇlny emulĂˇtor DOS a PlayStation hier pre PC, Android a Android TV.

[![CI](https://github.com/jozinko6/emulator/actions/workflows/ci.yml/badge.svg)](.github/workflows/ci.yml)

## Popis projektu

**JaĹo Ĺˇe chce bavkac** je PWA webovĂˇ aplikĂˇcia + Android aplikĂˇcia, ktorĂˇ vĂˇm umoĹľĹuje hraĹĄ vaĹˇe vlastnĂ© legĂˇlne zĂ­skanĂ© zĂˇloĹľnĂ© kĂłpie hier pre DOS a PlayStation 1 priamo v prehliadaÄŤi alebo v natĂ­vnej Android aplikĂˇcii. Hry sa ukladajĂş lokĂˇlne do OPFS (Origin Private File System) a **nikdy sa neodosielajĂş na server**.

**Priorita:** jednoduchĂ©, spoÄľahlivĂ© hranie vlastnĂ˝ch DOS a PS1 hier, ovlĂˇdanie cez klĂˇvesnicu, myĹˇ a gamepad, jednoduchĂ© uloĹľenie a pokraÄŤovanie v hre, funkÄŤnĂˇ Android/Android TV aplikĂˇcia.

## ÄŚo projekt NEobsahuje

- Ĺ˝iadne platby, reklamy, analytiku
- Ĺ˝iadnu verejnĂş registrĂˇciu pouĹľĂ­vateÄľov
- Ĺ˝iadne komerÄŤnĂ© funkcie
- Ĺ˝iadne hry, ROM, ISO, BIOS ani inĂ˝ chrĂˇnenĂ˝ obsah
- PS2 zostĂˇva vypnutĂ© (`NEXT_PUBLIC_ENABLE_PS2=false`)

## Stav emulĂˇtorov

| Platforma | Stav | PoznĂˇmka |
|-----------|------|----------|
| DOS | âś… ImplementovanĂ© | js-dos reĂˇlne WASM jadro (vyĹľaduje assety v `public/emulator-assets/js-dos/`) |
| PS1 | âś… ImplementovanĂ© | EmulatorJS / PCSX-ReARMed lokĂˇlne (vyĹľaduje assety v `public/emulator-assets/emulatorjs/`) |
| PS2 | â›” VypnutĂ© | `NEXT_PUBLIC_ENABLE_PS2=false` â€” Ĺľiadny placeholder, ktorĂ˝ by predstieral emulĂˇciu |

## PodporovanĂ© zariadenia

- **PC** (Windows, Linux, macOS) â€” klĂˇvesnica, myĹˇ, USB/Bluetooth gamepad
- **Android telefĂłn a tablet** â€” dotyk, USB/Bluetooth gamepad
- **Android TV / Google TV** â€” D-pad, gamepad
- **PWA** â€” inĹˇtalovateÄľnĂˇ do prehliadaÄŤa

## PodporovanĂ© formĂˇty

- **DOS:** `.jsdos`, ZIP obsahujĂşci DOS hru, `.exe`, `.com`, `.bat`, `dosbox.conf`
- **PS1:** BIN+CUE (vrĂˇtane multi-BIN trackov), CHD, PBP, ISO
- **ArchĂ­vy:** ZIP (fflate), RAR a 7z (libarchive.js â€” vyĹľaduje worker bundle)

## InĹˇtalĂˇcia

### Predpoklady
- Node.js 20+
- npm (pouĹľĂ­vame iba npm â€” Ĺľiadny Bun/Yarn)

### LokĂˇlne spustenie (web)

```bash
# 1. NainĹˇtalujte zĂˇvislosti
npm install

# 2. SkopĂ­rujte .env.example a vyplĹte podÄľa potreby
cp .env.example .env.local

# 3. (VoliteÄľnĂ©) Stiahnite emulaÄŤnĂ© assety
npm run setup:cores

# 4. Spustite vĂ˝vojovĂ˝ server
npm run dev
# AplikĂˇcia bude dostupnĂˇ na http://localhost:3000
```

### Build (web)

```bash
npm run build
npm start
```

### Android build

```bash
# 1. Build web shell (Vite + React, hash routing)
npm run android:web

# 2. Sync Capacitor projekt
npx cap sync android

# 3. Build debug APK
npm run android:debug

# 4. (Alebo) Build release APK (vyĹľaduje signing secrets)
npm run android:release
```

APK sa vytvorĂ­ v `android/app/build/outputs/apk/{debug,release}/`.

## Testovanie

```bash
# Unit + integration testy (Vitest)
npm test

# Type-check
npm run typecheck

# Lint
npm run lint

# PovinnĂ© overenie pred push-om
npm ci
npm run typecheck
npm run lint
npm run test -- --run
npm run build
npm run android:web
npx cap sync android
```

## Skripty

| Skript | Popis |
|--------|-------|
| `npm run dev` | VĂ˝vojovĂ˝ server (Next.js) |
| `npm run build` | ProdukÄŤnĂ˝ build Next.js |
| `npm run start` | Spustenie produkÄŤnĂ©ho buildu |
| `npm run typecheck` | TypeScript kontrola |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run android:web` | Build Android shell (Vite) |
| `npm run android:sync` | Build + Capacitor sync |
| `npm run android:debug` | Build debug APK |
| `npm run android:release` | Build release APK |
| `npm run setup:cores` | Stiahne open-source assety, vypĂ­Ĺˇe manuĂˇlne kroky pre ostatnĂ© |

## PWA

AplikĂˇcia je plnohodnotnĂˇ PWA:

- Manifest s ikonami 192/512 (vrĂˇtane maskable)
- Service worker pre offline shell
- InĹˇtalovateÄľnĂˇ na desktop aj mobil
- Respektuje safe-area insets pre iPhone

PoznĂˇmka: hernĂ© sĂşbory (ROM, ISO, BIN, CHD, BIOS) sa **necachujĂş** v Cache API â€” zostĂˇvajĂş v OPFS.

## OPFS

VeÄľkĂ© sĂşbory sa ukladajĂş do Origin Private File System:

- `games/<game-id>/<relative-path>` â€” hernĂ© sĂşbory
- `bios/<platform>/<filename>` â€” BIOS
- `saves/<game-id>/slot-<n>.sav` â€” save states (slot 0=auto, 1=manual, 2=backup)
- `saves/<game-id>/slot-<n>.png` â€” screenshoty save states

Save state ID je deterministickĂ©: `${gameId}:${slot}` â€” pri opakovanom uloĹľenĂ­ sa zĂˇznam aktualizuje, nevytvĂˇra sa novĂ˝.

## Save States

JednoduchĂ˝ model pre rodinnĂ© pouĹľĂ­vanie:

- **Auto Save** (slot 0) â€” periodicky (90s), pri ukonÄŤenĂ­, pri prechode na pozadie
- **Manual Save** (slot 1) â€” tlaÄŤidlo â€žUloĹľiĹĄ" alebo klĂˇves F5
- **Backup** (slot 2) â€” automaticky vytvorenĂ˝ pred prepĂ­sanĂ­m manual/auto save

**TlaÄŤidlo PokraÄŤovaĹĄ** na detaile hry:
1. NĂˇjde najnovĹˇĂ­ kompatibilnĂ˝ manual alebo auto save
2. SpustĂ­ hru
3. Po Ĺˇtarte jadra naÄŤĂ­ta save state
4. Ak sa naÄŤĂ­tanie nepodarĂ­, spustĂ­ hru od zaÄŤiatku s upozornenĂ­m

**HraĹĄ od zaÄŤiatku** nemaĹľe existujĂşce uloĹľenia.

## OvlĂˇdanie

### PC

- **KlĂˇvesnica** â€” `KeyboardEvent.code` (fyzickĂˇ pozĂ­cia klĂˇvesy nezĂˇvislĂˇ od rozloĹľenia)
  - F5 = Quick Save, F9 = Quick Load
  - Ĺ Ă­pky, Enter, Space, F1-F12, numerickĂ˝ blok, Ctrl/Alt/Shift
- **MyĹˇ** â€” Pointer Lock API po kliknutĂ­ na hernĂş obrazovku
  - Escape uvoÄľnĂ­ pointer lock
  - RelatĂ­vny pohyb, ÄľavĂ©/pravĂ©/strednĂ© tlaÄŤidlo, koliesko
- **Gamepad** â€” polling cez `requestAnimationFrame`
  - Xbox, DualShock, DualSense, generickĂ© USB/Bluetooth gamepady
  - Deadzone + sensitivity + invert Y (voliteÄľnĂ©)
  - VibrĂˇcie (ak sĂş dostupnĂ©)
  - Pri odpojenĂ­: `releaseAllInputs()`

### Android

- **NatĂ­vny gamepad** cez `KeyEvent` + `MotionEvent` v `NativeGamepadPlugin`
- Podpora USB OTG, Bluetooth, Android TV diaÄľkovĂ©ho ovlĂˇdaÄŤa
- D-pad, A/B/X/Y, L1/R1, L2/R2, L3/R3, Start/Select, analĂłgy
- VibrĂˇcie cez `Vibrator` API

### Android TV

- PlnohodnotnĂ˝ Leanback launcher (`TvActivity`)
- D-pad navigĂˇcia vo vĹˇetkĂ˝ch UI prvkoch
- Gamepad ovlĂˇdanie hier
- Back tlaÄŤidlo ukonÄŤĂ­ hru / vrĂˇti spĂ¤ĹĄ

## USB Import

### PC

- File System Access API (`showDirectoryPicker`) â€” primĂˇrne, zachovĂˇ ĹˇtruktĂşru
- `<input webkitdirectory>` fallback pre Firefox/Safari
- AplikĂˇcia automaticky NEprehÄľadĂˇva zariadenia bez sĂşhlasu pouĹľĂ­vateÄľa

### Android

- Storage Access Framework (SAF) â€” `ACTION_OPEN_DOCUMENT` + `ACTION_OPEN_DOCUMENT_TREE`
- Ĺ˝iadne `MANAGE_EXTERNAL_STORAGE`
- Streaming copy z Content URI do app-specific storage (64 KB buffer, no Base64)
- Persistable URI permissions pre opĂ¤tovnĂ˝ prĂ­stup

## Supabase (voliteÄľnĂ©)

AplikĂˇcia funguje bez Supabase. Ak chcete synchronizovaĹĄ metadĂˇta medzi zariadeniami:

1. Vytvorte projekt na https://supabase.com
2. Spustite SQL migrĂˇciu zo `supabase/migrations/0001_initial.sql`
3. Nastavte env premennĂ©:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

Row Level Security je zapnutĂˇ na vĹˇetkĂ˝ch tabuÄľkĂˇch. Sync nikdy neobsahuje ROM, ISO, BIN, CHD, CSO, BIOS ani celĂ© archĂ­vy.

## Android APK distribĂşcia

Na Ăşvodnej strĂˇnke webu je sekcia â€žStiahnuĹĄ aplikĂˇciu". APK je dostupnĂ© na:

```
https://github.com/jozinko6/emulator/releases/latest/download/jano-se-chce-bavkac.apk
```

Ak APK eĹˇte neexistuje, sekcia zobrazĂ­ â€žAndroid aplikĂˇcia sa pripravuje" â€” Ĺľiadny faloĹˇnĂ˝ download link.

### PodpĂ­sanie APK

CI podpisuje release APK pomocou GitHub Actions secrets:

- `ANDROID_KEYSTORE_BASE64` â€” base64-encoded .keystore
- `ANDROID_KEYSTORE_PASSWORD` â€” heslo k keystore
- `ANDROID_KEY_ALIAS` â€” alias kÄľĂşÄŤa
- `ANDROID_KEY_PASSWORD` â€” heslo k kÄľĂşÄŤu

Keystore sa NEukladĂˇ do Git repozitĂˇra.

## PrĂˇvne upozornenie

AplikĂˇcia **neposkytuje hry ani BIOS**. PouĹľĂ­vateÄľ je vĂ˝luÄŤne zodpovednĂ˝ za svoje sĂşbory. Pozrite [PrĂˇvne informĂˇcie](/legal).

## Licencie emulaÄŤnĂ˝ch jadier

- [js-dos](https://github.com/caiiiycuk/js-dos) â€” GPL-2.0 (pouĹľĂ­vateÄľ stiahne manuĂˇlne)
- [EmulatorJS / PCSX-ReARMed](https://gitlab.com/EmulatorJS/EmulatorJS) â€” GPL-2.0 (pouĹľĂ­vateÄľ stiahne manuĂˇlne)
- [fflate](https://github.com/101arrowz/fflate) â€” MIT
- [libarchive.js](https://github.com/nika-begiashvili/libarchive.js) â€” Apache-2.0

## ArchitektĂşra

Pozri `plan.md`, `FIX_PLAN.md` a `IMPLEMENTATION_REPORT.md` pre detailnĂş architektĂşru.

### WebovĂˇ verzia

- Next.js 16 (App Router)
- React 19
- TypeScript (strict)
- Tailwind CSS 4 + shadcn/ui
- Zustand (klientsky stav)
- IndexedDB (metadĂˇta)
- OPFS (veÄľkĂ© sĂşbory)

### Android verzia

- Capacitor 8 (appId `sk.jano.bavkac`)
- Vite + React 19 shell s hash routingom (`/#/library`, `/#/play/{id}`, ...)
- SamostatnĂ˝ build od webu â€” NEvyĹľaduje Next.js server
- 4 natĂ­vne Kotlin pluginy:
  - `NativeFullscreenPlugin` â€” immersive mode, keep screen on, orientation
  - `NativeGamepadPlugin` â€” KeyEvent + MotionEvent â†’ JS eventy
  - `NativeStoragePlugin` â€” streaming copy z Content URI
  - `NativeFilePickerPlugin` â€” Storage Access Framework
- `BaseGameActivity` wireuje gamepad eventy do pluginu
- `MainActivity` (LAUNCHER) pre mobily/tablety
- `TvActivity` (LEANBACK_LAUNCHER, landscape) pre Android TV

## ZnĂˇme obmedzenia

- EmulaÄŤnĂ© WASM jadrĂˇ (js-dos, EmulatorJS) sa musia pridaĹĄ manuĂˇlne â€” `npm run setup:cores` vypĂ­Ĺˇe nĂˇvod
- libarchive.js worker bundle sa stiahne automaticky cez `npm run setup:cores`
- PS2 je vypnutĂ© â€” aktivuje sa aĹľ po reĂˇlnej integrĂˇcii Play!.js
- Android build sa overuje v GitHub Actions, nie lokĂˇlne (sandbox nemĂˇ Android SDK)
- EmulatorJS neposkytuje FPS event â€” `performance-update` posiela `fps: 0`
- Streaming SHA-256 sa pre veÄľkĂ© sĂşbory naÄŤĂ­ta do pamĂ¤te (obmedzenie Web Crypto API)
