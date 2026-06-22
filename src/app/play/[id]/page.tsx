"use client";

import { useEffect, useRef, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Save,
  Download,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import type { GameRecord } from "@/types/game";
import type { EmulatorAdapter, EmulatorEvent, ImportedGame } from "@/types/emulator";
import { RetroCloudError } from "@/types/errors";
import { useEmulatorStore } from "@/stores/emulator-store";
import { useSettingsStore } from "@/stores/settings-store";
import { VirtualGamepad } from "@/components/controls/virtual-gamepad";
import { DosTouchpad } from "@/components/controls/dos-touchpad";

export default function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const loadSlot = searchParams?.get("slot");

  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<EmulatorAdapter | null>(null);
  const [game, setGame] = useState<GameRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPs2Disabled, setIsPs2Disabled] = useState(false);

  const setEmulatorState = useEmulatorStore((s) => s.setState);
  const setEmulatorActive = useEmulatorStore((s) => s.setActive);
  const setEmulatorError = useEmulatorStore((s) => s.setError);
  const emulatorReset = useEmulatorStore((s) => s.reset);

  useEffect(() => {
    let destroyed = false;

    async function init(): Promise<(() => Promise<void>) | undefined> {
      try {
        const { getGame, getGameFiles, putPlaySession } = await import("@/lib/storage/repositories");
        const { isPs2Available } = await import("@/emulators/ps2/ps2-availability");
        const { createAdapter } = await import("@/emulators/core/emulator-factory");

        const g = await getGame(id);
        if (!g) {
          setError("Hra sa nenašla.");
          setLoading(false);
          return undefined;
        }
        setGame(g);

        // PS2 gate
        if (g.platform === "ps2" && !isPs2Available()) {
          setIsPs2Disabled(true);
          setLoading(false);
          return undefined;
        }

        const files = await getGameFiles(id);
        const imported: ImportedGame = {
          id: g.id,
          platform: g.platform,
          name: g.name,
          mainFile: g.mainFile,
          files: await Promise.all(
            files.map(async (f) => ({
              relativePath: f.relativePath,
              size: f.size,
              opfsPath: f.opfsPath,
              hash: f.hash,
            }))
          ),
          sourceType: g.sourceType as ImportedGame["sourceType"],
          sourceReference: g.sourceReference,
          createdAt: g.createdAt,
        };

        const adapter = await createAdapter(g.platform);
        adapterRef.current = adapter;

        adapter.subscribe((event: EmulatorEvent) => {
          if (destroyed) return;
          if (event.type === "error") {
            setError(event.error?.message ?? "Neznáma chyba emulátora");
            setEmulatorError(event.error?.message ?? "Neznáma chyba");
          } else if (event.type === "started") {
            setEmulatorState("running");
          } else if (event.type === "paused") {
            setEmulatorState("paused");
          } else if (event.type === "resumed") {
            setEmulatorState("running");
          }
        });

        if (!containerRef.current) return undefined;

        await adapter.initialize(containerRef.current);
        await adapter.loadGame(imported);

        if (loadSlot) {
          try {
            await adapter.loadState(parseInt(loadSlot, 10));
          } catch {}
        }

        await adapter.start();
        setEmulatorActive(g.platform, g.id);
        setLoading(false);

        // Record play session
        const sessionId = crypto.randomUUID();
        const startedAt = Date.now();
        await putPlaySession({
          id: sessionId,
          gameId: g.id,
          startedAt,
          durationSeconds: 0,
          saveStateSlotUsed: loadSlot ? parseInt(loadSlot, 10) : undefined,
        });

        // Return cleanup function
        return async () => {
          const endedAt = Date.now();
          const durationSeconds = Math.floor((endedAt - startedAt) / 1000);
          try {
            const settings = useSettingsStore.getState();
            if (settings.isAutoSave(g.platform)) {
              await adapter.saveState(0); // slot 0 = auto-save
            }
            await putPlaySession({
              id: sessionId,
              gameId: g.id,
              startedAt,
              endedAt,
              durationSeconds,
            });
            await adapter.destroy();
          } catch {
            // Logged via adapter subscribe — avoid silent retry loop
          }
          adapterRef.current = null;
          emulatorReset();
        };
      } catch (e) {
        if (destroyed) return undefined;
        const message = e instanceof RetroCloudError ? e.toUserFacing().title : String(e);
        setError(message);
        setEmulatorError(message);
        setLoading(false);
        return undefined;
      }
    }

    const cleanupPromise = init();
    return () => {
      destroyed = true;
      cleanupPromise.then((cleanup) => {
        if (typeof cleanup === "function") {
          cleanup().catch(() => {});
        }
      });
    };
     
  }, [id]);

  // Auto-hide controls after 3s of inactivity
  useEffect(() => {
    if (loading || error) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      setShowControls(true);
      clearTimeout(timer);
      timer = setTimeout(() => setShowControls(false), 3000);
    };
    reset();
    const el = containerRef.current;
    if (el) {
      el.addEventListener("pointermove", reset);
      el.addEventListener("pointerdown", reset);
    }
    return () => {
      clearTimeout(timer);
      if (el) {
        el.removeEventListener("pointermove", reset);
        el.removeEventListener("pointerdown", reset);
      }
    };
  }, [loading, error]);

  // Fullscreen tracking
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const handleVolume = (v: number) => {
    setVolume(v);
    adapterRef.current?.setVolume(v);
  };

  const handleMute = () => {
    const next = !muted;
    setMuted(next);
    adapterRef.current?.setMuted(next);
  };

  const handlePause = async () => {
    const a = adapterRef.current;
    if (!a) return;
    if (a.state === "running") await a.pause();
    else if (a.state === "paused") await a.resume();
  };

  const handleReset = async () => {
    await adapterRef.current?.reset();
  };

  const handleSaveState = async () => {
    try {
      await adapterRef.current?.saveState(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleLoadState = async () => {
    try {
      await adapterRef.current?.loadState(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen?.();
    } else {
      await document.exitFullscreen();
    }
  };

  const handleExit = () => {
    router.push(game ? `/game/${game.id}` : "/library");
  };

  // PS2 disabled state
  if (isPs2Disabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md p-6 text-center">
          <AlertCircle className="h-10 w-10 text-fuchsia-400 mx-auto mb-3" />
          <h1 className="font-display text-lg text-primary mb-2">
            PS2 nedostupné
          </h1>
          <p className="text-sm text-muted-foreground mb-4">
            PS2 emulačné jadro zatiaľ nie je v tomto zostavení dostupné.
            Aktivujte ho nastavením NEXT_PUBLIC_ENABLE_PS2=true.
          </p>
          <Button asChild>
            <a href="/library">Späť na knižnicu</a>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col no-select">
      {/* Top bar */}
      <div
        className={`absolute top-0 left-0 right-0 z-20 transition-opacity ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-2 p-3 bg-gradient-to-b from-background to-transparent">
          <Button asChild variant="ghost" size="sm" className="text-foreground hover:bg-secondary/50">
            <button onClick={handleExit}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Ukončiť
            </button>
          </Button>
          <span className="text-sm font-medium truncate">{game?.name ?? "Načítavam…"}</span>
          <div className="ml-auto flex items-center gap-1">
            <Button asChild variant="ghost" size="icon">
              <button onClick={handleFullscreen}>
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </button>
            </Button>
          </div>
        </div>
      </div>

      {/* Emulator container */}
      <div className="flex-1 relative overflow-hidden">
        <div ref={containerRef} className="absolute inset-0 rc-crt" />

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Načítavam emulátor…</p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90 p-4">
            <Card className="max-w-md p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-destructive shrink-0" />
                <div>
                  <p className="font-medium">Chyba emulátora</p>
                  <p className="text-sm text-muted-foreground mt-1">{error}</p>
                  <div className="flex gap-2 mt-4">
                    <Button asChild>
                      <button onClick={() => window.location.reload()}>Skúsiť znova</button>
                    </Button>
                    <Button asChild variant="outline">
                      <button onClick={handleExit}>
                        <X className="h-4 w-4 mr-1" />
                        Späť
                      </button>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Virtual gamepad overlay (only when not loading/error and touch device) */}
        {!loading && !error && game && (
          <>
            {game.platform === "dos" ? (
              <DosTouchpad
                onInput={(e) => adapterRef.current?.sendInput(e)}
              />
            ) : (
              <VirtualGamepad
                onInput={(e) => adapterRef.current?.sendInput(e)}
              />
            )}
          </>
        )}
      </div>

      {/* Bottom controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="bg-gradient-to-t from-background to-transparent p-3">
          <div className="flex items-center gap-2 max-w-3xl mx-auto">
            <Button asChild variant="ghost" size="icon" title="Pauza/Pokračovať">
              <button onClick={handlePause}>
                <Pause className="h-4 w-4" />
              </button>
            </Button>
            <Button asChild variant="ghost" size="icon" title="Reset">
              <button onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
              </button>
            </Button>
            <Button asChild variant="ghost" size="icon" title="Uložiť (Slot 1)">
              <button onClick={handleSaveState}>
                <Save className="h-4 w-4" />
              </button>
            </Button>
            <Button asChild variant="ghost" size="icon" title="Načítať (Slot 1)">
              <button onClick={handleLoadState}>
                <Download className="h-4 w-4" />
              </button>
            </Button>

            <div className="flex items-center gap-1 ml-2">
              <Button asChild variant="ghost" size="icon" onClick={handleMute}>
                <button>
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              </Button>
              <Slider
                value={[volume]}
                onValueChange={(v) => handleVolume(v[0] ?? 0)}
                max={1}
                step={0.05}
                className="w-24"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
