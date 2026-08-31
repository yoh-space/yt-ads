import { calculateOffcutArea } from "./units";

export type ProductionType = "area" | "ink" | "unit";

type MaterialLike = {
  name: string;
  category?: string;
  unit?: string;
  baseUnit?: string;
  productionType?: ProductionType | null;
  consumptionRate?: number;
  etbValue?: number;
  sheetWidth?: number;
  sheetLength?: number;
  rollWidth?: number;
};

/** Category names that map to sheet/roll materials depleted by printed/cut area (m²). */
const AREA_CATEGORIES = new Set([
  "Banner",
  "Sticker roll",
  "Rigid sheet",
  "Foam board",
  "Film",
  "Fabric roll",
]);

/** Category names that map to printing inks depleted by volume per m² printed. */
const INK_NAMES = new Set([
  "Banner Ink",
  "DTF Ink",
  "Print and Cut INK",
  "UV Flat bed Ink",
]);

const INK_CATEGORY = "Ink";

/** Unit items (count-based depletion): electrical parts, finished components, display hardware. */
const UNIT_CATEGORIES = new Set([
  "Electrical",
  "Finished component",
  "Display hardware",
]);

/** Fallback ETB valuation per base unit when the material has no explicit value. */
const DEFAULT_ETB_BY_UNIT: Record<string, number> = {
  "m²": 250,
  "m": 150,
  "pcs": 120,
  "piece": 120,
  "L": 900,
  "sheet": 400,
};

/** Default ink consumption in millilitres per square metre of printed area. */
export const DEFAULT_INK_ML_PER_M2 = 12;

const AREA_ROLL_CATEGORIES = new Set(["Banner", "Sticker roll", "Film", "Fabric roll"]);
const AREA_SHEET_CATEGORIES = new Set(["Rigid sheet", "Foam board"]);

/**
 * Classifies a material for automatic deduction. Prefers an explicit
 * `productionType` stored on the material; otherwise derives it from the
 * canonical category/name. Never throws — unknown materials default to `unit`.
 */
export function classifyMaterialProductionType(material: MaterialLike): ProductionType {
  if (material.productionType) return material.productionType;
  const name = material.name?.toLowerCase() ?? "";
  if (INK_NAMES.has(name) || material.category === INK_CATEGORY) return "ink";
  if (material.category && AREA_CATEGORIES.has(material.category)) return "area";
  if (material.category && UNIT_CATEGORIES.has(material.category)) return "unit";
  if (material.baseUnit === "m²") return "area";
  if (material.baseUnit === "L") return "ink";
  if (material.baseUnit === "m") return "area";
  return "unit";
}

/** Resolves the ETB value of one base unit of the material, with a sensible fallback. */
export function resolveEtbValue(material: MaterialLike): number {
  if (typeof material.etbValue === "number" && material.etbValue > 0) return material.etbValue;
  const baseUnit = material.baseUnit ?? material.unit ?? "m²";
  return DEFAULT_ETB_BY_UNIT[baseUnit] ?? 120;
}

/** Resolves the ink consumption rate (mL of ink per m² printed), defaulting when unset. */
export function resolveInkConsumptionRate(material: MaterialLike): number {
  if (typeof material.consumptionRate === "number" && material.consumptionRate > 0) {
    return material.consumptionRate;
  }
  return DEFAULT_INK_ML_PER_M2;
}

/** Resolves the effective consumption rate for a material (mL/m² for ink only). */
export function effectiveConsumptionRate(material: MaterialLike): number {
  const type = classifyMaterialProductionType(material);
  return type === "ink" ? resolveInkConsumptionRate(material) : 0;
}

export function isRollMaterial(material: MaterialLike): boolean {
  const cat = material.category ?? "";
  return AREA_ROLL_CATEGORIES.has(cat);
}

export function isSheetMaterial(material: MaterialLike): boolean {
  const cat = material.category ?? "";
  return AREA_SHEET_CATEGORIES.has(cat);
}

/**
 * Computes the printed/cut area (m²) for a job given its dimensions and the
 * number of pieces. When dimensions are missing it falls back to the job's
 * own `quantity` (already in m²) so legacy jobs still deduct correctly.
 */
export function computeJobArea(input: {
  length?: number;
  width?: number;
  quantity: number;
  fallbackArea?: number;
}): number {
  const { length, width, quantity } = input;
  if (typeof length === "number" && Number.isFinite(length) && length > 0 &&
      typeof width === "number" && Number.isFinite(width) && width > 0) {
    const single = calculateOffcutArea(length, width);
    return Number((single * quantity).toFixed(3));
  }
  const fallback = typeof input.fallbackArea === "number" && Number.isFinite(input.fallbackArea) ? input.fallbackArea : 0;
  return Number((fallback > 0 ? fallback : quantity).toFixed(3));
}

/**
 * Computes the bill of materials (in the material's base unit) that a job
 * should consume when it is completed.
 *
 * - area materials: printed area (length × width × quantity) in m²
 * - ink materials: printed area × mL per m², then mL → L
 * - unit materials: exact piece count
 */
export function computeJobConsumption(material: MaterialLike, input: {
  length?: number;
  width?: number;
  quantity: number;
  fallbackArea?: number;
}): { productionType: ProductionType; baseQuantity: number; unit: string; areaM2: number; inkMl: number } {
  const productionType = classifyMaterialProductionType(material);
  const area = computeJobArea(input);
  const baseUnit = material.baseUnit ?? material.unit ?? "m²";

  if (productionType === "ink") {
    const ml = area * resolveInkConsumptionRate(material);
    const litres = Number((ml / 1000).toFixed(3));
    return { productionType, baseQuantity: litres, unit: "L", areaM2: Number(area.toFixed(3)), inkMl: Number(ml.toFixed(1)) };
  }

  if (productionType === "area") {
    return { productionType, baseQuantity: Number(area.toFixed(3)), unit: "m²", areaM2: Number(area.toFixed(3)), inkMl: 0 };
  }

  return { productionType, baseQuantity: Number(input.quantity.toFixed(3)), unit: baseUnit, areaM2: Number(area.toFixed(3)), inkMl: 0 };
}
