# Jaňo še chce bavkac

Súkromný rodinný projekt: lokálny webový a Android emulátor pre vlastné legálne záložné kópie DOS a PlayStation 1 hier.

[![CI](https://github.com/jozinko6/emulator/actions/workflows/ci.yml/badge.svg)](.github/workflows/ci.yml)

## Čo aplikácia robí

- importuje lokálne súbory, priečinky a archívy do OPFS,
- podporuje DOS cez js-dos a PS1 cez EmulatorJS / PCSX-ReARMed,
- ukladá save states atomicky s veľkosťou a SHA-256 hashom,
- beží ako PWA, Android aplikácia a Android TV shell,
- neposkytuje hry, ROM, ISO, BIN, CUE, BIOS ani iný chránený obsah.

Pre niektoré PS1 hry je potrebný vlastný PlayStation BIOS. Aplikácia BIOS neposkytuje.

## Lokálne spustenie

```bash
npm ci
npm run check:encoding
npm run setup:cores
npm run verify:cores
npm run dev
```

Web beží na `http://localhost:3000`.

## Build

```bash
npm run typecheck
npm run lint
npm run test -- --run
npm run build
```

## Android debug APK

```bash
npm run setup:cores
npm run verify:cores
npm run android:web
npx cap sync android
cd android
./gradlew clean assembleDebug --no-daemon
```

Na Windows môžete použiť:

```powershell
npm run android:debug
```

## Emulačné assety

`npm run setup:cores` pripraví iba redistribuovateľné runtime assety:

- `js-dos@8.4.0` z npm,
- EmulatorJS stable loader a PCSX-ReARMed runtime data z oficiálneho CDN,
- `libarchive.js@2.0.2` z npm.

Skript vytvorí `public/emulator-assets/emulator-assets.manifest.json` so zdrojmi, licenciami, veľkosťami a SHA-256 hashmi. Binárne runtime assety sa necommitujú; v CI sa pripravujú pred buildom.

## CI

GitHub Actions workflow spúšťa:

- `npm ci`,
- `npm run check:encoding`,
- `npm run typecheck`,
- `npm run lint`,
- `npm run test -- --run`,
- `npm run build`,
- `npm run setup:cores`,
- `npm run verify:cores`,
- `npm run android:web`,
- `npx cap sync android`,
- `./gradlew clean assembleDebug --no-daemon`.

Debug APK sa overí cez `apksigner`, premenuje na `jano-se-chce-bavkac-debug.apk`, vypočíta sa SHA-256 a nahrá sa ako artifact `jano-se-chce-bavkac-debug-apk`.
