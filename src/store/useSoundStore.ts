"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SoundState = {
  isMuted: boolean;
  setMuted: (muted: boolean) => void;
  toggleSound: () => void;
};

const STORAGE_KEY = "dashboard-sound-prefs";

export const useSoundStore = create<SoundState>()(
  persist(
    (set) => ({
      isMuted: false,
      setMuted: (muted) => set({ isMuted: muted }),
      toggleSound: () => set((state) => ({ isMuted: !state.isMuted })),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ isMuted: state.isMuted }),
    },
  ),
);
