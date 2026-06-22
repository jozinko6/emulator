"use client";

/**
 * EmulatorCanvas — container, ktorý prijíma EmulatorAdapter a renderuje
 * plátno / iframe s emulátorom.
 *
 * Per prompt ETAPA 9. Lifecykly:
 *  - mount: `adapter.initialize(container)` → `loadGame(game)` → `start()`
 *  - unmount: `adapter.destroy()`
 *  - error: zobrazí `<ErrorOverlay>`
 *
 * Komentáre v slovenčine.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type {
  EmulatorAdapter,
  EmulatorEvent,
  EmulatorLifecycleState,
  ImportedGame,
} from "@/types/emulator";
import type { GameRecord } from "@/types/game";
import { cn } from "@/lib/utils";
import { LoadingOverlay } from "./loading-overlay";
import { ErrorOverlay } from "./error-overlay";
import { isRetroCloudError } from "@/lib/errors-helpers";

export interface EmulatorCanvasHandle {
  getContainer: () => HTMLDivElement | null;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  saveState: (slot: number) => Promise<void>;
  loadState: (slot: number) => Promise<void>;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  reset: () => Promise<void>;
  enterFullscreen: () => Promise<void>;
}

interface EmulatorCanvasProps {
  adapter: EmulatorAdapter;
  game: GameRecord;
  volume: number;
  muted: boolean;
  onEvent?: (event: EmulatorEvent) => void;
  onStateChange?: (state: EmulatorLifecycleState) => void;
}

export const EmulatorCanvas = forwardRef<EmulatorCanvasHandle, EmulatorCanvasProps>(
  function EmulatorCanvas({ adapter, game, volume, muted, onEvent, onStateChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<unknown>(null);
    const [state, setState] = useState<EmulatorLifecycleState>(adapter.state);

    useImperativeHandle(
      ref,
      (): EmulatorCanvasHandle => ({
        getContainer: () => containerRef.current,
        pause: async () => {
          try {
            await adapter.pause();
          } catch (e) {
            console.warn("[emulator-canvas] pause zlyhal:", e);
          }
        },
        resume: async () => {
          try {
            await adapter.resume();
          } catch (e) {
            console.warn("[emulator-canvas] resume zlyhal:", e);
          }
        },
        saveState: async (slot) => {
          try {
            await adapter.saveState(slot);
          } catch (e) {
            console.warn("[emulator-canvas] saveState zlyhal:", e);
          }
        },
        loadState: async (slot) => {
          try {
            await adapter.loadState(slot);
          } catch (e) {
            console.warn("[emulator-canvas] loadState zlyhal:", e);
          }
        },
        setVolume: (v) => adapter.setVolume(v),
        setMuted: (m) => adapter.setMuted(m),
        reset: async () => {
          try {
            await adapter.reset();
          } catch (e) {
            console.warn("[emulator-canvas] reset zlyhal:", e);
          }
        },
        enterFullscreen: async () => {
          try {
            await adapter.enterFullscreen();
          } catch (e) {
            console.warn("[emulator-canvas] enterFullscreen zlyhal:", e);
          }
        },
      }),
      [adapter]
    );

    // Subscribe na udalosti adaptéra.
    useEffect(() => {
      const unsub = adapter.subscribe((event) => {
        onEvent?.(event);
        if (event.type === "error" && event.error) {
          setError(new Error(`${event.error.code}: ${event.error.message}`));
        }
        if (event.type === "destroyed") {
          setState("destroyed");
        }
      });
      return unsub;
    }, [adapter, onEvent]);

    // Propagate state changes.
    useEffect(() => {
      onStateChange?.(state);
    }, [state, onStateChange]);

    // Initial mount: initialize + loadGame + start.
    useEffect(() => {
      let destroyed = false;
      const container = containerRef.current;
      if (!container) return;

      setLoading(true);
      setError(null);

      (async () => {
        try {
          setState("initializing");
          await adapter.initialize(container);
          if (destroyed) return;

          setState("loading");
          const imported: ImportedGame = {
            id: game.id,
            platform: game.platform,
            name: game.name,
            mainFile: game.mainFile,
            files: [],
            sourceType: game.sourceType as ImportedGame["sourceType"],
            sourceReference: game.sourceReference,
            createdAt: game.createdAt,
          };
          await adapter.loadGame(imported);
          if (destroyed) return;

          adapter.setVolume(volume);
          adapter.setMuted(muted);

          await adapter.start();
          if (destroyed) return;

          setState("running");
          setLoading(false);
        } catch (e) {
          if (destroyed) return;
          console.error("[emulator-canvas] inicializácia zlyhala:", e);
          setError(e);
          setState("error");
          setLoading(false);
        }
      })();

      return () => {
        destroyed = true;
        // destroy sa volá z parent (play page), nie tu — necháme parent
        // rozhodnúť o časovaní (napr. auto-save pred destroy).
      };
       
    }, [adapter, game.id]);

    // Propagate volume/muted zmeny.
    useEffect(() => {
      adapter.setVolume(volume);
    }, [adapter, volume]);
    useEffect(() => {
      adapter.setMuted(muted);
    }, [adapter, muted]);

    const handleRetry = () => {
      setError(null);
      setLoading(true);
      // Re-init: Najjednoduchší spôsob — znova destroy + re-mount.
      // Tu zveríme zodpovednosť parentovi tým, že simulujeme route change.
      adapter
        .destroy()
        .then(() => setState("idle"))
        .catch((e: unknown) => console.warn("[emulator-canvas] retry destroy zlyhal:", e));
    };

    return (
      <div
        className={cn(
          "rc-crt relative h-full w-full overflow-hidden rounded-md bg-black",
          state === "running" && "no-select"
        )}
        ref={containerRef}
        role="region"
        aria-label={`Emulátor ${game.name}`}
      >
        {/* Container sa naplní DOM-om z adaptéra (canvas, iframe, ...). */}

        {loading && <LoadingOverlay />}

        {error != null && (
          <ErrorOverlay
            error={error}
            onRetry={isRetroCloudError(error) ? undefined : handleRetry}
          />
        )}
      </div>
    );
  }
);
