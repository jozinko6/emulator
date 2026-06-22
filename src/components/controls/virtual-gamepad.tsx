"use client";

/**
 * VirtualGamepad — PS1/PS2 touch gamepad pre mobilné zariadenia.
 *
 * Per prompt ETAPA 7. Poskytuje:
 *  - D-pad (4 smery)
 *  - Dva analógy (ľavý, pravý)
 *  - 4 face tlačidlá (Triangle, Circle, Cross, Square)
 *  - L1/L2/R1/R2
 *  - Start/Select
 *  - L3/R3
 *
 * Pointer Events, multitouch, pointer capture, haptická odozva
 * (navigator.vibrate), zabránenie scrollovaniu a zoomu (touch-action: none).
 *
 * Nastaviteľná veľkosť a priehľadnosť z props.
 *
 * Posiela `EmulatorInputEvent` cez props `onInput`.
 *
 * Komentáre v slovenčine.
 */
import { useCallback, useRef } from "react";
import type { EmulatorInputEvent } from "@/types/emulator";

interface VirtualGamepadProps {
  /** Callback pre vstupné eventy. */
  onInput: (event: EmulatorInputEvent) => void;
  /** Relatívna veľkosť (1.0 = default). Default 1.0. */
  size?: number;
  /** Priehľadnosť (0..1). Default 0.85. */
  opacity?: number;
  /** Zapnutá haptická odozva. Default true. */
  haptics?: boolean;
  /** Skryť analógy (ak hra nepoužíva). Default false. */
  hideSticks?: boolean;
  /** CSS class pre celý gamepad. */
  className?: string;
}

/**
 * Toast vibration — krátka odozva pri stlačení tlačidla.
 */
function vibrate(enabled: boolean, duration = 10): void {
  if (!enabled) return;
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  try {
    navigator.vibrate(duration);
  } catch {
    // vibration may be denied
  }
}

/**
 * Vytvorí EmulatorInputEvent pre button down/up.
 */
function makeButtonEventFn(
  control: string,
  pressed: boolean
): EmulatorInputEvent {
  return {
    type: pressed ? "button-down" : "button-up",
    control,
    value: pressed ? 1 : 0,
    timestamp: Date.now(),
  };
}

/**
 * Vytvorí EmulatorInputEvent pre zmenu osi.
 */
function makeAxisEventFn(
  control: string,
  value: number
): EmulatorInputEvent {
  return {
    type: "axis",
    control,
    value,
    timestamp: Date.now(),
  };
}

export function VirtualGamepad({
  onInput,
  size = 1.0,
  opacity = 0.85,
  haptics = true,
  hideSticks = false,
  className,
}: VirtualGamepadProps) {
  // Ref na aktuálne stavy tlačidiel — pre správny pointer capture
  const dpadActivePointer = useRef<number | null>(null);
  const dpadActiveButton = useRef<string | null>(null);
  const lstickPointer = useRef<number | null>(null);
  const rstickPointer = useRef<number | null>(null);
  const lstickBase = useRef<{ x: number; y: number } | null>(null);
  const rstickBase = useRef<{ x: number; y: number } | null>(null);

  /**
   * Handler pre D-pad button — pointer down/up.
   */
  const handleDpadButton = useCallback(
    (control: string, e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      // Iba jeden pointer na D-pad súčasne (multitouch podpora)
      if (e.type === "pointerdown") {
        if (dpadActivePointer.current !== null) return;
        dpadActivePointer.current = e.pointerId;
        dpadActiveButton.current = control;
        (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
        onInput(makeButtonEventFn(control, true));
        vibrate(haptics);
      } else if (e.type === "pointerup" || e.type === "pointercancel" || e.type === "pointerleave") {
        if (dpadActivePointer.current !== e.pointerId) return;
        const activeButton = dpadActiveButton.current;
        if (activeButton) {
          onInput(makeButtonEventFn(activeButton, false));
        }
        dpadActivePointer.current = null;
        dpadActiveButton.current = null;
        try {
          (e.currentTarget as HTMLButtonElement).releasePointerCapture(e.pointerId);
        } catch {
          // pointer capture might be already released
        }
      }
    },
    [haptics, onInput]
  );

  /**
   * Handler pre face button / shoulder button — pointer down/up.
   */
  const handleButton = useCallback(
    (control: string, e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (e.type === "pointerdown") {
        (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
        onInput(makeButtonEventFn(control, true));
        vibrate(haptics);
      } else if (e.type === "pointerup" || e.type === "pointercancel" || e.type === "pointerleave") {
        onInput(makeButtonEventFn(control, false));
        try {
          (e.currentTarget as HTMLButtonElement).releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
    },
    [haptics, onInput]
  );

  /**
   * Handler pre analóg stick — pointer down/move/up.
   */
  const handleStick = useCallback(
    (side: "left" | "right", e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const pointerRef = side === "left" ? lstickPointer : rstickPointer;
      const baseRef = side === "left" ? lstickBase : rstickBase;
      const axisX = side === "left" ? "lstick-x" : "rstick-x";
      const axisY = side === "left" ? "lstick-y" : "rstick-y";

      if (e.type === "pointerdown") {
        if (pointerRef.current !== null) return;
        pointerRef.current = e.pointerId;
        baseRef.current = { x: e.clientX, y: e.clientY };
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        onInput(makeAxisEventFn(axisX, 0));
        onInput(makeAxisEventFn(axisY, 0));
        return;
      }

      if (e.type === "pointermove") {
        if (pointerRef.current !== e.pointerId || !baseRef.current) return;
        const dx = e.clientX - baseRef.current.x;
        const dy = e.clientY - baseRef.current.y;
        const maxRadius = 40; // px
        const normX = Math.max(-1, Math.min(1, dx / maxRadius));
        const normY = Math.max(-1, Math.min(1, dy / maxRadius));
        onInput(makeAxisEventFn(axisX, normX));
        onInput(makeAxisEventFn(axisY, normY));
        return;
      }

      if (e.type === "pointerup" || e.type === "pointercancel" || e.type === "pointerleave") {
        if (pointerRef.current !== e.pointerId) return;
        onInput(makeAxisEventFn(axisX, 0));
        onInput(makeAxisEventFn(axisY, 0));
        pointerRef.current = null;
        baseRef.current = null;
        try {
          (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
    },
    [onInput]
  );

  // Škálovanie podľa `size`
  const buttonSize = `${56 * size}px`;
  const stickSize = `${80 * size}px`;

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-4 ${className ?? ""}`}
      style={{ opacity }}
      aria-hidden="false"
      role="group"
      aria-label="Virtuálny gamepad"
    >
      {/* Top row — shoulder buttons */}
      <div className="flex justify-between px-4 pt-2">
        <div className="pointer-events-auto flex gap-2">
          <ShoulderButton
            label="L2"
            onPointerDown={(e) => handleButton("l2", e)}
            onPointerUp={(e) => handleButton("l2", e)}
            onPointerLeave={(e) => handleButton("l2", e)}
            onPointerCancel={(e) => handleButton("l2", e)}
            size={size}
          />
          <ShoulderButton
            label="L1"
            onPointerDown={(e) => handleButton("l1", e)}
            onPointerUp={(e) => handleButton("l1", e)}
            onPointerLeave={(e) => handleButton("l1", e)}
            onPointerCancel={(e) => handleButton("l1", e)}
            size={size}
          />
        </div>
        <div className="pointer-events-auto flex gap-2">
          <ShoulderButton
            label="R1"
            onPointerDown={(e) => handleButton("r1", e)}
            onPointerUp={(e) => handleButton("r1", e)}
            onPointerLeave={(e) => handleButton("r1", e)}
            onPointerCancel={(e) => handleButton("r1", e)}
            size={size}
          />
          <ShoulderButton
            label="R2"
            onPointerDown={(e) => handleButton("r2", e)}
            onPointerUp={(e) => handleButton("r2", e)}
            onPointerLeave={(e) => handleButton("r2", e)}
            onPointerCancel={(e) => handleButton("r2", e)}
            size={size}
          />
        </div>
      </div>

      {/* Middle row — sticks */}
      {!hideSticks && (
        <div className="flex justify-between px-8">
          <AnalogStick
            label="L"
            size={stickSize}
            onPointerDown={(e) => handleStick("left", e)}
            onPointerMove={(e) => handleStick("left", e)}
            onPointerUp={(e) => handleStick("left", e)}
            onPointerLeave={(e) => handleStick("left", e)}
            onPointerCancel={(e) => handleStick("left", e)}
            onDoubleClick={() => onInput(makeButtonEventFn("l3", true))}
          />
          <AnalogStick
            label="R"
            size={stickSize}
            onPointerDown={(e) => handleStick("right", e)}
            onPointerMove={(e) => handleStick("right", e)}
            onPointerUp={(e) => handleStick("right", e)}
            onPointerLeave={(e) => handleStick("right", e)}
            onPointerCancel={(e) => handleStick("right", e)}
            onDoubleClick={() => onInput(makeButtonEventFn("r3", true))}
          />
        </div>
      )}

      {/* Bottom row — D-pad + face buttons + Start/Select */}
      <div className="flex items-end justify-between px-4 pb-2">
        {/* D-pad */}
        <div
          className="pointer-events-auto relative"
          style={{ width: `${144 * size}px`, height: `${144 * size}px` }}
        >
          <DpadButton
            control="dpad-up"
            label="▲"
            ariaLabel="D-pad hore"
            position="top"
            onPointerDown={(e) => handleDpadButton("dpad-up", e)}
            onPointerUp={(e) => handleDpadButton("dpad-up", e)}
            onPointerLeave={(e) => handleDpadButton("dpad-up", e)}
            onPointerCancel={(e) => handleDpadButton("dpad-up", e)}
            size={size}
          />
          <DpadButton
            control="dpad-down"
            label="▼"
            ariaLabel="D-pad dole"
            position="bottom"
            onPointerDown={(e) => handleDpadButton("dpad-down", e)}
            onPointerUp={(e) => handleDpadButton("dpad-down", e)}
            onPointerLeave={(e) => handleDpadButton("dpad-down", e)}
            onPointerCancel={(e) => handleDpadButton("dpad-down", e)}
            size={size}
          />
          <DpadButton
            control="dpad-left"
            label="◀"
            ariaLabel="D-pad vľavo"
            position="left"
            onPointerDown={(e) => handleDpadButton("dpad-left", e)}
            onPointerUp={(e) => handleDpadButton("dpad-left", e)}
            onPointerLeave={(e) => handleDpadButton("dpad-left", e)}
            onPointerCancel={(e) => handleDpadButton("dpad-left", e)}
            size={size}
          />
          <DpadButton
            control="dpad-right"
            label="▶"
            ariaLabel="D-pad vpravo"
            position="right"
            onPointerDown={(e) => handleDpadButton("dpad-right", e)}
            onPointerUp={(e) => handleDpadButton("dpad-right", e)}
            onPointerLeave={(e) => handleDpadButton("dpad-right", e)}
            onPointerCancel={(e) => handleDpadButton("dpad-right", e)}
            size={size}
          />
          {/* Center */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-muted/40"
            style={{ width: `${48 * size}px`, height: `${48 * size}px` }}
            aria-hidden="true"
          />
        </div>

        {/* Center: Start/Select */}
        <div className="pointer-events-auto flex flex-col items-center gap-2">
          <div className="flex gap-3">
            <CenterButton
              label="SELECT"
              onPointerDown={(e) => handleButton("select", e)}
              onPointerUp={(e) => handleButton("select", e)}
              onPointerLeave={(e) => handleButton("select", e)}
              onPointerCancel={(e) => handleButton("select", e)}
              size={size}
            />
            <CenterButton
              label="START"
              onPointerDown={(e) => handleButton("start", e)}
              onPointerUp={(e) => handleButton("start", e)}
              onPointerLeave={(e) => handleButton("start", e)}
              onPointerCancel={(e) => handleButton("start", e)}
              size={size}
            />
          </div>
        </div>

        {/* Face buttons (PSX layout: Triangle top, Circle right, Cross bottom, Square left) */}
        <div
          className="pointer-events-auto relative"
          style={{ width: `${144 * size}px`, height: `${144 * size}px` }}
        >
          <FaceButton
            control="face-y"
            label="△"
            color="text-emerald-500"
            ariaLabel="Triangle"
            position="top"
            onPointerDown={(e) => handleButton("face-y", e)}
            onPointerUp={(e) => handleButton("face-y", e)}
            onPointerLeave={(e) => handleButton("face-y", e)}
            onPointerCancel={(e) => handleButton("face-y", e)}
            size={size}
          />
          <FaceButton
            control="face-b"
            label="○"
            color="text-rose-500"
            ariaLabel="Circle"
            position="right"
            onPointerDown={(e) => handleButton("face-b", e)}
            onPointerUp={(e) => handleButton("face-b", e)}
            onPointerLeave={(e) => handleButton("face-b", e)}
            onPointerCancel={(e) => handleButton("face-b", e)}
            size={size}
          />
          <FaceButton
            control="face-a"
            label="✕"
            color="text-sky-500"
            ariaLabel="Cross"
            position="bottom"
            onPointerDown={(e) => handleButton("face-a", e)}
            onPointerUp={(e) => handleButton("face-a", e)}
            onPointerLeave={(e) => handleButton("face-a", e)}
            onPointerCancel={(e) => handleButton("face-a", e)}
            size={size}
          />
          <FaceButton
            control="face-x"
            label="□"
            color="text-fuchsia-500"
            ariaLabel="Square"
            position="left"
            onPointerDown={(e) => handleButton("face-x", e)}
            onPointerUp={(e) => handleButton("face-x", e)}
            onPointerLeave={(e) => handleButton("face-x", e)}
            onPointerCancel={(e) => handleButton("face-x", e)}
            size={size}
          />
        </div>
      </div>
    </div>
  );
}

// === Podkomponenty ===

interface DpadButtonProps {
  control: string;
  label: string;
  ariaLabel: string;
  position: "top" | "bottom" | "left" | "right";
  size: number;
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerLeave: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => void;
}

function DpadButton({
  label,
  ariaLabel,
  position,
  size,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
}: DpadButtonProps) {
  const positionClass =
    position === "top"
      ? "left-1/2 top-0 -translate-x-1/2"
      : position === "bottom"
      ? "left-1/2 bottom-0 -translate-x-1/2"
      : position === "left"
      ? "left-0 top-1/2 -translate-y-1/2"
      : "right-0 top-1/2 -translate-y-1/2";
  const dimension = `${48 * size}px`;
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerCancel}
      className={`absolute ${positionClass} flex items-center justify-center rounded-md bg-secondary/80 text-foreground touch-none select-none active:bg-primary/40`}
      style={{ width: dimension, height: dimension, touchAction: "none" }}
    >
      <span className="text-base" style={{ fontSize: `${14 * size}px` }}>{label}</span>
    </button>
  );
}

interface FaceButtonProps {
  control: string;
  label: string;
  color: string;
  ariaLabel: string;
  position: "top" | "bottom" | "left" | "right";
  size: number;
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerLeave: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => void;
}

function FaceButton({
  label,
  color,
  ariaLabel,
  position,
  size,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
}: FaceButtonProps) {
  const positionClass =
    position === "top"
      ? "left-1/2 top-0 -translate-x-1/2"
      : position === "bottom"
      ? "left-1/2 bottom-0 -translate-x-1/2"
      : position === "left"
      ? "left-0 top-1/2 -translate-y-1/2"
      : "right-0 top-1/2 -translate-y-1/2";
  const dimension = `${48 * size}px`;
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerCancel}
      className={`absolute ${positionClass} flex items-center justify-center rounded-full bg-secondary/80 ring-1 ring-border touch-none select-none active:bg-primary/40 ${color}`}
      style={{ width: dimension, height: dimension, touchAction: "none" }}
    >
      <span className="font-bold" style={{ fontSize: `${18 * size}px` }}>{label}</span>
    </button>
  );
}

interface ShoulderButtonProps {
  label: string;
  size: number;
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerLeave: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => void;
}

function ShoulderButton({
  label,
  size,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
}: ShoulderButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerCancel}
      className="rounded-md bg-secondary/80 px-3 py-1.5 text-xs font-medium text-foreground touch-none select-none active:bg-primary/40"
      style={{ touchAction: "none", fontSize: `${12 * size}px` }}
    >
      {label}
    </button>
  );
}

interface CenterButtonProps {
  label: string;
  size: number;
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerLeave: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => void;
}

function CenterButton({
  label,
  size,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
}: CenterButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerCancel}
      className="rounded-full bg-secondary/80 px-3 py-1 text-[10px] font-medium text-foreground touch-none select-none active:bg-primary/40"
      style={{ touchAction: "none", fontSize: `${10 * size}px` }}
    >
      {label}
    </button>
  );
}

interface AnalogStickProps {
  label: string;
  size: string;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerLeave: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
}

function AnalogStick({
  label,
  size,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
  onDoubleClick,
}: AnalogStickProps) {
  return (
    <div
      role="slider"
      aria-label={`${label} stick`}
      aria-valuemin={-1}
      aria-valuemax={1}
      aria-valuenow={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerCancel}
      onDoubleClick={onDoubleClick}
      className="pointer-events-auto flex items-center justify-center rounded-full bg-secondary/60 ring-1 ring-border touch-none select-none"
      style={{ width: size, height: size, touchAction: "none" }}
    >
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
    </div>
  );
}
