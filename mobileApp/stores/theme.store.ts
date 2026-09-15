import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedScheme = "light" | "dark";

type ThemeState = {
  mode: ThemeMode;
  resolvedScheme: ResolvedScheme;
  setMode: (mode: ThemeMode) => void;
  setResolvedScheme: (scheme: ResolvedScheme) => void;
  toggle: () => void;
};

/**
 * App-wide light/dark theme context. The `ThemeProvider` keeps `resolvedScheme`
 * in sync with the device scheme when `mode` is "system". Deliberately NOT
 * persisted to device storage (mobileApp/AGENTS.md: the only persisted value is
 * the Better Auth session token); the mode simply re-defaults to "system".
 */
export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: "system",
  resolvedScheme: "light",
  setMode: (mode) =>
    set({
      mode,
      resolvedScheme: mode === "system" ? get().resolvedScheme : mode,
    }),
  setResolvedScheme: (scheme) => set({ resolvedScheme: scheme }),
  toggle: () => {
    const next: ResolvedScheme = get().resolvedScheme === "dark" ? "light" : "dark";
    set({ mode: next, resolvedScheme: next });
  },
}));