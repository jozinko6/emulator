/**
 * JSDOS bundle builder — vytvorenie .jsdos balíka pre js-dos.
 *
 * Per prompt ETAPA 5. Formát .jsdos je ZIP archív obsahujúci:
 *  - `.jsdos/content/...` — herné súbory (DOS program)
 *  - `.jsdos/jsdos.json` — konfigurácia (command, cwd, ... )
 *
 * js-dos očakáva Blob alebo URL adresu k .jsdos súboru. Po zavolaní
 * `emulators.dos(bundle)` sa balík rozbalí v workery a spustí sa príkaz
 * definovaný v `jsdos.json`.
 *
 * Komentáre v slovenčine.
 */
import { zip, zipSync } from "fflate";

export interface JsdosBundleFile {
  /** Relatívna cesta v rámci balíka (napr. "START.BAT", "DATA/GAME.DAT"). */
  path: string;
  /** Dáta súboru. */
  data: Uint8Array;
}

export interface JsdosConfig {
  /** Príkaz, ktorý sa spustí po štarte DOSBoxu (napr. "START.BAT"). */
  command: string;
  /** Pracovný adresár v DOSBoxe (napr. "C:\\GAME"). */
  cwd: string;
  /** Voliteľné — ďalšie konfiguračné polia pre js-dos. */
  extra?: Record<string, unknown>;
}

/**
 * Normalizuje zoznam súborov do formy vhodnej pre `ZipInput`.
 * Vráti nový objekt s cestami `.jsdos/content/...` a kópiou dát
 * (aby sme mali čistý `Uint8Array<ArrayBuffer>` namiesto prípadného
 * `Uint8Array<SharedArrayBuffer>`).
 */
function buildZipInput(files: JsdosBundleFile[]): Record<string, Uint8Array> {
  const zipInput: Record<string, Uint8Array> = {};
  for (const file of files) {
    const normalizedPath = file.path.replace(/\\/g, "/");
    const fullPath = normalizedPath.startsWith(".jsdos/content/")
      ? normalizedPath
      : `.jsdos/content/${normalizedPath}`;
    const buf = new Uint8Array(file.data.byteLength);
    buf.set(file.data);
    zipInput[fullPath] = buf;
  }
  return zipInput;
}

/**
 * Vytvorí `jsdos.json` obsah pre danú konfiguráciu.
 */
function buildJsdosJson(mainFile: string, config?: Partial<JsdosConfig>): string {
  const jsdosConfig: JsdosConfig = {
    command: config?.command ?? mainFile,
    cwd: config?.cwd ?? "C:\\GAME",
    extra: config?.extra,
  };
  return JSON.stringify({
    command: jsdosConfig.command,
    cwd: jsdosConfig.cwd,
    ...jsdosConfig.extra,
  });
}

/**
 * Zostaví .jsdos balík ako Blob.
 *
 * Synchronná verzia — používa `fflate.zipSync`. Vhodná pre malé balíky
 * (do ~10 MB). Pre väčšie použite `buildJsdosBundleAsync`.
 *
 * @param files zoznam súborov, ktoré sa umiestnia do `.jsdos/content/`
 * @param mainFile názov hlavného spustiteľného súboru (relatívna cesta v rámci content)
 * @param config voliteľná konfigurácia; defaultne sa `command` odvodí od mainFile
 * @returns Blob s .jsdos balíkom (MIME `application/zip`)
 */
export function buildJsdosBundle(
  files: JsdosBundleFile[],
  mainFile: string,
  config?: Partial<JsdosConfig>
): Blob {
  const zipInput = buildZipInput(files);
  zipInput[".jsdos/jsdos.json"] = new TextEncoder().encode(buildJsdosJson(mainFile, config));
  const data = zipSync(zipInput);
  return new Blob([data], { type: "application/zip" });
}

/**
 * Async verzia `buildJsdosBundle` — pre veľké balíky (>10 MB).
 *
 * Používa `fflate.zip` (asynchrónna verzia, beží mimo hlavného vlákna
 * interne v sub-workery pre väčšie balíky).
 */
export async function buildJsdosBundleAsync(
  files: JsdosBundleFile[],
  mainFile: string,
  config?: Partial<JsdosConfig>
): Promise<Blob> {
  const zipInput = buildZipInput(files);
  zipInput[".jsdos/jsdos.json"] = new TextEncoder().encode(buildJsdosJson(mainFile, config));

  return new Promise<Blob>((resolve, reject) => {
    zip(zipInput, (err, data) => {
      if (err) {
        reject(
          new Error(`Nepodarilo sa vytvoriť .jsdos balík: ${err.message}`)
        );
        return;
      }
      resolve(new Blob([data], { type: "application/zip" }));
    });
  });
}

/**
 * Vytvorí Blob URL pre .jsdos balík.
 *
 * Volajúci MUSÍ URL po skončení zrušiť cez `URL.revokeObjectURL(url)` —
 * inak dôjde k memory leaku. Adaptér to robí v `destroy()`.
 */
export function createJsdosBundleUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}
