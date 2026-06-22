/**
 * Ps2Adapter â€” skeleton pre PS2 emulĂˇtor.
 *
 * Per prompt ETAPA 10: PS2 je za feature flagom `NEXT_PUBLIC_ENABLE_PS2=false`.
 * Tento adaptĂ©r je skeleton â€” NEimplementuje reĂˇlnu PS2 emulĂˇciu, pretoĹľe
 * v tomto zostavenĂ­ nie je dostupnĂ© Ĺľiadne PS2 emulaÄŤnĂ© jadro (Play!.js
 * je experimentĂˇlne a nie je sĂşÄŤasĹĄou projektu).
 *
 * Ak by sa v budĂşcnosti pridalo PS2 jadro, tento sĂşbor by ho naozaj
 * integroval. KĂ˝m sa tak stane, kaĹľdej metĂłde vyhadzujeme
 * `RetroCloudError(EMULATOR_CORE_UNAVAILABLE)`.
 *
 * Ĺ˝iadne placeholdery â€” adaptĂ©r nedĂˇva faloĹˇnĂ˝ dojem, Ĺľe funguje.
 *
 * KomentĂˇre v slovenÄŤine.
 */
import type {
  EmulatorAdapter,
  EmulatorLifecycleState,
  EmulatorInputEvent,
  EmulatorEvent,
  EmulatorPerformanceStats,
  ImportedGame,
  StoredSaveState,
} from "@/types/emulator";
import { RetroCloudError } from "@/types/errors";
import { createEmitter } from "@/emulators/core/emulator-events";
import { getPs2UnavailableReason } from "@/emulators/ps2/ps2-availability";

export class Ps2Adapter implements EmulatorAdapter {
  readonly platform = "ps2" as const;

  private _state: EmulatorLifecycleState = "idle";
  private emitter = createEmitter();

  get state(): EmulatorLifecycleState {
    return this._state;
  }

  async initialize(_container: HTMLElement): Promise<void> {
    this.fail();
  }

  async loadGame(_game: ImportedGame): Promise<void> {
    this.fail();
  }

  async start(): Promise<void> {
    this.fail();
  }

  async pause(): Promise<void> {
    this.fail();
  }

  async resume(): Promise<void> {
    this.fail();
  }

  async reset(): Promise<void> {
    this.fail();
  }

  sendInput(_event: EmulatorInputEvent): void {
    // Nepredstierame â€” ignorujeme vstupy, keÄŹĹľe jadro nebeĹľĂ­.
  }

  async saveState(_slot: number): Promise<StoredSaveState> {
    this.fail();
  }

  async loadState(_slot: number): Promise<void> {
    this.fail();
  }

  async deleteState(_slot: number): Promise<void> {
    this.fail();
  }

  setVolume(_volume: number): void {
    // Nepredstierame â€” ignorujeme.
  }

  setMuted(_muted: boolean): void {
    // Nepredstierame â€” ignorujeme.
  }

  async enterFullscreen(): Promise<void> {
    this.fail();
  }

  async exitFullscreen(): Promise<void> {
    // Ak sme nepreĹˇli do fullscreen, nemĂˇ zmysel exit.
  }

  getPerformanceStats(): EmulatorPerformanceStats {
    return { fps: 0, frameTimeMs: 0, timestamp: Date.now() };
  }

  async destroy(): Promise<void> {
    this.emitter.clear();
    this._state = "destroyed";
  }

  subscribe(listener: (event: EmulatorEvent) => void): () => void {
    return this.emitter.subscribe(listener);
  }

  /**
   * Vyhadzuje chybu â€” volanĂ© pri kaĹľdej metĂłde, ktorĂˇ vyĹľaduje jadro.
   *
   * PS2 jadro nie je sĂşÄŤasĹĄou tohto zostavenia, takĹľe kaĹľdĂ˝ pokus o pouĹľitie
   * konÄŤĂ­ touto chybou. NejednĂˇ sa o placeholder â€” adaptĂ©r jasne deklaruje,
   * Ĺľe PS2 emulĂˇcia nie je dostupnĂˇ.
   */
  private fail(): never {
    const err = new RetroCloudError(
      "EMULATOR_CORE_UNAVAILABLE",
      getPs2UnavailableReason(),
      {
        technicalDetail:
          "Ps2Adapter je skeleton â€” NEXT_PUBLIC_ENABLE_PS2=true, ale Ĺľiadne PS2 jadro nebolo implementovanĂ©.",
        recoveryHint:
          "PS2 emulĂˇcia zatiaÄľ nie je v Jaňo še chce bavkac podporovanĂˇ. PouĹľite DOS alebo PS1.",
      }
    );
    this._state = "error";
    this.emitter.emit({
      type: "error",
      timestamp: Date.now(),
      error: { code: err.code, message: err.message },
    });
    throw err;
  }
}
