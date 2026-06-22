# Jaňo še chce bavkac

> Súkromný rodinný projekt. Lokálny emulátor DOS a PlayStation hier pre PC, Android a Android TV.

[![CI](https://github.com/jozinko6/emulator/actions/workflows/ci.yml/badge.svg)](.github/workflows/ci.yml)

## Popis projektu

**Jaňo še chce bavkac** je PWA webová aplikácia + Android aplikácia, ktorá vám umožňuje hrať vaše vlastné legálne získané záložné kópie hier pre DOS a PlayStation 1 priamo v prehliadači alebo v natívnej Android aplikácii. Hry sa ukladajú lokálne do OPFS (Origin Private File System) a **nikdy sa neodosielajú na server**.

**Priorita:** jednoduché, spoľahlivé hranie vlastných DOS a PS1 hier, ovládanie cez klávesnicu, myš a gamepad, jednoduché uloženie a pokračovanie v hre, funkčná Android/Android TV aplikácia.

## Čo projekt NEobsahuje

- Žiadne platby, reklamy, analytiku
- Žiadnu verejnú registráciu používateľov
- Žiadne komerčné funkcie
- Žiadne hry, ROM, ISO, BIOS ani iný chránený obsah
- PS2 zostáva vypnuté (`NEXT_PUBLIC_ENABLE_PS2=false`)

## Stav emulátorov

| Platforma | Stav | Poznámka |
|-----------|------|----------|
| DOS | ✅ Implementované | js-dos reálne WASM jadro (vyžaduje assety v `public/emulator-assets/js-dos/`) |
| PS1 | ✅ Implementované | EmulatorJS / PCSX-ReARMed lokálne (vyžaduje assety v `public/emulator-assets/emulatorjs/`) |
| PS2 | ⛔ Vypnuté | `NEXT_PUBLIC_ENABLE_PS2=false` — žiadny placeholder, ktorý by predstieral emuláciu |

## Podporované zariadenia

- **PC** (Windows, Linux, macOS) — klávesnica, myš, USB/Bluetooth gamepad
- **Android telefón a tablet** — dotyk, USB/Bluetooth gamepad
- **Android TV / Google TV** — D-pad, gamepad
- **PWA** — inštalovateľná do prehliadača

## Podporované formáty

- **DOS:** `.jsdos`, ZIP obsahujúci DOS hru, `.exe`, `.com`, `.bat`, `dosbox.conf`
- **PS1:** BIN+CUE (vrátane multi-BIN trackov), CHD, PBP, ISO
- **Archívy:** ZIP (fflate), RAR a 7z (libarchive.js — vyžaduje worker bundle)

## Inštalácia

### Predpoklady
- Node.js 20+
- npm (používame iba npm — žiadny Bun/Yarn)

### Lokálne spustenie (web)

```bash
# 1. Nainštalujte závislosti
npm install

# 2. Skopírujte .env.example a vyplňte podľa potreby
cp .env.example .env.local

# 3. (Voliteľné) Stiahnite emulačné assety
npm run setup:cores

# 4. Spustite vývojový server
npm run dev
# Aplikácia bude dostupná na http://localhost:3000
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

# 4. (Alebo) Build release APK (vyžaduje signing secrets)
npm run android:release
```

APK sa vytvorí v `android/app/build/outputs/apk/{debug,release}/`.

## Testovanie

```bash
# Unit + integration testy (Vitest)
npm test

# Type-check
npm run typecheck

# Lint
npm run lint

# Povinné overenie pred push-om
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
| `npm run dev` | Vývojový server (Next.js) |
| `npm run build` | Produkčný build Next.js |
| `npm run start` | Spustenie produkčného buildu |
| `npm run typecheck` | TypeScript kontrola |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run android:web` | Build Android shell (Vite) |
| `npm run android:sync` | Build + Capacitor sync |
| `npm run android:debug` | Build debug APK |
| `npm run android:release` | Build release APK |
| `npm run setup:cores` | Stiahne open-source assety, vypíše manuálne kroky pre ostatné |

## PWA

Aplikácia je plnohodnotná PWA:

- Manifest s ikonami 192/512 (vrátane maskable)
- Service worker pre offline shell
- Inštalovateľná na desktop aj mobil
- Respektuje safe-area insets pre iPhone

Poznámka: herné súbory (ROM, ISO, BIN, CHD, BIOS) sa **necachujú** v Cache API — zostávajú v OPFS.

## OPFS

Veľké súbory sa ukladajú do Origin Private File System:

- `games/<game-id>/<relative-path>` — herné súbory
- `bios/<platform>/<filename>` — BIOS
- `saves/<game-id>/slot-<n>.sav` — save states (slot 0=auto, 1=manual, 2=backup)
- `saves/<game-id>/slot-<n>.png` — screenshoty save states

Save state ID je deterministické: `${gameId}:${slot}` — pri opakovanom uložení sa záznam aktualizuje, nevytvára sa nový.

## Save States

Jednoduchý model pre rodinné používanie:

- **Auto Save** (slot 0) — periodicky (90s), pri ukončení, pri prechode na pozadie
- **Manual Save** (slot 1) — tlačidlo „Uložiť" alebo kláves F5
- **Backup** (slot 2) — automaticky vytvorený pred prepísaním manual/auto save

**Tlačidlo Pokračovať** na detaile hry:
1. Nájde najnovší kompatibilný manual alebo auto save
2. Spustí hru
3. Po štarte jadra načíta save state
4. Ak sa načítanie nepodarí, spustí hru od začiatku s upozornením

**Hrať od začiatku** nemaže existujúce uloženia.

## Ovládanie

### PC

- **Klávesnica** — `KeyboardEvent.code` (fyzická pozícia klávesy nezávislá od rozloženia)
  - F5 = Quick Save, F9 = Quick Load
  - Šípky, Enter, Space, F1-F12, numerický blok, Ctrl/Alt/Shift
- **Myš** — Pointer Lock API po kliknutí na hernú obrazovku
  - Escape uvoľní pointer lock
  - Relatívny pohyb, ľavé/pravé/stredné tlačidlo, koliesko
- **Gamepad** — polling cez `requestAnimationFrame`
  - Xbox, DualShock, DualSense, generické USB/Bluetooth gamepady
  - Deadzone + sensitivity + invert Y (voliteľné)
  - Vibrácie (ak sú dostupné)
  - Pri odpojení: `releaseAllInputs()`

### Android

- **Natívny gamepad** cez `KeyEvent` + `MotionEvent` v `NativeGamepadPlugin`
- Podpora USB OTG, Bluetooth, Android TV diaľkového ovládača
- D-pad, A/B/X/Y, L1/R1, L2/R2, L3/R3, Start/Select, analógy
- Vibrácie cez `Vibrator` API

### Android TV

- Plnohodnotný Leanback launcher (`TvActivity`)
- D-pad navigácia vo všetkých UI prvkoch
- Gamepad ovládanie hier
- Back tlačidlo ukončí hru / vráti späť

## USB Import

### PC

- File System Access API (`showDirectoryPicker`) — primárne, zachová štruktúru
- `<input webkitdirectory>` fallback pre Firefox/Safari
- Aplikácia automaticky NEprehľadáva zariadenia bez súhlasu používateľa

### Android

- Storage Access Framework (SAF) — `ACTION_OPEN_DOCUMENT` + `ACTION_OPEN_DOCUMENT_TREE`
- Žiadne `MANAGE_EXTERNAL_STORAGE`
- Streaming copy z Content URI do app-specific storage (64 KB buffer, no Base64)
- Persistable URI permissions pre opätovný prístup

## Supabase (voliteľné)

Aplikácia funguje bez Supabase. Ak chcete synchronizovať metadáta medzi zariadeniami:

1. Vytvorte projekt na https://supabase.com
2. Spustite SQL migráciu zo `supabase/migrations/0001_initial.sql`
3. Nastavte env premenné:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

Row Level Security je zapnutá na všetkých tabuľkách. Sync nikdy neobsahuje ROM, ISO, BIN, CHD, CSO, BIOS ani celé archívy.

## Android APK distribúcia

Na úvodnej stránke webu je sekcia „Stiahnuť aplikáciu". APK je dostupné na:

```
https://github.com/jozinko6/emulator/releases/latest/download/jano-se-chce-bavkac.apk
```

Ak APK ešte neexistuje, sekcia zobrazí „Android aplikácia sa pripravuje" — žiadny falošný download link.

### Podpísanie APK

CI podpisuje release APK pomocou GitHub Actions secrets:

- `ANDROID_KEYSTORE_BASE64` — base64-encoded .keystore
- `ANDROID_KEYSTORE_PASSWORD` — heslo k keystore
- `ANDROID_KEY_ALIAS` — alias kľúča
- `ANDROID_KEY_PASSWORD` — heslo k kľúču

Keystore sa NEukladá do Git repozitára.

## Právne upozornenie

Aplikácia **neposkytuje hry ani BIOS**. Používateľ je výlučne zodpovedný za svoje súbory. Pozrite [Právne informácie](/legal).

## Licencie emulačných jadier

- [js-dos](https://github.com/caiiiycuk/js-dos) — GPL-2.0 (používateľ stiahne manuálne)
- [EmulatorJS / PCSX-ReARMed](https://gitlab.com/EmulatorJS/EmulatorJS) — GPL-2.0 (používateľ stiahne manuálne)
- [fflate](https://github.com/101arrowz/fflate) — MIT
- [libarchive.js](https://github.com/nika-begiashvili/libarchive.js) — Apache-2.0

## Architektúra

Pozri `plan.md`, `FIX_PLAN.md` a `IMPLEMENTATION_REPORT.md` pre detailnú architektúru.

### Webová verzia

- Next.js 16 (App Router)
- React 19
- TypeScript (strict)
- Tailwind CSS 4 + shadcn/ui
- Zustand (klientsky stav)
- IndexedDB (metadáta)
- OPFS (veľké súbory)

### Android verzia

- Capacitor 8 (appId `sk.jano.bavkac`)
- Vite + React 19 shell s hash routingom (`/#/library`, `/#/play/{id}`, ...)
- Samostatný build od webu — NEvyžaduje Next.js server
- 4 natívne Kotlin pluginy:
  - `NativeFullscreenPlugin` — immersive mode, keep screen on, orientation
  - `NativeGamepadPlugin` — KeyEvent + MotionEvent → JS eventy
  - `NativeStoragePlugin` — streaming copy z Content URI
  - `NativeFilePickerPlugin` — Storage Access Framework
- `BaseGameActivity` wireuje gamepad eventy do pluginu
- `MainActivity` (LAUNCHER) pre mobily/tablety
- `TvActivity` (LEANBACK_LAUNCHER, landscape) pre Android TV

## Známe obmedzenia

- Emulačné WASM jadrá (js-dos, EmulatorJS) sa musia pridať manuálne — `npm run setup:cores` vypíše návod
- libarchive.js worker bundle sa stiahne automaticky cez `npm run setup:cores`
- PS2 je vypnuté — aktivuje sa až po reálnej integrácii Play!.js
- Android build sa overuje v GitHub Actions, nie lokálne (sandbox nemá Android SDK)
- EmulatorJS neposkytuje FPS event — `performance-update` posiela `fps: 0`
- Streaming SHA-256 sa pre veľké súbory načíta do pamäte (obmedzenie Web Crypto API)
