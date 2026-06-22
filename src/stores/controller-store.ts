"use client";

import { create } from "zustand";
import type { ControllerProfileRecord } from "@/types/game";
import type { EmulatorPlatform } from "@/types/emulator";

interface ControllerState {
  profiles: ControllerProfileRecord[];
  connectedGamepads: Array<{ index: number; id: string; mapping: string }>;
  deadzone: number;
  sensitivity: number;
  setProfiles: (profiles: ControllerProfileRecord[]) => void;
  addProfile: (profile: ControllerProfileRecord) => void;
  updateProfile: (id: string, patch: Partial<ControllerProfileRecord>) => void;
  removeProfile: (id: string) => void;
  setConnectedGamepads: (pads: ControllerState["connectedGamepads"]) => void;
  setDeadzone: (dz: number) => void;
  setSensitivity: (s: number) => void;
  forPlatform: (platform: EmulatorPlatform) => ControllerProfileRecord | undefined;
}

export const useControllerStore = create<ControllerState>((set, get) => ({
  profiles: [],
  connectedGamepads: [],
  deadzone: 0.15,
  sensitivity: 1.0,
  setProfiles: (profiles) => set({ profiles }),
  addProfile: (profile) =>
    set((s) => ({ profiles: [...s.profiles, profile] })),
  updateProfile: (id, patch) =>
    set((s) => ({
      profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),
  removeProfile: (id) =>
    set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) })),
  setConnectedGamepads: (pads) => set({ connectedGamepads: pads }),
  setDeadzone: (dz) => set({ deadzone: dz }),
  setSensitivity: (s) => set({ sensitivity: s }),
  forPlatform: (platform) => {
    const list = get().profiles.filter((p) => p.platform === platform);
    return list.find((p) => p.isDefault) ?? list[0];
  },
}));
