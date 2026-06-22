"use client";

/**
 * Physical keyboard handler — per prompt section 2.
 *
 * Používa `KeyboardEvent.code` (fyzická pozícia klávesy) ako primárny identifikátor,
 * NIE `KeyboardEvent.key` (logická hodnota závislá od rozloženia).
 *
 * Funkcie:
 *   - keydown / keyup listener na document
 *   - ochrana proti repeatu (e.repeat sa ignoruje)
 *   - trackovanie všetkých aktuálne stlačených kláves
 *   - release všetkých kláves pri strate focusu / visibilitychange / blur
 *   - release pri pauze / ukončení hry (explicitné volanie)
 *   - zabránenie systémovým skratkám (F5, Ctrl+W, ...) počas hrania
 *   - nastaviteľné mapovanie klávesnice per hra
 */
import type { EmulatorInputAdapter } from "@/emulators/core/emulator-input-adapter";

export interface KeyboardHandlerOptions {
  /** Cieľový input adapter (DosInputAdapter / Ps1InputAdapter). */
  adapter: EmulatorInputAdapter;
  /** Element, na ktorom sa zachytávajú klávesy (default = document). */
  target?: HTMLElement | Document;
  /** Zoznam klávesových kódov, ktoré sa majú zachytiť (default = všetky). */
  allowedCodes?: Set<string>;
  /** Zoznam klávesových kódov, ktoré sa majú ignorovať. */
  ignoredCodes?: Set<string>;
  /** Vlastné mapovanie code → akcia (override defaultnej logiky). */
  customMap?: Record<string, string>;
  /** Zablokuje systémové skratky počas hrania (default = true). */
  blockSystemShortcuts?: boolean;
}

/** Klávesy, ktoré Chrome/Firefox interpretujú ako systémové skratky — necháme prehliadaču. */
const SYSTEM_SHORTCODES = new Set<string>([
  "F5", "F6", "F7", "F11", "F12",
  "Escape", // Escape uvoľní pointer lock, necháme prehliadaču
]);

export class KeyboardHandler {
  private readonly adapter: EmulatorInputAdapter;
  private readonly target: HTMLElement | Document;
  private readonly allowedCodes?: Set<string>;
  private readonly ignoredCodes: Set<string>;
  private readonly blockSystemShortcuts: boolean;
  private readonly pressed = new Set<string>();
  private active = false;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundBlur: () => void;
  private boundVisibility: () => void;
  private boundFocusOut: (e: FocusEvent) => void;

  constructor(opts: KeyboardHandlerOptions) {
    this.adapter = opts.adapter;
    this.target = opts.target ?? document;
    this.allowedCodes = opts.allowedCodes;
    this.ignoredCodes = opts.ignoredCodes ?? new Set();
    this.blockSystemShortcuts = opts.blockSystemShortcuts ?? true;

    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
    this.boundBlur = this.releaseAll.bind(this);
    this.boundVisibility = this.handleVisibilityChange.bind(this);
    this.boundFocusOut = this.handleFocusOut.bind(this);
  }

  /** Spustí zachytávanie klávesnice. */
  start(): void {
    if (this.active) return;
    this.active = true;
    this.target.addEventListener("keydown", this.boundKeyDown as EventListener, { capture: true });
    this.target.addEventListener("keyup", this.boundKeyUp as EventListener, { capture: true });
    window.addEventListener("blur", this.boundBlur);
    document.addEventListener("visibilitychange", this.boundVisibility);
    window.addEventListener("focusout", this.boundFocusOut as EventListener, { capture: true });
  }

  /** Zastaví zachytávanie a uvoľní všetky stlačené klávesy. */
  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.target.removeEventListener("keydown", this.boundKeyDown as EventListener, { capture: true });
    this.target.removeEventListener("keyup", this.boundKeyUp as EventListener, { capture: true });
    window.removeEventListener("blur", this.boundBlur);
    document.removeEventListener("visibilitychange", this.boundVisibility);
    window.removeEventListener("focusout", this.boundFocusOut as EventListener, { capture: true });
    this.releaseAll();
  }

  /** Explicitne uvoľní všetky stlačené klávesy — pri pauze, ukončení hry. */
  releaseAll(): void {
    if (this.pressed.size === 0) return;
    const codes = Array.from(this.pressed);
    this.pressed.clear();
    for (const code of codes) {
      this.adapter.keyUp(code);
    }
  }

  /** Vráti zoznam aktuálne stlačených klávesových kódov. */
  getPressedCodes(): string[] {
    return Array.from(this.pressed);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.repeat) {
      if (this.shouldPreventDefault(e.code)) {
        e.preventDefault();
      }
      return;
    }

    const code = e.code;
    if (!this.shouldHandle(code)) return;

    if (this.blockSystemShortcuts && SYSTEM_SHORTCODES.has(code) && !this.ignoredCodes.has(code)) {
      return;
    }

    this.pressed.add(code);
    this.adapter.keyDown(code);

    if (this.shouldPreventDefault(code)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    const code = e.code;
    if (!this.shouldHandle(code)) return;

    if (!this.pressed.has(code)) return;
    this.pressed.delete(code);
    this.adapter.keyUp(code);
  }

  private shouldHandle(code: string): boolean {
    if (this.ignoredCodes.has(code)) return false;
    if (this.allowedCodes && !this.allowedCodes.has(code)) return false;
    return true;
  }

  private shouldPreventDefault(code: string): boolean {
    const prevent = [
      "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
      "Space", "Tab", "PageUp", "PageDown", "Home", "End",
      "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
    ];
    return prevent.includes(code);
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.releaseAll();
    }
  }

  private handleFocusOut(e: FocusEvent): void {
    if (e.relatedTarget === null) {
      this.releaseAll();
    }
  }
}

/**
 * Konvertuje `KeyboardEvent.code` na zdieľaný názov klávesy pre EmulatorInputEvent.
 * Používa sa v DosInputAdapter.
 */
export function codeToControl(code: string): string {
  if (/^Key[A-Z]$/.test(code)) {
    return `key-${code.slice(3).toLowerCase()}`;
  }
  if (/^Digit[0-9]$/.test(code)) {
    return `key-${code.slice(5)}`;
  }
  if (/^Numpad[0-9]$/.test(code)) {
    return `key-numpad-${code.slice(6)}`;
  }
  if (code === "NumpadEnter") return "key-numpad-enter";
  if (code === "NumpadDecimal") return "key-numpad-decimal";
  if (code === "NumpadAdd") return "key-numpad-add";
  if (code === "NumpadSubtract") return "key-numpad-subtract";
  if (code === "NumpadMultiply") return "key-numpad-multiply";
  if (code === "NumpadDivide") return "key-numpad-divide";
  if (/^F[1-9]$|^F1[0-2]$/.test(code)) {
    return `key-${code.toLowerCase()}`;
  }
  const arrowMap: Record<string, string> = {
    ArrowUp: "key-up",
    ArrowDown: "key-down",
    ArrowLeft: "key-left",
    ArrowRight: "key-right",
  };
  if (arrowMap[code]) return arrowMap[code];
  const specialMap: Record<string, string> = {
    Space: "key-space",
    Enter: "key-enter",
    NumpadEnter: "key-enter",
    Escape: "key-escape",
    Backspace: "key-backspace",
    Tab: "key-tab",
    Insert: "key-insert",
    Delete: "key-delete",
    Home: "key-home",
    End: "key-end",
    PageUp: "key-pageup",
    PageDown: "key-pagedown",
    ControlLeft: "key-ctrl",
    ControlRight: "key-ctrl",
    AltLeft: "key-alt",
    AltRight: "key-alt",
    ShiftLeft: "key-shift",
    ShiftRight: "key-shift",
    CapsLock: "key-capslock",
    Minus: "key-minus",
    Equal: "key-equals",
    BracketLeft: "key-bracket-left",
    BracketRight: "key-bracket-right",
    Backslash: "key-backslash",
    Semicolon: "key-semicolon",
    Quote: "key-quote",
    Comma: "key-comma",
    Period: "key-period",
    Slash: "key-slash",
    Backquote: "key-backquote",
  };
  return specialMap[code] ?? `key-${code.toLowerCase()}`;
}
