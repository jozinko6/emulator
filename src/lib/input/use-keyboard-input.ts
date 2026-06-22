"use client";

/**
 * useKeyboardInput — per prompt section 11.
 *
 * Activates physical keyboard handler on the play page.
 * - Uses KeyboardEvent.code (physical position)
 * - F5 = Quick Save (instead of browser refresh)
 * - F9 = Quick Load
 * - Release all keys on blur / visibilitychange / unmount
 *
 * The handler is only active when `enabled` is true (game running).
 */
import { useEffect, useRef } from "react";
import type { EmulatorAdapter } from "@/types/emulator";
import { KeyboardHandler, codeToControl } from "@/lib/input/keyboard-handler";
import type { EmulatorInputAdapter } from "@/emulators/core/emulator-input-adapter";

export interface UseKeyboardInputOptions {
  adapter: EmulatorAdapter | null;
  enabled: boolean;
  /** Quick save callback (F5). */
  onQuickSave?: () => void;
  /** Quick load callback (F9). */
  onQuickLoad?: () => void;
}

/**
 * Wraps an EmulatorAdapter to provide EmulatorInputAdapter interface.
 * Forwards keyboard events to the adapter's sendInput method.
 */
function adapterToInputAdapter(adapter: EmulatorAdapter): EmulatorInputAdapter {
  return {
    keyDown(code) {
      const control = codeToControl(code);
      adapter.sendInput({ type: "key-down", control, timestamp: Date.now() });
    },
    keyUp(code) {
      const control = codeToControl(code);
      adapter.sendInput({ type: "key-up", control, timestamp: Date.now() });
    },
    pointerMove() {
      // DOS adapter handles pointer separately via MouseHandler
    },
    pointerButtonDown() {},
    pointerButtonUp() {},
    pointerWheel() {},
    gamepadButtonDown() {},
    gamepadButtonUp() {},
    gamepadAxis() {},
    releaseAllInputs() {
      adapter.releaseAllInputs?.();
    },
  };
}

export function useKeyboardInput(opts: UseKeyboardInputOptions) {
  const { adapter, enabled } = opts;
  const handlerRef = useRef<KeyboardHandler | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!enabled || !adapter) return;

    const inputAdapter = adapterToInputAdapter(adapter);
    const handler = new KeyboardHandler({
      adapter: inputAdapter,
      // Don't block F5 / F9 — we'll handle them ourselves
      ignoredCodes: new Set<string>(["F5", "F9"]),
      blockSystemShortcuts: true,
    });
    handlerRef.current = handler;
    handler.start();

    // F5 = Quick Save, F9 = Quick Load (override browser behavior)
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === "F5") {
        e.preventDefault();
        e.stopPropagation();
        optsRef.current.onQuickSave?.();
      } else if (e.code === "F9") {
        e.preventDefault();
        e.stopPropagation();
        optsRef.current.onQuickLoad?.();
      }
    };
    document.addEventListener("keydown", onKeyDown, { capture: true });

    return () => {
      document.removeEventListener("keydown", onKeyDown, { capture: true });
      handler.stop();
      handlerRef.current = null;
    };
  }, [enabled, adapter]);
}
