export type NormalizedInkColor = "CYAN" | "MAGENTA" | "YELLOW" | "BLACK" | "WHITE";

const DEFAULT_INK_COLOR: NormalizedInkColor = "BLACK";

/**
 * Converts legacy/user-entered ink labels into the canonical storage keys.
 * Unknown, missing, or blank values fall back to BLACK so callers always get
 * a valid canonical value and repeated normalization remains idempotent.
 */
export function normalizeInkColor(rawColor?: string | null): NormalizedInkColor {
  const value = rawColor?.trim().toLowerCase() ?? "";
  if (!value) return DEFAULT_INK_COLOR;
  if (value.includes("cmyk")) return "CYAN";

  switch (value) {
    case "blue":
    case "cyan":
    case "c":
      return "CYAN";
    case "red":
    case "magenta":
    case "m":
      return "MAGENTA";
    case "yellow":
    case "y":
      return "YELLOW";
    case "black":
    case "k":
      return "BLACK";
    case "white":
    case "w":
      return "WHITE";
    default:
      return DEFAULT_INK_COLOR;
  }
}

export function normalizeCompositeInkColors(rawColor: string): NormalizedInkColor[] {
  const value = rawColor.trim().toLowerCase();
  if (value.includes("cmyk")) return ["CYAN", "MAGENTA", "YELLOW", "BLACK"];
  return [normalizeInkColor(rawColor)];
}
