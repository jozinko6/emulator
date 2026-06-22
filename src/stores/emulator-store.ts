"use client";

import { create } from "zustand";
import type {
  EmulatorLifecycleState,
  EmulatorEvent,
  EmulatorPerformanceStats,
  EmulatorPlatform,
} from "@/types/emulator";

interface EmulatorRuntimeState {
  activePlatform: EmulatorPlatform | null;
  activeGameId: string | null;
  state: EmulatorLifecycleState;
  error: string | null;
  performance: EmulatorPerformanceStats | null;
  volume: number; // 0..1
  muted: boolean;
  fullscreen: boolean;
  autoSave: boolean;
  lastEvent: EmulatorEvent | null;
  setActive: (platform: EmulatorPlatform, gameId: string) => void;
  setState: (state: EmulatorLifecycleState) => void;
  setError: (error: string | null) => void;
  setPerformance: (perf: EmulatorPerformanceStats) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  setFullscreen: (fullscreen: boolean) => void;
  setAutoSave: (autoSave: boolean) => void;
  setLastEvent: (event: EmulatorEvent) => void;
  reset: () => void;
}

export const useEmulatorStore = create<EmulatorRuntimeState>((set) => ({
  activePlatform: null,
  activeGameId: null,
  state: "idle",
  error: null,
  performance: null,
  volume: 0.8,
  muted: false,
  fullscreen: false,
  autoSave: true,
  lastEvent: null,
  setActive: (platform, gameId) =>
    set({ activePlatform: platform, activeGameId: gameId, error: null }),
  setState: (state) => set({ state }),
  setError: (error) => set({ error }),
  setPerformance: (perf) => set({ performance: perf }),
  setVolume: (volume) => set({ volume }),
  setMuted: (muted) => set({ muted }),
  setFullscreen: (fullscreen) => set({ fullscreen }),
  setAutoSave: (autoSave) => set({ autoSave }),
  setLastEvent: (event) => set({ lastEvent: event }),
  reset: () =>
    set({
      activePlatform: null,
      activeGameId: null,
      state: "idle",
      error: null,
      performance: null,
      fullscreen: false,
      lastEvent: null,
    }),
}));
