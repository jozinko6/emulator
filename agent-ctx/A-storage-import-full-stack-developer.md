# A-storage-import — full-stack-developer

## Task
ETAPA 2+3 — Storage doplnenie + Import pipeline (archive layer, web workers, import wizard UI, streaming writer).

## Súvisiace súbory (pre čítanie pred prácou)
- `src/types/emulator.ts`, `src/types/game.ts`, `src/types/detection.ts`, `src/types/errors.ts` — typy
- `src/lib/storage/opfs.ts` — OPFS utilities
- `src/lib/storage/repositories.ts` — IndexedDB repos
- `src/lib/security/path-normalizer.ts`, `limits.ts`, `hashing.ts` — bezpečnosť
- `src/stores/import-store.ts` — import job store

## Stav po dokončení
Všetky súbory z ETAPA 2+3 už existovali z predošlej inicializácie. Pridané opravy:

### Bug fix v `src/lib/archive/zip.ts`
- Pridaná `isMainThread()` detekcia — kontrola veľkosti < 10 MB sa aplikuje len na hlavnom vlákne. V workery (kde `window` neexistuje) sa kontrola preskakuje, takže archive worker môže spracovávať ZIP súbory ľubovoľnej veľkosti.
- Predtým by `archive.worker.ts` volajúci `listZipEntries(data)` s `data.byteLength > 10 MB` vyhodil `RetroCloudError("INSUFFICIENT_MEMORY")`.

### Kvalitné opravy
- `src/lib/storage/opfs.ts`:
  - Odstránený `@ts-expect-error` na `dir.entries()` — nahradené explicitným `IterableDirectoryHandle` interface-om s `entries()/keys()/values()` ako `AsyncIterableIterator<T>` + `asIterable()` helper.
  - Odstránený `as any` na `dir.values()` — rovnaký helper.
  - Tri prázdne catch bloky (cleanup pri chybe zápisu + removeEntry) doplnené o `console.warn` s kontextom; pôvodná chyba má stále prioritu (re-throw).
  - `calculateDirectorySize` — `entry.getFile()` vyžaduje `FileSystemFileHandle`, nie `FileSystemHandle` — pridaný cast po kontrole `entry.kind === "file"`.
- `src/lib/storage/repositories.ts`: `getAllGames` catch teraz loguje chybu pred návratom `[]`.
- `src/lib/storage/streaming-writer.ts`: `makeAbortable` — oba `.catch(() => undefined)` doplnené o `console.warn`.
- `src/components/import/import-wizard.tsx`: `catch (e: any)` → `catch (e: unknown)`; prázdny catch v filtri nebezpečných ciest doplnený o `console.debug`; `.catch(() => undefined)` v cleanup doplnené o `console.warn`.
- `src/components/import/drop-zone.tsx`: prázdny catch v `collectFilesFromDirectory` doplnený o `console.warn` s menom súboru.
- `src/workers/archive.worker.ts`: prázdny catch vo filtri nebezpečných ciest doplnený o `console.warn`.

## Verifikácia
- `bunx tsc --noEmit` → exit 0 ✅
- `bun run lint` → exit 0 ✅
- `bun run lint --max-warnings=0` → exit 0 ✅
- Grep: v `src/` nie je žiadny `@ts-ignore`, `@ts-expect-error`, `: any`, `as any` ani `<any>`.

## Známe obmedzenia / nedokončené
1. **Detection worker** je placeholder (mock deteguje platformu podľa prípony). Subagent B (ETAPA 4) nahradí reálnou logikou (magic bytes, ISO analyzer, CUE parser).
2. **libarchive.js** worker bundle (`/libarchive/worker-bundle.js`) nie je v `public/libarchive/`. Bez neho RAR/7z rozbaľovanie nebude fungovať. Treba pridať pri reálnom nasadení.
3. **ZIP** sa v archive workery dekomprimuje dvakrát (raz pre list, raz pre extract) — výkonnostná optimalizácia mimo rozsah tohto tasku.
4. **Hashing worker** pre veľké blob-y (>1 GB) načíta celý obsah do pamäte, pretože `SubtleCrypto.digest` nepodporuje streaming. Známe obmedzenie Web Crypto API.
5. **Fingerprint** (`fingerprintGame`) používa FNV-1a hash (rýchly, deterministický). Pre reálnu deduplikáciu hier môže byť neskôr vylepšený o SHA-256 hlavného súboru.

## Kompletný zoznam súborov v ETAPA 2+3 scope
### Časť A — Archive layer
- `src/lib/archive/archive-types.ts` ✅
- `src/lib/archive/archive-security.ts` ✅
- `src/lib/archive/zip.ts` ✅ (s bug fixom)
- `src/lib/archive/rar.ts` ✅
- `src/lib/archive/seven-z.ts` ✅
- `src/lib/archive/libarchive-base.ts` ✅ (zdieľaný helper)

### Časť B — Web Workers
- `src/workers/archive.worker.ts` ✅
- `src/workers/hashing.worker.ts` ✅

### Časť C — Import Wizard UI
- `src/components/import/drop-zone.tsx` ✅
- `src/components/import/import-progress.tsx` ✅
- `src/components/import/import-wizard.tsx` ✅
- `src/components/import/format-detection.ts` ✅ (helper)
- `src/app/import/page.tsx` ✅

### Časť D — Streaming Writer
- `src/lib/storage/streaming-writer.ts` ✅
