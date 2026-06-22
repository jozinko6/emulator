/**
 * GamepadManager — Gamepad API wrapper.
 *
 * Per prompt ETAPA 7. Poskytuje:
 *  - `start()` — začne polling cez `requestAnimationFrame`
 *  - `stop()` — zastaví polling
 *  - `subscribe(handler)` — prihlásenie na `EmulatorInputEvent`
 *  - Deadzone + sensitivity z `controller-store`
 *  - Podpora Xbox, DualShock, DualSense, generické ovládače
 *  - Vibrácie cez `gamepad.vibrationActuator`
 *  - Mapovanie štandardných tlačidiel na zdieľané názvy (`"dpad-up"`, `"face-a"`, ...)
 *
 * Komentáre v slovenčine.
 */
import type { EmulatorInputEvent } from "@/types/emulator";
import {
  STANDARD_BUTTON_MAP,
  STANDARD_AXIS_MAP,
  applyDeadzone,
  applySensitivity,
  makeButtonEvent,
  makeAxisEvent,
  detectGamepadProfile,
  type GamepadProfile,
} from "@/emulators/core/emulator-input";

export interface GamepadManagerOptions {
  /** Deadzone pre analógy (0..1). Default 0.15. */
  deadzone?: number;
  /** Sensitivity multiplikátor pre analógy. Default 1.0. */
  sensitivity?: number;
  /** Minimálna zmena osi, ktorá sa reportuje (anti-noise). Default 0.05. */
  axisThreshold?: number;
}

interface GamepadState {
  /** ID ovládača pre detekciu zmeny. */
  id: string;
  /** Profil (xbox, dualshock, ...). */
  profile: GamepadProfile;
  /** Stav tlačidiel — predtým stlačené? */
  buttonsPressed: boolean[];
  /** Posledné nahlásené hodnoty osí. */
  axesValues: number[];
}

export class GamepadManager {
  private listeners = new Set<(event: EmulatorInputEvent) => void>();
  private states = new Map<number, GamepadState>();
  private rafId: number | null = null;
  private deadzone: number;
  private sensitivity: number;
  private axisThreshold: number;
  private destroyed = false;
  private onConnectHandler: ((e: GamepadEvent) => void) | null = null;
  private onDisconnectHandler: ((e: GamepadEvent) => void) | null = null;

  constructor(options: GamepadManagerOptions = {}) {
    this.deadzone = options.deadzone ?? 0.15;
    this.sensitivity = options.sensitivity ?? 1.0;
    this.axisThreshold = options.axisThreshold ?? 0.05;
  }

  /**
   * Začne polling gamepadov cez `requestAnimationFrame`.
   *
   * Na rozdiel od `gamepadconnected` / `gamepaddisconnected` eventov
   * (ktoré sú volatile a závisia od prehliadača), polling je spoľahlivý
   * spôsob, ako zistiť aktuálny stav všetkých pripojených ovládačov.
   */
  start(): void {
    if (this.rafId !== null) return;
    if (typeof navigator === "undefined" || !navigator.getGamepads) {
      console.warn("[gamepad-manager] Gamepad API nie je dostupné");
      return;
    }

    // Register connect/disconnect listeners
    this.onConnectHandler = (e: GamepadEvent) => {
      this.handleConnect(e.gamepad);
    };
    this.onDisconnectHandler = (e: GamepadEvent) => {
      this.handleDisconnect(e.gamepad);
    };
    window.addEventListener("gamepadconnected", this.onConnectHandler);
    window.addEventListener("gamepaddisconnected", this.onDisconnectHandler);

    // Initial scan — pre už pripojené ovládače
    const gamepads = navigator.getGamepads();
    if (gamepads) {
      for (const gp of gamepads) {
        if (gp) this.handleConnect(gp);
      }
    }

    this.tick();
  }

  /**
   * Zastaví polling.
   */
  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.onConnectHandler) {
      window.removeEventListener("gamepadconnected", this.onConnectHandler);
      this.onConnectHandler = null;
    }
    if (this.onDisconnectHandler) {
      window.removeEventListener("gamepaddisconnected", this.onDisconnectHandler);
      this.onDisconnectHandler = null;
    }
  }

  /**
   * Prihlási subscribera na `EmulatorInputEvent`.
   *
   * @returns funkcia pre odhlásenie
   */
  subscribe(handler: (event: EmulatorInputEvent) => void): () => void {
    if (this.destroyed) {
      console.warn("[gamepad-manager] subscribe() po destroy — ignorované");
      return () => undefined;
    }
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  /**
   * Zničí manager — zastaví polling a zruší všetkých subscriberov.
   */
  destroy(): void {
    this.stop();
    this.listeners.clear();
    this.states.clear();
    this.destroyed = true;
  }

  /**
   * Nastaví deadzone (z `controller-store`).
   */
  setDeadzone(deadzone: number): void {
    this.deadzone = deadzone;
  }

  /**
   * Nastaví sensitivity (z `controller-store`).
   */
  setSensitivity(sensitivity: number): void {
    this.sensitivity = sensitivity;
  }

  /**
   * Spustí vibráciu na všetkých pripojených ovládačoch (ak je podporovaná).
   *
   * @param duration trvanie v ms
   * @param strongMagnitude sila silného motora (0..1)
   * @param weakMagnitude sila slabého motora (0..1)
   */
  async vibrate(
    duration: number,
    strongMagnitude = 0.5,
    weakMagnitude = 0.5
  ): Promise<void> {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    if (!gamepads) return;

    const promises: Promise<unknown>[] = [];
    for (const gp of gamepads) {
      if (!gp) continue;
      const actuator = (
        gp as Gamepad & {
          vibrationActuator?: {
            playEffect: (
              type: string,
              params: { duration: number; strongMagnitude: number; weakMagnitude: number }
            ) => Promise<unknown>;
          };
        }
      ).vibrationActuator;
      if (actuator && typeof actuator.playEffect === "function") {
        promises.push(
          actuator.playEffect("dual-rumble", {
            duration,
            strongMagnitude,
            weakMagnitude,
          }).catch((e: unknown) => {
            console.warn("[gamepad-manager] vibrate zlyhal:", e);
          })
        );
      }
    }
    await Promise.all(promises);
  }

  /**
   * Vráti zoznam aktuálne pripojených ovládačov.
   */
  getConnectedGamepads(): Array<{ index: number; id: string; profile: GamepadProfile }> {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return [];
    const gamepads = navigator.getGamepads();
    const result: Array<{ index: number; id: string; profile: GamepadProfile }> = [];
    if (!gamepads) return result;
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (gp) {
        const state = this.states.get(gp.index);
        result.push({
          index: gp.index,
          id: gp.id,
          profile: state?.profile ?? "generic",
        });
      }
    }
    return result;
  }

  /**
   * Hlavná slučka pollingu — beží cez requestAnimationFrame.
   */
  private tick = (): void => {
    if (this.destroyed) return;
    if (typeof navigator !== "undefined" && navigator.getGamepads) {
      const gamepads = navigator.getGamepads();
      if (gamepads) {
        for (const gp of gamepads) {
          if (gp) this.pollGamepad(gp);
        }
      }
    }
    this.rafId = requestAnimationFrame(this.tick);
  };

  /**
   * Spracuje jeden gamepad — porovná aktuálny stav s predošlým a vyšle eventy.
   */
  private pollGamepad(gp: Gamepad): void {
    let state = this.states.get(gp.index);
    if (!state) {
      // Nový gamepad — inicializuj state
      state = {
        id: gp.id,
        profile: detectGamepadProfile(gp.id),
        buttonsPressed: new Array(gp.buttons.length).fill(false),
        axesValues: new Array(gp.axes.length).fill(0),
      };
      this.states.set(gp.index, state);
    }

    // 1. Skontroluj tlačidlá
    for (let i = 0; i < gp.buttons.length; i++) {
      const btn = gp.buttons[i];
      const wasPressed = state.buttonsPressed[i] ?? false;
      const isPressed = btn.value > 0.1;
      if (wasPressed !== isPressed) {
        state.buttonsPressed[i] = isPressed;
        const control = STANDARD_BUTTON_MAP[i];
        if (control) {
          this.emit(makeButtonEvent(control, isPressed, btn.value));
        }
      }
    }

    // 2. Skontroluj osí
    for (let i = 0; i < gp.axes.length; i++) {
      const raw = gp.axes[i] ?? 0;
      const withDeadzone = applyDeadzone(raw, this.deadzone);
      const withSensitivity = applySensitivity(withDeadzone, this.sensitivity);
      const prev = state.axesValues[i] ?? 0;
      // Anti-noise filter — zmena menšia než threshold sa ignoruje
      if (Math.abs(withSensitivity - prev) >= this.axisThreshold || (prev !== 0 && withSensitivity === 0)) {
        state.axesValues[i] = withSensitivity;
        const control = STANDARD_AXIS_MAP[i];
        if (control) {
          this.emit(makeAxisEvent(control, withSensitivity));
        }
      }
    }
  }

  private handleConnect(gp: Gamepad): void {
    if (this.states.has(gp.index)) return;
    this.states.set(gp.index, {
      id: gp.id,
      profile: detectGamepadProfile(gp.id),
      buttonsPressed: new Array(gp.buttons.length).fill(false),
      axesValues: new Array(gp.axes.length).fill(0),
    });
    console.info(`[gamepad-manager] pripojený: ${gp.id} (profil: ${detectGamepadProfile(gp.id)})`);
  }

  private handleDisconnect(gp: Gamepad): void {
    this.states.delete(gp.index);
    console.info(`[gamepad-manager] odpojený: ${gp.id}`);
  }

  private emit(event: EmulatorInputEvent): void {
    if (this.destroyed) return;
    const snapshot = Array.from(this.listeners);
    for (const listener of snapshot) {
      try {
        listener(event);
      } catch (e) {
        console.error("[gamepad-manager] listener chyba:", e);
      }
    }
  }
}
