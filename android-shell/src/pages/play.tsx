import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
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
import { Slider } from "@/components/ui/slider";
import type { GameRecord } from "@/types/game";
import type { EmulatorAdapter, EmulatorEvent, ImportedGame } from "@/types/emulator";
import { RetroCloudError } from "@/types/errors";
import { useEmulatorStore } from "@/stores/emulator-store";
import { useSettingsStore } from "@/stores/settings-store";
import { VirtualGamepad } from "@/components/controls/virtual-gamepad";
import { DosTouchpad } from "@/components/controls/dos-touchpad";

/**
 * Android shell play page — uses hash routing.
 *
 * Lifecycle:
 * 1. Load game metadata + files from IndexedDB
 * 2. Create adapter via createAdapter(platform)
 * 3. initialize(container) → loadGame(imported) → start() (returns immediately)
 * 4. wait for "started" event
 * 5. loadState(slot) if requested
 * 6. Hook up keyboard/mouse/gamepad input bridges
 * 7. Autosave interval + visibility/appStateChange listeners
 * 8. destroy() on unmount
 */
export function PlayPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const freshStart = searchParams?.get("fresh") === "1";

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
  const [savingState, setSavingState] = useState(false);

  const setEmulatorState = useEmulatorStore((s) => s.setState);
  const setEmulatorActive = useEmulatorStore((s) => s.setActive);
  const setEmulatorError = useEmulatorStore((s) => s.setError);
  const emulatorReset = useEmulatorStore((s) => s.reset);

  useEffect(() => {
    if (!id) return;
    let destroyed = false;
    let cleanupFn: (() => Promise<void>) | undefined;

    async function init(): Promise<(() => Promise<void>) | undefined> {
      try {
        const { getGame, getGameFiles, putPlaySession, getSaveStates } = await import("@/lib/storage/repositories");
        const { isPs2Available } = await import("@/emulators/ps2/ps2-availability");
        const { createAdapter } = await import("@/emulators/core/emulator-factory");

        const g = await getGame(id);
        if (!g) {
          setError("Hra sa nenašla.");
          setLoading(false);
          return undefined;
        }
        setGame(g);

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
          files: files.map((f) => ({
            relativePath: f.relativePath,
            size: f.size,
            opfsPath: f.opfsPath,
            hash: f.hash,
          })),
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
            setLoading(false);

            // Load save state AFTER start (unless fresh start requested)
            if (!freshStart) {
              void (async () => {
                try {
                  const saves = await getSaveStates(g.id);
                  const manual = saves.find((s) => s.slot === 1);
                  const auto = saves.find((s) => s.slot === 0);
                  const toLoad = manual ?? auto;
                  if (toLoad) {
                    await adapter.loadState(toLoad.slot);
                  }
                } catch (e) {
                  console.warn("Failed to load save state:", e);
                  setError("Uloženie sa nepodarilo načítať. Hra bola spustená od začiatku.");
                  setTimeout(() => setError(null), 4000);
                }
              })();
            }
          } else if (event.type === "paused") {
            setEmulatorState("paused");
          } else if (event.type === "resumed") {
            setEmulatorState("running");
          }
        });

        if (!containerRef.current) return undefined;

        await adapter.initialize(containerRef.current);
        await adapter.loadGame(imported);
        // start() returns immediately — emulator continues running asynchronously
        await adapter.start();
        setEmulatorActive(g.platform, g.id);

        // Record play session
        const sessionId = crypto.randomUUID();
        const startedAt = Date.now();
        await putPlaySession({
          id: sessionId,
          gameId: g.id,
          startedAt,
          durationSeconds: 0,
        });

        // Autosave interval (90s)
        const settings = useSettingsStore.getState();
        const autoSaveInterval = settings.isAutoSave(g.platform)
          ? setInterval(async () => {
              try {
                setSavingState(true);
                await adapter.saveState(0); // slot 0 = auto-save
              } catch (e) {
                console.warn("Autosave failed:", e);
              } finally {
                setSavingState(false);
              }
            }, 90_000)
          : null;

        // Visibility change — autosave when tab hidden
        const onVisibility = () => {
          if (document.hidden) {
            adapter.pause().catch(() => {
              /* pause may fail if already paused */
            });
            if (settings.isAutoSave(g.platform)) {
              adapter.saveState(0).catch((e) => console.warn("Visibility autosave failed:", e));
            }
          }
        };
        document.addEventListener("visibilitychange", onVisibility);

        // Capacitor appStateChange — autosave on background
        let appStateListener: { remove: () => void } | null = null;
        try {
          const { App: CapacitorApp } = await import("@capacitor/app");
          appStateListener = await CapacitorApp.addListener("appStateChange", ({ isActive }) => {
            if (!isActive) {
              if (settings.isAutoSave(g.platform)) {
                adapter.saveState(0).catch((e) => console.warn("App background autosave failed:", e));
              }
            }
          });
        } catch {
          /* Capacitor App plugin not available on web */
        }

        return async () => {
          if (autoSaveInterval) clearInterval(autoSaveInterval);
          document.removeEventListener("visibilitychange", onVisibility);
          if (appStateListener) {
            appStateListener.remove();
            appStateListener = null;
          }

          const endedAt = Date.now();
          const durationSeconds = Math.floor((endedAt - startedAt) / 1000);
          try {
            const settingsNow = useSettingsStore.getState();
            if (settingsNow.isAutoSave(g.platform)) {
              await adapter.saveState(0);
            }
            await putPlaySession({
              id: sessionId,
              gameId: g.id,
              startedAt,
              endedAt,
              durationSeconds,
            });
            await adapter.destroy();
          } catch (e) {
            console.warn("Cleanup failed:", e);
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
          cleanup().catch((e) => console.warn("Cleanup error:", e));
        }
      });
    };
  }, [id, freshStart, setEmulatorState, setEmulatorActive, setEmulatorError, emulatorReset]);

  // Auto-hide controls
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
    // Autosave before reset
    try {
      await adapterRef.current?.saveState(0);
    } catch (e) {
      console.warn("Pre-reset autosave failed:", e);
    }
    await adapterRef.current?.reset();
  };

  const handleSave = async () => {
    try {
      setSavingState(true);
      await adapterRef.current?.saveState(1); // slot 1 = manual
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingState(false);
    }
  };

  const handleLoad = async () => {
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
    navigate(game ? `/game/${game.id}` : "/library");
  };

  if (isPs2Disabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md p-6 text-center">
          <AlertCircle className="h-10 w-10 text-fuchsia-400 mx-auto mb-3" />
          <h1 className="font-display text-lg text-primary mb-2">PS2 nedostupné</h1>
          <p className="text-sm text-muted-foreground mb-4">
            PS2 emulačné jadro zatiaľ nie je v tomto zostavení dostupné.
          </p>
          <Button onClick={() => navigate("/library")}>Späť na knižnicu</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col no-select">
      <div
        className={`absolute top-0 left-0 right-0 z-20 transition-opacity ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-2 p-3 bg-gradient-to-b from-background to-transparent">
          <Button variant="ghost" size="sm" className="text-foreground hover:bg-secondary/50" onClick={handleExit}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Ukončiť
          </Button>
          <span className="text-sm font-medium truncate">{game?.name ?? "Načítavam…"}</span>
          {savingState && (
            <span className="text-xs text-primary flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Ukladám…
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handleFullscreen}>
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <div ref={containerRef} className="absolute inset-0 rc-crt" />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Načítavam emulátor…</p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90 p-4">
            <Card className="max-w-md p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-destructive shrink-0" />
                <div>
                  <p className="font-medium">Chyba emulátora</p>
                  <p className="text-sm text-muted-foreground mt-1">{error}</p>
                  <div className="flex gap-2 mt-4">
                    <Button onClick={() => window.location.reload()}>Skúsiť znova</Button>
                    <Button variant="outline" onClick={handleExit}>
                      <X className="h-4 w-4 mr-1" />
                      Späť
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {!loading && !error && game && (
          <>
            {game.platform === "dos" ? (
              <DosTouchpad onInput={(e) => adapterRef.current?.sendInput(e)} />
            ) : (
              <VirtualGamepad onInput={(e) => adapterRef.current?.sendInput(e)} />
            )}
          </>
        )}
      </div>

      <div
        className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="bg-gradient-to-t from-background to-transparent p-3">
          <div className="flex items-center gap-2 max-w-3xl mx-auto">
            <Button variant="ghost" size="icon" title="Pauza/Pokračovať" onClick={handlePause}>
              <Pause className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" title="Reset" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" title="Uložiť" onClick={handleSave}>
              <Save className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" title="Načítať" onClick={handleLoad}>
              <Download className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1 ml-2">
              <Button variant="ghost" size="icon" onClick={handleMute}>
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
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
