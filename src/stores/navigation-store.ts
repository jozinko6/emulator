"use client";

import { create } from "zustand";

interface NavigationState {
  activeRoute: string;
  sidebarOpen: boolean;
  isPlaying: boolean; // true keď beží emulátor — potláča navigáciu
  setActiveRoute: (route: string) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setPlaying: (playing: boolean) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  activeRoute: "/",
  sidebarOpen: false,
  isPlaying: false,
  setActiveRoute: (route) => set({ activeRoute: route }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setPlaying: (playing) => set({ isPlaying: playing }),
}));
