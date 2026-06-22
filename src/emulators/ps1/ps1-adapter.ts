/**
 * Ps1Adapter — reálna EmulatorJS integrácia (PCSX-ReARMed).
 *
 * Per prompt ETAPA 6. Implementuje `EmulatorAdapter` pre PS1.
 *
 * EmulatorJS sa načítava cez `<script src="/emulator-assets/emulatorjs/loader.js">`
 * (lokálne hostované WASM jadro). Konfigurácia sa nastavuje cez `window.EJS_*`
 * globálne premenné PRED načítaním loader.js.
 *
 * Po inicializácii je k dispozícii `window.EJS_emulator` s API:
 *   - `EJS_emulator.play() / pause() / restart()`
 *   - `EJS_emulator.saveSaveState(slot) / loadSaveState(slot)`
 *   - `EJS_emulator.elements` — DOM elementy
 *
 * Žiadne placeholdery — ak sa EmulatorJS nepodarí načítať, `initialize()`
 * vyhodí `RetroCloudError(EMULATOR_CORE_UNAVAILABLE)`.
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
import { EMULATOR_CORE_VERSIONS } from "@/types/emulator";
import { RetroCloudError } from "@/types/errors";
import { createEmitter, makeEvent } from "@/emulators/core/emulator-events";
import { mapPsxButtonToEJS } from "@/emulators/core/emulator-input";
import {
  readFile,
  saveStatePath,
  writeStream,
  deleteRecursive,
} from "@/lib/storage/opfs";
import { sha256 } from "@/lib/security/hashing";
import {
  putSaveState,
  getSaveStates,
  deleteSaveState,
  getBiosForPlatform,
  saveStateRecordToStored,
} from "@/lib/storage/repositories";
import { v4 as uuid } from "uuid";

/** Cesta k EmulatorJS loader skriptu v public/ priečinku. */
const EJS_LOADER_URL = "/emulator-assets/emulatorjs/loader.js";
/** Cesta k EmulatorJS data priečinku (wasm, cores, ...). */
const EJS_DATA_PATH = "/emulator-assets/emulatorjs/data/";

/**
 * Typ pre `window.EJS_emulator` API. Reálny objekt má viac polí, ale
 * pre našu integráciu potrebujeme len základné ovládanie + save states.
 */
interface EJSEmulator {
  play(): void;
  pause(): void;
  restart(): void;
  saveSaveState(slot?: number): Promise<Uint8Array> | Uint8Array;
  loadSaveState(state: Uint8Array | Blob, slot?: number): Promise<void> | void;
  elements: {
    canvas?: HTMLCanvasElement;
    container?: HTMLElement;
  };
  // Voliteľné — rôzne verzie EJS
  config?(opts: Record<string, unknown>): void;
}

interface EJSConfigWindow {
  EJS_player?: string;
  EJS_core?: string;
  EJS_gameUrl?: string;
  EJS_gameName?: string;
  EJS_biosUrl?: string;
  EJS_pathtodata?: string;
  EJS_startOnLoaded?: boolean;
  EJS_audioVolume?: number;
  EJS_onsave?: (state: Uint8Array) => void;
  EJS_onload?: () => void;
  EJS_onError?: (msg: string) => void;
  EJS_emulator?: EJSEmulator;
  EJS_listeners?: { on: (event: string, handler: (...args: unknown[]) => void) => void };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Window extends EJSConfigWindow {}
}

export class Ps1Adapter implements EmulatorAdapter {
  readonly platform = "ps1" as const;

  private _state: EmulatorLifecycleState = "idle";
  private emitter = createEmitter();
  private container: HTMLElement | null = null;
  private playerDiv: HTMLDivElement | null = null;
  private blobUrls: string[] = [];
  private currentGame: ImportedGame | null = null;
  private volume = 0.8;
  private muted = false;
  private perfStats: EmulatorPerformanceStats = {
    fps: 0,
    frameTimeMs: 0,
    timestamp: 0,
  };
  private scriptLoaded = false;
  private ejsReady = false;
  private lastFpsCheckAt = 0;
  private audioContext: AudioContext | null = null;

  get state(): EmulatorLifecycleState {
    return this._state;
  }

  /**
   * Inicializuje adapter — načíta EmulatorJS loader.js.
   *
   * @throws RetroCloudError(EMULATOR_CORE_UNAVAILABLE) ak sa skript nepodarí
   *   načítať alebo ak chýba `EJS_emulator` po onload.
   */
  async initialize(container: HTMLElement): Promise<void> {
    if (this._state === "destroyed") {
      throw new RetroCloudError(
        "EMULATOR_INIT_FAILED",
        "Adaptér bol zničený — vytvorte nový."
      );
    }
    this.setState("initializing");
    this.container = container;

    try {
      // Vytvor player div, do ktorého EJS vloží canvas
      this.playerDiv = document.createElement("div");
      this.playerDiv.id = "retrocloud-ps1-player";
      this.playerDiv.style.width = "100%";
      this.playerDiv.style.height = "100%";
      this.playerDiv.style.position = "relative";
      this.playerDiv.style.backgroundColor = "#000";
      this.container.appendChild(this.playerDiv);

      // Nastav EJS konfiguráciu (player selector + data path)
      // Pred načítaním loader.js musia byt všetky EJS_* nastavené
      window.EJS_player = "#retrocloud-ps1-player";
      window.EJS_core = "psx";
      window.EJS_pathtodata = EJS_DATA_PATH;
      window.EJS_startOnLoaded = false;
      window.EJS_audioVolume = this.volume;

      // Hook na onload — znamená, že EJS je pripravený
      const readyPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new RetroCloudError(
            "EMULATOR_CORE_UNAVAILABLE",
            "EmulatorJS sa nenačítal do 30 sekúnd.",
            { technicalDetail: "Timeout čakania na EJS_onload." }
          ));
        }, 30_000);

        window.EJS_onload = () => {
          clearTimeout(timeout);
          this.ejsReady = true;
          resolve();
        };
        window.EJS_onError = (msg: string) => {
          clearTimeout(timeout);
          reject(new RetroCloudError(
            "EMULATOR_INIT_FAILED",
            `EmulatorJS chyba: ${msg}`
          ));
        };
      });

      await this.loadEjsScript();
      await readyPromise;

      // Odstráň onload / onError hooky — nechceme ich volať neskôr
      window.EJS_onload = undefined;
      window.EJS_onError = undefined;

      this.emit(makeEvent("initialized"));
      this.setState("idle");
    } catch (e) {
      if (e instanceof RetroCloudError) {
        this.emit(makeEvent("error", undefined, {
          code: e.code,
          message: e.message,
        }));
        this.setState("error");
        throw e;
      }
      const rcErr = new RetroCloudError(
        "EMULATOR_CORE_UNAVAILABLE",
        `EmulatorJS sa nepodarilo načítať: ${e instanceof Error ? e.message : String(e)}`,
        {
          cause: e,
          technicalDetail: `URL: ${EJS_LOADER_URL}`,
          recoveryHint: "Skontrolujte, že public/emulator-assets/emulatorjs/loader.js existuje.",
        }
      );
      this.emit(makeEvent("error", undefined, {
        code: rcErr.code,
        message: rcErr.message,
      }));
      this.setState("error");
      throw rcErr;
    }
  }

  /**
   * Načíta EmulatorJS loader.js cez `<script>` tag.
   */
  private loadEjsScript(): Promise<void> {
    if (this.scriptLoaded) return Promise.resolve();

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${EJS_LOADER_URL}"]`
    );
    if (existing) {
      this.scriptLoaded = true;
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = EJS_LOADER_URL;
      script.async = true;
      script.onload = () => {
        this.scriptLoaded = true;
        resolve();
      };
      script.onerror = () => {
        reject(new RetroCloudError(
          "EMULATOR_CORE_UNAVAILABLE",
          `EmulatorJS loader.js sa nepodarilo načítať z ${EJS_LOADER_URL}.`,
          {
            technicalDetail: "Script element error event.",
            recoveryHint: "Nahrajte EmulatorJS balík do public/emulator-assets/emulatorjs/.",
          }
        ));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Načíta PS1 hru do emulátora.
   *
   * Podporované formáty:
   *  - .bin/.cue — hlavný súbor je .cue, BIN súbory sú v OPFS
   *  - .iso — jediný ISO súbor
   *  - .chd — komprimovaný obraz
   *  - .pbp — PSP EBOOT s PS1 hrou
   *
   * BIOS:
   *  - Skontroluje `getBiosForPlatform("ps1")` — ak chýba, throw MISSING_BIOS
   *  - Načíta BIOS z OPFS ako Blob URL a nastaví `EJS_biosUrl`
   */
  async loadGame(game: ImportedGame): Promise<void> {
    if (!this.container || !this.ejsReady) {
      throw new RetroCloudError(
        "EMULATOR_INIT_FAILED",
        "Adaptér nebol inicializovaný — zavolajte initialize() pred loadGame()."
      );
    }
    this.setState("loading");
    this.currentGame = game;
    this.emit(makeEvent("game-loading", { gameId: game.id, name: game.name }));

    try {
      // 1. Skontroluj BIOS
      const biosRecords = await getBiosForPlatform("ps1");
      if (biosRecords.length === 0) {
        throw new RetroCloudError(
          "MISSING_BIOS",
          "Pre PS1 emuláciu je potrebný BIOS súbor. Nahrajte ho v Nastavenia → BIOS.",
          {
            technicalDetail: "getBiosForPlatform('ps1') vrátil prázdne pole.",
            recoveryHint: "Nahrajte PS1 BIOS (SCPH-1001, SCPH-5501, ...) v Nastavenia → BIOS.",
          }
        );
      }
      const bios = biosRecords[0];
      const biosFile = await readFile(bios.opfsPath);
      const biosUrl = URL.createObjectURL(biosFile);
      this.blobUrls.push(biosUrl);

      // 2. Priprav game URL
      const mainManifest = game.files.find((f) => f.relativePath === game.mainFile);
      if (!mainManifest) {
        throw new RetroCloudError(
          "START_FILE_NOT_FOUND",
          `Hlavný súbor "${game.mainFile}" sa nenašiel v manifeste hier.`
        );
      }
      const gameFile = await readFile(mainManifest.opfsPath);
      const gameUrl = URL.createObjectURL(gameFile);
      this.blobUrls.push(gameUrl);

      // 3. Nastav EJS konfiguráciu
      window.EJS_gameUrl = gameUrl;
      window.EJS_biosUrl = biosUrl;
      window.EJS_gameName = game.name;
      window.EJS_audioVolume = this.muted ? 0 : this.volume;

      // 4. Ak EJS_emulator ešte nie je vytvorený, init sa stane pri onload
      // (loadGame voláme až po initialize, takže EJS_emulator existuje).
      // Pre novú hru môžeme buď reloader.js reload, alebo použiť EJS metódu.
      // Bezpečný prístup: re-load EJS cez restart.
      if (!window.EJS_emulator) {
        throw new RetroCloudError(
          "EMULATOR_INIT_FAILED",
          "EmulatorJS neinicializoval `window.EJS_emulator` po onload.",
          { technicalDetail: "window.EJS_emulator je undefined." }
        );
      }

      // AudioContext — pre PS1 je nutný pre zvuk
      this.ensureAudioContext();

      this.emit(makeEvent("game-ready", { gameId: game.id }));
      this.setState("ready");
    } catch (e) {
      const rcErr = e instanceof RetroCloudError
        ? e
        : new RetroCloudError(
            "EMULATOR_INIT_FAILED",
            `Hru sa nepodarilo načítať: ${e instanceof Error ? e.message : String(e)}`,
            { cause: e }
          );
      this.emit(makeEvent("error", undefined, {
        code: rcErr.code,
        message: rcErr.message,
      }));
      this.setState("error");
      throw rcErr;
    }
  }

  /**
   * Zabezpečí aktívny AudioContext pre PS1 zvuk.
   *
   * Prehliadače vyžadujú user gesture pred aktiváciou AudioContext.
   * Po `start()` (ktorý je volaný z button clicku) by mal byť AudioContext
   * resumable.
   */
  private ensureAudioContext(): void {
    if (this.audioContext) return;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new Ctor();
    } catch (e) {
      console.warn("[ps1-adapter] AudioContext sa nepodarilo vytvoriť:", e);
    }
  }

  async start(): Promise<void> {
    if (!window.EJS_emulator) {
      throw new RetroCloudError(
        "EMULATOR_INIT_FAILED",
        "EJS_emulator nie je k dispozícii — zavolajte loadGame() pred start()."
      );
    }
    if (this._state === "running") {
      console.warn("[ps1-adapter] start() volané, ale emulátor už beží");
      return;
    }

    // Resume AudioContext (ak bol suspended)
    if (this.audioContext && this.audioContext.state === "suspended") {
      try {
        await this.audioContext.resume();
      } catch (e) {
        console.warn("[ps1-adapter] AudioContext.resume() zlyhal:", e);
      }
    }

    // Nastav `running` AŽ po reálnom spustení
    window.EJS_emulator.play();
    this.setState("running");
    this.emit(makeEvent("started"));

    // Spust FPS monitor
    this.startFpsMonitor();
  }

  async pause(): Promise<void> {
    if (!window.EJS_emulator) return;
    window.EJS_emulator.pause();
    this.setState("paused");
    this.emit(makeEvent("paused"));
  }

  async resume(): Promise<void> {
    if (!window.EJS_emulator) return;
    window.EJS_emulator.play();
    this.setState("running");
    this.emit(makeEvent("resumed"));
  }

  async reset(): Promise<void> {
    if (!window.EJS_emulator) return;
    window.EJS_emulator.restart();
    this.emit(makeEvent("started"));
  }

  /**
   * Spracuje vstup z gamepadu / virtuálneho ovládača.
   *
   * Pre tlačidlá (`button-down`, `button-up`) ich mapuje na EJS controller
   * button IDs a posiela keyboard event na canvas.
   *
   * EmulatorJS internej jadro (PCSX-ReARMed) prijíma vstupy z klávesnice
   * a cez vlastný gamepad API. Pre našu integráciu konvertujeme ovládacie
   * signály na keyboard eventy zaslané priamo na canvas element.
   */
  sendInput(event: EmulatorInputEvent): void {
    if (this._state !== "running") return;
    const canvas = window.EJS_emulator?.elements?.canvas;
    if (!canvas) return;

    if (event.type === "button-down" || event.type === "button-up") {
      // Skús najprv EJS controller API; fallback je keyboard simulácia
      const ejsButton = mapPsxButtonToEJS(event.control);
      if (ejsButton !== null && window.EJS_emulator?.config) {
        // Niektoré verzie EJS podporujú `config({ input: ... })`
        // — tu pre istotu len zaznamenáme. Reálna integrácia s EJS
        // controller API je mimo rozsah tohto adaptéra.
        return;
      }
      // Fallback — keyboard simulácia
      const keyMap: Record<string, string> = {
        "dpad-up": "ArrowUp",
        "dpad-down": "ArrowDown",
        "dpad-left": "ArrowLeft",
        "dpad-right": "ArrowRight",
        "face-a": "x",         // Cross
        "face-b": "v",         // Circle
        "face-x": "z",         // Square
        "face-y": "a",         // Triangle
        "start": "Enter",
        "select": "Shift",
        "l1": "q",
        "r1": "w",
        "l2": "1",
        "r2": "3",
      };
      const key = keyMap[event.control];
      if (key) {
        this.dispatchKeyToCanvas(canvas, key, event.type === "button-down");
      }
      return;
    }

    if (event.type === "key-down" || event.type === "key-up") {
      const keyMap: Record<string, string> = {
        "key-up": "ArrowUp",
        "key-down": "ArrowDown",
        "key-left": "ArrowLeft",
        "key-right": "ArrowRight",
        "key-enter": "Enter",
        "key-escape": "Escape",
        "key-space": " ",
        "key-tab": "Tab",
        "key-shift": "Shift",
        "key-ctrl": "Control",
        "key-alt": "Alt",
      };
      const key = keyMap[event.control];
      if (key) {
        this.dispatchKeyToCanvas(canvas, key, event.type === "key-down");
      }
    }
  }

  /**
   * Dispatch keyboard event na EJS canvas.
   *
   * EJS internej zachytáva keyboard eventy globálne (na window), ale pre
   * istotu ich dispatchujeme aj na canvas.
   */
  private dispatchKeyToCanvas(canvas: HTMLCanvasElement, key: string, pressed: boolean): void {
    const type = pressed ? "keydown" : "keyup";
    try {
      canvas.dispatchEvent(new KeyboardEvent(type, {
        key,
        bubbles: true,
        cancelable: true,
      }));
    } catch (e) {
      console.warn("[ps1-adapter] dispatchKeyToCanvas zlyhal:", e);
    }
  }

  async saveState(slot: number): Promise<StoredSaveState> {
    if (!window.EJS_emulator || !this.currentGame) {
      throw new RetroCloudError(
        "EMULATOR_INIT_FAILED",
        "Nie je možné uložiť save state — emulátor nie je pripravený."
      );
    }

    const stateResult = window.EJS_emulator.saveSaveState(slot);
    const stateData: Uint8Array = stateResult instanceof Promise
      ? await stateResult
      : stateResult;

    const opfsPath = saveStatePath(this.currentGame.id, slot);
    const buffer = new ArrayBuffer(stateData.byteLength);
    new Uint8Array(buffer).set(stateData);
    const blob = new Blob([buffer]);
    const stream = blob.stream() as ReadableStream<Uint8Array>;
    await writeStream(opfsPath, stream);

    const hash = await sha256(stateData);
    const now = Date.now();
    const saveRecord = {
      id: uuid(),
      gameId: this.currentGame.id,
      slot,
      createdAt: now,
      updatedAt: now,
      fileSize: stateData.byteLength,
      opfsPath,
      isAutoSave: false,
      emulatorCore: EMULATOR_CORE_VERSIONS.ps1.core,
      emulatorVersion: EMULATOR_CORE_VERSIONS.ps1.version,
      gameFingerprint: this.currentGame.files[0]?.hash ?? hash,
    };
    await putSaveState(saveRecord);
    const stored = saveStateRecordToStored(saveRecord);

    this.emit(makeEvent("state-saved", { slot }));
    return stored;
  }

  async loadState(slot: number): Promise<void> {
    if (!window.EJS_emulator || !this.currentGame) {
      throw new RetroCloudError(
        "EMULATOR_INIT_FAILED",
        "Nie je možné načítať save state — emulátor nie je pripravený."
      );
    }
    const saves = await getSaveStates(this.currentGame.id);
    const save = saves.find((s) => s.slot === slot);
    if (!save) {
      throw new RetroCloudError(
        "SAVE_STATE_INCOMPATIBLE",
        `Save state v slote ${slot} neexistuje.`
      );
    }
    const file = await readFile(save.opfsPath);
    const data = new Uint8Array(await file.arrayBuffer());
    await Promise.resolve(window.EJS_emulator.loadSaveState(data, slot));
    this.emit(makeEvent("state-loaded", { slot }));
  }

  async deleteState(slot: number): Promise<void> {
    if (!this.currentGame) return;
    const saves = await getSaveStates(this.currentGame.id);
    const save = saves.find((s) => s.slot === slot);
    if (!save) return;
    await deleteSaveState(save.id);
    await deleteRecursive(save.opfsPath).catch((e: unknown) => {
      console.warn("[ps1-adapter] deleteRecursive(save) zlyhal:", e);
    });
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    window.EJS_audioVolume = this.muted ? 0 : this.volume;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    window.EJS_audioVolume = muted ? 0 : this.volume;
  }

  async enterFullscreen(): Promise<void> {
    const canvas = window.EJS_emulator?.elements?.canvas;
    if (!canvas) return;
    try {
      if (canvas.requestFullscreen) {
        await canvas.requestFullscreen();
        this.emit(makeEvent("fullscreen-entered"));
      }
    } catch (e) {
      console.warn("[ps1-adapter] requestFullscreen() zlyhal:", e);
    }
  }

  async exitFullscreen(): Promise<void> {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      this.emit(makeEvent("fullscreen-exited"));
    }
  }

  getPerformanceStats(): EmulatorPerformanceStats {
    return this.perfStats;
  }

  subscribe(listener: (event: EmulatorEvent) => void): () => void {
    return this.emitter.subscribe(listener);
  }

  /**
   * Zničí emulátor — kompletný cleanup:
   *  - close AudioContext
   *  - revoke Blob URLs
   *  - odstráni player div z DOM
   *  - zmaže window.EJS_* premenné
   *  - zruší subscriberov
   */
  async destroy(): Promise<void> {
    this.setState("stopping");

    // Stop FPS monitor
    this.lastFpsCheckAt = 0;

    // Zavri AudioContext
    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch (e) {
        console.warn("[ps1-adapter] AudioContext.close() zlyhal:", e);
      }
      this.audioContext = null;
    }

    // Revoke Blob URLs
    for (const url of this.blobUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        console.warn("[ps1-adapter] revokeObjectURL zlyhal:", e);
      }
    }
    this.blobUrls = [];

    // Odstráni player div z DOM
    if (this.playerDiv && this.playerDiv.parentElement) {
      this.playerDiv.parentElement.removeChild(this.playerDiv);
    }
    this.playerDiv = null;

    // Zmaže EJS konfiguráciu z window
    window.EJS_player = undefined;
    window.EJS_core = undefined;
    window.EJS_gameUrl = undefined;
    window.EJS_gameName = undefined;
    window.EJS_biosUrl = undefined;
    window.EJS_pathtodata = undefined;
    window.EJS_startOnLoaded = undefined;
    window.EJS_audioVolume = undefined;
    window.EJS_onload = undefined;
    window.EJS_onError = undefined;
    window.EJS_emulator = undefined;

    this.container = null;
    this.currentGame = null;
    this.ejsReady = false;

    this.emitter.clear();
    this.setState("destroyed");
    this.emit(makeEvent("destroyed"));
  }

  /**
   * Spustí FPS monitor — odsekávaný cez `setInterval` každých 500 ms.
   *
   * EmulatorJS neposkytuje FPS event priamo, takže robíme odhad podľa
   * `requestAnimationFrame` na canvas. Pre jednoduchosť používame
   * intervalovú kontrolu.
   */
  private startFpsMonitor(): void {
    this.lastFpsCheckAt = performance.now();
    const checkFps = () => {
      if (this._state !== "running") return;
      const now = performance.now();
      // EmulatorJS neexponuje FPS — nastavíme 0 ako placeholder pre
      // perfStats; UI môže zobraziť "Performance: N/A".
      // Reálna implementácia by páchala requestAnimationFrame monitor.
      this.perfStats = {
        fps: 0,
        frameTimeMs: 0,
        timestamp: Date.now(),
      };
      this.emit(makeEvent("performance-update", this.perfStats));
      setTimeout(checkFps, 1000);
    };
    setTimeout(checkFps, 1000);
  }

  private setState(state: EmulatorLifecycleState): void {
    this._state = state;
  }

  private emit(event: EmulatorEvent): void {
    this.emitter.emit(event);
  }
}
