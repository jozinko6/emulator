/**
 * Emulator input — normalizácia `EmulatorInputEvent` a mapovanie ovládača.
 *
 * Per prompt ETAPA 5 (Unified Emulator Core) a ETAPA 7 (Ovládanie).
 *
 * Zdieľané názvy ovládacích prvkov (control) — používajú sa naprieč
 * fyzickými gamepadmi, virtuálnym gamepadom aj DOS touchpadom:
 *
 *   "dpad-up"      "dpad-down"   "dpad-left"   "dpad-right"
 *   "face-a"       "face-b"      "face-x"      "face-y"
 *   "l1"           "l2"          "r1"          "r2"
 *   "l3"           "r3"
 *   "start"        "select"
 *   "lstick-x"     "lstick-y"    "rstick-x"    "rstick-y"
 *
 * Pre DOS / klávesnicu sa používajú názvy kláves:
 *   "key-escape" "key-enter" "key-space" "key-tab" "key-backspace"
 *   "key-up" "key-down" "key-left" "key-right"
 *   "key-ctrl" "key-alt" "key-shift"
 *   "key-f1" ... "key-f12"
 *   "key-a" ... "key-z" "key-0" ... "key-9"
 *
 * Komentáre v slovenčine.
 */
import type { EmulatorInputEvent } from "@/types/emulator";

/**
 * Štandardné mapovanie Gamepad API tlačidiel na zdieľané názvy.
 *
 * Toto je defaultná mapovacia tabuľka pre štandardné gamepady (Xbox, DualShock,
 * DualSense, generické) — indexy zodpovedajú štandardu W3C Gamepad API.
 *
 * Standard Mapping (W3C):
 *   0: face-a (Cross / A)
 *   1: face-b (Circle / B)
 *   2: face-x (Square / X)
 *   3: face-y (Triangle / Y)
 *   4: l1 (L bumper)
 *   5: r1 (R bumper)
 *   6: l2 (L trigger - analog)
 *   7: r2 (R trigger - analog)
 *   8: select (Share / Back)
 *   9: start (Options / Start)
 *   10: l3 (L stick click)
 *   11: r3 (R stick click)
 *   12: dpad-up
 *   13: dpad-down
 *   14: dpad-left
 *   15: dpad-right
 *   16: home (PS / Xbox button)
 *
 * Osí:
 *   axes[0]: lstick-x (-1 = left, +1 = right)
 *   axes[1]: lstick-y (-1 = up, +1 = down)
 *   axes[2]: rstick-x
 *   axes[3]: rstick-y
 */
export const STANDARD_BUTTON_MAP: Record<number, string> = {
  0: "face-a",
  1: "face-b",
  2: "face-x",
  3: "face-y",
  4: "l1",
  5: "r1",
  6: "l2",
  7: "r2",
  8: "select",
  9: "start",
  10: "l3",
  11: "r3",
  12: "dpad-up",
  13: "dpad-down",
  14: "dpad-left",
  15: "dpad-right",
  16: "home",
};

export const STANDARD_AXIS_MAP: Record<number, string> = {
  0: "lstick-x",
  1: "lstick-y",
  2: "rstick-x",
  3: "rstick-y",
};

/**
 * Aplikuje deadzone na os — hodnoty menšie než deadzone sa považujú za nulu.
 *
 * @param value hodnota osi (-1..1)
 * @param deadzone deadzone (0..1)
 * @returns hodnota s aplikovaným deadzone-om
 */
export function applyDeadzone(value: number, deadzone: number): number {
  if (Math.abs(value) < deadzone) return 0;
  // Normalizuj hodnotu mimo deadzone, aby bol prechod plynulý
  const sign = Math.sign(value);
  const magnitude = Math.abs(value);
  const normalized = (magnitude - deadzone) / (1 - deadzone);
  return sign * Math.max(0, Math.min(1, normalized));
}

/**
 * Aplikuje citlivosť (sensitivity) na os.
 *
 * @param value hodnota osi (-1..1)
 * @param sensitivity multiplikátor (1.0 = lineárna)
 */
export function applySensitivity(value: number, sensitivity: number): number {
  return Math.max(-1, Math.min(1, value * sensitivity));
}

/**
 * Vytvorí `EmulatorInputEvent` pre stlačenie tlačidla.
 */
export function makeButtonEvent(
  control: string,
  pressed: boolean,
  value?: number
): EmulatorInputEvent {
  return {
    type: pressed ? "button-down" : "button-up",
    control,
    value: value ?? (pressed ? 1 : 0),
    timestamp: Date.now(),
  };
}

/**
 * Vytvorí `EmulatorInputEvent` pre zmenu osi.
 */
export function makeAxisEvent(
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

/**
 * Vytvorí `EmulatorInputEvent` pre klávesu (DOS klávesnica).
 */
export function makeKeyEvent(
  control: string,
  pressed: boolean
): EmulatorInputEvent {
  return {
    type: pressed ? "key-down" : "key-up",
    control,
    timestamp: Date.now(),
  };
}

/**
 * Vytvorí `EmulatorInputEvent` pre pointer (dotyk, myš).
 */
export function makePointerEvent(
  x: number,
  y: number,
  control: string = "pointer"
): EmulatorInputEvent {
  return {
    type: "pointer",
    control,
    x,
    y,
    timestamp: Date.now(),
  };
}

/**
 * Identifikátor štandardného ovládača.
 *
 * Podporované profily: Xbox, DualShock (PS4), DualSense (PS5), generic.
 */
export type GamepadProfile = "xbox" | "dualshock" | "dualsense" | "generic";

/**
 * Rozpozná typ ovládača podľa `gamepad.id`.
 *
 * `gamepad.id` je reťazec, ktorý obsahuje identifikátor výrobcu — obyčajne
 * vo formáte "Vendor Name VendorID-ProductID-...".
 */
export function detectGamepadProfile(gamepadId: string): GamepadProfile {
  const lower = gamepadId.toLowerCase();
  if (lower.includes("dualsense") || lower.includes("054c-0ce6")) return "dualsense";
  if (lower.includes("dualshock") || lower.includes("054c-05c4") || lower.includes("054c-09cc")) {
    return "dualshock";
  }
  if (lower.includes("xbox") || lower.includes("xinput") || lower.includes("045e")) {
    return "xbox";
  }
  return "generic";
}

/**
 * Pomocná tabuľka: pre PS1/PS2 face tlačidlá potrebujeme PSX usporiadanie
 * (Square / Cross / Circle / Triangle). W3C mapping má:
 *   0 = Cross (face-a)
 *   1 = Circle (face-b)
 *   2 = Square (face-x)
 *   3 = Triangle (face-y)
 *
 * Pre PSX/PS2 adaptery (pcsx-rearmed) sa obyčajne očakáva Cross=A, Circle=B,
 * Square=X, Triangle=Y — toto zodpovedá W3C mapping. Preto sa mapovanie
 * nemení.
 */
export function mapPsxButtonToEJS(control: string): string | null {
  // EJS controller button IDs (typicky):
  //   0 = a (Cross), 1 = b (Circle), 2 = x (Square), 3 = y (Triangle)
  //   4 = l1, 5 = r1, 6 = l2, 7 = r2
  //   8 = select, 9 = start, 10 = l3, 11 = r3
  //   12 = up, 13 = down, 14 = left, 15 = right
  const map: Record<string, number> = {
    "face-a": 0,
    "face-b": 1,
    "face-x": 2,
    "face-y": 3,
    "l1": 4,
    "r1": 5,
    "l2": 6,
    "r2": 7,
    "select": 8,
    "start": 9,
    "l3": 10,
    "r3": 11,
    "dpad-up": 12,
    "dpad-down": 13,
    "dpad-left": 14,
    "dpad-right": 15,
  };
  const id = map[control];
  return id === undefined ? null : String(id);
}

/**
 * Pre js-dos (DOS): konvertuje `control` na js-dos klávesovú mapu.
 *
 * js-dos používa `ci.simulateKeyEvent(code, pressed)` s kódmi z
 * DOS keyboard layoutu. Tu mapujeme iba často používané klávesy.
 */
export function mapControlToDosKeyCode(control: string): number | null {
  // js-dos key codes (z DOSBOX keymap):
  // Kompletný zoznam je v js-dos sources (dos_key_codes.h).
  // Tu mapujeme len zdieľané názvy, ktoré prichádzajú z virtual-gamepad / gamepad-manager.
  const map: Record<string, number> = {
    "key-escape": 1,
    "key-1": 2, "key-2": 3, "key-3": 4, "key-4": 5, "key-5": 6,
    "key-6": 7, "key-7": 8, "key-8": 9, "key-9": 10, "key-0": 11,
    "key-minus": 12, "key-equals": 13,
    "key-backspace": 14,
    "key-tab": 15,
    "key-q": 16, "key-w": 17, "key-e": 18, "key-r": 19, "key-t": 20,
    "key-y": 21, "key-u": 22, "key-i": 23, "key-o": 24, "key-p": 25,
    "key-a": 30, "key-s": 31, "key-d": 32, "key-f": 33, "key-g": 34,
    "key-h": 35, "key-j": 36, "key-k": 37, "key-l": 38,
    "key-z": 44, "key-x": 45, "key-c": 46, "key-v": 47, "key-b": 48,
    "key-n": 49, "key-m": 50,
    "key-enter": 28,
    "key-lctrl": 29, "key-rctrl": 29,
    "key-lalt": 56, "key-ralt": 56,
    "key-lshift": 42, "key-rshift": 54,
    "key-space": 57,
    "key-up": 72, "key-down": 80,
    "key-left": 75, "key-right": 77,
    "key-f1": 59, "key-f2": 60, "key-f3": 61, "key-f4": 62,
    "key-f5": 63, "key-f6": 64, "key-f7": 65, "key-f8": 66,
    "key-f9": 67, "key-f10": 68, "key-f11": 87, "key-f12": 88,
  };
  const code = map[control];
  return code ?? null;
}
