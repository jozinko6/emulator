# Final Repair Report

Branch: `fix/final-runtime-integration`
PR: `https://github.com/jozinko6/emulator/pull/1`

## Original CI run

- Commit checked: `2a0d20b9968778a9e3725e0a366f8563cbde918f`
- Run checked: `27977865207`
- Workflow: `CI + Android Build`
- Failed job metadata: `Web - Type-check, Lint, Test, Build`, job id `82800144124`, conclusion `failure`
- Android debug and release jobs were skipped because the web job failed.
- GitHub job log download returned `404 BlobNotFound` on 2026-06-22, so the original line-level log was no longer retrievable through the GitHub Actions API. The repair therefore records the API metadata and the locally reproduced failures fixed in this branch.

## Package lock and Node

- `npm ci` passed locally.
- Local machine Node: system Node 22/npm 11 were used by the desktop shell.
- GitHub Actions is configured for Node 20 through `actions/setup-node@v4`.
- `package-lock.json` did not require regeneration for dependency resolution.

## Encoding

- Added `scripts/check-encoding.mjs`.
- Added `npm run check:encoding`.
- CI runs the encoding check before type-check/build.
- README, legal/privacy/terms pages, diagnostics pages, reports, metadata, and affected import/game strings were cleaned to UTF-8 without BOM.
- Visible app name: `Jaňo še chce bavkac`.

## Gradle and Android

- Added real Gradle wrapper files under `android/` for Gradle 8.7.
- Added `scripts/run-gradle.mjs` and updated Android npm scripts to use the wrapper.
- Added `android/gradle.properties` with AndroidX enabled and JVM encoding settings.
- Fixed Capacitor plugin registration order in `BaseGameActivity.kt`.
- Fixed `MotionEvent.source` usage in native gamepad handling.
- Forced AndroidX dependency versions compatible with AGP 8.2.2 and Gradle 8.7.
- Local SDK installed at `C:/Users/Test_Admin/AppData/Local/Android/Sdk`; `android/local.properties` remains ignored.

## Emulator assets

- Added idempotent `scripts/setup-emulator-assets.mjs`.
- Added `scripts/verify-emulator-assets.mjs`.
- Runtime assets are downloaded/generated into `public/emulator-assets/` and ignored except for the generated manifest.
- Manifest: `public/emulator-assets/emulator-assets.manifest.json`.
- Sources:
  - `js-dos@8.4.0` from npm, license GPL-2.0.
  - EmulatorJS stable CDN loader/data, license GPL-3.0/upstream core license.
  - `libarchive.js@2.0.2` from npm, license MIT.
- No BIOS, ROM, ISO, games, or copyrighted game content is downloaded.
- PS1 BIOS message shown: `Pre niektoré PS1 hry je potrebný vlastný PlayStation BIOS. Aplikácia BIOS neposkytuje.`

## Save states

- Added `stateHash` to `SaveStateRecord`.
- Save writes store SHA-256 metadata.
- Load path verifies game id, fingerprint, emulator core, emulator version, file size, and hash before passing bytes to emulator cores.
- Latest-save lookup returns only compatible saves when compatibility metadata is supplied.

## DOS launcher selection

- Multi-launcher DOS imports no longer auto-select the first candidate.
- Import UI asks: `Ktorý súbor spúšťa hru?`
- User confirmation updates `mainFile` and finalizes the DOS import.

## Diagnostics

- Web and Android diagnostics show readiness for js-dos, EmulatorJS / PCSX-ReARMed, libarchive.js, asset manifest, and native plugins.
- Diagnostics include the action text `Znova overiť emulačné jadrá`.

## Local verification

- `npm ci`: passed.
- `npm run check:encoding`: passed.
- `npm run setup:cores`: passed.
- `npm run verify:cores`: passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed with existing warnings only.
- `npm run test -- --run`: 14 files, 127 tests passed.
- `npm run build`: passed.
- `npm run android:web`: passed.
- `npx cap sync android`: passed.
- `node scripts/run-gradle.mjs --version`: Gradle 8.7.
- `node scripts/run-gradle.mjs clean assembleDebug --no-daemon`: passed with JDK 21.

## GitHub Actions after push

- New pushed commit initially checked: `726e13b12ee5431c681ceb3f7e5b61317fd04fda`.
- New run: `https://github.com/jozinko6/emulator/actions/runs/27986711677`.
- Run status: `failure`.
- GitHub annotation: `The job was not started because your account is locked due to a billing issue.`
- Duration was about 4 seconds and no APK artifact was produced because the web job never started.
- This is an external GitHub account/billing block, not a code, lockfile, test, Gradle, or Android build failure.

## APK

- Local APK: `C:\Users\Test_Admin\Desktop\Pokusy\Jano\android\app\build\outputs\apk\debug\app-debug.apk`
- Copied artifact: `C:\Users\Test_Admin\Desktop\Pokusy\Jano\jano-se-chce-bavkac-debug.apk`
- Size: `9879509` bytes.
- SHA-256: `48f5198465c9ee5312e033c4f859978be43f9ca7eeed8ad2276a797ac6851cc9`
- `apksigner verify --verbose`: passed using APK Signature Scheme v2.

## Known limitations

- PS1 gameplay still requires a legally obtained user BIOS for games that need BIOS.
- GitHub's original run log for run `27977865207` was no longer available from the Actions log blob endpoint.
- Local shell used system Node 22; CI is pinned to Node 20 as required.
