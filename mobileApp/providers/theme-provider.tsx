import { ThemeProvider as NavigationThemeProvider } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { type PropsWithChildren } from "react";
import { useColorScheme } from "react-native";

import { navigationTheme } from "@/constants/theme";
import { useThemeStore, type ResolvedScheme } from "@/stores/theme.store";

/**
 * Resolves the active light/dark theme (device scheme when mode is "system",
 * otherwise the forced mode from the Zustand store) and feeds the resolved
 * tokens to react-navigation + the status bar.
 */
export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const mode = useThemeStore((s) => s.mode);
  const setResolvedScheme = useThemeStore((s) => s.setResolvedScheme);

  const resolved: ResolvedScheme =
    mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;

  // Keep the store's resolved scheme in sync so `useTheme()` reads one source.
  setResolvedScheme(resolved === "dark" ? "dark" : "light");

  return (
    <>
      <NavigationThemeProvider value={navigationTheme(resolved)}>
        {children}
      </NavigationThemeProvider>
      <StatusBar style={resolved === "dark" ? "light" : "dark"} />
    </>
  );
}