/**
 * Centralized error system â€” per prompt section 27.
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
        title: "NepodporovanĂ˝ formĂˇt sĂşboru",
        cause: "Tento typ sĂşboru Jaňo še chce bavkac nedokĂˇĹľe naÄŤĂ­taĹĄ.",
        resolution: "PouĹľite jeden z podporovanĂ˝ch formĂˇtov: ZIP, RAR, 7z, JSDOS, ISO, BIN+CUE, CHD, CSO, PBP, ELF.",
      },
      CORRUPTED_ARCHIVE: {
        title: "PoĹˇkodenĂ˝ archĂ­v",
        cause: "ArchĂ­v sa nepodarilo rozbaliĹĄ, pretoĹľe je poĹˇkodenĂ˝.",
        resolution: "SkĂşste stiahnuĹĄ alebo vytvoriĹĄ archĂ­v znova.",
      },
      PASSWORD_PROTECTED_ARCHIVE: {
        title: "ArchĂ­v chrĂˇnenĂ˝ heslom",
        cause: "ArchĂ­v je chrĂˇnenĂ˝ heslom.",
        resolution: "Zadajte heslo alebo pouĹľite nechrĂˇnenĂ˝ archĂ­v.",
      },
      WRONG_PASSWORD: {
        title: "NesprĂˇvne heslo",
        cause: "ZadanĂ© heslo nie je sprĂˇvne.",
        resolution: "SkĂşste ine heslo.",
      },
      ARCHIVE_BOMB_DETECTED: {
        title: "Podozrenie na archĂ­vnu bombu",
        cause: "ArchĂ­v mĂˇ podozrivo vysokĂ˝ kompresnĂ˝ pomer alebo poÄŤet sĂşborov.",
        resolution: "Import bol z bezpeÄŤnostnĂ˝ch dĂ´vodov zamietnutĂ˝.",
      },
      PATH_TRAVERSAL_DETECTED: {
        title: "NebezpeÄŤnĂˇ cesta v archĂ­ve",
        cause: "ArchĂ­v obsahuje cestu, ktorĂˇ sa pokĂşĹˇa opustiĹĄ cieÄľovĂ˝ prieÄŤinok.",
        resolution: "Import bol zamietnutĂ˝. Skontrolujte zdroj archĂ­vu.",
      },
      INSUFFICIENT_STORAGE: {
        title: "Nedostatok miesta v ĂşloĹľisku",
        cause: "V zariadenĂ­ nie je dostatok miesta na uloĹľenie hry.",
        resolution: "UvoÄľnite miesto v prehliadaÄŤi alebo odstrĂˇĹte niektorĂ© hry z kniĹľnice.",
      },
      INSUFFICIENT_MEMORY: {
        title: "Nedostatok pamĂ¤te",
        cause: "SĂşbor je prĂ­liĹˇ veÄľkĂ˝ na naÄŤĂ­tanie do pamĂ¤te naraz.",
        resolution: "SkĂşste menĹˇĂ­ sĂşbor alebo reĹˇtartujte prehliadaÄŤ.",
      },
      MISSING_BIOS: {
        title: "ChĂ˝ba BIOS",
        cause: "Pre tĂşto platformu je potrebnĂ˝ BIOS, ktorĂ˝ nebol nahranĂ˝.",
        resolution: "Nahrajte vlastnĂ˝ BIOS v Nastavenia â†’ BIOS.",
      },
      INVALID_BIOS: {
        title: "NeplatnĂ˝ BIOS",
        cause: "NahranĂ˝ BIOS nemĂˇ oÄŤakĂˇvanĂş veÄľkosĹĄ alebo hash.",
        resolution: "Skontrolujte, Ĺľe ide o sprĂˇvny BIOS pre danĂ˝ regiĂłn.",
      },
      MISSING_BIN_IN_CUE: {
        title: "ChĂ˝ba BIN sĂşbor pre CUE",
        cause: "CUE sĂşbor odkazuje na BIN sĂşbory, ktorĂ© sa nenaĹˇli.",
        resolution: "Vyberte vĹˇetky sĂşbory patriace k hre (CUE + vĹˇetky BIN).",
      },
      START_FILE_NOT_FOUND: {
        title: "Ĺ tartovacĂ­ sĂşbor sa nenaĹˇiel",
        cause: "V archĂ­ve sa nenaĹˇiel Ĺľiadny spustiteÄľnĂ˝ sĂşbor hry.",
        resolution: "Uistite sa, Ĺľe archĂ­v obsahuje START.BAT, GAME.EXE alebo podobnĂ˝ sĂşbor.",
      },
      AMBIGUOUS_PLATFORM: {
        title: "Nebola rozpoznanĂˇ platforma",
        cause: "Nebolo moĹľnĂ© jednoznaÄŤne urÄŤiĹĄ platformu hry.",
        resolution: "Vyberte platformu manuĂˇlne.",
      },
      CORRUPTED_ISO: {
        title: "PoĹˇkodenĂ˝ ISO obraz",
        cause: "ISO obraz sa nepodarilo preÄŤĂ­taĹĄ.",
        resolution: "SkĂşste pouĹľiĹĄ inĂ˝ zdroj obrazu.",
      },
      INVALID_DRIVE_URL: {
        title: "NeplatnĂ˝ Google Drive odkaz",
        cause: "ZadanĂ˝ odkaz sa nepodarilo rozpoznaĹĄ ako verejnĂ˝ Google Drive sĂşbor.",
        resolution: "Skontrolujte odkaz alebo pouĹľite Google Drive Picker.",
      },
      PRIVATE_DRIVE_FILE: {
        title: "SĂşkromnĂ˝ Drive sĂşbor",
        cause: "SĂşbor na Google Drive nie je verejne dostupnĂ˝.",
        resolution: "Nastavte sĂşbor ako verejnĂ˝ alebo pouĹľite Google Drive Picker.",
      },
      CORS_BLOCKED: {
        title: "Stiahnutie blokovanĂ© prehliadaÄŤom (CORS)",
        cause: "PrehliadaÄŤ nedovolil priame stiahnutie sĂşboru.",
        resolution: "PouĹľite Google Drive Picker alebo stiahnite sĂşbor manuĂˇlne.",
      },
      EMULATOR_INIT_FAILED: {
        title: "EmulĂˇtor sa nepodarilo spustiĹĄ",
        cause: "EmulaÄŤnĂ© jadro vrĂˇtilo chybu poÄŤas inicializĂˇcie.",
        resolution: "ReĹˇtartujte hru. Ak problĂ©m pretrvĂˇva, pozrite diagnostiku.",
      },
      EMULATOR_CORE_UNAVAILABLE: {
        title: "EmulaÄŤnĂ© jadro nie je dostupnĂ©",
        cause: "Pre tĂşto platformu nie je v tomto zostavenĂ­ dostupnĂ© emulaÄŤnĂ© jadro.",
        resolution: "PS2 emulĂˇcia je experimentĂˇlna a v predvolenom zostavenĂ­ vypnutĂˇ.",
      },
      GAME_INCOMPATIBLE: {
        title: "Hra nie je kompatibilnĂˇ",
        cause: "TĂşto konkrĂ©tnu hru sa nepodarilo spustiĹĄ v aktuĂˇlnom emulaÄŤnom jadre.",
        resolution: "SkĂşste inĂş verziu hry alebo inĂ˝ formĂˇt obrazu.",
      },
      WEBGL2_UNAVAILABLE: {
        title: "WebGL2 nie je dostupnĂ©",
        cause: "PrehliadaÄŤ alebo GPU nepodporuje WebGL2.",
        resolution: "Aktivujte hardvĂ©rovĂş akcelerĂˇciu v prehliadaÄŤi.",
      },
      AUDIO_BLOCKED: {
        title: "Zvuk je blokovanĂ˝",
        cause: "PrehliadaÄŤ zablokoval AudioContext pred interakciou pouĹľĂ­vateÄľa.",
        resolution: "Kliknite do hernĂ©ho plĂˇtna alebo stlaÄŤte ÄľubovoÄľnĂ© tlaÄŤidlo.",
      },
      SAVE_STATE_INCOMPATIBLE: {
        title: "Save state nie je kompatibilnĂ˝",
        cause: "Save state bol vytvorenĂ˝ inou verziou emulaÄŤnĂ©ho jadra.",
        resolution: "PouĹľite save state z rovnakej verzie jadra, alebo uloĹľte novĂ˝.",
      },
      FILE_TOO_LARGE: {
        title: "SĂşbor je prĂ­liĹˇ veÄľkĂ˝",
        cause: "SĂşbor prekroÄŤil limit pre danĂş platformu.",
        resolution: "PouĹľite menĹˇĂ­ sĂşbor alebo zvĂ˝Ĺˇte limit v nastaveniach.",
      },
      TOO_MANY_FILES: {
        title: "PrĂ­liĹˇ veÄľa sĂşborov v archĂ­ve",
        cause: "ArchĂ­v obsahuje viac sĂşborov ako je povolenĂ©.",
        resolution: "PouĹľite archĂ­v s menĹˇĂ­m poÄŤtom sĂşborov.",
      },
      PATH_TOO_LONG: {
        title: "Cesta v archĂ­ve je prĂ­liĹˇ dlhĂˇ",
        cause: "NiektorĂˇ cesta v archĂ­ve prekroÄŤila maximĂˇlnu dÄşĹľku.",
        resolution: "Skontrolujte obsah archĂ­vu.",
      },
      DIRECTORY_TOO_DEEP: {
        title: "PrĂ­liĹˇ hlbokĂˇ adresĂˇrovĂˇ ĹˇtruktĂşra",
        cause: "ArchĂ­v obsahuje prĂ­liĹˇ vnorenĂ© prieÄŤinky.",
        resolution: "SploĹˇte ĹˇtruktĂşru archĂ­vu.",
      },
      NESTED_ARCHIVE_TOO_DEEP: {
        title: "VnorenĂ© archĂ­vy",
        cause: "ArchĂ­v obsahuje ÄŹalĹˇie archĂ­vy, ÄŤo nie je povolenĂ©.",
        resolution: "RozbaÄľte vnorenĂ© archĂ­vy pred importom.",
      },
      OPFS_UNAVAILABLE: {
        title: "OPFS nie je dostupnĂ©",
        cause: "Origin Private File System nie je v tomto prehliadaÄŤi podporovanĂ˝.",
        resolution: "PouĹľite modernĂ˝ prehliadaÄŤ (Chrome 102+, Firefox 111+, Safari 15.2+).",
      },
      WORKER_ERROR: {
        title: "Chyba workera",
        cause: "PomocnĂ˝ worker zlyhal.",
        resolution: "ReĹˇtartujte import.",
      },
      NETWORK_ERROR: {
        title: "Chyba siete",
        cause: "Nepodarilo sa stiahnuĹĄ sĂşbor.",
        resolution: "Skontrolujte pripojenie a skĂşste znova.",
      },
      UNKNOWN_ERROR: {
        title: "NeznĂˇma chyba",
        cause: "Vyskytla sa neoÄŤakĂˇvanĂˇ chyba.",
        resolution: "SkĂşste to znova. Ak problĂ©m pretrvĂˇva, pozrite diagnostiku.",
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
