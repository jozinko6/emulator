"use client";

/**
 * Native Android gamepad — per prompt section 5.
 *
 * Na Androide používame Android input API (KeyEvent, MotionEvent) ako
 * spoľahlivejší fallback pre Gamepad API, ktoré v Android WebView nefunguje
 * spoľahlivo pre všetky ovládače.
 *
 * Natívny Kotlin plugin preposiela udalosti do JavaScriptu cez bridge.
 * V prehliadači (web/PWA) sa používa štandardný Gamepad API.
 */
import { getRuntimeInfo } from "./native-platform";

export type NativeGamepadEventType = "keydown" | "keyup" | "axis";

export interface NativeGamepadEvent {
  type: NativeGamepadEventType;
  /** Pre keydown/keyup: zdieľaný názov tlačidla ("face-a", "dpad-up", ...). */
  button?: string;
  /** Pre axis: názov osi ("lstick-x", ...). */
  axis?: string;
  /** Pre axis: hodnota (-1..1). */
  value?: number;
  /** Source: SOURCE_GAMEPAD, SOURCE_JOYSTICK, SOURCE_DPAD. */
  source: string;
  /** Časová značka z Android SystemClock.uptimeMillis(). */
  timestamp: number;
}

export interface NativeGamepadListener {
  (event: NativeGamepadEvent): void;
}

export interface NativeGamepadPlugin {
  start(): Promise<void>;
  stop(): Promise<void>;
  subscribe(listener: NativeGamepadListener): () => void;
  /** Zoznam pripojených ovládačov. */
  getConnectedControllers(): Promise<Array<{
    deviceId: number;
    name: string;
    sources: number;
  }>>;
  /** Spustí vibráciu. */
  vibrate(durationMs: number, intensity: number): Promise<void>;
}

let cachedPlugin: NativeGamepadPlugin | null = null;
let cachedAvailable: boolean | null = null;

export function isNativeGamepadAvailable(): boolean {
  if (cachedAvailable !== null) return cachedAvailable;
  if (typeof window === "undefined") {
    cachedAvailable = false;
    return false;
  }
  const info = getRuntimeInfo();
  if (!info.isNativeAndroid) {
    cachedAvailable = false;
    return false;
  }
  cachedAvailable = !!(window.Capacitor?.Plugins?.NativeGamepad ?? window.AndroidBridge?.nativeGamepad);
  return cachedAvailable;
}

export function getNativeGamepadPlugin(): NativeGamepadPlugin | null {
  if (!isNativeGamepadAvailable()) return null;
  if (cachedPlugin) return cachedPlugin;
  const capacitor = window.Capacitor?.Plugins?.NativeGamepad as NativeGamepadPlugin | undefined;
  const bridge = window.AndroidBridge?.nativeGamepad as NativeGamepadPlugin | undefined;
  cachedPlugin = capacitor ?? bridge ?? null;
  return cachedPlugin;
}

/**
 * Mapovanie Android KeyEvent kódov na zdieľané názvy tlačidiel.
 *
 * Android keycodes: https://developer.android.com/reference/android/view/KeyEvent
 *
 * Dôležité kódy pre gamepad:
 *   KEYCODE_BUTTON_A = 96
 *   KEYCODE_BUTTON_B = 97
 *   KEYCODE_BUTTON_X = 99
 *   KEYCODE_BUTTON_Y = 100
 *   KEYCODE_BUTTON_L1 = 102
 *   KEYCODE_BUTTON_R1 = 103
 *   KEYCODE_BUTTON_L2 = 104
 *   KEYCODE_BUTTON_R2 = 105
 *   KEYCODE_BUTTON_SELECT = 109
 *   KEYCODE_BUTTON_START = 108
 *   KEYCODE_BUTTON_THUMBL = 106
 *   KEYCODE_BUTTON_THUMBR = 107
 *   KEYCODE_DPAD_UP = 19
 *   KEYCODE_DPAD_DOWN = 20
 *   KEYCODE_DPAD_LEFT = 21
 *   KEYCODE_DPAD_RIGHT = 22
 *   KEYCODE_DPAD_CENTER = 23
 *   KEYCODE_BACK = 4
 *   KEYCODE_MENU = 82
 */
export const ANDROID_KEYCODE_TO_CONTROL: Record<number, string> = {
  96: "face-a", // BUTTON_A
  97: "face-b", // BUTTON_B
  99: "face-x", // BUTTON_X
  100: "face-y", // BUTTON_Y
  102: "l1", // BUTTON_L1
  103: "r1", // BUTTON_R1
  104: "l2", // BUTTON_L2
  105: "r2", // BUTTON_R2
  109: "select", // BUTTON_SELECT
  108: "start", // BUTTON_START
  106: "l3", // BUTTON_THUMBL
  107: "r3", // BUTTON_THUMBR
  19: "dpad-up", // DPAD_UP
  20: "dpad-down", // DPAD_DOWN
  21: "dpad-left", // DPAD_LEFT
  22: "dpad-right", // DPAD_RIGHT
  23: "dpad-center", // DPAD_CENTER
  4: "back", // BACK
  82: "menu", // MENU
};

/**
 * Mapovanie Android axis indexov na zdieľané názvy.
 *
 * Android MotionEvent AXIS_* constants:
 *   AXIS_X = 0
 *   AXIS_Y = 1
 *   AXIS_Z = 11
 *   AXIS_RZ = 14
 *   AXIS_HAT_X = 15
 *   AXIS_HAT_Y = 16
 *   AXIS_LTRIGGER = 17
 *   AXIS_RTRIGGER = 18
 *   AXIS_BRAKE = 22
 *   AXIS_GAS = 23
 *
 * Pre gamepad sa obyčajne mapuje:
 *   ľavý stick: X, Y
 *   pravý stick: Z, RZ
 *   D-pad: HAT_X, HAT_Y
 *   L2/R2 trigger: LTRIGGER / RTRIGGER (alebo GAS / BRAKE)
 */
export const ANDROID_AXIS_TO_CONTROL: Record<number, string> = {
  0: "lstick-x", // AXIS_X
  1: "lstick-y", // AXIS_Y
  11: "rstick-x", // AXIS_Z
  14: "rstick-y", // AXIS_RZ
  15: "dpad-x", // AXIS_HAT_X
  16: "dpad-y", // AXIS_HAT_Y
  17: "l2-axis", // AXIS_LTRIGGER
  18: "r2-axis", // AXIS_RTRIGGER
};
