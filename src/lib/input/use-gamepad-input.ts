"use client";

/**
 * useGamepadInput — per prompt section 10.
 *
 * Polls navigator.getGamepads() via requestAnimationFrame during active gameplay.
 * - Only polls when enabled (game is running)
 * - Sends button-down only on transition to pressed
 * - Sends button-up on release
 * - Applies deadzone + sensitivity
 * - Sends analog axes
 * - Handles gamepad disconnection → releaseAllInputs
 * - Cleans up on unmount / error / disabled
 *
 * F5 = Quick Save, F9 = Quick Load (per prompt section 11).
 */
import { useEffect, useRef } from "react";
import type { EmulatorAdapter } from "@/types/emulator";
import {
  STANDARD_BUTTON_MAP,
  STANDARD_AXIS_MAP,
  applyDeadzone,
  applySensitivity,
  detectGamepadProfile,
} from "@/emulators/core/emulator-input";

export interface UseGamepadInputOptions {
  adapter: EmulatorAdapter | null;
  enabled: boolean;
  deadzone?: number;
  sensitivity?: number;
  invertY?: boolean;
  /** Called when a gamepad is connected. */
  onConnected?: (info: { index: number; id: string; profile: string }) => void;
  /** Called when a gamepad is disconnected. */
  onDisconnected?: (info: { index: number; id: string }) => void;
}

interface GamepadState {
  id: string;
  buttonsPressed: boolean[];
  axesValues: number[];
}

export function useGamepadInput(opts: UseGamepadInputOptions) {
  const { adapter, enabled, deadzone = 0.15, sensitivity = 1.0, invertY = false } = opts;

  const statesRef = useRef<Map<number, GamepadState>>(new Map());
  const rafRef = useRef<number | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!enabled || !adapter) return;
    if (typeof navigator === "undefined" || !navigator.getGamepads) return;

    const handleConnect = (e: GamepadEvent) => {
      const pad = e.gamepad;
      statesRef.current.set(pad.index, {
        id: pad.id,
        buttonsPressed: new Array(pad.buttons.length).fill(false),
        axesValues: new Array(pad.axes.length).fill(0),
      });
      optsRef.current.onConnected?.({
        index: pad.index,
        id: pad.id,
        profile: detectGamepadProfile(pad.id),
      });
    };

    const handleDisconnect = (e: GamepadEvent) => {
      const state = statesRef.current.get(e.gamepad.index);
      if (state) {
        // Release all pressed buttons via EmulatorInputEvent
        for (let i = 0; i < state.buttonsPressed.length; i++) {
          if (state.buttonsPressed[i]) {
            const control = STANDARD_BUTTON_MAP[i];
            if (control) {
              adapter.sendInput({
                type: "button-up",
                control,
                value: 0,
                timestamp: Date.now(),
              });
            }
          }
        }
        // Reset axes
        for (let i = 0; i < state.axesValues.length; i++) {
          if (state.axesValues[i] !== 0) {
            const control = STANDARD_AXIS_MAP[i];
            if (control) {
              adapter.sendInput({
                type: "axis",
                control,
                value: 0,
                timestamp: Date.now(),
              });
            }
          }
        }
        statesRef.current.delete(e.gamepad.index);
      }
      optsRef.current.onDisconnected?.({ index: e.gamepad.index, id: e.gamepad.id });
    };

    const poll = () => {
      const currentAdapter = optsRef.current.adapter;
      if (!currentAdapter) {
        rafRef.current = requestAnimationFrame(poll);
        return;
      }
      const pads = navigator.getGamepads();
      for (const pad of pads) {
        if (!pad) continue;
        if (!statesRef.current.has(pad.index)) {
          statesRef.current.set(pad.index, {
            id: pad.id,
            buttonsPressed: new Array(pad.buttons.length).fill(false),
            axesValues: new Array(pad.axes.length).fill(0),
          });
        }
        const state = statesRef.current.get(pad.index)!;
        const dz = optsRef.current.deadzone ?? 0.15;
        const sens = optsRef.current.sensitivity ?? 1.0;
        const invY = optsRef.current.invertY ?? false;

        // Buttons — send button-down only on transition
        for (let i = 0; i < pad.buttons.length; i++) {
          const btn = pad.buttons[i];
          const control = STANDARD_BUTTON_MAP[i];
          if (!control) continue;
          const isPressed = btn.pressed;
          const wasPressed = state.buttonsPressed[i] ?? false;
          if (isPressed && !wasPressed) {
            state.buttonsPressed[i] = true;
            currentAdapter.sendInput({
              type: "button-down",
              control,
              value: 1,
              timestamp: Date.now(),
            });
          } else if (!isPressed && wasPressed) {
            state.buttonsPressed[i] = false;
            currentAdapter.sendInput({
              type: "button-up",
              control,
              value: 0,
              timestamp: Date.now(),
            });
          }
        }

        // Axes
        for (let i = 0; i < pad.axes.length; i++) {
          const control = STANDARD_AXIS_MAP[i];
          if (!control) continue;
          let value = applyDeadzone(pad.axes[i] ?? 0, dz);
          value = applySensitivity(value, sens);
          if (invY && (control === "lstick-y" || control === "rstick-y")) {
            value = -value;
          }
          const prev = state.axesValues[i] ?? 0;
          if (Math.abs(value - prev) > 0.01) {
            state.axesValues[i] = value;
            currentAdapter.sendInput({
              type: "axis",
              control,
              value,
              timestamp: Date.now(),
            });
          }
        }
      }
      rafRef.current = requestAnimationFrame(poll);
    };

    window.addEventListener("gamepadconnected", handleConnect);
    window.addEventListener("gamepaddisconnected", handleDisconnect);

    // Init state for already-connected gamepads
    const pads = navigator.getGamepads();
    for (const pad of pads) {
      if (pad && !statesRef.current.has(pad.index)) {
        statesRef.current.set(pad.index, {
          id: pad.id,
          buttonsPressed: new Array(pad.buttons.length).fill(false),
          axesValues: new Array(pad.axes.length).fill(0),
        });
      }
    }

    rafRef.current = requestAnimationFrame(poll);

    return () => {
      window.removeEventListener("gamepadconnected", handleConnect);
      window.removeEventListener("gamepaddisconnected", handleDisconnect);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      // Release all on cleanup
      for (const [, state] of statesRef.current) {
        for (let i = 0; i < state.buttonsPressed.length; i++) {
          if (state.buttonsPressed[i]) {
            const control = STANDARD_BUTTON_MAP[i];
            if (control) {
              adapter.sendInput({
                type: "button-up",
                control,
                value: 0,
                timestamp: Date.now(),
              });
            }
          }
        }
        for (let i = 0; i < state.axesValues.length; i++) {
          if (state.axesValues[i] !== 0) {
            const control = STANDARD_AXIS_MAP[i];
            if (control) {
              adapter.sendInput({
                type: "axis",
                control,
                value: 0,
                timestamp: Date.now(),
              });
            }
          }
        }
      }
      statesRef.current.clear();
      adapter.releaseAllInputs?.();
    };
  }, [enabled, adapter, deadzone, sensitivity, invertY]);
}
