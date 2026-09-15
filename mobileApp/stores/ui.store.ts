import { create } from "zustand";

type UIState = {
  unreadPushCount: number;
  activeModal: string | null;
  setUnreadPushCount: (count: number) => void;
  setActiveModal: (modal: string | null) => void;
};

/** Ephemeral UI flags only — nothing here is persisted. */
export const useUIStore = create<UIState>((set) => ({
  unreadPushCount: 0,
  activeModal: null,
  setUnreadPushCount: (unreadPushCount) => set({ unreadPushCount }),
  setActiveModal: (activeModal) => set({ activeModal }),
}));