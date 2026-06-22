# FIX_PLAN — Jaňo še chce bavkac

Súkromný rodinný projekt. Priorita: jednoduché, spoľahlivé hranie vlastných DOS/PS1 hier na PC a Androide (vrátane TV). Žiadne platby, reklamy, analytika, verejná registrácia. PS2 zostáva vypnuté.

## 1. Aktuálne chyby (zistené)

| # | Oblasť | Chyba | Súbor/y |
|---|--------|-------|---------|
| 1 | Package manager | Chýba `package-lock.json`, mix npm/Bun, skripty používajú Linux-only `cp`, `tee`, `NODE_ENV=...` prefix | `package.json` |
| 2 | Android web build | `webDir: "out"` v Capacitor config, ale Next.js standalone nevytvára `out/` | `capacitor.config.ts` |
| 3 | Android Capacitor | Chýba `@capacitor/android`, `@capacitor/splash-screen`, pluginy v configu nie sú reálne nainštalované | `package.json`, `capacitor.config.ts` |
| 4 | Kotlin compile | `MainActivity.kt` mieša Application + 2 aktivity v jednom súbore, chýba `Bundle` import, `JSONObject.NULL` typo, chýba `Build` import v `NativeGamepadPlugin`, neexistujúce `activity.intent` | `android/app/src/main/java/sk/jano/bavkac/*.kt` |
| 5 | AndroidManifest | Duplicitný `leanback`, zbytočný `FULLSCREEN` a `READ_EXTERNAL_STORAGE`, chýba `application/javaSdk` | `android/app/src/main/AndroidManifest.xml` |
| 6 | Gradle signing | `bundle` split blok, chýba korektný `signingConfigs`, `keystorePath: undefined` | `android/app/build.gradle` |
| 7 | Native gamepad | Plugin má metódy, ale `MainActivity` ich nikdy nevolá — `dispatchKeyEvent`/`onGenericMotionEvent` nie sú implementované | `MainActivity.kt`, `NativeGamepadPlugin.kt` |
| 8 | Web Gamepad | UI existuje, ale herná obrazovka nepolluje `navigator.getGamepads()` cez RAF | `src/app/play/[id]/page.tsx` |
| 9 | Keyboard | KeyboardHandler existuje, ale nie je napojený na play page | `src/app/play/[id]/page.tsx` |
| 10 | DOS myš | DosAdapter `sendInput("pointer", ...)` je no-op | `src/emulators/dos/dos-adapter.ts` |
| 11 | Lifecycle | `start()` čaká na dokončenie emulačnej slučky, play page zostane v „Načítavam" | `dos-adapter.ts`, `ps1-adapter.ts`, `play/[id]/page.tsx` |
| 12 | Save state ID | Každé uloženie vytvára nové UUID → duplicitné metadata pre rovnaký slot | `src/lib/storage/repositories.ts`, `play/[id]/page.tsx` |
| 13 | Atomic save | Žiadna ochrana pred poškodením pri páde — write priamo do cieľa | chýba |
| 14 | Save UI | Zobrazuje „Slot 1/2/3", technické detaily | `src/app/saves/page.tsx`, `src/components/library/save-state-list.tsx` |
| 15 | Continue | Tlačidlo „Pokračovať" len spustí hru, nenačíta save | `src/app/play/[id]/page.tsx`, `src/app/game/[id]/page.tsx` |
| 16 | Load order | `loadState` volaný pred `start` — nesprávne | `src/app/play/[id]/page.tsx` |
| 17 | Autosave | Iba pri React unmount, žiadny interval, žiadny visibility/Capacitor listener | chýba |
| 18 | File picker | `NativeFilePickerPlugin` vracia prázdne výsledky v callbackoch | `NativeFilePickerPlugin.kt` |
| 19 | Android TV D-pad | Žiadny focus management v CSS, tlačidlá nie sú explicitne focusable | `globals.css`, komponenty |
| 20 | Emulator assets | Žiadny setup skript, žiadne overenie SHA-256 | chýba |
| 21 | Zbytočné deps | Prisma, NextAuth, nepoužívané editorové knižnice, chart knižnice | `package.json` |
| 22 | ESLint | Príliš mnoho vypnutých pravidiel, prázdne catch bloky | `eslint.config.mjs` |
| 23 | CI workflow | Používa `cap sync` bez `@capacitor/android`, nereálne APK URL | `.github/workflows/ci.yml` |
| 24 | Docs | README a IMPLEMENTATION_REPORT nezhodné s reálnym stavom | `README.md`, `IMPLEMENTATION_REPORT.md` |

## 2. Poradie opráv

1. **Package manager + cross-platform skripty** (sekcia 2) — bez tohto nefunguje nič
2. **Android web build shell (Vite)** (sekcia 5) — separátny statický shell, nie Next.js standalone
3. **Capacitor dependencies + config** (sekcia 4)
4. **Kotlin compile opravy** (sekcia 6) — `BaseGameActivity`, `JanobavkacApplication`, samostatné súbory
5. **AndroidManifest opravy** (sekcia 7)
6. **Gradle signing** (sekcia 8)
7. **Native gamepad wiring** (sekcia 9) — `dispatchKeyEvent`/`onGenericMotionEvent` v `BaseGameActivity`
8. **Save state dátový model** (sekcia 14) — deterministické ID `${gameId}:${slot}`
9. **Atomické ukladanie** (sekcia 15) — temp → backup → activate → cleanup
10. **Emulator lifecycle** (sekcia 13) — `start()` vráti ihneď po spustení
11. **Save UI zjednodušenie** (sekcia 16) — Uložiť / Načítať / Ukončiť
12. **Continue** (sekcia 17) — proper load after start
13. **Autosave** (sekcia 19) — interval + visibility + Capacitor appStateChange
14. **Web Gamepad polling** (sekcia 10) — `useGamepadInput` hook
15. **Keyboard handler napojenie** (sekcia 11) — F5 quick save, F9 quick load
16. **DOS myš** (sekcia 12) — reálne js-dos API alebo pravdivé obmedzenie
17. **Native file picker** (sekcia 20) — reálny SAF
18. **Android TV focus** (sekcia 21) — CSS focus styles, focusable attrs
19. **Emulator assets setup skript** (sekcia 22) — `scripts/setup-emulator-assets.mjs`
20. **ESLint** (sekcia 24) — zapnúť pravidlá, opraviť prázdne catch
21. **Zbytočné deps** (sekcia 23) — odstrániť Prisma/NextAuth ak nepoužívané
22. **Testy** (sekcia 26) — pridať chýbajúce
23. **CI workflow** (sekcia 3) — npm ci, typecheck, lint, test, build, android:web, cap sync, assembleDebug
24. **Docs** (sekcia 25) — README, IMPLEMENTATION_REPORT, FIX_REPORT
25. **Povinné overenie** (sekcia 27) — npm ci, typecheck, lint, test, build, android:web, cap sync
26. **Push na GitHub**

## 3. Riziká

- **Android build v sandboxe** — Android SDK nie je nainštalovaný. `./gradlew assembleDebug` sa spustí len v CI. Skripty a Kotlin kód budú pripravené korektne, ale overenie prebehne až v GitHub Actions.
- **Cap sync** — vyžaduje `@capacitor/android` nainštalovaný; po `npm install` by mal fungovať.
- **Vite shell vs Next.js** — budú 2 samostatné bundly. Next.js zostane pre web, Vite shell pre Android. Zdieľané moduly budú v `src/lib/`, `src/emulators/`, `src/types/`.
- **Hash routing v Android shell** — Next.js App Router nepodporuje hash routing priamo, preto Vite shell s `react-router-dom` (hash router).
- **Emulator WASM assety** — zostanú nepripojené z licenčných dôvodov. Setup skript stiahne len open-source wrapper knižnice (fflate, libarchive.js worker), NEstiahne js-dos/EmulatorJS jadrá — pre tie vypíše manuálny návod.
- **PS1 BIOS** — ostáva povinný používateľský upload, neposkytujeme.
- **DOS myš** — overím reálne js-dos API (v8.x je to `ci.sendMouseButton()` a `ci.sendMouseMotion()`). Ak nie je dostupné, pravdivo to označím.
- **Save state migrácia** — zvýšim IndexedDB verziu z 1 → 2, migrácia deduplikuje existujúce záznamy.
- **Force push** — pri push-i použijem bežný push (nie force), lebo história je už zsyncovaná.

## 4. Spôsob overenia

| Úroveň | Overenie |
|--------|----------|
| TypeScript | `npm run typecheck` → 0 chýb |
| ESLint | `npm run lint` → 0 chýb, 0 warnings |
| Unit testy | `npm run test -- --run` → všetky prejdú |
| Web build | `npm run build` → úspešné |
| Android web build | `npm run android:web` → `android-shell/dist/` existuje |
| Cap sync | `npx cap sync android` → úspešné |
| Gradle debug APK | `cd android && ./gradlew assembleDebug` → len v CI (sandbox nemá Android SDK) |
| Agent-browser | úvodná / import / play routes renderujú správne |
| Docs audit | README, IMPLEMENTATION_REPORT, FIX_REPORT zodpovedajú reálnemu stavu |

## 5. Výnimky a obmedzenia (budú pravdivo zdokumentované)

- **Android APK build** sa overí v GitHub Actions, nie lokálne (chýba Android SDK).
- **Emulator WASM jadrá** (js-dos, EmulatorJS) sa nesmú redistribuovať — setup skript vypíše návod.
- **BIOS** sa neposkytuje.
- **PS2** zostáva vypnuté (`NEXT_PUBLIC_ENABLE_PS2=false`).
- **Supabase / Google OAuth** — kód ostáva, ale default vypnutý.
- **Testovacie ROM/ISO** — použijem len legálne homebrew alebo syntetické testy.
