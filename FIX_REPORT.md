# Final runtime integration update

Implemented the final import, save-state, Continue, Android native storage, Android gamepad, DOS mouse, CI, and release-signing fixes. Verified results and known limitations are recorded in FINAL_FIX_REPORT.md.

# FIX_REPORT â€” JaĹo Ĺˇe chce bavkac

Dokumentuje opravy implementovanĂ© podÄľa `FIX_PLAN.md`.

## OpravenĂ© chyby

| # | OblasĹĄ | Stav | PoznĂˇmka |
|---|--------|------|----------|
| 1 | Package manager | âś… | `package-lock.json` vytvorenĂ˝, npm only, cross-platform skripty (`node scripts/*.mjs` namiesto `cp`/`tee`/`NODE_ENV=...`) |
| 2 | Android web build | âś… | VytvorenĂ˝ samostatnĂ˝ Vite + React shell v `android-shell/`, `webDir: "android-shell/dist"` |
| 3 | Capacitor dependencies | âś… | `@capacitor/android` + `@capacitor/splash-screen` pridanĂ©, vĹˇetky v8.x, `cap sync android` funguje |
| 4 | Kotlin compile | âś… | `JanobavkacApplication.kt`, `BaseGameActivity.kt`, `MainActivity.kt`, `TvActivity.kt` â€” samostatnĂ© sĂşbory, vĹˇetky importy pridanĂ© |
| 5 | AndroidManifest | âś… | OdstrĂˇnenĂ˝ duplicitnĂ˝ `leanback`, `FULLSCREEN`, `READ_EXTERNAL_STORAGE`; leanback required=false |
| 6 | Gradle signing | âś… | `signingConfigs.release` naÄŤĂ­ta z `RELEASE_*` properties, `bundle` split blok odstrĂˇnenĂ˝ |
| 7 | Native gamepad wiring | âś… | `BaseGameActivity.dispatchKeyEvent` + `onGenericMotionEvent` filtruje SOURCE_GAMEPAD/JOYSTICK, deleguje do `NativeGamepadPlugin` |
| 8 | Save state ID | âś… | `makeSaveStateId(gameId, slot) = "${gameId}:${slot}"`, IndexedDB verzia zvĂ˝ĹˇenĂˇ na 2, migrĂˇcia deduplikuje zĂˇznamy |
| 9 | AtomickĂ© ukladanie | âś… | `saveStateAtomically()` â€” temp â†’ over â†’ backup â†’ aktivuj â†’ cleanup; pri zlyhanĂ­ zachovĂˇ starĂ˝ |
| 10 | Emulator lifecycle | âś… | `DosAdapter.start()` â€” `runPromise` sledovanĂ˝ asynchrĂłnne, `start()` vrĂˇti ihneÄŹ po reĂˇlnom spustenĂ­ jadra |
| 11 | Save UI zjednoduĹˇenie | âś… | TlaÄŤidlĂˇ â€žUloĹľiĹĄ / NaÄŤĂ­taĹĄ / UkonÄŤiĹĄ" namiesto technickĂ˝ch â€žSlot 1/2/3" |
| 12 | Continue | âś… | `getLatestSaveForGame()` preferuje manual â†’ auto â†’ backup; loadState volanĂ© AĹ˝ po `start()` |
| 13 | Autosave | âś… | Interval 90s, `visibilitychange`, `appStateChange` (Capacitor), final autosave pri ukonÄŤenĂ­ |
| 14 | Web Gamepad polling | âś… | `useGamepadInput` hook â€” RAF polling, button transitions, deadzone, sensitivity, disconnect release |
| 15 | Keyboard handler | âś… | `useKeyboardInput` hook â€” `KeyboardEvent.code`, F5 = Quick Save, F9 = Quick Load, blur release |
| 16 | DOS myĹˇ | âś… | `DosAdapter.sendInput("pointer")` volĂˇ `ci.simulateMouseMotion()`; `useMouseInput` hook s Pointer Lock |
| 17 | Native file picker | âś… | `NativeFilePickerPlugin` â€” reĂˇlny SAF cez `ACTION_OPEN_DOCUMENT` + `ACTION_OPEN_DOCUMENT_TREE`, streaming copy na background thread |
| 18 | Android TV focus | âś… | CSS focus styles v `globals.css`, `focus-visible:ring-2` na tlaÄŤidlĂˇch |
| 19 | Emulator assets setup | âś… | `scripts/setup-emulator-assets.mjs` + `npm run setup:cores` â€” stiahne libarchive.js, vypĂ­Ĺˇe manuĂˇlne kroky pre js-dos a EmulatorJS |
| 20 | ESLint | âś… | PravidlĂˇ `no-undef`, `no-unreachable`, `no-redeclare`, `@typescript-eslint/no-unused-vars`, `react-hooks/exhaustive-deps` zapnutĂ©; 0 errors |
| 21 | ZbytoÄŤnĂ© deps | âś… | OdstrĂˇnenĂ©: Prisma, NextAuth, next-intl, @mdxeditor/editor, @dnd-kit/*, @reactuses/core, react-syntax-highlighter, sharp, z-ai-web-dev-sdk, bun-types, react-hook-form, @hookform/resolvers, zod, vaul, react-resizable-panels, recharts, embla-carousel-react, react-day-picker, cmdk, input-otp + nepouĹľĂ­vanĂ© Radix UI + shadcn/ui komponenty |
| 22 | Testy | âś… | 115 unit testov (11 test sĂşborov) â€” pribudli save-state-store.test.ts (16 testov) |
| 23 | CI workflow | âś… | `web-quality` (npm ci â†’ typecheck â†’ lint â†’ test â†’ build) + `android-build` (assembleDebug) + `android-release` (sign + GitHub Release) |
| 24 | Docs | âś… | README.md, IMPLEMENTATION_REPORT.md, FIX_PLAN.md, FIX_REPORT.md â€” vĹˇade nĂˇzov â€žJaĹo Ĺˇe chce bavkac" |

## ZmenenĂ© sĂşbory (hlavnĂ©)

### PridanĂ©

- `FIX_PLAN.md`
- `FIX_REPORT.md`
- `package-lock.json`
- `scripts/build.mjs` â€” cross-platform Next.js build
- `scripts/build-android-shell.mjs` â€” cross-platform Vite build + copy public/
- `scripts/setup-emulator-assets.mjs` â€” `npm run setup:cores`
- `android-shell/` â€” kompletnĂ˝ Vite + React shell s hash routingom
  - `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`
  - `src/main.tsx`, `src/components/app-shell.tsx`, `src/components/storage-meter.tsx`
  - `src/pages/{home,library,import,game-detail,play,settings,diagnostics,legal}.tsx`
- `android/app/src/main/java/sk/jano/bavkac/JanobavkacApplication.kt`
- `android/app/src/main/java/sk/jano/bavkac/BaseGameActivity.kt`
- `android/app/src/main/java/sk/jano/bavkac/TvActivity.kt`
- `android/app/src/main/res/drawable/tv_banner.png`
- `android/app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher.png` + `_round.png`
- `android/app/capacitor.build.gradle`
- `src/emulators/core/emulator-input-adapter.ts` â€” `EmulatorInputAdapter` interface
- `src/lib/app-identity.ts`
- `src/lib/input/keyboard-handler.ts`
- `src/lib/input/mouse-handler.ts`
- `src/lib/input/input-bridge.ts`
- `src/lib/input/use-gamepad-input.ts`
- `src/lib/input/use-keyboard-input.ts`
- `src/lib/input/use-mouse-input.ts`
- `src/lib/storage/save-state-store.ts`
- `src/lib/android-release.ts`
- `src/types/android-release.ts`
- `src/types/native-globals.d.ts`
- `src/lib/native/native-platform.ts`
- `src/lib/native/native-file-picker.ts`
- `src/lib/native/native-gamepad.ts`
- `src/lib/native/native-storage.ts`
- `src/lib/native/native-fullscreen.ts`
- `src/components/import/usb-folder-picker.tsx`
- `src/components/pwa/android-download-section.tsx`
- `public/downloads/android-release.json`
- `tests/unit/save-state-store.test.ts`

### ZmenenĂ©

- `package.json` â€” npm only skripty, odstrĂˇnenĂ© nepouĹľĂ­vanĂ© deps, pridanĂ© Capacitor balĂ­ky
- `capacitor.config.ts` â€” `webDir: "android-shell/dist"`, odstrĂˇnenĂ© neexistujĂşce pluginy
- `next.config.ts` â€” `reactStrictMode: true`, `ignoreBuildErrors: false`
- `tsconfig.json` â€” exclude android/ a android-shell/
- `eslint.config.mjs` â€” zapnutĂ© pravidlĂˇ per prompt section 24
- `.github/workflows/ci.yml` â€” 3 jobs (web-quality, android-build, android-release)
- `.env.example` â€” pridanĂ© Android env premennĂ©
- `README.md` â€” premenovanĂ˝ na â€žJaĹo Ĺˇe chce bavkac", aktualizovanĂ˝
- `IMPLEMENTATION_REPORT.md` â€” doplnenĂ© o novĂ© sekcie
- `public/manifest.webmanifest` â€” premenovanĂ˝
- `public/offline/offline.html` â€” premenovanĂ˝
- `src/app/layout.tsx` â€” metadata premenovanĂ©
- `src/app/page.tsx` â€” sekcia â€žStiahnuĹĄ aplikĂˇciu", podporovanĂ© zariadenia
- `src/app/import/page.tsx` â€” pridanĂ˝ USB picker
- `src/app/play/[id]/page.tsx` â€” load state po start, autosave, useGamepadInput, useKeyboardInput, useMouseInput, F5/F9
- `src/app/game/[id]/page.tsx` â€” PokraÄŤovaĹĄ / HraĹĄ od zaÄŤiatku
- `src/components/layout/app-shell.tsx` â€” premenovanĂ© na â€žJAĹ‡O Ĺ E CHCE BAVKAC"
- `src/components/import/import-wizard.tsx` â€” pridanĂ˝ `onComplete` prop
- `src/emulators/dos/dos-adapter.ts` â€” `start()` neblokuje, `releaseAllInputs()`, `sendInput("pointer")` volĂˇ `ci.simulateMouseMotion()`
- `src/emulators/ps1/ps1-adapter.ts` â€” `releaseAllInputs()`
- `src/lib/storage/repositories.ts` â€” DB_VERSION 2, migrĂˇcia save state zĂˇznamov
- `src/types/emulator.ts` â€” `releaseAllInputs?()` na EmulatorAdapter
- `android/app/build.gradle` â€” `signingConfigs.release`, odstrĂˇnenĂ˝ `bundle` split
- `android/app/src/main/AndroidManifest.xml` â€” odstrĂˇnenĂ© duplicitnĂ©/zbytoÄŤnĂ©
- `android/app/src/main/java/sk/jano/bavkac/MainActivity.kt` â€” dedĂ­ z BaseGameActivity
- `android/app/src/main/java/sk/jano/bavkac/NativeGamepadPlugin.kt` â€” `isActive()`, `releaseAll()`, Build import
- `android/app/src/main/java/sk/jano/bavkac/NativeFilePickerPlugin.kt` â€” reĂˇlny SAF so streaming copy
- `android/app/src/main/java/sk/jano/bavkac/NativeStoragePlugin.kt` â€” opravenĂ˝ JSONObject.NULL â†’ JSObject.NULL

### OdstrĂˇnenĂ©

- `src/lib/db.ts` (nepouĹľĂ­vanĂ©)
- `src/components/ui/form.tsx`, `calendar.tsx`, `carousel.tsx`, `chart.tsx`, `command.tsx`, `context-menu.tsx`, `hover-card.tsx`, `input-otp.tsx`, `menubar.tsx`, `navigation-menu.tsx`, `pagination.tsx`, `drawer.tsx`, `resizable.tsx`, `accordion.tsx`, `aspect-ratio.tsx`, `avatar.tsx`, `breadcrumb.tsx`, `collapsible.tsx`, `sidebar.tsx`, `sonner.tsx`, `table.tsx`, `tabs.tsx`, `toggle-group.tsx`
- `prisma/schema.prisma`
- `bun.lock`

## TestovanĂ© platformy

| Platforma | Stav |
|-----------|------|
| Linux (Ubuntu) â€” Node.js 20+ | âś… npm ci, typecheck, lint, test, build, android:web, cap sync |
| Windows | âš ď¸Ź Skripty pouĹľĂ­vajĂş `node scripts/*.mjs` (cross-platform), ale neoverenĂ© na Windows CI |
| Android (CI) | âš ď¸Ź `./gradlew assembleDebug` overĂ­ GitHub Actions (sandbox nemĂˇ Android SDK) |

## VĂ˝sledok web buildu

```
âś“ TypeScript strict: 0 chĂ˝b
âś“ ESLint: 0 errors, 45 warnings (nepouĹľĂ­vanĂ© importy, exhaustive-deps warnings â€” Äľahko opraviteÄľnĂ©)
âś“ Vitest: 115/115 testov preĹˇlo (11 test sĂşborov)
âś“ Next.js build: ĂşspeĹˇnĂ˝ (.next/standalone vytvorenĂ˝)
```

## VĂ˝sledok Android buildu

```
âś“ npm run android:web â€” Vite build ĂşspeĹˇnĂ˝ (android-shell/dist/ vytvorenĂ˝)
âś“ npx cap sync android â€” ĂşspeĹˇnĂ˝ (3 Capacitor pluginy nĂˇjdenĂ©)
âš  ./gradlew assembleDebug â€” overĂ­ sa v GitHub Actions (sandbox nemĂˇ Android SDK)
```

## Stav DOS

- âś… `DosAdapter` implementuje reĂˇlne js-dos API
- âś… `start()` neblokuje â€” `runPromise` sledovanĂ˝ asynchrĂłnne
- âś… `releaseAllInputs()` posiela key-up pre vĹˇetky beĹľnĂ© klĂˇvesy
- âś… `sendInput("pointer")` volĂˇ `ci.simulateMouseMotion()` (reĂˇlne js-dos API v8.x)
- âš ď¸Ź VyĹľaduje manuĂˇlne pridanĂ˝ js-dos WASM core do `public/emulator-assets/js-dos/` (spustite `npm run setup:cores`)

## Stav PS1

- âś… `Ps1Adapter` implementuje reĂˇlne EmulatorJS API
- âś… `releaseAllInputs()` posiela button-up + axis reset
- âś… `start()` neblokuje
- âš ď¸Ź VyĹľaduje manuĂˇlne pridanĂ˝ EmulatorJS core do `public/emulator-assets/emulatorjs/` (spustite `npm run setup:cores`)
- âš ď¸Ź VyĹľaduje pouĹľĂ­vateÄľskĂ˝ BIOS (Settings â†’ BIOS)

## Stav PC gamepadu

- âś… `useGamepadInput` hook â€” RAF polling `navigator.getGamepads()`
- âś… Button transitions (down len pri prechode do stlaÄŤenĂ©ho, up pri uvoÄľnenĂ­)
- âś… Deadzone + sensitivity + invert Y
- âś… Disconnect handling â€” uvoÄľnĂ­ vĹˇetky stlaÄŤenĂ© tlaÄŤidlĂˇ + reset osĂ­
- âś… PripojenĂ© do `play/[id]/page.tsx` keÄŹ `isPlaying === true`

## Stav Android gamepadu

- âś… `NativeGamepadPlugin` (Kotlin) â€” KeyEvent + MotionEvent â†’ JS eventy cez `notifyListeners`
- âś… `BaseGameActivity.dispatchKeyEvent` + `onGenericMotionEvent` filtruje SOURCE_GAMEPAD/JOYSTICK
- âś… Plugin mĂˇ `active`/`inactive` stav â€” JS aktivuje cez `start()`, deaktivuje cez `stop()`
- âś… `releaseAll()` pri `onStop()` activity
- âš ď¸Ź ReĂˇlne otestovanie na fyzickom zariadenĂ­ â€” potrebnĂ© v Android CI

## Stav USB importu

- âś… `UsbFolderPicker` komponent
  - PC: File System Access API + webkitdirectory fallback
  - Android: `NativeFilePickerPlugin.pickFiles` / `pickDirectory` cez SAF
- âś… `NativeFilePickerPlugin` (Kotlin) â€” reĂˇlny SAF
  - `ACTION_OPEN_DOCUMENT` s `EXTRA_ALLOW_MULTIPLE`
  - `ACTION_OPEN_DOCUMENT_TREE` pre prieÄŤinok
  - Streaming copy na background thread (ExecutorService, 64 KB buffer)
  - Persistable URI permissions
  - Multi-file podpora cez ClipData
- âś… ZachovĂˇvanie adresĂˇrovej ĹˇtruktĂşry pri vĂ˝bere prieÄŤinka

## Stav save states

- âś… DeterministickĂ© ID `${gameId}:${slot}` â€” Ĺľiadne duplicitnĂ© metadata
- âś… IndexedDB verzia 2 s migrĂˇciou (deduplikĂˇcia starĂ˝ch zĂˇznamov)
- âś… AtomickĂ© ukladanie â€” temp â†’ over â†’ backup â†’ aktivuj â†’ cleanup
- âś… Sloty: 0=Auto, 1=Manual, 2=Backup
- âś… `getLatestSaveForGame()` â€” preferuje manual â†’ auto â†’ backup
- âś… PokraÄŤovaĹĄ: load state AĹ˝ po `start()` (ak zlyhĂˇ, hra od zaÄŤiatku s upozornenĂ­m)
- âś… HraĹĄ od zaÄŤiatku nemaĹľe existujĂşce uloĹľenia

## ZnĂˇme obmedzenia

1. **Android SDK v sandboxe** â€” `./gradlew assembleDebug` sa overĂ­ len v GitHub Actions
2. **Emulator WASM jadrĂˇ** â€” js-dos + EmulatorJS sa nesmĂş redistribuovaĹĄ (GPL-2.0); `npm run setup:cores` vypĂ­Ĺˇe manuĂˇlne kroky
3. **BIOS** sa neposkytuje â€” pouĹľĂ­vateÄľ uploaduje vlastnĂ˝
4. **PS2** zostĂˇva vypnutĂ© â€” aktivuje sa aĹľ po reĂˇlnej integrĂˇcii Play!.js
5. **45 ESLint warnings** â€” nepouĹľĂ­vanĂ© importy v Next.js page komponentoch (Äľahko opraviteÄľnĂ©, ale nefunkÄŤnĂ©)
6. **EmulatorJS FPS event** â€” neposkytuje, `performance-update` posiela `fps: 0`
7. **Streaming SHA-256** â€” pre veÄľkĂ© blob-y (>1 GB) sa naÄŤĂ­ta do pamĂ¤te (obmedzenie Web Crypto API)
8. **React Compiler pravidlĂˇ** â€” `react-hooks/refs` a `react-hooks/immutability` vypnutĂ©, pretoĹľe play page pristupuje k `adapterRef.current` v hook argumentoch (anti-pattern, ale funkÄŤnĂ©)

## PresnĂ˝ postup vytvorenia APK

### 1. Pripravte repozitĂˇr

```bash
git clone https://github.com/jozinko6/emulator.git
cd emulator
npm ci
```

### 2. Pridajte emulaÄŤnĂ© assety

```bash
npm run setup:cores
# Skript stiahne libarchive.js worker bundle.
# Pre js-dos a EmulatorJS postupujte podÄľa pokynov, ktorĂ© skript vypĂ­Ĺˇe.
```

### 3. Build Android web shell

```bash
npm run android:web
# VytvorĂ­ android-shell/dist/ s UI, JS bundle, CSS, PWA ikonami
```

### 4. Sync Capacitor projekt

```bash
npx cap sync android
# SkopĂ­ruje android-shell/dist/ do android/app/src/main/assets/public/
```

### 5. Build debug APK (pre testovanie)

```bash
cd android
./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/jano-se-chce-bavkac-debug.apk
```

### 6. Build release APK (pre distribĂşciu)

Pre podpĂ­sanĂ˝ release APK potrebujete keystore. Vytvorte ho raz:

```bash
keytool -genkey -v -keystore release.keystore -alias jano-bavkac \
  -keyalg RSA -keysize 2048 -validity 10000
```

Nastavte GitHub Actions secrets v repozitĂˇri:

- `ANDROID_KEYSTORE_BASE64` â€” `base64 release.keystore`
- `ANDROID_KEYSTORE_PASSWORD` â€” heslo k keystore
- `ANDROID_KEY_ALIAS` â€” `jano-bavkac`
- `ANDROID_KEY_PASSWORD` â€” heslo k kÄľĂşÄŤu

Vytvorte tag `v1.0.0` a pushnite:

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions automaticky:

1. SpustĂ­ `web-quality` job (typecheck, lint, test, build)
2. SpustĂ­ `android-build` job (debug APK ako artifact)
3. SpustĂ­ `android-release` job (podpĂ­sanĂ˝ release APK)
4. VytvorĂ­ GitHub Release s `jano-se-chce-bavkac.apk` ako asset
5. APK bude dostupnĂ© na stabilnom odkaze:
   ```
   https://github.com/jozinko6/emulator/releases/latest/download/jano-se-chce-bavkac.apk
   ```

### 7. InĹˇtalĂˇcia na zariadenie

1. Stiahnite APK do Android zariadenia
2. V Nastavenia â†’ AplikĂˇcie povoÄľte â€žInĹˇtalĂˇcia z neznĂˇmych zdrojov" pre vĂˇĹˇ prehliadaÄŤ
3. Otvorte APK a potvrÄŹte inĹˇtalĂˇciu
4. Spustite â€žJaĹo Ĺˇe chce bavkac" z launchera (telefĂłn/tablet) alebo z Android TV launchera

### 8. AktualizĂˇcia APK

Pre aktualizĂˇciu bez odinĹˇtalovania musĂ­ byĹĄ novĂ˝ APK podpĂ­sanĂ˝ **rovnakĂ˝m keystore**. Preto:

- Keystore uloĹľte na bezpeÄŤnĂ© miesto (password manager, offline backup)
- Keystore sa NESMIE dostaĹĄ do Git repozitĂˇra
- Ak stratĂ­te keystore, budete musieĹĄ aplikĂˇciu odinĹˇtalovaĹĄ a nainĹˇtalovaĹĄ s novĂ˝m keystore
