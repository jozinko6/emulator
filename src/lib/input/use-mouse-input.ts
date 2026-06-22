"use client";

/**
 * useMouseInput — per prompt section 12.
 *
 * Activates MouseHandler with Pointer Lock API for DOS games.
 * - Click on game canvas → request pointer lock
 * - movementX/Y → adapter.sendInput({type: "pointer", x, y})
 * - Left/right/middle buttons → adapter.sendInput({type: "button-down/up", control: "mouse-X"})
 * - Wheel → adapter.sendInput({type: "pointer", control: "wheel"})
 * - Escape exits pointer lock (browser default)
 *
 * Only active when enabled (game running + DOS platform).
 */
import { useEffect, useRef, useState } from "react";
import type { EmulatorAdapter } from "@/types/emulator";
import type { EmulatorInputAdapter } from "@/emulators/core/emulator-input-adapter";
import { MouseHandler } from "@/lib/input/mouse-handler";

export interface UseMouseInputOptions {
  adapter: EmulatorAdapter | null;
  enabled: boolean;
  target: HTMLElement | null;
  enablePointerLock?: boolean;
}

function adapterToMouseInputAdapter(adapter: EmulatorAdapter): EmulatorInputAdapter {
  return {
    keyDown() {},
    keyUp() {},
    pointerMove(deltaX, deltaY) {
      adapter.sendInput({
        type: "pointer-move",
        control: "mouse-move",
        x: deltaX,
        y: deltaY,
        timestamp: Date.now(),
      });
    },
    pointerButtonDown(button) {
      const control = button === 0 ? "mouse-left" : button === 2 ? "mouse-right" : "mouse-middle";
      adapter.sendInput({
        type: "pointer-button-down",
        control,
        value: 1,
        timestamp: Date.now(),
      });
    },
    pointerButtonUp(button) {
      const control = button === 0 ? "mouse-left" : button === 2 ? "mouse-right" : "mouse-middle";
      adapter.sendInput({
        type: "pointer-button-up",
        control,
        value: 0,
        timestamp: Date.now(),
      });
    },
    pointerWheel(deltaX, deltaY) {
      adapter.sendInput({
        type: "pointer-wheel",
        control: deltaY > 0 ? "wheel-down" : "wheel-up",
        x: deltaX,
        y: deltaY,
        timestamp: Date.now(),
      });
    },
    gamepadButtonDown() {},
    gamepadButtonUp() {},
    gamepadAxis() {},
    releaseAllInputs() {
      adapter.releaseAllInputs?.();
    },
  };
}

export function useMouseInput(opts: UseMouseInputOptions) {
  const { adapter, enabled, target, enablePointerLock = true } = opts;
  const handlerRef = useRef<MouseHandler | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (!enabled || !adapter || !target) return;

    const inputAdapter = adapterToMouseInputAdapter(adapter);
    const handler = new MouseHandler({
      adapter: inputAdapter,
      target,
      enablePointerLock,
      onPointerLockChange: (locked) => setIsLocked(locked),
      onPointerLockError: (e) => console.warn("Pointer lock error:", e),
    });
    handlerRef.current = handler;
    handler.start();

    return () => {
      handler.stop();
      handlerRef.current = null;
    };
  }, [enabled, adapter, target, enablePointerLock]);

  return { isLocked };
}
