"use client";

import { create } from "zustand";
import type { GameRecord } from "@/types/game";

interface LibraryState {
  games: GameRecord[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  platformFilter: "all" | "dos" | "ps1" | "ps2";
  sortBy: "name" | "createdAt" | "lastPlayedAt" | "size" | "isFavorite";
  sortDir: "asc" | "desc";
  setGames: (games: GameRecord[]) => void;
  addGame: (game: GameRecord) => void;
  updateGame: (id: string, patch: Partial<GameRecord>) => void;
  removeGame: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSearchQuery: (q: string) => void;
  setPlatformFilter: (f: "all" | "dos" | "ps1" | "ps2") => void;
  setSortBy: (s: LibraryState["sortBy"]) => void;
  setSortDir: (d: "asc" | "desc") => void;
  filtered: () => GameRecord[];
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  games: [],
  loading: false,
  error: null,
  searchQuery: "",
  platformFilter: "all",
  sortBy: "createdAt",
  sortDir: "desc",
  setGames: (games) => set({ games }),
  addGame: (game) => set((s) => ({ games: [game, ...s.games] })),
  updateGame: (id, patch) =>
    set((s) => ({
      games: s.games.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    })),
  removeGame: (id) => set((s) => ({ games: s.games.filter((g) => g.id !== id) })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setPlatformFilter: (f) => set({ platformFilter: f }),
  setSortBy: (s) => set({ sortBy: s }),
  setSortDir: (d) => set({ sortDir: d }),
  filtered: () => {
    const { games, searchQuery, platformFilter, sortBy, sortDir } = get();
    let result = [...games];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((g) => g.name.toLowerCase().includes(q));
    }
    if (platformFilter !== "all") {
      result = result.filter((g) => g.platform === platformFilter);
    }
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = a.name.localeCompare(b.name);
      else if (sortBy === "createdAt") cmp = a.createdAt - b.createdAt;
      else if (sortBy === "lastPlayedAt")
        cmp = (a.lastPlayedAt ?? 0) - (b.lastPlayedAt ?? 0);
      else if (sortBy === "size") cmp = a.size - b.size;
      else if (sortBy === "isFavorite")
        cmp = (a.isFavorite ? 1 : 0) - (b.isFavorite ? 1 : 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  },
}));
