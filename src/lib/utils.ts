import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge Tailwind CSS classes with clsx
 * Handles conditional classes and resolves Tailwind class conflicts
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatInkColorLabel(colorKey?: string): string {
  switch (colorKey?.trim().toUpperCase()) {
    case "CYAN": return "Blue (Cyan)";
    case "MAGENTA": return "Red (Magenta)";
    case "YELLOW": return "Yellow";
    case "BLACK": return "Black";
    case "WHITE": return "White";
    default: return colorKey?.trim() || "Unknown";
  }
}
