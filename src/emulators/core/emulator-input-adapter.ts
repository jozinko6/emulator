/**
 * Unified EmulatorInputAdapter — per prompt section 1 (OVLÁDANIE NA PC).
 *
 * Tento interface je nadradený EmulatorInputEvent systému — umožňuje
 * klávesnici, myši a gamepadu posielať reálne vstupy priamo do emulačného
 * jadra bez toho, aby prechádzali cez React UI.
 *
 * Každý konkrétny adaptér (DosInputAdapter, Ps1InputAdapter) implementuje
 * tieto metódy mapovaním na reálne API jadra (js-dos ci.sendKeyEvent,
 * EJS controller API, atď).
 */
export interface EmulatorInputAdapter {
  /** Fyzická klávesa stlačená (KeyboardEvent.code ako primárny identifikátor). */
  keyDown(code: string): void;
  /** Fyzická klávesa uvoľnená. */
  keyUp(code: string): void;

  /** Relatívny pohyb myši (rozdiel od poslednej pozície). */
  pointerMove(deltaX: number, deltaY: number): void;
  /** Tlačidlo myši stlačené (0=ľavé, 1=stredné, 2=pravé, 3=koliesko hore, 4=koliesko dole). */
  pointerButtonDown(button: number): void;
  /** Tlačidlo myši uvoľnené. */
  pointerButtonUp(button: number): void;
  /** Koliesko myši. */
  pointerWheel(deltaX: number, deltaY: number): void;

  /** Gamepad tlačidlo stlačené (zdieľaný názov — face-a, dpad-up, ...). */
  gamepadButtonDown(button: string): void;
  /** Gamepad tlačidlo uvoľnené. */
  gamepadButtonUp(button: string): void;
  /** Gamepad os sa zmenila (lstick-x, lstick-y, rstick-x, rstick-y). */
  gamepadAxis(axis: string, value: number): void;

  /** Uvoľní všetky aktuálne stlačené vstupy — pri strate focusu, pauze, ukončení. */
  releaseAllInputs(): void;
}

/** No-op input adapter — používa sa, ak emulátor nemá reálne input API. */
export class NullInputAdapter implements EmulatorInputAdapter {
  keyDown(): void {}
  keyUp(): void {}
  pointerMove(): void {}
  pointerButtonDown(): void {}
  pointerButtonUp(): void {}
  pointerWheel(): void {}
  gamepadButtonDown(): void {}
  gamepadButtonUp(): void {}
  gamepadAxis(): void {}
  releaseAllInputs(): void {}
}
