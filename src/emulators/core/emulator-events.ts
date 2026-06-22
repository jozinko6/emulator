/**
 * Emulator events — typy udalostí + `createEmitter()` helper.
 *
 * Per prompt ETAPA 5 (Unified Emulator Core).
 *
 * `createEmitter()` vracia jednoduchý pub/sub objekt, ktorý používajú
 * všetky adaptéry (DosAdapter, Ps1Adapter, ...) na emitovanie
 * `EmulatorEvent` udalostí. UI sa môže cez `subscribe()` pripojiť.
 *
 * Komentáre v slovenčine.
 */
import type { EmulatorEvent } from "@/types/emulator";

export interface EmulatorEmitter {
  /** Vyšle udalosť všetkým subscriberom. */
  emit(event: EmulatorEvent): void;
  /** Zaregistruje subscribera. Vráti funkciu pre odregistrovanie. */
  subscribe(listener: (event: EmulatorEvent) => void): () => void;
  /** Zruší všetkých subscriberov (používa sa v `destroy()`). */
  clear(): void;
}

/**
 * Vytvorí nový emitter.
 *
 * Implementácia je zámerne jednoduchá — nepoužíva RxJS ani inú knižnicu,
 * aby sme mali minimálnu závislosť a plnú kontrolu nad lifecycle.
 */
export function createEmitter(): EmulatorEmitter {
  const listeners = new Set<(event: EmulatorEvent) => void>();
  let destroyed = false;

  return {
    emit(event: EmulatorEvent): void {
      if (destroyed) {
        console.warn("[emitter] emit() volané po destroy — udalosť zahodená");
        return;
      }
      // Kopírujeme set pred iteráciou — listener môže počas emit() odregistrovať.
      const snapshot = Array.from(listeners);
      for (const listener of snapshot) {
        try {
          listener(event);
        } catch (e) {
          // Chyba v jednom listeneri nesmie zlomiť ostatných.
          console.error("[emitter] listener vyhodil chybu:", e);
        }
      }
    },

    subscribe(listener: (event: EmulatorEvent) => void): () => void {
      if (destroyed) {
        console.warn("[emitter] subscribe() volané po destroy — listener nezaregistrovaný");
        return () => undefined;
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    clear(): void {
      destroyed = true;
      listeners.clear();
    },
  };
}

/**
 * Pomocná funkcia — vytvorí `EmulatorEvent` s aktuálnym timestampom.
 */
export function makeEvent<T>(
  type: EmulatorEvent["type"],
  payload?: T,
  error?: EmulatorEvent["error"]
): EmulatorEvent<T> {
  return {
    type,
    payload,
    timestamp: Date.now(),
    error,
  };
}
