/**
 * Streaming writer do OPFS.
 *
 * Per prompt sekcia 12 — súbory > 256 MB sa NESMÚ načítať naraz do pamäte
 * pomocou `await file.arrayBuffer()`. Namiesto toho sa streamujú po chunkoch
 * cez `file.stream()` → `writeStream()` z `opfs.ts`.
 *
 * Tento modul poskytuje:
 *  - `streamFileToOpfs(file, opfsPath, onProgress?, signal?)` — streamuje File
 *  - `streamBlobToOpfs(blob, opfsPath, onProgress?, signal?)` — streamuje Blob
 *
 * Komentáre v slovenčine.
 */
import { writeStream } from "@/lib/storage/opfs";
import { RetroCloudError } from "@/types/errors";

/** Prah, nad ktorý sa NESMIE použiť `await file.arrayBuffer()`. */
export const STREAM_THRESHOLD_BYTES = 256 * 1024 * 1024; // 256 MB

/**
 * Skontroluje, či je súbor bezpečný na načítanie do pamäte naraz.
 * UI by nemalo volať `file.arrayBuffer()` ak je súbor väčší ako tento prah.
 */
export function isStreamRequired(byteLength: number): boolean {
  return byteLength > STREAM_THRESHOLD_BYTES;
}

/**
 * Vytvorí ReadableStream z Blob-a — fallback pre prehliadače, ktoré
 * nepodporujú `Blob.stream()` (všetky moderné ho podporujú, ale pre istotu).
 */
function blobToStream(blob: Blob): ReadableStream<Uint8Array> {
  if (typeof blob.stream === "function") {
    return blob.stream() as ReadableStream<Uint8Array>;
  }
  // Fallback — chunkovanie
  const CHUNK = 8 * 1024 * 1024; // 8 MB
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (offset >= blob.size) {
        controller.close();
        return;
      }
      const end = Math.min(offset + CHUNK, blob.size);
      const chunk = await blob.slice(offset, end).arrayBuffer();
      controller.enqueue(new Uint8Array(chunk));
      offset = end;
    },
  });
}

/**
 * Streamuje File do OPFS.
 *
 * @param file zdrojový súbor
 * @param opfsPath cieľová cesta v OPFS (napr. "games/{gameId}/main.iso")
 * @param onProgress voliteľný callback so stavom (written bytes)
 * @param signal voliteľný AbortSignal pre zrušenie
 * @returns `{ size }` — celkový počet zapísaných bajtov
 */
export async function streamFileToOpfs(
  file: File,
  opfsPath: string,
  onProgress?: (writtenBytes: number) => void,
  signal?: AbortSignal
): Promise<{ size: number }> {
  if (signal?.aborted) {
    throw new RetroCloudError("UNKNOWN_ERROR", "Zápis do OPFS zrušený pred štartom.");
  }

  // Ak je poskytnutý signal, vytvoríme pass-through stream, ktorý skončí
  // keď sa signal abortne. `writeStream` v `opfs.ts` pri chybe reader.read()
  // správne zavolá abort writable a cleanup.
  const sourceStream = blobToStream(file);
  const stream = signal
    ? makeAbortable(sourceStream, signal)
    : sourceStream;

  try {
    const result = await writeStream(opfsPath, stream, onProgress);
    return { size: result.size };
  } catch (e) {
    if (signal?.aborted) {
      throw new RetroCloudError("UNKNOWN_ERROR", "Zápis do OPFS zrušený používateľom.");
    }
    if (e instanceof RetroCloudError) throw e;
    throw new RetroCloudError(
      "UNKNOWN_ERROR",
      `Zápis do OPFS zlyhal: ${e instanceof Error ? e.message : String(e)}`,
      { cause: e, technicalDetail: `opfsPath=${opfsPath}` }
    );
  }
}

/**
 * Streamuje Blob do OPFS. Používa sa napr. pre extrahované dáta z archívu,
 * ktoré prichádzajú ako Blob.
 *
 * @param blob zdrojový blob
 * @param opfsPath cieľová cesta v OPFS
 * @param onProgress voliteľný callback so stavom (written bytes)
 * @param signal voliteľný AbortSignal pre zrušenie
 * @returns `{ size }` — celkový počet zapísaných bajtov
 */
export async function streamBlobToOpfs(
  blob: Blob,
  opfsPath: string,
  onProgress?: (writtenBytes: number) => void,
  signal?: AbortSignal
): Promise<{ size: number }> {
  // Blob a File majú rovnaké API pre stream() — použijeme streamFileToOpfs
  // pomocou pretypovania (File je podmnožinou Blob-u).
  return streamFileToOpfs(blob as File, opfsPath, onProgress, signal);
}

/**
 * Vytvorí abortovateľný pass-through stream.
 * Keď sa `signal` abortne, reader sa zruší a chyba sa propaguje.
 */
function makeAbortable(
  source: ReadableStream<Uint8Array>,
  signal: AbortSignal
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (signal.aborted) {
        await reader.cancel().catch((err: unknown) => {
          // Ak reader.cancel zlyhá, len zaznamenáme — pôvodnú chybu propagujeme
          // cez controller.error nižšie.
          console.warn("[streaming-writer] reader.cancel() zlyhal pri aborte:", err);
        });
        controller.error(
          new RetroCloudError("UNKNOWN_ERROR", "Zápis do OPFS zrušený používateľom.")
        );
        return;
      }
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      if (value) {
        controller.enqueue(value);
      }
    },
    cancel() {
      void reader.cancel().catch((err: unknown) => {
        console.warn("[streaming-writer] reader.cancel() zlyhal pri cancel:", err);
      });
    },
  });
}
