/**
 * DosAdapter — reálna js-dos integrácia cez `window.emulators`.
 *
 * Per prompt ETAPA 5. Implementuje `EmulatorAdapter` pre DOS.
 *
 * js-dos v8 sa načítava cez `<script src="/emulator-assets/js-dos/js-dos.js">`
 * (lokálne hostované WASM jadro). Po inicializácii je k dispozícii
 * `window.emulators` s API:
 *   - `emulators.pathPrefix` — prefix pre WASM súbory
 *   - `emulators.dos(bundle: Blob | URL): Promise<CommandInterface>`
 *
 * CommandInterface (ci):
 *   - `ci.run(): Promise<void>` — hlavná slučka (resolves pri ukončení)
 *   - `ci.exit(): Promise<void>` — ukončí emulátor
 *   - `ci.saveState(): Promise<Uint8Array>`
 *   - `ci.loadState(state: Uint8Array): Promise<void>`
 *   - `ci.config(opts)` — audio/video config
 *   - `ci.simulateKeyEvent(code, pressed)` — keyboard input
 *   - `ci.simulateMouse(...)` — mouse input
 *
 * Žiadne placeholdery — ak sa js-dos nepodarí načítať, `initialize()`
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
import { mapControlToDosKeyCode } from "@/emulators/core/emulator-input";
import {
  buildJsdosBundle,
  buildJsdosBundleAsync,
  createJsdosBundleUrl,
  type JsdosBundleFile,
} from "@/emulators/dos/jsdos-builder";
import {
  readFile,
} from "@/lib/storage/opfs";
import {
  saveStateRecordToStored,
} from "@/lib/storage/repositories";
import {
  deleteSaveState,
  getSaveState,
  saveStateAtomically,
  SLOT_AUTO,
  validateSaveStateRecord,
} from "@/lib/storage/save-state-store";
import { extname } from "@/lib/security/path-normalizer";

/** Cesta k js-dos skriptu v public/ priečinku. */
const JSDOS_SCRIPT_URL = "/emulator-assets/js-dos/js-dos.js";
/** Path prefix pre js-dos WASM súbory. */
const JSDOS_PATH_PREFIX = "/emulator-assets/js-dos/";

/** Prah veľkosti, nad ktorý používame async builder. */
const ASYNC_BUNDLE_THRESHOLD = 10 * 1024 * 1024; // 10 MB

/**
 * Typ pre `window.emulators` API. Reálne objekt má viac polí, ale
 * pre našu integráciu potrebujeme len `pathPrefix` a `dos()`.
 */
interface JsdosEmulatorsAPI {
  pathPrefix: string;
  dos(bundle: Blob | string): Promise<JsdosCommandInterface>;
}

interface JsdosCommandInterface {
  run(): Promise<void>;
  exit(): Promise<void>;
  saveState(): Promise<Uint8Array>;
  loadState(state: Uint8Array): Promise<void>;
  config(opts: Record<string, unknown>): void;
  simulateKeyEvent(code: number, pressed: boolean): void;
  simulateMouse(...args: number[]): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  listeners(): { sound: boolean; frames: boolean; network: boolean };
  pause?(): void;
  resume?(): void;
}

/**
 * Globálne uložené referencie na window objekty. Keďže js-dos sa načítava
 * cez script tag, musíme pristupovať cez indexovaný prístup.
 */
declare global {
  interface Window {
    emulators?: JsdosEmulatorsAPI;
  }
}

export class DosAdapter implements EmulatorAdapter {
  readonly platform = "dos" as const;

  private _state: EmulatorLifecycleState = "idle";
  private emitter = createEmitter();
  private container: HTMLElement | null = null;
  private ci: JsdosCommandInterface | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private blobUrls: string[] = [];
  private runPromise: Promise<void> | null = null;
  private currentGame: ImportedGame | null = null;
  private volume = 0.8;
  private muted = false;
  private perfStats: EmulatorPerformanceStats = {
    fps: 0,
    frameTimeMs: 0,
    timestamp: 0,
  };
  private frameTimes: number[] = [];
  private lastFrameAt = 0;
  private scriptLoaded = false;
  private lastFpsCheckAt = 0;
  private fpsFrameCount = 0;

  get state(): EmulatorLifecycleState {
    return this._state;
  }

  /**
   * Načíta js-dos skript cez `<script>` tag, ak ešte nebol načítaný.
   *
   * @throws RetroCloudError(EMULATOR_CORE_UNAVAILABLE) ak sa skript nepodarí
   *   načítať (404, network error) alebo ak `window.emulators` chýba po načítaní.
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
      await this.loadJsdosScript();
      if (!window.emulators) {
        throw new RetroCloudError(
          "EMULATOR_CORE_UNAVAILABLE",
          "js-dos jadro nie je dostupné — `window.emulators` chýba po načítaní skriptu.",
          {
            technicalDetail: `Skript ${JSDOS_SCRIPT_URL} sa načítal, ale window.emulators nie je definované. Skontrolujte, či ${JSDOS_SCRIPT_URL} je skutočne js-dos v8 bundle.`,
            recoveryHint: "Nahrajte js-dos v8 balík do public/emulator-assets/js-dos/.",
          }
        );
      }
      window.emulators.pathPrefix = JSDOS_PATH_PREFIX;
      this.scriptLoaded = true;

      // Vytvor canvas, do ktorého js-dos vykresľuje
      this.canvas = document.createElement("canvas");
      this.canvas.style.width = "100%";
      this.canvas.style.height = "100%";
      this.canvas.style.display = "block";
      this.canvas.setAttribute("aria-label", "DOS emulator canvas");
      this.container.appendChild(this.canvas);

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
        `js-dos sa nepodarilo načítať: ${e instanceof Error ? e.message : String(e)}`,
        {
          cause: e,
          technicalDetail: `URL: ${JSDOS_SCRIPT_URL}`,
          recoveryHint: "Skontrolujte, že public/emulator-assets/js-dos/js-dos.js existuje a je dostupný.",
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
   * Načíta js-dos skript cez `<script>` tag (ak ešte nebol načítaný).
   *
   * Interná funkcia — skript sa načíta len raz. Pri opakovaných volaniach
   * sa použije cachovaná referencia.
   */
  private loadJsdosScript(): Promise<void> {
    if (this.scriptLoaded && window.emulators) {
      return Promise.resolve();
    }
    // Ak už existuje script element s touto URL, počkajme na jeho load.
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${JSDOS_SCRIPT_URL}"]`
    );
    if (existing) {
      return new Promise<void>((resolve, reject) => {
        if (window.emulators) {
          resolve();
          return;
        }
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () =>
          reject(new RetroCloudError(
            "EMULATOR_CORE_UNAVAILABLE",
            `js-dos skript sa nepodarilo načítať z ${JSDOS_SCRIPT_URL}.`,
            { technicalDetail: "Script element error event." }
          ))
        );
      });
    }

    return new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = JSDOS_SCRIPT_URL;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = () => resolve();
      script.onerror = () => {
        reject(new RetroCloudError(
          "EMULATOR_CORE_UNAVAILABLE",
          `js-dos skript sa nepodarilo načítať z ${JSDOS_SCRIPT_URL}.`,
          {
            technicalDetail: "Script element error event.",
            recoveryHint: "Nahrajte js-dos v8 balík (js-dos.js + wasm) do public/emulator-assets/js-dos/.",
          }
        ));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Načíta hru do emulátora.
   *
   * Pre .jsdos balíky: načíta priamo z OPFS ako Blob a vytvorí URL.
   * Pre ZIP / BAT / EXE / COM: prečíta všetky súbory z OPFS, vytvorí .jsdos
   * balík cez `jsdos-builder.ts` a ten použije.
   */
  async loadGame(game: ImportedGame): Promise<void> {
    if (!this.container || !window.emulators) {
      throw new RetroCloudError(
        "EMULATOR_INIT_FAILED",
        "Adaptér nebol inicializovaný — zavolajte initialize() pred loadGame()."
      );
    }
    this.setState("loading");
    this.currentGame = game;
    this.emit(makeEvent("game-loading", { gameId: game.id, name: game.name }));

    try {
      const bundle = await this.prepareBundle(game);
      const url = createJsdosBundleUrl(bundle);
      this.blobUrls.push(url);

      // Vytvor DOS inštanciu
      this.ci = await window.emulators.dos(url);
      this.attachCiListeners();

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
   * Pripraví .jsdos Blob z hier podľa typu mainFile.
   *
   * - Ak je mainFile `.jsdos` — načíta priamo z OPFS ako Blob.
   * - Inak (ZIP / BAT / EXE / COM) — načíta všetky súbory z OPFS a zostaví balík.
   */
  private async prepareBundle(game: ImportedGame): Promise<Blob> {
    const mainFile = game.mainFile;
    const ext = extname(mainFile);

    if (ext === "jsdos") {
      // Priamo .jsdos — načíta ako Blob z OPFS
      const mainManifest = game.files.find((f) => f.relativePath === mainFile);
      if (!mainManifest) {
        throw new RetroCloudError(
          "START_FILE_NOT_FOUND",
          `.jsdos súbor "${mainFile}" sa nenašiel v manifeste hier.`
        );
      }
      const file = await readFile(mainManifest.opfsPath);
      return file;
    }

    // Pre ZIP / BAT / EXE / COM — prečítame všetky súbory a zostavíme balík
    const files: JsdosBundleFile[] = [];
    let totalSize = 0;
    for (const manifest of game.files) {
      const file = await readFile(manifest.opfsPath);
      const buffer = new Uint8Array(await file.arrayBuffer());
      files.push({
        path: manifest.relativePath,
        data: buffer,
      });
      totalSize += buffer.byteLength;
    }

    if (files.length === 0) {
      throw new RetroCloudError(
        "START_FILE_NOT_FOUND",
        `Hra "${game.name}" neobsahuje žiadne súbory.`
      );
    }

    // Nastav command — ak je mainFile .BAT/.EXE/.COM, použije sa priamo
    // (DOSBox ho spustí ako príkaz). Inak sa nechá js-dos vybrať default.
    const command = (ext === "bat" || ext === "exe" || ext === "com")
      ? mainFile.split("/").pop() ?? mainFile
      : mainFile;

    if (totalSize > ASYNC_BUNDLE_THRESHOLD) {
      return buildJsdosBundleAsync(files, command);
    }
    return buildJsdosBundle(files, command);
  }

  /**
   * Pripojí listenery na `ci` — sledovanie FPS a sound/events.
   */
  private attachCiListeners(): void {
    if (!this.ci) return;
    try {
      // js-dos posiela `frame` events — používame na výpočet FPS
      this.ci.on("frame", () => this.handleFrame());
    } catch (e) {
      // Niektoré verzie js-dos nemajú `on` API — zaznamenáme, ale nepredstierame.
      console.warn("[dos-adapter] ci.on() nie je podporované:", e);
    }
  }

  /**
   * Handler pre frame event — výpočet FPS.
   */
  private handleFrame(): void {
    const now = performance.now();
    if (this.lastFrameAt > 0) {
      const delta = now - this.lastFrameAt;
      this.frameTimes.push(delta);
      if (this.frameTimes.length > 60) this.frameTimes.shift();
    }
    this.lastFrameAt = now;
    this.fpsFrameCount++;

    // Emit performance-update každých ~500 ms
    if (now - this.lastFpsCheckAt > 500) {
      const avgFrameTime = this.frameTimes.length > 0
        ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
        : 0;
      const fps = avgFrameTime > 0 ? Math.round(1000 / avgFrameTime) : 0;
      this.perfStats = {
        fps,
        frameTimeMs: avgFrameTime,
        timestamp: Date.now(),
      };
      this.emit(makeEvent("performance-update", this.perfStats));
      this.lastFpsCheckAt = now;
      this.fpsFrameCount = 0;
    }
  }

  /**
   * Spustí hlavnú slučku emulátora.
   *
   * `ci.run()` je async — resolves až keď hra skončí. Stav `running`
   * nastavíme IHNEĎ po zavolaní `ci.run()` (po reálnom štarte jadra).
   */
  async start(): Promise<void> {
    if (!this.ci) {
      throw new RetroCloudError(
        "EMULATOR_INIT_FAILED",
        "Adaptér nie je pripravený — zavolajte loadGame() pred start()."
      );
    }
    if (this._state === "running") {
      console.warn("[dos-adapter] start() volané, ale emulátor už beží");
      return;
    }
    // Aplikuj audio config pred štartom
    this.applyAudioConfig();

    // Spustime ci.run() — toto vracia Promise, ktorý sa resolvne pri ukončení emulátora.
    // Podľa prompt sekcia 13: start() musi skončiť po úspešnom spustení jadra,
    // nesmie čakať až do ukončenia celej emulačnej slučky.
    this.runPromise = this.ci.run();

    // Ak ci.run() hneď vyhodí synchronnú chybu, zachyť ju
    // Inak nechaj bežať na pozadí — error handler dole
    if (!this.runPromise || typeof this.runPromise.then !== "function") {
      throw new RetroCloudError(
        "EMULATOR_INIT_FAILED",
        "DOS jadro nevrátilo Promise z ci.run()"
      );
    }

    // Sleduj runPromise asynchrónne — error alebo ukončenie
    this.runPromise
      .then(() => {
        // Normálne ukončenie
        if (this._state !== "destroyed") {
          this.setState("idle");
        }
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[dos-adapter] ci.run() vyhodil chybu:", e);
        this.emit(
          makeEvent("error", undefined, {
            code: "EMULATOR_INIT_FAILED",
            message: `DOS jadro spadlo: ${msg}`,
          })
        );
        this.setState("error");
      })
      .finally(() => {
        this.runPromise = null;
      });

    // Nastav `running` AŽ keď reálne spustíme ci.run()
    this.setState("running");
    this.emit(makeEvent("started"));
  }

  async pause(): Promise<void> {
    if (!this.ci) return;
    if (this.ci.pause) {
      this.ci.pause();
      this.setState("paused");
      this.emit(makeEvent("paused"));
    } else {
      console.warn("[dos-adapter] ci.pause() nie je podporované");
    }
  }

  async resume(): Promise<void> {
    if (!this.ci) return;
    if (this.ci.resume) {
      this.ci.resume();
      this.setState("running");
      this.emit(makeEvent("resumed"));
    } else {
      console.warn("[dos-adapter] ci.resume() nie je podporované");
    }
  }

  async reset(): Promise<void> {
    // js-dos nepodporuje priamy reset — reload hry
    if (!this.currentGame) return;
    await this.cleanupCi();
    await this.loadGame(this.currentGame);
    await this.start();
  }

  /**
   * Spracuje vstup z gamepadu / virtuálneho ovládača.
   *
   * Pre klávesové eventy (`key-down`, `key-up`) použije `simulateKeyEvent`.
   * Pre tlačidlá (`button-down`, `button-up`) ich skonvertuje na klávesy,
   * ak je to možné — inak ignoruje (DOS nepodporuje gamepad natívne).
   */
  sendInput(event: EmulatorInputEvent): void {
    if (!this.ci || this._state !== "running") return;

    if (event.type === "key-down" || event.type === "key-up") {
      const code = mapControlToDosKeyCode(event.control);
      if (code !== null) {
        this.ci.simulateKeyEvent(code, event.type === "key-down");
      }
      return;
    }

    if (event.type === "button-down" || event.type === "button-up") {
      // Mapujeme gamepad tlačidlá na klávesy pre DOS
      // (DOS hry obyčajne používajú šípky + akciu)
      const keyMap: Record<string, string> = {
        "dpad-up": "key-up",
        "dpad-down": "key-down",
        "dpad-left": "key-left",
        "dpad-right": "key-right",
        "face-a": "key-ctrl",   // Cross = fire
        "face-b": "key-alt",    // Circle = jump
        "face-x": "key-space",  // Square = action
        "face-y": "key-enter",  // Triangle = menu
        "start": "key-enter",
        "select": "key-escape",
        "l1": "key-tab",
        "r1": "key-shift",
        "l2": "key-f1",
        "r2": "key-f2",
      };
      const key = keyMap[event.control];
      if (key) {
        const code = mapControlToDosKeyCode(key);
        if (code !== null) {
          this.ci.simulateKeyEvent(code, event.type === "button-down");
        }
      }
      return;
    }

    if (event.type === "pointer" || event.type === "pointer-move") {
      // DOS mouse support — per prompt section 12.
      //
      // js-dos API (v8.x): ci.simulateMouseMotion(deltaX, deltaY) for relative movement,
      // ci.simulateMouseButton(button, pressed) for buttons (0=left, 1=middle, 2=right).
      //
      // Pointer Lock API gives us relative movement via event.movementX/Y, which the
      // MouseHandler passes to sendInput({type: "pointer", x: movementX, y: movementY}).
      // We forward those deltas directly to ci.simulateMouseMotion.
      try {
        const ci = this.ci as unknown as {
          simulateMouseMotion?: (dx: number, dy: number) => void;
          simulateMouseButton?: (button: number, pressed: boolean) => void;
        };
        if (typeof ci.simulateMouseMotion === "function" && event.x !== undefined && event.y !== undefined) {
          ci.simulateMouseMotion(event.x, event.y);
        }
      } catch (e) {
        console.warn("[dos-adapter] simulateMouseMotion failed:", e);
      }
      return;
    }

    if (event.type === "pointer-button-down" || event.type === "pointer-button-up") {
      try {
        const ci = this.ci as unknown as {
          simulateMouseButton?: (button: number, pressed: boolean) => void;
          simulateMouse?: (...args: number[]) => void;
        };
        const button = event.control === "mouse-right" ? 2 : event.control === "mouse-middle" ? 1 : 0;
        const pressed = event.type === "pointer-button-down";
        if (typeof ci.simulateMouseButton === "function") {
          ci.simulateMouseButton(button, pressed);
        } else if (typeof ci.simulateMouse === "function") {
          ci.simulateMouse(button, pressed ? 1 : 0);
        }
      } catch (e) {
        console.warn("[dos-adapter] simulateMouseButton failed:", e);
      }
      return;
    }

    if (event.type === "pointer-wheel") {
      try {
        const ci = this.ci as unknown as {
          simulateMouseWheel?: (deltaX: number, deltaY: number) => void;
        };
        if (typeof ci.simulateMouseWheel === "function") {
          ci.simulateMouseWheel(event.x ?? 0, event.y ?? 0);
        } else {
          console.debug("[dos-adapter] js-dos mouse wheel API is not available in this core.");
        }
      } catch (e) {
        console.warn("[dos-adapter] simulateMouseWheel failed:", e);
      }
      return;
    }
  }

  /**
   * Uloží save state do OPFS a metadata do IndexedDB.
   */
  async saveState(slot: number): Promise<StoredSaveState> {
    if (!this.ci || !this.currentGame) {
      throw new RetroCloudError(
        "EMULATOR_INIT_FAILED",
        "Nie je možné uložiť save state — emulátor nie je pripravený."
      );
    }

    const stateData = await this.ci.saveState();
    const buffer = new ArrayBuffer(stateData.byteLength);
    new Uint8Array(buffer).set(stateData);
    const saveRecord = await saveStateAtomically(this.currentGame.id, slot, buffer, {
      emulatorCore: EMULATOR_CORE_VERSIONS.dos.core,
      emulatorVersion: EMULATOR_CORE_VERSIONS.dos.version,
      gameFingerprint: this.currentGame.files[0]?.hash ?? this.currentGame.id,
      isAutoSave: slot === SLOT_AUTO,
    });
    const stored = saveStateRecordToStored(saveRecord);

    this.emit(makeEvent("state-saved", { slot }));
    return stored;
  }

  /**
   * Načíta save state z OPFS a aplikuje ho na emulátor.
   */
  async loadState(slot: number): Promise<void> {
    if (!this.ci || !this.currentGame) {
      throw new RetroCloudError(
        "EMULATOR_INIT_FAILED",
        "Nie je možné načítať save state — emulátor nie je pripravený."
      );
    }

    const save = await getSaveState(this.currentGame.id, slot);
    if (!save) {
      throw new RetroCloudError(
        "SAVE_STATE_INCOMPATIBLE",
        `Save state v slote ${slot} neexistuje.`
      );
    }

    const fingerprint = this.currentGame.files[0]?.hash ?? this.currentGame.id;
    const verified = await validateSaveStateRecord(save, {
      gameId: this.currentGame.id,
      emulatorCore: EMULATOR_CORE_VERSIONS.dos.core,
      emulatorVersion: EMULATOR_CORE_VERSIONS.dos.version,
      gameFingerprint: fingerprint,
    });
    if (!verified.ok) {
      throw new RetroCloudError(
        "SAVE_STATE_INCOMPATIBLE",
        `Save state v slote ${slot} nie je kompatibilný alebo je poškodený (${verified.reason}).`
      );
    }

    await this.ci.loadState(verified.data);
    this.emit(makeEvent("state-loaded", { slot }));
  }

  async deleteState(slot: number): Promise<void> {
    if (!this.currentGame) return;
    const save = await getSaveState(this.currentGame.id, slot);
    if (!save) return;
    await deleteSaveState(this.currentGame.id, slot);
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.applyAudioConfig();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyAudioConfig();
  }

  /**
   * Aplikuje audio konfiguráciu na `ci`.
   *
   * js-dos `ci.config()` akceptuje `{ audio: true/false, volume: 0..1 }`
   * (presný formát závisí od verzie). Ak `ci.config()` chýba, len zaznamenáme.
   */
  private applyAudioConfig(): void {
    if (!this.ci) return;
    try {
      this.ci.config({
        audio: !this.muted,
        volume: this.muted ? 0 : this.volume,
      });
    } catch (e) {
      console.warn("[dos-adapter] ci.config() zlyhal:", e);
    }
  }

  async enterFullscreen(): Promise<void> {
    if (!this.canvas) return;
    try {
      await this.canvas.requestFullscreen();
      this.emit(makeEvent("fullscreen-entered"));
    } catch (e) {
      console.warn("[dos-adapter] requestFullscreen() zlyhal:", e);
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
   * Release all currently pressed keys / mouse buttons.
   * Per prompt section 13 — called on destroy, blur, pause, route change.
   */
  releaseAllInputs(): void {
    if (!this.ci) return;
    try {
      // Send key-up for common keys (idempotent — js-dos ignores keys not currently down)
      const releaseKeys = [
        1, 14, 15, 28, 29, 42, 54, 56, 57,
        72, 75, 77, 80,
        ...Array.from({ length: 26 }, (_, i) => 16 + i),
        ...Array.from({ length: 10 }, (_, i) => 2 + i),
        ...Array.from({ length: 12 }, (_, i) => 59 + i),
        87, 88,
      ];
      for (const code of releaseKeys) {
        try {
          this.ci.simulateKeyEvent?.(code, false);
        } catch {
          // Key not currently pressed — ignore
        }
      }
      const ci = this.ci as unknown as {
        simulateMouseButton?: (button: number, pressed: boolean) => void;
      };
      if (typeof ci.simulateMouseButton === "function") {
        for (const button of [0, 1, 2]) {
          ci.simulateMouseButton(button, false);
        }
      }
    } catch (e) {
      console.warn("[dos-adapter] releaseAllInputs failed:", e);
    }
  }

  /**
   * Zničí emulátor — kompletný cleanup:
   *  - exit z DOS jadra
   *  - revoke všetkých Blob URLs
   *  - odstráni canvas z DOM
   *  - zruší všetkých subscriberov
   */
  async destroy(): Promise<void> {
    this.setState("stopping");
    this.releaseAllInputs();
    await this.cleanupCi();

    // Revoke Blob URLs
    for (const url of this.blobUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        console.warn("[dos-adapter] revokeObjectURL zlyhal:", e);
      }
    }
    this.blobUrls = [];

    // Odstráni canvas
    if (this.canvas && this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    this.canvas = null;
    this.container = null;
    this.currentGame = null;
    this.frameTimes = [];
    this.lastFrameAt = 0;

    this.emitter.clear();
    this.setState("destroyed");
    this.emit(makeEvent("destroyed"));
  }

  /**
   * Zastaví DOS jadro a počká na ukončenie.
   */
  private async cleanupCi(): Promise<void> {
    if (!this.ci) return;
    try {
      await this.ci.exit();
    } catch (e) {
      console.warn("[dos-adapter] ci.exit() zlyhal:", e);
    }
    if (this.runPromise) {
      try {
        await this.runPromise;
      } catch {
        // už zaznamenané v start()
      }
    }
    this.ci = null;
  }

  private setState(state: EmulatorLifecycleState): void {
    this._state = state;
  }

  private emit(event: EmulatorEvent): void {
    this.emitter.emit(event);
  }
}
