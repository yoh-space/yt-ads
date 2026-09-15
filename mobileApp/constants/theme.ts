import { DarkTheme as NavDarkTheme, DefaultTheme as NavDefaultTheme, type Theme as NavigationTheme } from "@react-navigation/native";
import { Platform } from "react-native";

/**
 * Core design tokens for the YT Advertising mobile client.
 *
 * Raw palette values live in `Palette`. Semantic colors are defined per scheme
 * (light/dark) as `ThemeColors`. Components MUST consume tokens through the
 * `useTheme()` hook (`stores/theme.store` + `hooks/use-theme`) and never inline
 * raw color values.
 */

export const Palette = {
  brand: {
    50: "#EFF9FF",
    100: "#D9F0FF",
    200: "#B2E3FF",
    300: "#63D9FF",
    400: "#3FB8E6",
    500: "#1FA0D6",
    600: "#0A7EA4",
    700: "#0A6788",
    800: "#104F66",
    900: "#123A4A",
  },
  neutral: {
    0: "#FFFFFF",
    50: "#F4F8FF",
    100: "#E9EFFA",
    200: "#DCE4F3",
    300: "#C2CDE1",
    400: "#9DABC6",
    500: "#74829C",
    600: "#5B6680",
    700: "#3E4A63",
    800: "#232E44",
    900: "#0E1730",
    950: "#060B18",
  },
  success: {
    50: "#E8F7EE",
    500: "#178A4F",
    700: "#0E7A44",
  },
  warning: {
    50: "#FFF4E0",
    600: "#B76E00",
    700: "#A16207",
  },
  danger: {
    50: "#FDEBEF",
    500: "#E11D48",
    700: "#BE123C",
  },
} as const;

export type Palette = typeof Palette;

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceSubtle: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  onPrimary: string;
  primaryMuted: string;
  accent: string;
  onAccent: string;
  accentMuted: string;
  border: string;
  borderStrong: string;
  divider: string;
  success: string;
  onSuccess: string;
  successMuted: string;
  warning: string;
  onWarning: string;
  warningMuted: string;
  danger: string;
  onDanger: string;
  dangerMuted: string;
  overlay: string;
  scrim: string;
  tabBar: string;
  tabIconDefault: string;
  tabIconSelected: string;
  tabBarBorder: string;
  inputBg: string;
  inputBorder: string;
  placeholder: string;
  skeleton: string;
  skeletonHighlight: string;
  ring: string;
};

export const LightColors: ThemeColors = {
  background: Palette.neutral[50],
  surface: Palette.neutral[0],
  surfaceElevated: Palette.neutral[0],
  surfaceSubtle: Palette.neutral[100],
  text: Palette.neutral[900],
  textSecondary: Palette.neutral[600],
  textMuted: Palette.neutral[400],
  textInverse: Palette.neutral[0],
  primary: Palette.brand[600],
  onPrimary: Palette.neutral[0],
  primaryMuted: Palette.brand[100],
  accent: Palette.brand[600],
  onAccent: Palette.neutral[0],
  accentMuted: Palette.brand[50],
  border: Palette.neutral[200],
  borderStrong: Palette.neutral[300],
  divider: Palette.neutral[100],
  success: Palette.success[500],
  onSuccess: Palette.neutral[0],
  successMuted: Palette.success[50],
  warning: Palette.warning[700],
  onWarning: Palette.neutral[0],
  warningMuted: Palette.warning[50],
  danger: Palette.danger[500],
  onDanger: Palette.neutral[0],
  dangerMuted: Palette.danger[50],
  overlay: "rgba(14, 23, 48, 0.4)",
  scrim: "rgba(14, 23, 48, 0.6)",
  tabBar: Palette.neutral[0],
  tabIconDefault: Palette.neutral[400],
  tabIconSelected: Palette.brand[600],
  tabBarBorder: Palette.neutral[200],
  inputBg: Palette.neutral[0],
  inputBorder: Palette.neutral[300],
  placeholder: Palette.neutral[400],
  skeleton: Palette.neutral[100],
  skeletonHighlight: Palette.neutral[50],
  ring: Palette.brand[300],
};

export const DarkColors: ThemeColors = {
  background: Palette.neutral[950],
  surface: Palette.neutral[900],
  surfaceElevated: Palette.neutral[800],
  surfaceSubtle: Palette.neutral[800],
  text: Palette.neutral[50],
  textSecondary: Palette.neutral[300],
  textMuted: Palette.neutral[400],
  textInverse: Palette.neutral[900],
  primary: Palette.brand[300],
  onPrimary: Palette.neutral[950],
  primaryMuted: Palette.neutral[800],
  accent: Palette.brand[300],
  onAccent: Palette.neutral[950],
  accentMuted: Palette.neutral[800],
  border: Palette.neutral[800],
  borderStrong: Palette.neutral[700],
  divider: Palette.neutral[800],
  success: Palette.success[500],
  onSuccess: Palette.neutral[0],
  successMuted: Palette.neutral[800],
  warning: Palette.warning[600],
  onWarning: Palette.neutral[0],
  warningMuted: Palette.neutral[800],
  danger: Palette.danger[500],
  onDanger: Palette.neutral[0],
  dangerMuted: Palette.neutral[800],
  overlay: "rgba(0, 0, 0, 0.5)",
  scrim: "rgba(0, 0, 0, 0.7)",
  tabBar: Palette.neutral[900],
  tabIconDefault: Palette.neutral[400],
  tabIconSelected: Palette.brand[300],
  tabBarBorder: Palette.neutral[800],
  inputBg: Palette.neutral[900],
  inputBorder: Palette.neutral[700],
  placeholder: Palette.neutral[500],
  skeleton: Palette.neutral[800],
  skeletonHighlight: Palette.neutral[700],
  ring: Palette.brand[400],
};

export const Colors = {
  light: LightColors,
  dark: DarkColors,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export type Spacing = typeof Spacing;

export const Radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export type Radius = typeof Radius;

export const FontSizes = {
  xs: 12,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 26,
  display: 32,
} as const;

export type FontSizes = typeof FontSizes;

export const FontWeights = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  heavy: "800",
} as const;

export type FontWeights = typeof FontWeights;

export const LineHeights = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
} as const;

export type LineHeights = typeof LineHeights;

export type Theme = {
  scheme: "light" | "dark";
  colors: ThemeColors;
  spacing: Spacing;
  radius: Radius;
  fontSizes: FontSizes;
  fontWeights: FontWeights;
  lineHeights: LineHeights;
};

export const LightTheme: Theme = {
  scheme: "light",
  colors: LightColors,
  spacing: Spacing,
  radius: Radius,
  fontSizes: FontSizes,
  fontWeights: FontWeights,
  lineHeights: LineHeights,
};

export const DarkTheme: Theme = {
  scheme: "dark",
  colors: DarkColors,
  spacing: Spacing,
  radius: Radius,
  fontSizes: FontSizes,
  fontWeights: FontWeights,
  lineHeights: LineHeights,
};

/** Maps our design tokens onto the react-navigation theme the navigators consume. */
export function navigationTheme(scheme: "light" | "dark"): NavigationTheme {
  const tokens = scheme === "dark" ? DarkTheme : LightTheme;
  const base = scheme === "dark" ? NavDarkTheme : NavDefaultTheme;
  return {
    ...base,
    dark: scheme === "dark",
    colors: {
      primary: tokens.colors.primary,
      background: tokens.colors.background,
      card: tokens.colors.surface,
      text: tokens.colors.text,
      border: tokens.colors.border,
      notification: tokens.colors.danger,
    },
  };
}

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});