"use client";

import { create } from "zustand";
import type { ImportJobRecord } from "@/types/game";

interface ImportState {
  currentJob: ImportJobRecord | null;
  history: ImportJobRecord[];
  legalConfirmed: boolean;
  setJob: (job: ImportJobRecord | null) => void;
  updateJob: (patch: Partial<ImportJobRecord>) => void;
  finalizeJob: () => void;
  setLegalConfirmed: (confirmed: boolean) => void;
  reset: () => void;
}

export const useImportStore = create<ImportState>((set) => ({
  currentJob: null,
  history: [],
  legalConfirmed: false,
  setJob: (job) => set({ currentJob: job }),
  updateJob: (patch) =>
    set((s) =>
      s.currentJob
        ? {
            currentJob: { ...s.currentJob, ...patch, updatedAt: Date.now() },
          }
        : {}
    ),
  finalizeJob: () =>
    set((s) => {
      if (!s.currentJob) return {};
      return {
        currentJob: null,
        history: [s.currentJob, ...s.history].slice(0, 20),
      };
    }),
  setLegalConfirmed: (confirmed) => set({ legalConfirmed: confirmed }),
  reset: () => set({ currentJob: null, legalConfirmed: false }),
}));
