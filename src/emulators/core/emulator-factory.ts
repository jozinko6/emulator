/**
 * Emulator factory — vytvára adaptéry podľa platformy.
 *
 * Per prompt ETAPA 5 (Unified Emulator Core).
 *
 * Pre PS2 rešpektuje feature flag `NEXT_PUBLIC_ENABLE_PS2`. Ak je vypnuté,
 * `createAdapter("ps2")` vyhodí `RetroCloudError(EMULATOR_CORE_UNAVAILABLE)`.
 *
 * Komentáre v slovenčine.
 */
import type { EmulatorAdapter, EmulatorPlatform } from "@/types/emulator";
import { RetroCloudError } from "@/types/errors";
import { isPs2Available, getPs2UnavailableReason } from "@/emulators/ps2/ps2-availability";

/**
 * Vytvorí `EmulatorAdapter` pre danú platformu.
 *
 * @param platform cieľová platforma (dos | ps1 | ps2)
 * @returns inštancia adaptéra (DosAdapter / Ps1Adapter)
 * @throws RetroCloudError(EMULATOR_CORE_UNAVAILABLE) ak je PS2 zakázané alebo
 *         ak sa jadro nepodarilo načítať (konkrétne zlyhanie nájdeme v `cause`).
 */
export async function createAdapter(platform: EmulatorPlatform): Promise<EmulatorAdapter> {
  switch (platform) {
    case "dos": {
      // Dynamic import — aby sa js-dos knižnica nenačítala na homepage
      const mod = await import("@/emulators/dos/dos-adapter");
      return new mod.DosAdapter();
    }

    case "ps1": {
      const mod = await import("@/emulators/ps1/ps1-adapter");
      return new mod.Ps1Adapter();
    }

    case "ps2": {
      if (!isPs2Available()) {
        throw new RetroCloudError(
          "EMULATOR_CORE_UNAVAILABLE",
          getPs2UnavailableReason(),
          {
            technicalDetail:
              "NEXT_PUBLIC_ENABLE_PS2=false — PS2 jadro nie je súčasťou tohto zostavenia.",
            recoveryHint:
              "Pre experimentálnu PS2 emuláciu nastavte NEXT_PUBLIC_ENABLE_PS2=true.",
          }
        );
      }
      // Ak je flag true, skúsime dynamicky načítať adaptér. Ak nie je
      // implementovaný (ešte stále experimentálne), vyhodíme chybu.
      try {
        const mod = await import("@/emulators/ps2/ps2-adapter");
        return new mod.Ps2Adapter();
      } catch (e) {
        throw new RetroCloudError(
          "EMULATOR_CORE_UNAVAILABLE",
          "PS2 adaptér sa nepodarilo načítať — jadro nie je dostupné.",
          {
            cause: e,
            technicalDetail:
              e instanceof Error ? e.message : String(e),
          }
        );
      }
    }

    default: {
      // Exhaustiveness check — TypeScript vynúti, že sme pokryli všetky platformy.
      const exhaustive: never = platform;
      throw new RetroCloudError(
        "EMULATOR_CORE_UNAVAILABLE",
        `Neznáma platforma: ${String(exhaustive)}`
      );
    }
  }
}

/**
 * Synchronná kontrola dostupnosti platformy — bez dynamic importu.
 *
 * Používa sa v UI, aby sa zakázalo tlačidlo "Play PS2", ak je PS2 vypnuté.
 */
export function isPlatformAvailable(platform: EmulatorPlatform): boolean {
  if (platform === "ps2") return isPs2Available();
  return true;
}
