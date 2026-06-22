/**
 * CUE sheet parser — parser pre .cue súbory, ktoré sprevádzajú .bin obrazy.
 *
 * Per prompt ETAPA 4. CUE sheet je textový formát popisujúci štruktúru
 * CD/DVD obrazu. Každý CUE sheet obsahuje jednu alebo viacero skladieb
 * (tracks), pričom každá skladba môže odkazovať na iný .bin súbor.
 *
 * Príklad:
 *   FILE "game.bin" BINARY
 *     TRACK 01 MODE1/2352
 *       INDEX 01 00:00:00
 *     TRACK 02 AUDIO
 *       INDEX 00 02:00:00
 *       INDEX 01 02:02:00
 *
 * Komentáre v slovenčine.
 */

export interface CueTrack {
  /** Číslo skladby (1-based). */
  number: number;
  /** Typ skladby: MODE1/2352, MODE2/2352, AUDIO, CDG, ... */
  mode: string;
  /** Zoznam indexov (00 = pre-gap, 01 = hlavný index). */
  indexes: CueIndex[];
}

export interface CueIndex {
  /** Číslo indexu (0, 1, 2, ...). */
  number: number;
  /** Čas v MM:SS:FF formáte (FF = frames, 75 frame/s). */
  time: string;
  /** Čas v sekundách (desatinné číslo). */
  timeSeconds: number;
}

export interface CueFile {
  /** Názov BIN súboru (z CUE FILE príkazu). */
  name: string;
  /** Typ súboru — obyčajne "BINARY" alebo "WAVE" / "MP3". */
  type: string;
  /** Skladby patriace do tohto súboru. */
  tracks: CueTrack[];
}

export interface CueSheet {
  /** Zoznam súborov odkazovaných v CUE sheete. */
  files: CueFile[];
  /** Pôvodný text CUE sheete (pre debug). */
  raw: string;
  /** Pole hlášok (warnings) — nezásadné problémy, ktoré parser zvládol. */
  warnings: string[];
}

/**
 * Konvertuje čas v MM:SS:FF formáte na sekundy (desatinné).
 * 1 sekunda = 75 frameov (CD-DA).
 */
export function cueTimeToSeconds(time: string): number {
  const match = /^(\d+):(\d+):(\d+)$/.exec(time);
  if (!match) return 0;
  const mm = parseInt(match[1], 10);
  const ss = parseInt(match[2], 10);
  const ff = parseInt(match[3], 10);
  return mm * 60 + ss + ff / 75;
}

/**
 * Spracuje jeden riadok CUE sheeta.
 *
 * CUE sheet je case-insensitive (v praxi sa používajú veľké písmená,
 * ale berieme aj malé). Whitespace medzi tokenmi je flexibilný.
 */
function tokenize(line: string): string[] {
  // Pozor: hodnoty za FILE alebo TITLE môžu byť v úvodzovkách
  // a obsahovať medzery. Preto parsovanie robíme po tokenoch, pričom
  // úvodzovky berieme ako jeden token.
  const tokens: string[] = [];
  let i = 0;
  while (i < line.length) {
    // Skip whitespace
      while (i < line.length && (line[i] === " " || line[i] === "\t")) {
        i++;
      }
      if (i >= line.length) break;

      if (line[i] === '"') {
        // String literal
        i++; // skip opening quote
        const start = i;
        while (i < line.length && line[i] !== '"') {
          i++;
        }
        tokens.push(line.slice(start, i));
        if (i < line.length && line[i] === '"') i++; // skip closing quote
      } else {
        // Whitespace-delimited token
        const start = i;
        while (i < line.length && line[i] !== " " && line[i] !== "\t") {
          i++;
        }
        tokens.push(line.slice(start, i));
      }
    }
  return tokens;
}

/**
 * Parsuje CUE sheet z textového obsahu.
 *
 * @param content text obsah .cue súboru
 * @returns CueSheet s rozparsovanými súbormi a skladbami
 */
export function parseCue(content: string): CueSheet {
  const warnings: string[] = [];
  const files: CueFile[] = [];
  let currentFile: CueFile | null = null;
  let currentTrack: CueTrack | null = null;

  const lines = content.split(/\r?\n/);

  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    const rawLine = lines[lineNo];
    const line = rawLine.trim();
    if (line.length === 0) continue;

    const tokens = tokenize(line);
    if (tokens.length === 0) continue;

    const keyword = tokens[0].toUpperCase();

    switch (keyword) {
      case "FILE": {
        if (tokens.length < 3) {
          warnings.push(`Riadok ${lineNo + 1}: FILE bez názvu alebo typu — preskočené`);
          continue;
        }
        // Ukonči predošlý track (ak existuje)
        if (currentTrack && currentFile) {
          currentFile.tracks.push(currentTrack);
          currentTrack = null;
        }
        currentFile = {
          name: tokens[1],
          type: tokens[2].toUpperCase(),
          tracks: [],
        };
        files.push(currentFile);
        break;
      }

      case "TRACK": {
        if (!currentFile) {
          warnings.push(`Riadok ${lineNo + 1}: TRACK mimo FILE bloku — preskočené`);
          continue;
        }
        if (tokens.length < 3) {
          warnings.push(`Riadok ${lineNo + 1}: TRACK bez čísla alebo typu — preskočené`);
          continue;
        }
        // Pridaj predošlý track do currentFile
        if (currentTrack) {
          currentFile.tracks.push(currentTrack);
        }
        const number = parseInt(tokens[1], 10);
        if (Number.isNaN(number)) {
          warnings.push(`Riadok ${lineNo + 1}: TRACK číslo nie je platné: ${tokens[1]}`);
          continue;
        }
        currentTrack = {
          number,
          mode: tokens[2].toUpperCase(),
          indexes: [],
        };
        break;
      }

      case "INDEX": {
        if (!currentTrack) {
          warnings.push(`Riadok ${lineNo + 1}: INDEX mimo TRACK bloku — preskočené`);
          continue;
        }
        if (tokens.length < 3) {
          warnings.push(`Riadok ${lineNo + 1}: INDEX bez čísla alebo času — preskočené`);
          continue;
        }
        const idxNum = parseInt(tokens[1], 10);
        if (Number.isNaN(idxNum)) {
          warnings.push(`Riadok ${lineNo + 1}: INDEX číslo nie je platné: ${tokens[1]}`);
          continue;
        }
        const time = tokens[2];
        // Over formát MM:SS:FF
        if (!/^\d+:\d+:\d+$/.test(time)) {
          warnings.push(`Riadok ${lineNo + 1}: INDEX čas nezodpovedá MM:SS:FF: ${time}`);
        }
        currentTrack.indexes.push({
          number: idxNum,
          time,
          timeSeconds: cueTimeToSeconds(time),
        });
        break;
      }

      case "REM": {
        // Komentár — ignorujeme
        break;
      }

      case "CATALOG":
      case "CDTEXTFILE":
      case "FLAGS":
      case "ISRC":
      case "PERFORMER":
      case "POSTGAP":
      case "PREGAP":
      case "SONGWRITER":
      case "TITLE": {
        // Podporované, ale pre našu detekciu ich nepotrebujeme — ignorujeme.
        break;
      }

      default: {
        warnings.push(`Riadok ${lineNo + 1}: neznámy CUE príkaz "${keyword}" — ignorované`);
        break;
      }
    }
  }

  // Pridaj posledný track do posledného súboru
  if (currentTrack && currentFile) {
    currentFile.tracks.push(currentTrack);
  }

  return { files, raw: content, warnings };
}

/**
 * Skontroluje, že všetky BIN súbory odkazované v CUE sheete existujú
 * medzi sibling súbormi.
 *
 * @param cue CUE sheet z `parseCue`
 * @param siblingFiles zoznam názvov súborov v rovnakom adresári (iba názvy, nie cesty)
 * @returns zoznam chýbajúcich názvov BIN súborov
 */
export function findMissingBinFiles(cue: CueSheet, siblingFiles: string[]): string[] {
  // Normalizuj sibling files na lowercase pre case-insensitive porovnanie
  // (CUE sheet odkazy môžu mať inú veľkosť písmen než súborový systém).
  const lowerSet = new Set(siblingFiles.map((f) => f.toLowerCase()));
  const missing: string[] = [];
  for (const file of cue.files) {
    if (!lowerSet.has(file.name.toLowerCase())) {
      missing.push(file.name);
    }
  }
  return missing;
}

/**
 * Vráti true, ak CUE sheet odkazuje len na binárne súbory (BINARY).
 * Ak obsahuje aj WAVE/MP3, vráti false — to znamená, že audio tracky
 * sú oddelené a potrebujeme ich samostatne načítať.
 */
export function isAllBinary(cue: CueSheet): boolean {
  return cue.files.every((f) => f.type === "BINARY");
}

/**
 * Vráti zoznam všetkých názvov BIN súborov odkazovaných v CUE sheete.
 */
export function getBinFileNames(cue: CueSheet): string[] {
  return cue.files.map((f) => f.name);
}
