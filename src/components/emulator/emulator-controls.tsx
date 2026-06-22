"use client";

/**
 * EmulatorControls — overlay panely (horný + spodný).
 *
 * Per prompt ETAPA 9:
 *  - Horný panel: názov hry, pause, fullscreen, exit
 *  - Spodný panel: save/load, hlasitosť, mute, reset
 *  - Panely sa počas hrania automaticky skryjú (po 3s nečinnosti)
 *
 * Komentáre v slovenčine.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pause,
  Play,
  Maximize,
  Minimize,
  X,
  Save,
  Upload,
  Volume2,
  VolumeX,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface EmulatorControlsProps {
  gameName: string;
  paused: boolean;
  muted: boolean;
  volume: number;
  fullscreen: boolean;
  onPauseToggle: () => void;
  onExit: () => void;
  onToggleFullscreen: () => void;
  onSave: () => void;
  onLoad: () => void;
  onReset: () => void;
  onVolumeChange: (v: number) => void;
  onMuteToggle: () => void;
}

const AUTO_HIDE_MS = 3000;

export function EmulatorControls(props: EmulatorControlsProps) {
  const [visible, setVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showAndScheduleHide = useCallback(() => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setVisible(false);
    }, AUTO_HIDE_MS);
  }, []);

  useEffect(() => {
    showAndScheduleHide();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [showAndScheduleHide]);

  // Kedykoľvek zmeníme paused/fullscreen — reset hide timer.
  useEffect(() => {
    showAndScheduleHide();
  }, [props.paused, props.fullscreen, showAndScheduleHide]);

  const handleMouseMove = useCallback(() => {
    showAndScheduleHide();
  }, [showAndScheduleHide]);

  const handleTouch = useCallback(() => {
    showAndScheduleHide();
  }, [showAndScheduleHide]);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10"
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouch}
    >
      {/* Top bar */}
      <div
        className={cn(
          "pointer-events-auto absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/80 to-transparent px-3 py-2 transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0"
        )}
        style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={props.onExit}
          aria-label="Ukončiť hru"
          className="text-white hover:bg-white/10 hover:text-white"
        >
          <X className="size-5" aria-hidden="true" />
        </Button>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-white" title={props.gameName}>
          {props.gameName}
        </p>
        <Button
          variant="ghost"
          size="icon"
          onClick={props.onPauseToggle}
          aria-label={props.paused ? "Pokračovať" : "Pauza"}
          className="text-white hover:bg-white/10 hover:text-white"
        >
          {props.paused ? (
            <Play className="size-5" aria-hidden="true" />
          ) : (
            <Pause className="size-5" aria-hidden="true" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={props.onToggleFullscreen}
          aria-label={props.fullscreen ? "Ukončiť celú obrazovku" : "Celá obrazovka"}
          className="text-white hover:bg-white/10 hover:text-white"
        >
          {props.fullscreen ? (
            <Minimize className="size-5" aria-hidden="true" />
          ) : (
            <Maximize className="size-5" aria-hidden="true" />
          )}
        </Button>
      </div>

      {/* Bottom bar */}
      <div
        className={cn(
          "pointer-events-auto absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0"
        )}
        style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={props.onSave}
          className="text-white hover:bg-white/10 hover:text-white"
          aria-label="Uložiť save state"
        >
          <Save className="size-4" aria-hidden="true" />
          Save
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={props.onLoad}
          className="text-white hover:bg-white/10 hover:text-white"
          aria-label="Načítať save state"
        >
          <Upload className="size-4" aria-hidden="true" />
          Load
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={props.onReset}
          aria-label="Reset hry"
          className="text-white hover:bg-white/10 hover:text-white"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={props.onMuteToggle}
            aria-label={props.muted ? "Zapnúť zvuk" : "Vypnúť zvuk"}
            className="text-white hover:bg-white/10 hover:text-white"
          >
            {props.muted ? (
              <VolumeX className="size-4" aria-hidden="true" />
            ) : (
              <Volume2 className="size-4" aria-hidden="true" />
            )}
          </Button>
          <div className="w-20 sm:w-28">
            <Slider
              value={[props.volume]}
              min={0}
              max={1}
              step={0.01}
              disabled={props.muted}
              onValueChange={(v) => props.onVolumeChange(v[0] ?? 0.8)}
              aria-label="Hlasitosť"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
