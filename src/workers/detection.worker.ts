/**
 * Web Worker pre detekciu platformy hier.
 *
 * Per prompt ETAPA 4. Tento worker prijíma `DetectionRequest` a vracia
 * `DetectionResult` z reálneho `detectPlatform()` volania.
 *
 * Beží mimo hlavného vlákna, aby analýza veľkých ISO obrazov alebo
 * zložitých ZIP archívov neblokovala UI.
 *
 * Komentáre v slovenčine.
 */
import type { DetectionResult, DetectionInput } from "@/types/detection";
import { detectPlatform } from "@/lib/detection/platform-detector";
import { analyzeIso } from "@/lib/detection/iso-analyzer";

/// <reference lib="webworker" />

/**
 * V workery je `self` typu DedicatedWorkerGlobalScope, ale TypeScript lib.dom
 * ho deklaruje ako Window. Pre typovú bezpečnosť používame explicitný cast.
 */
interface WorkerContext {
  postMessage(message: DetectionResponse, transfer?: Transferable[]): void;
  onmessage: ((e: MessageEvent<DetectionRequest>) => void) | null;
}

const ctx = self as unknown as WorkerContext;

/**
 * Požiadavka na detekciu.
 *
 * Voliteľné pole `isoBytes` — ak je k dispozícii načítaný ISO obraz (pre
 * presnejšiu PS1/PS2 detekciu), worker ho analyzuje. Pre veľké ISO sa
 * odporúča poslať len hlavičku (prvých ~33 kB) namiesto celého súboru.
 */
export interface DetectionRequest {
  id: string;
  input: DetectionInput;
  /** Voliteľné — full ISO byty pre presnú analýzu PS1/PS2 indikátorov. */
  isoBytes?: Uint8Array;
}

export type DetectionResponse =
  | { type: "done"; id: string; result: DetectionResult }
  | { type: "error"; id: string; message: string };

/**
 * Spracuje požiadavku na detekciu.
 *
 * Ak je v `input.isoSystemIndicator` už vyplnené (poslal caller), použije sa.
 * Inak, ak je k dispozícii `isoBytes`, worker zavolá `analyzeIso` a výsledok
 * doplní do `input.isoSystemIndicator`.
 */
function handleDetect(req: DetectionRequest): DetectionResult {
  const input: DetectionInput = { ...req.input };

  // Ak caller neposkytol isoSystemIndicator ale poslal isoBytes, analyzujeme
  if (input.isoSystemIndicator == null && req.isoBytes && req.isoBytes.length > 0) {
    const isoResult = analyzeIso(req.isoBytes);
    if (isoResult.indicator) {
      input.isoSystemIndicator = isoResult.indicator;
      // Pridáme dôvody z ISO analýzy do `input` — detectPlatform ich nečíta
      // priamo, ale pridáme ich do výsledku neskôr.
    }
  }

  const result = detectPlatform(input);

  // Ak máme isoResult, pridáme jeho dôvody do výsledku (ak ešte nie sú)
  if (req.isoBytes && req.isoBytes.length > 0) {
    const isoResult = analyzeIso(req.isoBytes);
    if (isoResult.indicator) {
      const existingReasons = new Set(result.reasons);
      for (const r of isoResult.reasons) {
        if (!existingReasons.has(r)) {
          result.reasons.push(r);
        }
      }
    }
  }

  return result;
}

ctx.onmessage = (event: MessageEvent<DetectionRequest>) => {
  const req = event.data;
  if (!req || typeof req !== "object" || !("id" in req)) {
    ctx.postMessage({
      type: "error",
      id: "",
      message: "Neplatná požiadavka na detection worker",
    } satisfies DetectionResponse);
    return;
  }

  try {
    const result = handleDetect(req);
    ctx.postMessage({ type: "done", id: req.id, result } satisfies DetectionResponse);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[detection.worker] chyba pri detekcii:", e);
    ctx.postMessage({
      type: "error",
      id: req.id,
      message: `Chyba pri detekcii: ${message}`,
    } satisfies DetectionResponse);
  }
};
