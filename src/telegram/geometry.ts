export interface ParsedDimensions {
  width: number;
  height: number;
  area: number;
  label: string;
}

export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

/**
 * Parses a dimensions string like "2x3", "1.5 x 2", "2×3" or "2*3" (metres).
 * Returns the width/height, the computed area in m², and a display label.
 * Returns null when the input is not a valid `length x width` pair.
 */
export function parseDimensions(input: string): ParsedDimensions | null {
  const trimmed = input.trim();
  const match = /^(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*m?\s*$/i.exec(trimmed);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= 0 || height <= 0 || width > 1000 || height > 1000) return null;
  const area = Math.round(width * height * 100) / 100;
  return { width, height, area, label: `${formatNumber(width)}m × ${formatNumber(height)}m` };
}

/** True when the text looks like an order code, e.g. ORD-2026-123456. */
export function isOrderCode(text: string): boolean {
  return /^ORD-\d{4}-\d{6}$/i.test(text.trim());
}

/** True when the text looks like a phone number. */
export function looksLikePhone(text: string): boolean {
  return /^\+?\d[\d\s()-]{7,18}$/.test(text.trim());
}

export function normalizePhone(text: string): string {
  return text.replace(/[^\d+]/g, "").trim();
}