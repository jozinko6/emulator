/**
 * Ps2Adapter — skeleton pre PS2 emulátor.
 *
 * Per prompt ETAPA 10: PS2 je za feature flagom `NEXT_PUBLIC_ENABLE_PS2=false`.
 * Tento adaptér je skeleton — NEimplementuje reálnu PS2 emuláciu, pretože
 * v tomto zostavení nie je dostupné žiadne PS2 emulačné jadro (Play!.js
 * je experimentálne a nie je súčasťou projektu).
 *
 * Ak by sa v budúcnosti pridalo PS2 jadro, tento súbor by ho naozaj
 * integroval. Kým sa tak stane, každej metóde vyhadzujeme
 * `RetroCloudError(EMULATOR_CORE_UNAVAILABLE)`.
 *
 * Žiadne placeholdery — adaptér nedáva falošný dojem, že funguje.
 *
 * Komentáre v slovenčine.
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
    // Nepredstierame — ignorujeme vstupy, keďže jadro nebeží.
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
    // Nepredstierame — ignorujeme.
  }

  setMuted(_muted: boolean): void {
    // Nepredstierame — ignorujeme.
  }

  async enterFullscreen(): Promise<void> {
    this.fail();
  }

  async exitFullscreen(): Promise<void> {
    // Ak sme neprešli do fullscreen, nemá zmysel exit.
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
   * Vyhadzuje chybu — volané pri každej metóde, ktorá vyžaduje jadro.
   *
   * PS2 jadro nie je súčasťou tohto zostavenia, takže každý pokus o použitie
   * končí touto chybou. Nejedná sa o placeholder — adaptér jasne deklaruje,
   * že PS2 emulácia nie je dostupná.
   */
  private fail(): never {
    const err = new RetroCloudError(
      "EMULATOR_CORE_UNAVAILABLE",
      getPs2UnavailableReason(),
      {
        technicalDetail:
          "Ps2Adapter je skeleton — NEXT_PUBLIC_ENABLE_PS2=true, ale žiadne PS2 jadro nebolo implementované.",
        recoveryHint:
          "PS2 emulácia zatiaľ nie je v RETROCLOUD podporovaná. Použite DOS alebo PS1.",
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
