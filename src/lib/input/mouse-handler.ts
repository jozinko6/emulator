"use client";

/**
 * Physical mouse handler — per prompt section 3.
 *
 * Implementuje:
 *   - click na hernú obrazovku → request Pointer Lock
 *   - relatívny pohyb myši (movementX/Y) → adapter.pointerMove()
 *   - ľavé, pravé, stredné tlačidlo + koliesko
 *   - Escape uvoľní pointer lock (prehliadač to robí automaticky)
 *   - krátke vysvetlenie pre používateľa pri prvom lock-u
 *   - možnosť vypnúť Pointer Lock v nastaveniach
 *   - fallback s absolútnou polohou pre zariadenia bez Pointer Lock
 */
import type { EmulatorInputAdapter } from "@/emulators/core/emulator-input-adapter";

export interface MouseHandlerOptions {
  adapter: EmulatorInputAdapter;
  target: HTMLElement;
  /** Povoliť Pointer Lock (default = true). Vypnuteľné v nastaveniach. */
  enablePointerLock?: boolean;
  /** Callback pri zmene pointer lock stavu (pre zobrazenie vysvetlenia). */
  onPointerLockChange?: (locked: boolean) => void;
  /** Callback pri chybe pointer lock. */
  onPointerLockError?: (error: Event) => void;
}

export class MouseHandler {
  private readonly adapter: EmulatorInputAdapter;
  private readonly target: HTMLElement;
  private readonly enablePointerLock: boolean;
  private readonly onPointerLockChange?: (locked: boolean) => void;
  private readonly onPointerLockError?: (error: Event) => void;
  private active = false;
  private locked = false;
  private readonly pressedButtons = new Set<number>();
  private boundClick: (e: MouseEvent) => void;
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseUp: (e: MouseEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundWheel: (e: WheelEvent) => void;
  private boundPointerLockChange: () => void;
  private boundPointerLockError: (e: Event) => void;

  constructor(opts: MouseHandlerOptions) {
    this.adapter = opts.adapter;
    this.target = opts.target;
    this.enablePointerLock = opts.enablePointerLock ?? true;
    this.onPointerLockChange = opts.onPointerLockChange;
    this.onPointerLockError = opts.onPointerLockError;

    this.boundClick = this.handleClick.bind(this);
    this.boundMouseDown = this.handleMouseDown.bind(this);
    this.boundMouseUp = this.handleMouseUp.bind(this);
    this.boundMouseMove = this.handleMouseMove.bind(this);
    this.boundWheel = this.handleWheel.bind(this);
    this.boundPointerLockChange = this.handlePointerLockChange.bind(this);
    this.boundPointerLockError = this.handlePointerLockError.bind(this);
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    // Click spustí pointer lock
    this.target.addEventListener("click", this.boundClick);
    this.target.addEventListener("mousedown", this.boundMouseDown);
    window.addEventListener("mouseup", this.boundMouseUp);
    this.target.addEventListener("mousemove", this.boundMouseMove);
    this.target.addEventListener("wheel", this.boundWheel, { passive: false });
    document.addEventListener("pointerlockchange", this.boundPointerLockChange);
    document.addEventListener("pointerlockerror", this.boundPointerLockError);
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.target.removeEventListener("click", this.boundClick);
    this.target.removeEventListener("mousedown", this.boundMouseDown);
    window.removeEventListener("mouseup", this.boundMouseUp);
    this.target.removeEventListener("mousemove", this.boundMouseMove);
    this.target.removeEventListener("wheel", this.boundWheel);
    document.removeEventListener("pointerlockchange", this.boundPointerLockChange);
    document.removeEventListener("pointerlockerror", this.boundPointerLockError);
    this.releaseAll();
    if (this.locked) {
      document.exitPointerLock();
    }
  }

  isLocked(): boolean {
    return this.locked;
  }

  /** Explicitne uvoľní všetky stlačené tlačidlá myši. */
  releaseAll(): void {
    if (this.pressedButtons.size === 0) return;
    const buttons = Array.from(this.pressedButtons);
    this.pressedButtons.clear();
    for (const b of buttons) {
      this.adapter.pointerButtonUp(b);
    }
  }

  /** Manuálne požiada o Pointer Lock (mimo click handlera). */
  async requestLock(): Promise<void> {
    if (!this.enablePointerLock) return;
    if (typeof this.target.requestPointerLock !== "function") return;
    try {
      // requestPointerLock v modernom Chrome vracia Promise (unprefixed)
      const result = this.target.requestPointerLock() as unknown;
      if (result instanceof Promise) {
        await result;
      }
    } catch (e) {
      // Legacy API nepotrebuje Promise handling
      console.warn("Pointer lock request failed", e);
    }
  }

  /** Manuálne uvoľní Pointer Lock. */
  exitLock(): void {
    if (this.locked && document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  private handleClick(_e: MouseEvent): void {
    if (!this.enablePointerLock || this.locked) return;
    void this.requestLock();
  }

  private handleMouseDown(e: MouseEvent): void {
    this.pressedButtons.add(e.button);
    this.adapter.pointerButtonDown(e.button);
    if (this.locked) {
      e.preventDefault();
    }
  }

  private handleMouseUp(e: MouseEvent): void {
    if (!this.pressedButtons.has(e.button)) return;
    this.pressedButtons.delete(e.button);
    this.adapter.pointerButtonUp(e.button);
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this.locked) {
      // Pointer Lock mode — relatívny pohyb
      this.adapter.pointerMove(e.movementX, e.movementY);
    } else {
      // Fallback mode — absolútny pohyb (malé delta od poslednej pozície)
      this.adapter.pointerMove(e.movementX || 0, e.movementY || 0);
    }
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    this.adapter.pointerWheel(e.deltaX, e.deltaY);
  }

  private handlePointerLockChange(): void {
    this.locked = document.pointerLockElement === this.target;
    this.onPointerLockChange?.(this.locked);
    if (!this.locked) {
      // Pri uvoľnení lock-u uvoľni stlačené tlačidlá
      this.releaseAll();
    }
  }

  private handlePointerLockError(e: Event): void {
    this.locked = false;
    this.onPointerLockError?.(e);
  }
}
