# RETROCLOUD

> Lokálne orientovaný online emulátor a správca vlastných záložných kópií hier pre DOS, PlayStation 1 a PlayStation 2.

[![CI](https://github.com/your-org/retrocloud/actions/workflows/ci.yml/badge.svg)](.github/workflows/ci.yml)

## Popis projektu

RETROCLOUD je PWA webová aplikácia, ktorá vám umožňuje hrať vaše vlastné
legálne získané záložné kópie hier pre DOS, PS1 a (experimentálne) PS2 priamo
v prehliadači. Hry sa ukladajú lokálne do OPFS (Origin Private File System) a
**nikdy sa neodosielajú na server**.

## Stav emulátorov

| Platforma | Stav | Poznámka |
|-----------|------|----------|
| DOS | ✅ Implementované | js-dos reálne WASM jadro (vyžaduje assety v `public/emulator-assets/js-dos/`) |
| PS1 | ✅ Implementované | EmulatorJS / PCSX-ReARMed lokálne (vyžaduje assety v `public/emulator-assets/emulatorjs/`) |
| PS2 | ⛔ Vypnuté | `NEXT_PUBLIC_ENABLE_PS2=false` — žiadny placeholder, ktorý by predstieral emuláciu |

## Podporované formáty

- **DOS:** `.jsdos`, ZIP obsahujúci DOS hru, `.exe`, `.com`, `.bat`, `dosbox.conf`
- **PS1:** BIN+CUE (vrátane multi-BIN trackov), CHD, PBP, ISO
- **PS2:** ISO, CHD, CSO, ELF (iba ak `NEXT_PUBLIC_ENABLE_PS2=true`)
- **Archívy:** ZIP (fflate), RAR a 7z (libarchive.js — vyžaduje worker bundle)

## Technické obmedzenia

- Pre DOS/PS1 je potrebné stiahnuť WASM jadrá do `public/emulator-assets/` (licenčné dôvody — neposkytujeme ich v repozitári).
- PS2 emulácia je v prehliadači stále veľmi experimentálna a v predvolenom zostavení je vypnutá.
- Pre SharedArrayBuffer (potrebné pre PS1) je nastavené `Cross-Origin-Embedder-Policy: credentialless` a `Cross-Origin-Opener-Policy: same-origin`.
- Veľké súbory (ISO, CHD) sa streamujú do OPFS — nikdy sa nenačítavajú celé do RAM.
- iOS Safari má obmedzenia pre OPFS a Service Worker — aplikácia funguje, ale s limitmi.

## Právne upozornenie

RETROCLOUD **neposkytuje hry ani BIOS**. Aplikácia je nástroj na prehrávanie
vlastných legálne získaných záložných kópií hier. Používateľ je výlučne
zodpovedný za svoje súbory. Pozrite [Právne informácie](/legal).

## Systémové požiadavky

- Moderný prehliadač s podporou:
  - WebAssembly
  - WebGL2 (pre PS1)
  - OPFS (Chrome 102+, Firefox 111+, Safari 15.2+)
  - IndexedDB
  - Service Worker (pre PWA offline)
- Min. 4 GB RAM (odporúčané 8 GB)
- Dostatočné voľné miesto v úložisku prehliadača

## Inštalácia

### Predpoklady
- Node.js 20+ alebo Bun 1.3+
- npm (preferované pre maximálnu kompatibilitu)

### Lokálne spustenie

```bash
# 1. Nainštalujte závislosti
npm install

# 2. Skopírujte .env.example a vyplňte podľa potreby
cp .env.example .env.local

# 3. (Voliteľné) Pridajte emulačné assety
#    - Stiahnite js-dos z https://github.com/caiiiycuk/js-dos
#      a umiestnite do public/emulator-assets/js-dos/
#    - Stiahnite EmulatorJS z https://gitlab.com/EmulatorJS/EmulatorJS
#      a umiestnite do public/emulator-assets/emulatorjs/
#    - Stiahnite libarchive.js worker bundle
#      a umiestnite do public/libarchive/worker-bundle.js

# 4. Spustite vývojový server
npm run dev
# Aplikácia bude dostupná na http://localhost:3000
```

### Build

```bash
npm run build
npm start
```

### Testovanie

```bash
# Unit + integration testy (Vitest)
npm test

# Type-check
npm run typecheck

# Lint
npm run lint

# E2E testy (Playwright — vyžaduje inštaláciu prehliadačov)
npx playwright install
npm run test:e2e
```

## PWA

Aplikácia je plnohodnotná PWA:

- Manifest s ikonami 192/512 (vrátane maskable)
- Service worker pre offline shell
- Inštalovateľná na desktop aj mobil
- Respektuje safe-area insets pre iPhone

Poznámka: herné súbory (ROM, ISO, BIN, CHD, BIOS) sa **necachujú** v Cache API
— zostávajú v OPFS.

## OPFS

Veľké súbory sa ukladajú do Origin Private File System:

- `games/<game-id>/<relative-path>` — herné súbory
- `bios/<platform>/<filename>` — BIOS
- `saves/<game-id>/slot-<n>.sav` — save states
- `saves/<game-id>/slot-<n>.png` — screenshoty save states

Utility v `src/lib/storage/opfs.ts`:
- `normalizePath`, `ensureDirectory`, `writeStream`, `readSlice`
- `deleteRecursive`, `calculateDirectorySize`, `listDirectory`
- `cleanupPartialImport` — rollback pri neúspešnom importe

## Supabase (voliteľné)

Aplikácia funguje bez Supabase. Ak chcete synchronizovať metadáta medzi
zariadeniami:

1. Vytvorte projekt na https://supabase.com
2. Spustite SQL migráciu zo `supabase/migrations/0001_initial.sql`
3. Nastavte env premenné:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
4. V Supabase Auth povoľte Email, Magic Link alebo Google OAuth

Row Level Security je zapnutá na všetkých tabuľkách. Sync nikdy
neobsahuje ROM, ISO, BIN, CHD, CSO, BIOS ani celé archívy.

## Google Cloud / Drive

Pre Google Drive Picker a stiahnutie verejných odkazov:

1. Vytvorte projekt na https://console.cloud.google.com
2. Povoľte Google Picker API a Google Drive API
3. Vytvorte OAuth 2.0 Client ID (typ: Web)
4. Vytvorte API Key
5. Nastavte env premenné:
   ```
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
   NEXT_PUBLIC_GOOGLE_API_KEY=AIza...
   NEXT_PUBLIC_GOOGLE_APP_ID=xxx
   ```
6. Pridajte vašu doménu do Authorized JavaScript origins

Aplikácia používa najmenší možný scope `drive.file` — prístup iba k súborom,
ktoré používateľ explicitne vyberie v Picker-i. OAuth token sa ukladá v
sessionStorage (nie localStorage).

## Nasadenie na Vercel

1. Pripojte repozitár na Vercel
2. Nastavte env premenné (pozri `.env.example`)
3. Nasadenie prebehne automaticky
4. **Dôležité:** Pridajte Cross-Origin hlavičky v `next.config.ts` (už nastavené)
5. Pre PS1/PS2 (ak budúce) overte, že Vercel neporušuje COEP/COOP

### Cross-origin hlavičky

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

Tieto sú nastavené globálne v `next.config.ts` pre `SharedArrayBuffer` (potrebné
pre WASM Threading v PCSX-ReARMed). Overené konflikty s:
- Google Picker ✓
- Google Identity Services ✓
- Externé obrázky ✓ (credentialless namiesto require-corp)
- Supabase ✓
- Service Worker ✓

## Známe problémy

- EmulatorJS neposkytuje FPS event — `performance-update` posiela `fps: 0`
- DOS myš — `sendInput` pre `pointer` eventy sa loguje, ale plná konverzia na `ci.simulateMouse()` nie je implementovaná
- PS1 controller API — EJS nepodporuje programové button stláčanie; posiela sa keyboard event na canvas
- libarchive.js worker bundle sa musí pridať manuálne (licencia)
- PS2 je vypnuté — aktivuje sa až po reálnej integrácii Play!.js

## Riešenie problémov

### Aplikácia nebeží
1. Skontrolujte `/diagnostics` — overte WebAssembly, WebGL2, OPFS
2. Reštartujte prehliadač (najmä po aktualizácii)
3. Skontrolujte konzolu na chyby

### Hra sa nespustí
1. Pre PS1 — overte, že je nahraný BIOS (Nastavenia → BIOS)
2. Skontrolujte formát hry (DOS: `.jsdos`/`.bat`/`.exe`; PS1: BIN+CUE/CHD/PBP)
3. Pre BIN+CUE — overte, že CUE odkazuje na všetky BIN súbory
4. Pozrite diagnostiku

### Import zlyhá
1. Skontrolujte dostupné miesto (`navigator.storage.estimate()`)
2. Pre archívy — overte, že nie sú chránené heslom alebo poškodené
3. Pre ZIP bombu — limit je 1000:1 kompresný pomer
4. Pre path traversal — archív bol zamietnutý z bezpečnostných dôvodov

### Google Drive nefunguje
1. Overte env premenné
2. Skontrolujte, že vaša doména je v Authorized JavaScript origins
3. Ak CORS blokuje priame stiahnutie — použite Picker alebo manuálny download

## Licencie emulačných jadier

- [js-dos](https://github.com/caiiiycuk/js-dos) — GPL-2.0
- [EmulatorJS / PCSX-ReARMed](https://gitlab.com/EmulatorJS/EmulatorJS) — GPL-2.0
- [Play!.js](https://github.com/jpd002/Play-) — MIT (ešte neintegrované)
- [fflate](https://github.com/101arrowz/fflate) — MIT
- [libarchive.js](https://github.com/nika-begiashvili/libarchive.js) — Apache-2.0

## Architektúra

Pozri `plan.md` a `IMPLEMENTATION_REPORT.md` pre detailnú architektúru.
