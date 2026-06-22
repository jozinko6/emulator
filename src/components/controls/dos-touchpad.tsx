"use client";

/**
 * DosTouchpad — DOS ovládanie pre mobilné zariadenia.
 *
 * Per prompt ETAPA 7. Poskytuje:
 *  - Virtuálna klávesnica (šípky, Esc, Enter, Space, Ctrl, Alt, Shift, funkčné klávesy F1-F12)
 *  - Touchpad (ľavý/pravý klik) — track movement
 *
 * Posiela keyboard events cez `onInput` ako `EmulatorInputEvent` s typom
 * `key-down` / `key-up` a control hodnotou `"key-escape"`, `"key-enter"`, atď.
 *
 * Komentáre v slovenčine.
 */
import { useCallback, useRef, useState } from "react";
import type { EmulatorInputEvent } from "@/types/emulator";
import { Button } from "@/components/ui/button";

interface DosTouchpadProps {
  /** Callback pre vstupné eventy. */
  onInput: (event: EmulatorInputEvent) => void;
  /** Zapnutá haptická odozva. Default true. */
  haptics?: boolean;
  /** Skryť funkčné klávesy (ak hra nepoužíva). Default false. */
  hideFunctionKeys?: boolean;
  /** Skryť touchpad (ak hra nepoužíva myš). Default false. */
  hideTouchpad?: boolean;
  /** CSS class pre celý touchpad. */
  className?: string;
}

/** Skupina klávesov — pre organizáciu layoutu. */
interface KeyGroup {
  name: string;
  keys: Array<{ control: string; label: string; width?: number }>;
}

const ARROW_KEYS: KeyGroup = {
  name: "Arrows",
  keys: [
    { control: "key-up", label: "↑" },
    { control: "key-down", label: "↓" },
    { control: "key-left", label: "←" },
    { control: "key-right", label: "→" },
  ],
};

const MODIFIER_KEYS: KeyGroup = {
  name: "Modifiers",
  keys: [
    { control: "key-ctrl", label: "Ctrl" },
    { control: "key-alt", label: "Alt" },
    { control: "key-shift", label: "Shift" },
  ],
};

const ACTION_KEYS: KeyGroup = {
  name: "Actions",
  keys: [
    { control: "key-escape", label: "Esc" },
    { control: "key-enter", label: "Enter" },
    { control: "key-space", label: "Space" },
    { control: "key-tab", label: "Tab" },
    { control: "key-backspace", label: "⌫" },
  ],
};

const FUNCTION_KEYS: KeyGroup = {
  name: "Function",
  keys: [
    { control: "key-f1", label: "F1" },
    { control: "key-f2", label: "F2" },
    { control: "key-f3", label: "F3" },
    { control: "key-f4", label: "F4" },
    { control: "key-f5", label: "F5" },
    { control: "key-f6", label: "F6" },
    { control: "key-f7", label: "F7" },
    { control: "key-f8", label: "F8" },
    { control: "key-f9", label: "F9" },
    { control: "key-f10", label: "F10" },
    { control: "key-f11", label: "F11" },
    { control: "key-f12", label: "F12" },
  ],
};

function vibrate(enabled: boolean, duration = 8): void {
  if (!enabled) return;
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  try {
    navigator.vibrate(duration);
  } catch {
    // vibration may be denied
  }
}

function makeKeyEvent(control: string, pressed: boolean): EmulatorInputEvent {
  return {
    type: pressed ? "key-down" : "key-up",
    control,
    timestamp: Date.now(),
  };
}

export function DosTouchpad({
  onInput,
  haptics = true,
  hideFunctionKeys = false,
  hideTouchpad = false,
  className,
}: DosTouchpadProps) {
  // Modifiers sa správajú "sticky" — ostávajú stlačené kým ich používateľ
  // nepustí. Pre jednoduchosť implementujeme ako toggle.
  const [activeModifiers, setActiveModifiers] = useState<Set<string>>(new Set());
  const touchpadPointer = useRef<number | null>(null);
  const touchpadLastPos = useRef<{ x: number; y: number } | null>(null);

  /**
   * Handler pre klávesu — pointer down/up.
   */
  const handleKey = useCallback(
    (control: string, isModifier: boolean, e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (e.type === "pointerdown") {
        (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
        if (isModifier) {
          // Toggle modifier
          setActiveModifiers((prev) => {
            const next = new Set(prev);
            if (next.has(control)) {
              next.delete(control);
              onInput(makeKeyEvent(control, false));
            } else {
              next.add(control);
              onInput(makeKeyEvent(control, true));
            }
            return next;
          });
        } else {
          onInput(makeKeyEvent(control, true));
          // Ak sú aktívne modifikátory, pustíme ich po stlačení klávesy
          // (bežné správanie pre DOS skratky ako Ctrl+S)
          // Pozor: pre niektoré hry to môže byť nechcené — ponechávame jednoduché.
        }
        vibrate(haptics);
      } else if (e.type === "pointerup" || e.type === "pointercancel" || e.type === "pointerleave") {
        if (!isModifier) {
          onInput(makeKeyEvent(control, false));
        }
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
   * Handler pre touchpad — pointer down/move/up.
   *
   * Posiela `pointer` eventy s `x`, `y` (relatívne zmeny) na `onInput`.
   * Pre ľavý/pravý klik posiela `key-down` / `key-up` eventy (DOS hry
   * obyčajne nemajú priamu myšovu podporu, ale js-dos ju simuluje).
   */
  const handleTouchpad = useCallback(
    (button: "left" | "right", e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (e.type === "pointerdown") {
        if (touchpadPointer.current !== null) return;
        touchpadPointer.current = e.pointerId;
        touchpadLastPos.current = { x: e.clientX, y: e.clientY };
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        // Mouse button down — posiela ako pointer event s control "mouse-left"/"mouse-right"
        onInput({
          type: "pointer",
          control: button === "left" ? "mouse-left-down" : "mouse-right-down",
          x: e.clientX,
          y: e.clientY,
          timestamp: Date.now(),
        });
        vibrate(haptics);
      } else if (e.type === "pointermove") {
        if (touchpadPointer.current !== e.pointerId || !touchpadLastPos.current) return;
        const dx = e.clientX - touchpadLastPos.current.x;
        const dy = e.clientY - touchpadLastPos.current.y;
        touchpadLastPos.current = { x: e.clientX, y: e.clientY };
        onInput({
          type: "pointer",
          control: "mouse-move",
          x: dx,
          y: dy,
          timestamp: Date.now(),
        });
      } else if (e.type === "pointerup" || e.type === "pointercancel" || e.type === "pointerleave") {
        if (touchpadPointer.current !== e.pointerId) return;
        onInput({
          type: "pointer",
          control: button === "left" ? "mouse-left-up" : "mouse-right-up",
          x: e.clientX,
          y: e.clientY,
          timestamp: Date.now(),
        });
        touchpadPointer.current = null;
        touchpadLastPos.current = null;
        try {
          (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
    },
    [haptics, onInput]
  );

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-30 flex flex-col justify-end gap-2 p-2 ${className ?? ""}`}
      aria-label="DOS ovládanie"
    >
      {/* Touchpad (ak je zobrazený) */}
      {!hideTouchpad && (
        <div className="pointer-events-auto mx-auto flex w-full max-w-md gap-2">
          <div
            role="button"
            aria-label="Ľavé tlačidlo myši"
            onPointerDown={(e) => handleTouchpad("left", e)}
            onPointerUp={(e) => handleTouchpad("left", e)}
            onPointerMove={(e) => handleTouchpad("left", e)}
            onPointerCancel={(e) => handleTouchpad("left", e)}
            onPointerLeave={(e) => handleTouchpad("left", e)}
            className="flex-1 select-none rounded-md bg-secondary/60 p-3 text-center text-xs font-medium text-foreground ring-1 ring-border touch-none active:bg-primary/40"
            style={{ touchAction: "none", minHeight: "44px" }}
          >
            Ľavé tlačidlo myši
          </div>
          <div
            role="button"
            aria-label="Pravé tlačidlo myši"
            onPointerDown={(e) => handleTouchpad("right", e)}
            onPointerUp={(e) => handleTouchpad("right", e)}
            onPointerMove={(e) => handleTouchpad("right", e)}
            onPointerCancel={(e) => handleTouchpad("right", e)}
            onPointerLeave={(e) => handleTouchpad("right", e)}
            className="flex-1 select-none rounded-md bg-secondary/60 p-3 text-center text-xs font-medium text-foreground ring-1 ring-border touch-none active:bg-primary/40"
            style={{ touchAction: "none", minHeight: "44px" }}
          >
            Pravé tlačidlo myši
          </div>
        </div>
      )}

      {/* Virtuálna klávesnica */}
      <div className="pointer-events-auto mx-auto w-full max-w-3xl space-y-2 rounded-lg bg-background/80 p-2 backdrop-blur">
        {/* Arrows + Actions row */}
        <div className="flex flex-wrap gap-1.5">
          {ARROW_KEYS.keys.map((k) => (
            <VirtualKey
              key={k.control}
              label={k.label}
              ariaLabel={k.control}
              onPointerDown={(e) => handleKey(k.control, false, e)}
              onPointerUp={(e) => handleKey(k.control, false, e)}
              onPointerLeave={(e) => handleKey(k.control, false, e)}
              onPointerCancel={(e) => handleKey(k.control, false, e)}
            />
          ))}
          <div className="flex-1" />
          {ACTION_KEYS.keys.map((k) => (
            <VirtualKey
              key={k.control}
              label={k.label}
              ariaLabel={k.control}
              onPointerDown={(e) => handleKey(k.control, false, e)}
              onPointerUp={(e) => handleKey(k.control, false, e)}
              onPointerLeave={(e) => handleKey(k.control, false, e)}
              onPointerCancel={(e) => handleKey(k.control, false, e)}
            />
          ))}
        </div>

        {/* Modifiers row */}
        <div className="flex flex-wrap gap-1.5">
          {MODIFIER_KEYS.keys.map((k) => (
            <VirtualKey
              key={k.control}
              label={k.label}
              ariaLabel={k.control}
              active={activeModifiers.has(k.control)}
              onPointerDown={(e) => handleKey(k.control, true, e)}
              onPointerUp={(e) => handleKey(k.control, true, e)}
              onPointerLeave={(e) => handleKey(k.control, true, e)}
              onPointerCancel={(e) => handleKey(k.control, true, e)}
            />
          ))}
          <div className="flex-1" />
          {!hideFunctionKeys && (
            <>
              <span className="self-center text-[10px] text-muted-foreground">F1-F12 ↓</span>
            </>
          )}
        </div>

        {/* Function keys row */}
        {!hideFunctionKeys && (
          <div className="flex flex-wrap gap-1">
            {FUNCTION_KEYS.keys.map((k) => (
              <VirtualKey
                key={k.control}
                label={k.label}
                ariaLabel={k.control}
                small
                onPointerDown={(e) => handleKey(k.control, false, e)}
                onPointerUp={(e) => handleKey(k.control, false, e)}
                onPointerLeave={(e) => handleKey(k.control, false, e)}
                onPointerCancel={(e) => handleKey(k.control, false, e)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface VirtualKeyProps {
  label: string;
  ariaLabel: string;
  active?: boolean;
  small?: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerLeave: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => void;
}

function VirtualKey({
  label,
  ariaLabel,
  active,
  small,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
}: VirtualKeyProps) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "secondary"}
      size="sm"
      aria-label={ariaLabel}
      aria-pressed={active}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerCancel}
      className={`min-h-11 touch-none select-none ${small ? "min-w-12 px-2 text-xs" : "min-w-14 px-3"}`}
      style={{ touchAction: "none" }}
    >
      {label}
    </Button>
  );
}
