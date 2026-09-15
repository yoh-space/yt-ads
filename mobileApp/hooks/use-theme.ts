import { DarkTheme, LightTheme, type Theme } from "@/constants/theme";
import { useThemeStore, type ThemeMode } from "@/stores/theme.store";

export type UseThemeResult = {
  /** Resolved scheme actually shown on screen. */
  scheme: "light" | "dark";
  isDark: boolean;
  mode: ThemeMode;
  /** Full design-token object for the resolved scheme. */
  theme: Theme;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

/** Single hook for consuming the resolved light/dark theme everywhere. */
export function useTheme(): UseThemeResult {
  const resolvedScheme = useThemeStore((s) => s.resolvedScheme);
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const toggle = useThemeStore((s) => s.toggle);

  const isDark = resolvedScheme === "dark";

  return {
    scheme: resolvedScheme,
    isDark,
    mode,
    theme: isDark ? DarkTheme : LightTheme,
    setMode,
    toggle,
  };
}