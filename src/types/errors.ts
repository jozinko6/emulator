/**
 * Centralized error system — per prompt section 27.
 */

export type RetroCloudErrorCode =
  | "UNSUPPORTED_FORMAT"
  | "CORRUPTED_ARCHIVE"
  | "PASSWORD_PROTECTED_ARCHIVE"
  | "WRONG_PASSWORD"
  | "ARCHIVE_BOMB_DETECTED"
  | "PATH_TRAVERSAL_DETECTED"
  | "INSUFFICIENT_STORAGE"
  | "INSUFFICIENT_MEMORY"
  | "MISSING_BIOS"
  | "INVALID_BIOS"
  | "MISSING_BIN_IN_CUE"
  | "START_FILE_NOT_FOUND"
  | "AMBIGUOUS_PLATFORM"
  | "CORRUPTED_ISO"
  | "INVALID_DRIVE_URL"
  | "PRIVATE_DRIVE_FILE"
  | "CORS_BLOCKED"
  | "EMULATOR_INIT_FAILED"
  | "EMULATOR_CORE_UNAVAILABLE"
  | "GAME_INCOMPATIBLE"
  | "WEBGL2_UNAVAILABLE"
  | "AUDIO_BLOCKED"
  | "SAVE_STATE_INCOMPATIBLE"
  | "FILE_TOO_LARGE"
  | "TOO_MANY_FILES"
  | "PATH_TOO_LONG"
  | "DIRECTORY_TOO_DEEP"
  | "NESTED_ARCHIVE_TOO_DEEP"
  | "OPFS_UNAVAILABLE"
  | "WORKER_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR";

export interface RetroCloudErrorOptions {
  cause?: unknown;
  technicalDetail?: string;
  recoveryHint?: string;
}

export class RetroCloudError extends Error {
  readonly code: RetroCloudErrorCode;
  readonly technicalDetail?: string;
  readonly recoveryHint?: string;
  readonly cause?: unknown;

  constructor(code: RetroCloudErrorCode, message: string, options: RetroCloudErrorOptions = {}) {
    super(message);
    this.name = "RetroCloudError";
    this.code = code;
    this.technicalDetail = options.technicalDetail;
    this.recoveryHint = options.recoveryHint;
    this.cause = options.cause;
  }

  toUserFacing(): { title: string; cause: string; resolution: string; technical?: string } {
    const map: Record<RetroCloudErrorCode, { title: string; cause: string; resolution: string }> = {
      UNSUPPORTED_FORMAT: {
        title: "Nepodporovaný formát súboru",
        cause: "Tento typ súboru RETROCLOUD nedokáže načítať.",
        resolution: "Použite jeden z podporovaných formátov: ZIP, RAR, 7z, JSDOS, ISO, BIN+CUE, CHD, CSO, PBP, ELF.",
      },
      CORRUPTED_ARCHIVE: {
        title: "Poškodený archív",
        cause: "Archív sa nepodarilo rozbaliť, pretože je poškodený.",
        resolution: "Skúste stiahnuť alebo vytvoriť archív znova.",
      },
      PASSWORD_PROTECTED_ARCHIVE: {
        title: "Archív chránený heslom",
        cause: "Archív je chránený heslom.",
        resolution: "Zadajte heslo alebo použite nechránený archív.",
      },
      WRONG_PASSWORD: {
        title: "Nesprávne heslo",
        cause: "Zadané heslo nie je správne.",
        resolution: "Skúste ine heslo.",
      },
      ARCHIVE_BOMB_DETECTED: {
        title: "Podozrenie na archívnu bombu",
        cause: "Archív má podozrivo vysoký kompresný pomer alebo počet súborov.",
        resolution: "Import bol z bezpečnostných dôvodov zamietnutý.",
      },
      PATH_TRAVERSAL_DETECTED: {
        title: "Nebezpečná cesta v archíve",
        cause: "Archív obsahuje cestu, ktorá sa pokúša opustiť cieľový priečinok.",
        resolution: "Import bol zamietnutý. Skontrolujte zdroj archívu.",
      },
      INSUFFICIENT_STORAGE: {
        title: "Nedostatok miesta v úložisku",
        cause: "V zariadení nie je dostatok miesta na uloženie hry.",
        resolution: "Uvoľnite miesto v prehliadači alebo odstráňte niektoré hry z knižnice.",
      },
      INSUFFICIENT_MEMORY: {
        title: "Nedostatok pamäte",
        cause: "Súbor je príliš veľký na načítanie do pamäte naraz.",
        resolution: "Skúste menší súbor alebo reštartujte prehliadač.",
      },
      MISSING_BIOS: {
        title: "Chýba BIOS",
        cause: "Pre túto platformu je potrebný BIOS, ktorý nebol nahraný.",
        resolution: "Nahrajte vlastný BIOS v Nastavenia → BIOS.",
      },
      INVALID_BIOS: {
        title: "Neplatný BIOS",
        cause: "Nahraný BIOS nemá očakávanú veľkosť alebo hash.",
        resolution: "Skontrolujte, že ide o správny BIOS pre daný región.",
      },
      MISSING_BIN_IN_CUE: {
        title: "Chýba BIN súbor pre CUE",
        cause: "CUE súbor odkazuje na BIN súbory, ktoré sa nenašli.",
        resolution: "Vyberte všetky súbory patriace k hre (CUE + všetky BIN).",
      },
      START_FILE_NOT_FOUND: {
        title: "Štartovací súbor sa nenašiel",
        cause: "V archíve sa nenašiel žiadny spustiteľný súbor hry.",
        resolution: "Uistite sa, že archív obsahuje START.BAT, GAME.EXE alebo podobný súbor.",
      },
      AMBIGUOUS_PLATFORM: {
        title: "Nebola rozpoznaná platforma",
        cause: "Nebolo možné jednoznačne určiť platformu hry.",
        resolution: "Vyberte platformu manuálne.",
      },
      CORRUPTED_ISO: {
        title: "Poškodený ISO obraz",
        cause: "ISO obraz sa nepodarilo prečítať.",
        resolution: "Skúste použiť iný zdroj obrazu.",
      },
      INVALID_DRIVE_URL: {
        title: "Neplatný Google Drive odkaz",
        cause: "Zadaný odkaz sa nepodarilo rozpoznať ako verejný Google Drive súbor.",
        resolution: "Skontrolujte odkaz alebo použite Google Drive Picker.",
      },
      PRIVATE_DRIVE_FILE: {
        title: "Súkromný Drive súbor",
        cause: "Súbor na Google Drive nie je verejne dostupný.",
        resolution: "Nastavte súbor ako verejný alebo použite Google Drive Picker.",
      },
      CORS_BLOCKED: {
        title: "Stiahnutie blokované prehliadačom (CORS)",
        cause: "Prehliadač nedovolil priame stiahnutie súboru.",
        resolution: "Použite Google Drive Picker alebo stiahnite súbor manuálne.",
      },
      EMULATOR_INIT_FAILED: {
        title: "Emulátor sa nepodarilo spustiť",
        cause: "Emulačné jadro vrátilo chybu počas inicializácie.",
        resolution: "Reštartujte hru. Ak problém pretrváva, pozrite diagnostiku.",
      },
      EMULATOR_CORE_UNAVAILABLE: {
        title: "Emulačné jadro nie je dostupné",
        cause: "Pre túto platformu nie je v tomto zostavení dostupné emulačné jadro.",
        resolution: "PS2 emulácia je experimentálna a v predvolenom zostavení vypnutá.",
      },
      GAME_INCOMPATIBLE: {
        title: "Hra nie je kompatibilná",
        cause: "Túto konkrétnu hru sa nepodarilo spustiť v aktuálnom emulačnom jadre.",
        resolution: "Skúste inú verziu hry alebo iný formát obrazu.",
      },
      WEBGL2_UNAVAILABLE: {
        title: "WebGL2 nie je dostupné",
        cause: "Prehliadač alebo GPU nepodporuje WebGL2.",
        resolution: "Aktivujte hardvérovú akceleráciu v prehliadači.",
      },
      AUDIO_BLOCKED: {
        title: "Zvuk je blokovaný",
        cause: "Prehliadač zablokoval AudioContext pred interakciou používateľa.",
        resolution: "Kliknite do herného plátna alebo stlačte ľubovoľné tlačidlo.",
      },
      SAVE_STATE_INCOMPATIBLE: {
        title: "Save state nie je kompatibilný",
        cause: "Save state bol vytvorený inou verziou emulačného jadra.",
        resolution: "Použite save state z rovnakej verzie jadra, alebo uložte nový.",
      },
      FILE_TOO_LARGE: {
        title: "Súbor je príliš veľký",
        cause: "Súbor prekročil limit pre danú platformu.",
        resolution: "Použite menší súbor alebo zvýšte limit v nastaveniach.",
      },
      TOO_MANY_FILES: {
        title: "Príliš veľa súborov v archíve",
        cause: "Archív obsahuje viac súborov ako je povolené.",
        resolution: "Použite archív s menším počtom súborov.",
      },
      PATH_TOO_LONG: {
        title: "Cesta v archíve je príliš dlhá",
        cause: "Niektorá cesta v archíve prekročila maximálnu dĺžku.",
        resolution: "Skontrolujte obsah archívu.",
      },
      DIRECTORY_TOO_DEEP: {
        title: "Príliš hlboká adresárová štruktúra",
        cause: "Archív obsahuje príliš vnorené priečinky.",
        resolution: "Splošte štruktúru archívu.",
      },
      NESTED_ARCHIVE_TOO_DEEP: {
        title: "Vnorené archívy",
        cause: "Archív obsahuje ďalšie archívy, čo nie je povolené.",
        resolution: "Rozbaľte vnorené archívy pred importom.",
      },
      OPFS_UNAVAILABLE: {
        title: "OPFS nie je dostupné",
        cause: "Origin Private File System nie je v tomto prehliadači podporovaný.",
        resolution: "Použite moderný prehliadač (Chrome 102+, Firefox 111+, Safari 15.2+).",
      },
      WORKER_ERROR: {
        title: "Chyba workera",
        cause: "Pomocný worker zlyhal.",
        resolution: "Reštartujte import.",
      },
      NETWORK_ERROR: {
        title: "Chyba siete",
        cause: "Nepodarilo sa stiahnuť súbor.",
        resolution: "Skontrolujte pripojenie a skúste znova.",
      },
      UNKNOWN_ERROR: {
        title: "Neznáma chyba",
        cause: "Vyskytla sa neočakávaná chyba.",
        resolution: "Skúste to znova. Ak problém pretrváva, pozrite diagnostiku.",
      },
    };
    const entry = map[this.code] ?? map.UNKNOWN_ERROR;
    return {
      title: entry.title,
      cause: entry.cause,
      resolution: this.recoveryHint ?? entry.resolution,
      technical: this.technicalDetail,
    };
  }
}
