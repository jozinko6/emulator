# Final fix plan

## Verified starting point

- Branch created from `main`: `fix/final-runtime-integration`.
- Current code still contained USB import placeholders in both web and Android import pages.
- Shared `ImportWizard` still imported `next/link`, which breaks the shared Next/Vite boundary.
- The import flow still used only the first selected file for loose files.
- DOS and PS1 adapters still wrote save metadata directly through the old repository helpers with random UUID IDs.
- Web and Android continue behavior was inconsistent.
- Native gamepad TypeScript wrapper did not use Capacitor `registerPlugin`.

## Implementation steps

1. Add a shared import source contract and helper functions for browser files, USB directory entries, Android SAF internal paths, CUE validation, DOS launcher selection, and main-file selection.
2. Wire `UsbFolderPicker` into the same `ImportWizard` pipeline on web and Android shell.
3. Remove Next router/link dependencies from shared import components.
4. Replace adapter save operations with `saveStateAtomically`, deterministic slot IDs, and `getSaveState`/`deleteSaveState`.
5. Make save storage use versioned OPFS paths and switch IndexedDB metadata only after the new file has been fully written and verified.
6. Unify `/play/{id}`, `/play/{id}?fresh=1`, and `/play/{id}?slot=N` behavior on web and Android.
7. Register the native Android gamepad plugin through Capacitor and map native events into emulator input events.
8. Extend DOS mouse events for button down/up/wheel and block context menu while playing.
9. Harden CI/release workflow and update documentation with only verified results.
10. Run the required checks, build Android debug APK, commit, push, and open a PR when authentication allows it.
