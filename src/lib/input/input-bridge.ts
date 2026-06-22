"use client";

/**
 * InputBridge — integruje keyboard, mouse a gamepad do jednotného vstupného
 * kanála do EmulatorInputAdapter.
 *
 * Per prompt section 1 (OVLÁDANIE NA PC) — PC controls.
 *
 * Vlastnosti:
 *   - Jeden `start()` / `stop()` pre všetky vstupy
 *   - Gamepad polling cez requestAnimationFrame (iba aktívny počas hry)
 *   - Pri odpojení gamepadu: uvoľní všetky jeho aktívne vstupy + pozastaví hru (voliteľné)
 *   - Pri strate focusu / visibilitychange: uvoľní klávesy + myš
 *   - `releaseAll()` pri pauze / ukončení hry
 */
import type { EmulatorInputAdapter } from "@/emulators/core/emulator-input-adapter";
import { KeyboardHandler } from "@/lib/input/keyboard-handler";
import { MouseHandler } from "@/lib/input/mouse-handler";
import {
  STANDARD_BUTTON_MAP,
  STANDARD_AXIS_MAP,
  applyDeadzone,
  applySensitivity,
  detectGamepadProfile,
  type GamepadProfile,
} from "@/emulators/core/emulator-input";

export interface InputBridgeOptions {
  /** Cieľový input adapter (DosInputAdapter / Ps1InputAdapter). */
  adapter: EmulatorInputAdapter;
  /** Element, na ktorom beží emulátor (pre mouse + keyboard target). */
  target: HTMLElement;
  /** Povoliť Pointer Lock (default = true). Vypnuteľné v nastaveniach. */
  enablePointerLock?: boolean;
  /** Deadzone pre analógy (0..1). Default 0.15. */
  deadzone?: number;
  /** Sensitivity multiplikátor pre analógy. Default 1.0. */
  sensitivity?: number;
  /** Invertovať Y os ľavého sticku. */
  invertY?: boolean;
  /** Callback pri zmene pointer lock stavu. */
  onPointerLockChange?: (locked: boolean) => void;
  /** Callback pri pripojení gamepadu. */
  onGamepadConnected?: (info: { index: number; id: string; profile: GamepadProfile }) => void;
  /** Callback pri odpojení gamepadu. */
  onGamepadDisconnected?: (info: { index: number; id: string }) => void;
  /** Pozastaviť hru pri odpojení gamepadu (default = false). */
  pauseOnGamepadDisconnect?: boolean;
  /** Callback na pozastavenie hry. */
  onPauseRequest?: () => void;
}

interface GamepadState {
  id: string;
  profile: GamepadProfile;
  buttonsPressed: boolean[];
  axesValues: number[];
}

export class InputBridge {
  private readonly adapter: EmulatorInputAdapter;
  private readonly target: HTMLElement;
  private readonly keyboard: KeyboardHandler;
  private readonly mouse: MouseHandler;
  private readonly deadzone: number;
  private readonly sensitivity: number;
  private readonly invertY: boolean;
  private readonly onPointerLockChange?: (locked: boolean) => void;
  private readonly onGamepadConnected?: InputBridgeOptions["onGamepadConnected"];
  private readonly onGamepadDisconnected?: InputBridgeOptions["onGamepadDisconnected"];
  private readonly pauseOnGamepadDisconnect: boolean;
  private readonly onPauseRequest?: () => void;

  private rafId: number | null = null;
  private readonly states = new Map<number, GamepadState>();
  private active = false;

  private boundGamepadConnected: (e: GamepadEvent) => void;
  private boundGamepadDisconnected: (e: GamepadEvent) => void;
  private boundPoll: () => void;

  constructor(opts: InputBridgeOptions) {
    this.adapter = opts.adapter;
    this.target = opts.target;
    this.deadzone = opts.deadzone ?? 0.15;
    this.sensitivity = opts.sensitivity ?? 1.0;
    this.invertY = opts.invertY ?? false;
    this.onPointerLockChange = opts.onPointerLockChange;
    this.onGamepadConnected = opts.onGamepadConnected;
    this.onGamepadDisconnected = opts.onGamepadDisconnected;
    this.pauseOnGamepadDisconnect = opts.pauseOnGamepadDisconnect ?? false;
    this.onPauseRequest = opts.onPauseRequest;

    this.keyboard = new KeyboardHandler({ adapter: opts.adapter });
    this.mouse = new MouseHandler({
      adapter: opts.adapter,
      target: opts.target,
      enablePointerLock: opts.enablePointerLock ?? true,
      onPointerLockChange: opts.onPointerLockChange,
    });

    this.boundGamepadConnected = this.handleGamepadConnected.bind(this);
    this.boundGamepadDisconnected = this.handleGamepadDisconnected.bind(this);
    this.boundPoll = this.poll.bind(this);
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.keyboard.start();
    this.mouse.start();
    window.addEventListener("gamepadconnected", this.boundGamepadConnected);
    window.addEventListener("gamepaddisconnected", this.boundGamepadDisconnected);

    // Init state for already-connected gamepads (Firefox may not fire connected event)
    const pads = typeof navigator !== "undefined" && navigator.getGamepads
      ? navigator.getGamepads()
      : [];
    for (const pad of pads) {
      if (pad) this.initGamepadState(pad);
    }

    // Start polling loop
    this.rafId = requestAnimationFrame(this.boundPoll);
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.keyboard.stop();
    this.mouse.stop();
    window.removeEventListener("gamepadconnected", this.boundGamepadConnected);
    window.removeEventListener("gamepaddisconnected", this.boundGamepadDisconnected);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    // Release all gamepad inputs
    for (const [index, state] of this.states) {
      for (let i = 0; i < state.buttonsPressed.length; i++) {
        if (state.buttonsPressed[i]) {
          const control = STANDARD_BUTTON_MAP[i];
          if (control) this.adapter.gamepadButtonUp(control);
        }
      }
    }
    this.states.clear();
    this.adapter.releaseAllInputs();
  }

  /** Explicitne uvoľní všetky vstupy — pri pauze. */
  releaseAllInputs(): void {
    this.keyboard.releaseAll();
    this.mouse.releaseAll();
    // Release all gamepad buttons
    for (const [, state] of this.states) {
      for (let i = 0; i < state.buttonsPressed.length; i++) {
        if (state.buttonsPressed[i]) {
          const control = STANDARD_BUTTON_MAP[i];
          if (control) this.adapter.gamepadButtonUp(control);
        }
      }
      // Reset axes to 0
      for (let i = 0; i < state.axesValues.length; i++) {
        if (state.axesValues[i] !== 0) {
          const control = STANDARD_AXIS_MAP[i];
          if (control) this.adapter.gamepadAxis(control, 0);
        }
      }
    }
    // Reset state arrays
    for (const [, state] of this.states) {
      state.buttonsPressed = state.buttonsPressed.map(() => false);
      state.axesValues = state.axesValues.map(() => 0);
    }
  }

  /** Spustí vibráciu na všetkých pripojených gamepadoch (ak je podporovaná). */
  async vibrate(durationMs: number, weakMagnitude = 1.0, strongMagnitude = 1.0): Promise<void> {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    const promises: Promise<unknown>[] = [];
    for (const pad of pads) {
      if (!pad) continue;
      const actuator = (pad as Gamepad & {
        vibrationActuator?: { playEffect: (type: string, params: unknown) => Promise<unknown> };
      }).vibrationActuator;
      if (actuator && typeof actuator.playEffect === "function") {
        promises.push(
          actuator.playEffect("dual-rumble", {
            duration: durationMs,
            weakMagnitude,
            strongMagnitude,
          })
        );
      }
    }
    await Promise.all(promises);
  }

  /** Vráti zoznam pripojených gamepadov. */
  getConnectedGamepads(): Array<{ index: number; id: string; profile: GamepadProfile }> {
    return Array.from(this.states.entries()).map(([index, s]) => ({
      index,
      id: s.id,
      profile: s.profile,
    }));
  }

  private initGamepadState(pad: Gamepad): void {
    if (this.states.has(pad.index)) return;
    this.states.set(pad.index, {
      id: pad.id,
      profile: detectGamepadProfile(pad.id),
      buttonsPressed: new Array(pad.buttons.length).fill(false),
      axesValues: new Array(pad.axes.length).fill(0),
    });
    this.onGamepadConnected?.({
      index: pad.index,
      id: pad.id,
      profile: detectGamepadProfile(pad.id),
    });
  }

  private handleGamepadConnected(e: GamepadEvent): void {
    this.initGamepadState(e.gamepad);
  }

  private handleGamepadDisconnected(e: GamepadEvent): void {
    const state = this.states.get(e.gamepad.index);
    if (state) {
      // Release all currently pressed buttons
      for (let i = 0; i < state.buttonsPressed.length; i++) {
        if (state.buttonsPressed[i]) {
          const control = STANDARD_BUTTON_MAP[i];
          if (control) this.adapter.gamepadButtonUp(control);
        }
      }
      // Reset axes to 0
      for (let i = 0; i < state.axesValues.length; i++) {
        if (state.axesValues[i] !== 0) {
          const control = STANDARD_AXIS_MAP[i];
          if (control) this.adapter.gamepadAxis(control, 0);
        }
      }
      this.states.delete(e.gamepad.index);
    }
    this.onGamepadDisconnected?.({ index: e.gamepad.index, id: e.gamepad.id });

    if (this.pauseOnGamepadDisconnect && this.states.size === 0) {
      this.onPauseRequest?.();
    }
  }

  private poll(): void {
    if (!this.active) return;

    if (typeof navigator !== "undefined" && navigator.getGamepads) {
      const pads = navigator.getGamepads();
      for (const pad of pads) {
        if (!pad) continue;
        if (!this.states.has(pad.index)) {
          this.initGamepadState(pad);
        }
        this.pollGamepad(pad);
      }
    }

    this.rafId = requestAnimationFrame(this.boundPoll);
  }

  private pollGamepad(pad: Gamepad): void {
    const state = this.states.get(pad.index);
    if (!state) return;

    // Buttons
    for (let i = 0; i < pad.buttons.length; i++) {
      const btn = pad.buttons[i];
      const wasPressed = state.buttonsPressed[i] ?? false;
      const isPressed = btn.pressed;
      const control = STANDARD_BUTTON_MAP[i];
      if (!control) continue;

      if (isPressed && !wasPressed) {
        state.buttonsPressed[i] = true;
        this.adapter.gamepadButtonDown(control);
      } else if (!isPressed && wasPressed) {
        state.buttonsPressed[i] = false;
        this.adapter.gamepadButtonUp(control);
      }
    }

    // Axes
    for (let i = 0; i < pad.axes.length; i++) {
      const control = STANDARD_AXIS_MAP[i];
      if (!control) continue;
      let value = applyDeadzone(pad.axes[i] ?? 0, this.deadzone);
      value = applySensitivity(value, this.sensitivity);
      if (this.invertY && (control === "lstick-y" || control === "rstick-y")) {
        value = -value;
      }
      const prev = state.axesValues[i] ?? 0;
      if (Math.abs(value - prev) > 0.01) {
        state.axesValues[i] = value;
        this.adapter.gamepadAxis(control, value);
      }
    }
  }
}
