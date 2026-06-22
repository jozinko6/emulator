# Final fix report

## What changed

- USB and folder import on web and Android shell now feeds real entries into the shared `ImportWizard` pipeline instead of logging placeholders.
- Multi-file loose imports preserve relative paths and support PS1 CUE + BIN selection and DOS folder launcher selection.
- Android native storage now exposes a truthful `openFile({ path }) -> { path, url, size }` contract and the import pipeline streams native file URLs into OPFS.
- Shared import UI no longer imports `next/link`, so it can be bundled by both Next.js and the Android Vite shell.
- DOS and PS1 adapters now use `saveStateAtomically`, `getSaveState`, and deterministic save IDs through the save-state store.
- Save-state storage now writes versioned files, verifies temp file size, flips IndexedDB metadata after the new file is written, and removes superseded files only after metadata succeeds.
- Continue behavior is unified: `/play/{id}` loads the latest manual/auto save, `/play/{id}?fresh=1` starts clean, and `/play/{id}?slot=N` loads an explicit slot.
- Android native gamepad is registered through Capacitor `registerPlugin("NativeGamepad")`, mapped to emulator input events, and cleaned up on unmount.
- DOS mouse input now sends explicit pointer move, button down/up, and wheel events; context menu is blocked while playing and buttons are released on blur/pointer cancel.
- CI now builds web quality checks, Android web shell, Capacitor sync, and debug APK artifact. Release builds fail if signing secrets are missing.

## Verification

- `npm ci`: passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed with existing warnings, 0 errors.
- `npm run test -- --run`: passed, 12 files, 121 tests.
- `npm run build`: passed.
- `npm run android:web`: passed.
- `npx cap sync android`: passed.
- Local Gradle debug build: blocked by local environment. The repository had no Gradle wrapper, system Gradle was missing, JDK 25 was incompatible with Gradle 8.2.1, a temporary JDK 17 and Gradle 8.7 got past that, but Android SDK was not installed locally. Attempting to install temporary command line tools timed out before SDK packages were available.

## APK

- Local debug APK path: not produced in this environment because Android SDK is missing.
- CI is configured to produce `jano-se-chce-bavkac-debug.apk` and `jano-se-chce-bavkac-debug.apk.sha256` as artifacts.

## Functional status

- USB import: implemented and build/typecheck/test verified.
- BIN+CUE import: implemented for loose multi-file imports and unit tested.
- Multi-BIN CUE: unit tested for present and missing tracks.
- DOS folder import: implemented with priority launcher selection and unit tested.
- Save system: implemented with deterministic IDs and atomic metadata switching; unit tested.
- Web Continue: implemented and build verified.
- Android Continue: implemented and Android web build verified.
- PC gamepad: existing web fallback retained.
- Android gamepad: implemented and build verified; physical device not yet verified.
- DOS mouse: implemented and build verified; js-dos wheel support is used only when the core exposes `simulateMouseWheel`.

## Known limitations

- Physical Android device testing was not performed: Implemented and build verified, physical device zatial neoverene.
- Local APK generation was blocked by missing Android SDK in this machine. CI now provisions Android SDK and Gradle 8.7.
- Archive extraction for ZIP/RAR/7z still uses the existing worker path; this change focuses the new multi-file logic on loose file/folder/SAF imports.
