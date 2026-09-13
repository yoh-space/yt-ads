/**
 * Shared Normalization Module for Owner Full-Authority Configuration Architecture.
 *
 * Implements Section 4 of owner-authority-architecture.pdf:
 * - Authoritative sources only: typed constants and canonical mappings.
 * - Normalize, then validate: collapse whitespace, alias-map units, canonicalize casing,
 *   then reject unknown enum values and unresolved references with an error naming the nearest valid match.
 * - Single source of truth shared by seeds, mutations, and migrations.
 */

export const ALLOWED_CATALOG_FAMILIES = [
  "ROLL",
  "RIGID_SHEET",
  "INK_SOLVENT",
  "HARDWARE",
  "ILLUMINATED_DISPLAY_SYSTEM",
  "SIGNAGE_FRAME_PROFILE",
] as const;

export type AllowedCatalogFamily = (typeof ALLOWED_CATALOG_FAMILIES)[number];

export const ALLOWED_BASE_UNITS = [
  "m²",
  "m",
  "sheet",
  "piece",
  "pcs",
  "L",
  "mL",
] as const;

export const ALLOWED_PURCHASE_UNITS = [
  "roll",
  "sheet",
  "liter",
  "piece",
  "canister",
  "box",
  "pack",
] as const;

export const ALLOWED_GROUP_TONES = [
  "cyan",
  "blue",
  "violet",
  "gold",
  "green",
  "slate",
] as const;

export const ALLOWED_GROUP_ICONS = [
  "ScrollText",
  "Tags",
  "Layers",
  "FlaskConical",
  "Cable",
  "Boxes",
  "Wrench",
  "Sliders",
  "ShieldCheck",
  "FolderTree",
] as const;

/** Trims string and collapses multi-whitespace down to a single space. */
export function normalizeText(val?: string | null): string {
  if (!val) return "";
  return val.trim().replace(/\s+/g, " ");
}

/**
 * Derives a deterministic slug from an entity name (Section 5.1).
 * Lowercase, whitespace collapsed, non-alphanumerics converted to underscores,
 * leading/trailing underscores stripped.
 */
export function deriveSlug(name?: string | null): string {
  const clean = normalizeText(name);
  if (!clean) return "";
  return clean
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Normalizes and validates a catalog family value against canonical families:
 * ROLL | RIGID_SHEET | INK_SOLVENT | HARDWARE | ILLUMINATED_DISPLAY_SYSTEM | SIGNAGE_FRAME_PROFILE
 */
export function normalizeCatalogFamily(raw?: string | null): AllowedCatalogFamily {
  const text = normalizeText(raw).toUpperCase().replace(/[\s-]+/g, "_");
  if (!text) {
    throw new Error(
      `Catalog family is required. Must be one of: ${ALLOWED_CATALOG_FAMILIES.join(", ")}.`,
    );
  }

  // Alias / synonym mapping
  if (text === "ROLL" || text === "ROLLS" || text === "BANNER" || text === "VINYL") {
    return "ROLL";
  }
  if (text === "RIGID_SHEET" || text === "RIGID" || text === "SHEET" || text === "SHEETS" || text === "BOARD" || text === "BOARDS") {
    return "RIGID_SHEET";
  }
  if (text === "INK_SOLVENT" || text === "INK" || text === "SOLVENT" || text === "INKS") {
    return "INK_SOLVENT";
  }
  if (text === "HARDWARE" || text === "ACCESSORY" || text === "ACCESSORIES" || text === "ELECTRICAL") {
    return "HARDWARE";
  }
  if (
    text === "ILLUMINATED_DISPLAY_SYSTEM" ||
    text === "LIGHTBOX" ||
    text === "LIGHT_BOX" ||
    text === "SCREEN_LIGHTBOX" ||
    text === "SCREEN_LIGHT_BOX" ||
    text === "FABRIC_LIGHTBOX" ||
    text === "SEG_LIGHTBOX" ||
    text === "ILLUMINATED_DISPLAY" ||
    text === "BACKLIT_DISPLAY"
  ) {
    return "ILLUMINATED_DISPLAY_SYSTEM";
  }
  if (
    text === "SIGNAGE_FRAME_PROFILE" ||
    text === "FRAME_PROFILE" ||
    text === "EXTRUSION" ||
    text === "EXTRUSIONS" ||
    text === "FRAME" ||
    text === "FRAMING" ||
    text === "METAL_PROFILE" ||
    text === "LIGHTBOX_FRAME" ||
    text === "LIGHTBOX_BARS" ||
    text === "SIGNAGE_BARS" ||
    text === "ALUMINUM_PROFILE"
  ) {
    return "SIGNAGE_FRAME_PROFILE";
  }

  if (ALLOWED_CATALOG_FAMILIES.includes(text as AllowedCatalogFamily)) {
    return text as AllowedCatalogFamily;
  }

  throw new Error(
    `Unknown catalog family '${raw}'. Must be one of: ${ALLOWED_CATALOG_FAMILIES.join(", ")}.`,
  );
}

/**
 * Normalizes base units to canonical representations (e.g. "m²", "m", "L", "mL", "sheet", "piece").
 */
export function normalizeBaseUnit(raw?: string | null): string {
  const text = normalizeText(raw);
  if (!text) throw new Error("Base unit is required.");

  const lower = text.toLowerCase();
  if (lower === "m²" || lower === "m2" || lower === "sqm" || lower === "sq_m" || lower === "sq.m") {
    return "m²";
  }
  if (lower === "m" || lower === "meter" || lower === "metre" || lower === "linear_meter") {
    return "m";
  }
  if (lower === "l" || lower === "liter" || lower === "litre" || lower === "liters" || lower === "litres") {
    return "L";
  }
  if (lower === "ml" || lower === "milliliter" || lower === "millilitre") {
    return "mL";
  }
  if (lower === "sheet" || lower === "sheets") {
    return "sheet";
  }
  if (lower === "piece" || lower === "pieces" || lower === "pc" || lower === "pcs") {
    return "piece";
  }

  // Check direct matches
  const match = ALLOWED_BASE_UNITS.find((u) => u.toLowerCase() === lower);
  if (match) return match;

  throw new Error(
    `Unknown base unit '${raw}'. Allowed values: ${ALLOWED_BASE_UNITS.join(", ")}.`,
  );
}

/**
 * Normalizes purchase units to canonical representations (e.g. "roll", "sheet", "liter", "piece", "canister").
 */
export function normalizePurchaseUnit(raw?: string | null): string {
  const text = normalizeText(raw).toLowerCase();
  if (!text) throw new Error("Purchase unit is required.");

  if (text === "roll" || text === "rolls") return "roll";
  if (text === "sheet" || text === "sheets") return "sheet";
  if (text === "liter" || text === "litre" || text === "liters" || text === "litres" || text === "l") return "liter";
  if (text === "piece" || text === "pieces" || text === "pcs" || text === "pc") return "piece";
  if (text === "canister" || text === "can" || text === "canisters") return "canister";
  if (text === "box" || text === "boxes") return "box";
  if (text === "pack" || text === "package" || text === "packs") return "pack";

  const match = ALLOWED_PURCHASE_UNITS.find((u) => u === text);
  if (match) return match;

  throw new Error(
    `Unknown purchase unit '${raw}'. Allowed values: ${ALLOWED_PURCHASE_UNITS.join(", ")}.`,
  );
}

/**
 * Normalizes group design tone (Section 4.2).
 */
export function normalizeGroupTone(raw?: string | null): string {
  const text = normalizeText(raw).toLowerCase();
  if (!text) return "cyan";
  if (ALLOWED_GROUP_TONES.includes(text as any)) return text;
  throw new Error(`Unknown group tone '${raw}'. Allowed tones: ${ALLOWED_GROUP_TONES.join(", ")}.`);
}

/**
 * Normalizes group icon name (Section 4.2).
 */
export function normalizeGroupIcon(raw?: string | null): string {
  const text = normalizeText(raw);
  if (!text) return "FolderTree";
  const match = ALLOWED_GROUP_ICONS.find((i) => i.toLowerCase() === text.toLowerCase());
  if (match) return match;
  return text; // Allow custom lucide icon string
}
