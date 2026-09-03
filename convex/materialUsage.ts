import { calculateOffcutArea } from "./units";
import type { PurchaseUnit, Unit } from "./types";

export type ProductionType = "area" | "linear" | "ink" | "unit";

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

/**
 * Shape of the workspace's central operational & financial configuration
 * record. Used as the source of truth for ETB valuations, ink consumption
 * and risk thresholds by the rest of the backend.
 */
export type SystemConfig = {
  key: string;
  etbPerSquareMetre: number;
  etbPerLitre: number;
  etbPerPiece: number;
  etbPerMetre: number;
  etbPerSheet: number;
  unitConversionDefaults: UnitConversionRule[];
  materialOverrides: Array<{ materialName: string; etbValue: number }>;
  inkMlPerSquareMetre: number;
  maxAllowedWastePercent: number;
  minOffcutAreaSquareMetre: number;
  requireAdminPinForExceptions: boolean;
  maxDirectStockOutEtb: number;
  orderExpirationHours: number;
  updatedAt: number;
  updatedBy?: string;
};

export type UnitConversionRule = {
  materialName: string;
  purchaseUnit: PurchaseUnit;
  baseUnit: Unit;
  inputDimension?: number;
  conversionRatio: number;
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

/**
 * Bundled defaults for the workspace's central operational & financial
 * configuration. Used as a synchronous fallback and as the seed for the first
 * `systemConfigs` row. Authoritative figures come from the database and are
 * resolved via `resolveEtbValueFromConfig` /
 * `resolveInkConsumptionRateFromConfig` whenever a `SystemConfig` is
 * available.
 */
export const DEFAULT_SYSTEM_CONFIG: Omit<SystemConfig, "updatedAt" | "updatedBy"> = {
  key: "default",
  etbPerSquareMetre: 250,
  etbPerLitre: 900,
  etbPerPiece: 120,
  etbPerMetre: 150,
  etbPerSheet: 400,
  unitConversionDefaults: [
    { materialName: "Banner", purchaseUnit: "roll", baseUnit: "m²", conversionRatio: 160 },
    { materialName: "DTF Film", purchaseUnit: "roll", baseUnit: "m", conversionRatio: 100 },
    { materialName: "Acrylic", purchaseUnit: "sheet", baseUnit: "m²", conversionRatio: 2.977 },
    { materialName: "Foam", purchaseUnit: "sheet", baseUnit: "m²", conversionRatio: 2.977 },
    { materialName: "Normal Sticker", purchaseUnit: "roll", baseUnit: "m²", conversionRatio: 63.5 },
    { materialName: "Frosted Sticker", purchaseUnit: "roll", baseUnit: "m²", conversionRatio: 63.5 },
    { materialName: "Transparent Sticker", purchaseUnit: "roll", baseUnit: "m²", conversionRatio: 63.5 },
    { materialName: "Reflective Sticker", purchaseUnit: "roll", baseUnit: "m²", conversionRatio: 63.5 },
    { materialName: "Mush Sticker", purchaseUnit: "roll", baseUnit: "m²", conversionRatio: 63.5 },
    { materialName: "Canvas (Canva)", purchaseUnit: "roll", baseUnit: "m²", conversionRatio: 45.6 },
    { materialName: "Neon Light", purchaseUnit: "roll", baseUnit: "m", conversionRatio: 5 },
    { materialName: "LED Module / Strip", purchaseUnit: "pack", baseUnit: "pcs", conversionRatio: 20 },
    { materialName: "Mica Sheet", purchaseUnit: "piece", baseUnit: "pcs", conversionRatio: 1 },
    { materialName: "Power Supply", purchaseUnit: "piece", baseUnit: "pcs", conversionRatio: 1 },
  ],
  materialOverrides: [],
  inkMlPerSquareMetre: 12,
  maxAllowedWastePercent: 5,
  minOffcutAreaSquareMetre: 0.05,
  requireAdminPinForExceptions: true,
  maxDirectStockOutEtb: 2000,
  orderExpirationHours: 24,
};

/** Resolves the currently governed purchase-to-base conversion for a material. */
export function resolveConversionRatio(
  material: Pick<MaterialLike, "name" | "baseUnit" | "unit" | "rollWidth"> & { purchaseUnit?: string; conversionRatio?: number },
  config?: Pick<SystemConfig, "unitConversionDefaults">,
  purchaseUnit?: string,
  inputDimension?: number,
): number | undefined {
  const input = purchaseUnit ?? material.purchaseUnit;
  const baseUnit = material.baseUnit ?? material.unit;
  const rules = config?.unitConversionDefaults ?? [];
  const materialName = material.name.trim().toLowerCase();
  const matches = rules.filter((rule) =>
    rule.materialName.trim().toLowerCase() === materialName &&
    rule.purchaseUnit === input &&
    rule.baseUnit === baseUnit &&
    (inputDimension === undefined || rule.inputDimension === undefined || rule.inputDimension === inputDimension),
  );
  if (matches.length > 0) {
    const dimensioned = inputDimension === undefined
      ? matches.find((rule) => rule.inputDimension === undefined)
      : matches.find((rule) => rule.inputDimension !== undefined);
    return (dimensioned ?? matches[0]).conversionRatio;
  }
  return material.conversionRatio;
}

/**
 * Synchronous fallback map for unit-rate lookups. Kept so any code path that
 * still needs a value without a database context (snapshot generation, unit
 * tests, ad-hoc CLI scripts) can resolve a sane baseline. Authoritative
 * valuations live in `systemConfigs` and are resolved via
 * `resolveEtbValueFromConfig` whenever a `SystemConfig` is available.
 */
const FALLBACK_ETB_BY_UNIT: Record<string, number> = {
  "m²": DEFAULT_SYSTEM_CONFIG.etbPerSquareMetre,
  "m": DEFAULT_SYSTEM_CONFIG.etbPerMetre,
  "pcs": DEFAULT_SYSTEM_CONFIG.etbPerPiece,
  "piece": DEFAULT_SYSTEM_CONFIG.etbPerPiece,
  "L": DEFAULT_SYSTEM_CONFIG.etbPerLitre,
  "sheet": DEFAULT_SYSTEM_CONFIG.etbPerSheet,
};

/**
 * Fallback ink consumption in millilitres per square metre of printed area.
 * Authoritative value is stored in `systemConfigs` and resolved via
 * `resolveInkConsumptionRateFromConfig`.
 */
export const DEFAULT_INK_ML_PER_M2 = DEFAULT_SYSTEM_CONFIG.inkMlPerSquareMetre;

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
  if (material.baseUnit === "m") return "linear";
  if (material.category && AREA_CATEGORIES.has(material.category)) return "area";
  if (material.category && UNIT_CATEGORIES.has(material.category)) return "unit";
  if (material.baseUnit === "m²") return "area";
  if (material.baseUnit === "L") return "ink";
  return "unit";
}

/**
 * Synchronous ETB lookup that prefers the material's own stored value and
 * otherwise falls back to the bundled default rates. Use this only when a
 * `SystemConfig` is not available (e.g. unit tests or pure helpers); backend
 * handlers should pass the active `SystemConfig` to
 * `resolveEtbValueFromConfig`.
 */
export function resolveEtbValue(material: MaterialLike): number {
  if (typeof material.etbValue === "number" && material.etbValue > 0) return material.etbValue;
  const baseUnit = material.baseUnit ?? material.unit ?? "m²";
  return FALLBACK_ETB_BY_UNIT[baseUnit] ?? DEFAULT_SYSTEM_CONFIG.etbPerPiece;
}

/**
 * Authoritative ETB valuation. Order of precedence:
 *   1. Material-specific override stored in `systemConfigs.materialOverrides`
 *   2. The material's own `etbValue` field (explicit per-material value)
 *   3. The unit-rate in the active `SystemConfig`
 *   4. The bundled fallback rate for the base unit
 */
export function resolveEtbValueFromConfig(
  material: MaterialLike,
  config: Pick<SystemConfig, "etbPerSquareMetre" | "etbPerLitre" | "etbPerPiece" | "etbPerMetre" | "etbPerSheet" | "materialOverrides">,
): number {
  if (material.name) {
    const key = material.name.trim().toLowerCase();
    const override = config.materialOverrides.find((entry) => entry.materialName.trim().toLowerCase() === key);
    if (override && override.etbValue > 0) return override.etbValue;
  }
  if (typeof material.etbValue === "number" && material.etbValue > 0) return material.etbValue;
  const baseUnit = material.baseUnit ?? material.unit ?? "m²";
  switch (baseUnit) {
    case "m²":
      return config.etbPerSquareMetre;
    case "L":
      return config.etbPerLitre;
    case "m":
      return config.etbPerMetre;
    case "sheet":
      return config.etbPerSheet;
    case "piece":
    case "pcs":
      return config.etbPerPiece;
    default:
      return FALLBACK_ETB_BY_UNIT[baseUnit] ?? config.etbPerPiece;
  }
}

/**
 * Synchronous ink consumption lookup. Prefers the material's own stored
 * `consumptionRate` and otherwise falls back to the bundled default. Backend
 * handlers should pass the active `SystemConfig` to
 * `resolveInkConsumptionRateFromConfig`.
 */
export function resolveInkConsumptionRate(material: MaterialLike): number {
  if (typeof material.consumptionRate === "number" && material.consumptionRate > 0) {
    return material.consumptionRate;
  }
  return DEFAULT_INK_ML_PER_M2;
}

/**
 * Authoritative ink consumption rate. Prefers a per-material override stored
 * on the material itself; otherwise falls back to the active `SystemConfig`'s
 * workspace-wide rate.
 */
export function resolveInkConsumptionRateFromConfig(
  material: MaterialLike,
  config: Pick<SystemConfig, "inkMlPerSquareMetre">,
): number {
  if (typeof material.consumptionRate === "number" && material.consumptionRate > 0) {
    return material.consumptionRate;
  }
  return config.inkMlPerSquareMetre;
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

  if (productionType === "linear") {
    const linearQuantity = Number(input.quantity.toFixed(3));
    const areaM2 = typeof input.width === "number" && input.width > 0 && typeof input.length === "number" && input.length > 0
      ? Number((input.length * input.width * input.quantity).toFixed(3))
      : 0;
    return { productionType, baseQuantity: linearQuantity, unit: baseUnit, areaM2, inkMl: 0 };
  }

  return { productionType, baseQuantity: Number(input.quantity.toFixed(3)), unit: baseUnit, areaM2: Number(area.toFixed(3)), inkMl: 0 };
}
