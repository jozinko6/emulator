"use client";

import { create } from "zustand";
import type {
  EmulatorSettingsRecord,
  UserPreferenceRecord,
  AspectRatio,
  PerformanceProfile,
} from "@/types/game";
import type { EmulatorPlatform } from "@/types/emulator";

interface SettingsState {
  platformSettings: Partial<Record<EmulatorPlatform, EmulatorSettingsRecord>>;
  preferences: Record<string, unknown>;
  loaded: boolean;
  load: () => Promise<void>;
  setPlatformSetting: (
    platform: EmulatorPlatform,
    patch: Partial<EmulatorSettingsRecord>
  ) => void;
  setPreference: (key: string, value: unknown) => void;
  getAspectRatio: (platform: EmulatorPlatform) => AspectRatio;
  getPerformanceProfile: (platform: EmulatorPlatform) => PerformanceProfile;
  getVolume: (platform: EmulatorPlatform) => number;
  isMuted: (platform: EmulatorPlatform) => boolean;
  isAutoSave: (platform: EmulatorPlatform) => boolean;
}

const DEFAULT_SETTINGS: Record<EmulatorPlatform, EmulatorSettingsRecord> = {
  dos: {
    platform: "dos",
    volume: 0.8,
    muted: false,
    aspectRatio: "4:3",
    performanceProfile: "balanced",
    autoSave: true,
    updatedAt: 0,
  },
  ps1: {
    platform: "ps1",
    volume: 0.8,
    muted: false,
    aspectRatio: "4:3",
    performanceProfile: "balanced",
    autoSave: true,
    updatedAt: 0,
  },
  ps2: {
    platform: "ps2",
    volume: 0.8,
    muted: false,
    aspectRatio: "16:9",
    performanceProfile: "balanced",
    autoSave: true,
    updatedAt: 0,
  },
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  platformSettings: {},
  preferences: {},
  loaded: false,
  load: async () => {
    try {
      const { getUserPreferences, getAllEmulatorSettings } = await import(
        "@/lib/storage/repositories"
      );
      const [settings, prefs] = await Promise.all([
        getAllEmulatorSettings(),
        getUserPreferences(),
      ]);
      const map: Partial<Record<EmulatorPlatform, EmulatorSettingsRecord>> = {};
      for (const s of settings) map[s.platform] = s;
      const prefMap: Record<string, unknown> = {};
      for (const p of prefs as UserPreferenceRecord[]) prefMap[p.key] = p.value;
      set({
        platformSettings: { ...DEFAULT_SETTINGS, ...map },
        preferences: prefMap,
        loaded: true,
      });
    } catch {
      // IndexedDB might not be available (SSR / test). Use defaults.
      set({ platformSettings: DEFAULT_SETTINGS, loaded: true });
    }
  },
  setPlatformSetting: (platform, patch) =>
    set((s) => ({
      platformSettings: {
        ...s.platformSettings,
        [platform]: {
          ...(s.platformSettings[platform] ?? DEFAULT_SETTINGS[platform]),
          ...patch,
          platform,
          updatedAt: Date.now(),
        },
      },
    })),
  setPreference: (key, value) =>
    set((s) => ({ preferences: { ...s.preferences, [key]: value } })),
  getAspectRatio: (platform) =>
    get().platformSettings[platform]?.aspectRatio ?? DEFAULT_SETTINGS[platform].aspectRatio,
  getPerformanceProfile: (platform) =>
    get().platformSettings[platform]?.performanceProfile ??
    DEFAULT_SETTINGS[platform].performanceProfile,
  getVolume: (platform) =>
    get().platformSettings[platform]?.volume ?? DEFAULT_SETTINGS[platform].volume,
  isMuted: (platform) =>
    get().platformSettings[platform]?.muted ?? DEFAULT_SETTINGS[platform].muted,
  isAutoSave: (platform) =>
    get().platformSettings[platform]?.autoSave ?? DEFAULT_SETTINGS[platform].autoSave,
}));
