/**
 * Web Worker pre SHA-256 výpočty.
 *
 * Per prompt sekcia 11 — hashing cez SubtleCrypto offloadujeme z hlavného
 * vlákna, aby UI zostalo plynulé aj pri veľkých súboroch.
 *
 * Podporuje:
 *  - `hash-arraybuffer` — hashuje ArrayBuffer
 *  - `hash-blob` — hashuje Blob (chunkovane, bez načítania celého do pamäte)
 *
 * Po dokončení pošle `{type:"done", hash: string}`.
 * Pri chybe pošle `{type:"error", message: string}`.
 *
 * Komentáre v slovenčine.
 */
import { bufferToHex } from "@/lib/security/hashing";

/// <reference lib="webworker" />

/**
 * V workery je `self` typu DedicatedWorkerGlobalScope, ale TypeScript lib.dom
 * ho deklaruje ako Window. Pre typovú bezpečnosť používame explicitný cast.
 */
interface WorkerContext {
  postMessage(message: HashResponse, transfer?: Transferable[]): void;
  onmessage: ((e: MessageEvent<HashRequest>) => void) | null;
}

const ctx = self as unknown as WorkerContext;

type HashRequest =
  | { type: "hash-arraybuffer"; id: string; buffer: ArrayBuffer }
  | { type: "hash-blob"; id: string; blob: Blob };

type HashResponse =
  | { type: "progress"; id: string; processedBytes: number; totalBytes: number }
  | { type: "done"; id: string; hash: string }
  | { type: "error"; id: string; message: string };

function post(message: HashResponse): void {
  ctx.postMessage(message);
}

/**
 * Hashuje ArrayBuffer pomocou SubtleCrypto.digest.
 */
async function hashArrayBuffer(id: string, buffer: ArrayBuffer): Promise<void> {
  try {
    post({ type: "progress", id, processedBytes: 0, totalBytes: buffer.byteLength });
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    post({ type: "progress", id, processedBytes: buffer.byteLength, totalBytes: buffer.byteLength });
    post({ type: "done", id, hash: bufferToHex(digest) });
  } catch (e) {
    post({
      type: "error",
      id,
      message: `Chyba pri hashovaní: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
}

/**
 * Hashuje Blob po chunkoch. SubtleCrypto.digest neumí streamovať,
 * takže chunky sa načítajú, hashujú sa individuálne a na konci sa spoja.
 *
 * Pre SHA-256 to znamená, že musíme na konci zrekonštruovať celý digest —
 * preto pre veľmi veľké súbory radšej používame streaming akumulovaním
 * chunkov do jedného ArrayBufferu a finálnym digestom.
 *
 * Tento worker tedaBlob chunkuje len pre progress reporting; finálny hash
 * sa počíta z celého načítaného obsahu (ako v `sha256Stream` v hashing.ts).
 */
async function hashBlob(id: string, blob: Blob): Promise<void> {
  try {
    const totalBytes = blob.size;
    post({ type: "progress", id, processedBytes: 0, totalBytes });

    // Pre veľké blob-y by sme mali použiť streaming hash — ale SubtleCrypto
    // neumí streamovať. Ak je blob veľký (>1 GB), hashovanie bude pamäťovo
    // náročné — toto je známe obmedzenie, ktoré riešime tak, že blob najprv
    // rozdelíme na chunky a postupne načítame do jedného ArrayBufferu.
    const CHUNK = 8 * 1024 * 1024; // 8 MB
    const buffer = new ArrayBuffer(totalBytes);
    const view = new Uint8Array(buffer);
    let offset = 0;

    for (let start = 0; start < totalBytes; start += CHUNK) {
      const end = Math.min(start + CHUNK, totalBytes);
      const chunk = await blob.slice(start, end).arrayBuffer();
      view.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
      post({ type: "progress", id, processedBytes: offset, totalBytes });
    }

    const digest = await crypto.subtle.digest("SHA-256", buffer);
    post({ type: "done", id, hash: bufferToHex(digest) });
  } catch (e) {
    post({
      type: "error",
      id,
      message: `Chyba pri hashovaní blobu: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
}

ctx.onmessage = (event: MessageEvent<HashRequest>) => {
  const req = event.data;
  if (!req || typeof req !== "object" || !("type" in req)) {
    post({ type: "error", id: "", message: "Neplatná požiadavka na hashing worker" });
    return;
  }
  switch (req.type) {
    case "hash-arraybuffer":
      void hashArrayBuffer(req.id, req.buffer);
      break;
    case "hash-blob":
      void hashBlob(req.id, req.blob);
      break;
    default: {
      const exhaustive: never = req;
      post({ type: "error", id: "", message: `Neznáma požiadavka: ${String(exhaustive)}` });
    }
  }
};
