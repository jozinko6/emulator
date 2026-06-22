/**
 * Emulator adapter interface — re-export zo `types/emulator.ts`.
 *
 * Per prompt ETAPA 5 (Unified Emulator Core). Všetky adaptéry implementujú
 * rovnaké rozhranie, aby mohol byť emulátor volaný nezávisle od platformy.
 *
 * UI NESMIE priamo volať js-dos / EmulatorJS / Play!.js API — výhradne
 * cez `EmulatorAdapter` instance vytvorené cez `createAdapter()`.
 */
export type {
  EmulatorAdapter,
  EmulatorPlatform,
  EmulatorLifecycleState,
  EmulatorEvent,
  EmulatorEventType,
  EmulatorInputEvent,
  EmulatorPerformanceStats,
  ImportedGame,
  GameFileManifest,
  StoredSaveState,
  EMULATOR_CORE_VERSIONS,
} from "@/types/emulator";
