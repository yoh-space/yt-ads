/**
 * Pure client-side utility that maps a flat `listParentInventory` result into
 * the six visual category groups shown on the Owner Inventory main-store tab.
 *
 * Grouping is intentionally based on the data that's already present in every
 * parentInventory row (unitType, materialCategory, baseUnit) so it stays
 * consistent as the catalog grows without schema changes.
 */

import {
  Boxes,
  Cable,
  FlaskConical,
  Layers,
  Minus,
  Package,
  ScrollText,
  Tags,
  type LucideIcon,
} from "lucide-react";

/** Matches what `api.inventory.listParentInventory` returns per item. */
export interface ParentInventoryItem {
  _id: string;
  materialName: string;
  materialCategory: string;
  unitType: "ROLL" | "SHEET" | "LITER";
  totalStockQuantity: number;
  baseUnit?: string;
  baseUnitsInStock?: number;
  conversionFactor?: number | null;
  reorderAt?: number;
  /** Resolved by the backend from the material reorder level and package conversion. */
  lowStock: boolean;
}

export type CategoryTone = "cyan" | "gold" | "violet" | "blue" | "green" | "slate";

export interface CategoryGroupItem {
  name: string;
  quantity: number;
  unit: string;
  lowStock: boolean;
}

export interface CategoryGroup {
  id: string;
  label: string;
  amharicLabel: string;
  description: string;
  icon: LucideIcon;
  tone: CategoryTone;
  /** Sum of `totalStockQuantity` across the group (whole packaging units). */
  totalUnits: number;
  /** Human-readable unit label for the total (Rolls / Sheets / Canisters / pcs / m). */
  unitLabel: string;
  items: CategoryGroupItem[];
  /** True when any item in the group is at or below its reorder threshold. */
  hasLowStock: boolean;
}

/** Categories whose `category` field marks them as roll materials. */
const ROLL_CATEGORIES = new Set([
  "Banner",
  "Fabric roll",
  "Film",
]);

/** `category` values that classify a material as a sticker / vinyl roll. */
const STICKER_ROLL_CATEGORIES = new Set([
  "Sticker roll",
]);

/** `category` values that classify a material as a rigid sheet. */
const SHEET_CATEGORIES = new Set([
  "Rigid sheet",
  "Foam board",
]);

/** `category` values that classify a material as an ink or solvent liquid. */
const INK_SOLVENT_CATEGORIES = new Set([
  "Ink",
  "Solvent",
]);

/**
 * `category` + `baseUnit` combinations that indicate a metal bar / structural
 * linear material (6-metre aluminium or steel bars used for 3D light boxes).
 * We match on baseUnit "m" inside hardware/electrical categories because that
 * is how linear structural items are tracked in this catalog.
 */
const LINEAR_HARDWARE_CATEGORIES = new Set([
  "Hardware",
  "Electrical",
]);

/** All other hardware / countable accessory categories. */
const HARDWARE_CATEGORIES = new Set([
  "Electrical",
  "Hardware",
  "Display hardware",
  "Finished component",
  "Textile & Apparel",
]);

// ─── Classifier helpers ────────────────────────────────────────────────────────

function isRoll(item: ParentInventoryItem): boolean {
  return (
    item.unitType === "ROLL" &&
    !STICKER_ROLL_CATEGORIES.has(item.materialCategory) &&
    (ROLL_CATEGORIES.has(item.materialCategory) ||
      // Fallback: any ROLL-type that didn't match another more-specific bucket
      item.unitType === "ROLL")
  );
}

function isStickerRoll(item: ParentInventoryItem): boolean {
  return item.unitType === "ROLL" && STICKER_ROLL_CATEGORIES.has(item.materialCategory);
}

function isSheet(item: ParentInventoryItem): boolean {
  return item.unitType === "SHEET" || SHEET_CATEGORIES.has(item.materialCategory);
}

function isInkSolvent(item: ParentInventoryItem): boolean {
  return item.unitType === "LITER" || INK_SOLVENT_CATEGORIES.has(item.materialCategory);
}

function isMetalBar(item: ParentInventoryItem): boolean {
  return (
    (item.baseUnit === "m") &&
    LINEAR_HARDWARE_CATEGORIES.has(item.materialCategory)
  );
}

function isHardware(item: ParentInventoryItem): boolean {
  return HARDWARE_CATEGORIES.has(item.materialCategory);
}

// ─── Grouping function ────────────────────────────────────────────────────────

/**
 * Groups a flat parentInventory list into six display categories.
 * Each item maps to exactly one group (first matching rule wins).
 */
export function groupParentInventoryByCategory(
  items: ParentInventoryItem[],
): CategoryGroup[] {
  const groups: Record<
    string,
    {
      meta: Omit<CategoryGroup, "totalUnits" | "items" | "hasLowStock">;
      rawItems: Array<{ item: ParentInventoryItem }>;
    }
  > = {
    rolls: {
      meta: {
        id: "rolls",
        label: "Rolls",
        amharicLabel: "ሮሎች",
        description: "Banner, canvas & fabric rolls",
        icon: ScrollText,
        tone: "cyan",
        unitLabel: "Rolls",
      },
      rawItems: [],
    },
    stickers: {
      meta: {
        id: "stickers",
        label: "Sticker Rolls",
        amharicLabel: "ስቲከር ሮሎች",
        description: "Vinyl & sticker media",
        icon: Tags,
        tone: "violet",
        unitLabel: "Rolls",
      },
      rawItems: [],
    },
    sheets: {
      meta: {
        id: "sheets",
        label: "Sheets",
        amharicLabel: "ሺቶች",
        description: "Rigid boards & foam sheets",
        icon: Layers,
        tone: "gold",
        unitLabel: "Sheets",
      },
      rawItems: [],
    },
    canisters: {
      meta: {
        id: "canisters",
        label: "Inks & Solvents",
        amharicLabel: "ቀለሞች",
        description: "Ink canisters & cleaning solvents",
        icon: FlaskConical,
        tone: "green",
        unitLabel: "Canisters",
      },
      rawItems: [],
    },
    metal_bars: {
      meta: {
        id: "metal_bars",
        label: "Metal Bars",
        amharicLabel: "የብረት ዘንጎች",
        description: "Structural aluminium & steel bars (6 m)",
        icon: Minus,
        tone: "blue",
        unitLabel: "m",
      },
      rawItems: [],
    },
    hardware: {
      meta: {
        id: "hardware",
        label: "Hardware & Parts",
        amharicLabel: "ሃርድዌር",
        description: "Electronics, accessories & display parts",
        icon: Package,
        tone: "slate",
        unitLabel: "pcs",
      },
      rawItems: [],
    },
  };

  for (const item of items) {
    // Priority order: stickers before generic rolls; metal bars before generic hardware
    if (isStickerRoll(item)) {
      groups.stickers.rawItems.push({ item });
    } else if (isRoll(item)) {
      groups.rolls.rawItems.push({ item });
    } else if (isSheet(item)) {
      groups.sheets.rawItems.push({ item });
    } else if (isInkSolvent(item)) {
      groups.canisters.rawItems.push({ item });
    } else if (isMetalBar(item)) {
      groups.metal_bars.rawItems.push({ item });
    } else if (isHardware(item)) {
      groups.hardware.rawItems.push({ item });
    } else {
      // Catch-all: anything unclassified goes into hardware
      groups.hardware.rawItems.push({ item });
    }
  }

  return Object.values(groups).map(({ meta, rawItems }) => {
    const categoryItems: CategoryGroupItem[] = rawItems.map(({ item }) => {
      const isLow = item.lowStock;
      return {
        name: item.materialName,
        quantity: Number(item.totalStockQuantity.toFixed(1)),
        unit: meta.unitLabel,
        lowStock: isLow,
      };
    });

    const totalUnits = Number(
      rawItems
        .reduce((sum, { item }) => sum + item.totalStockQuantity, 0)
        .toFixed(1),
    );

    return {
      ...meta,
      totalUnits,
      items: categoryItems,
      hasLowStock: categoryItems.some((i) => i.lowStock),
    };
  });
}

/**
 * Convenience: returns a quick breakdown of base-unit totals for the
 * summary bar above the category grid.
 */
export function computeMainStoreSummary(items: ParentInventoryItem[]) {
  let totalRollBaseM2 = 0;
  let totalSheetBaseM2 = 0;
  let totalInkLitres = 0;
  let totalTracked = 0;

  for (const item of items) {
    totalTracked += 1;
    const base = item.baseUnitsInStock ?? 0;
    if (item.unitType === "ROLL") totalRollBaseM2 += base;
    else if (item.unitType === "SHEET") totalSheetBaseM2 += base;
    else if (item.unitType === "LITER") totalInkLitres += base;
  }

  return {
    totalTracked,
    totalRollBaseM2: Number(totalRollBaseM2.toFixed(1)),
    totalSheetBaseM2: Number(totalSheetBaseM2.toFixed(1)),
    totalInkLitres: Number(totalInkLitres.toFixed(1)),
  };
}
