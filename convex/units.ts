import type { PurchaseUnit, Unit } from "./types";

export type InputUnit = PurchaseUnit | Unit;

function isDirectUnitPair(inputUnit: InputUnit, baseUnit: Unit) {
  return (inputUnit === "liter" && baseUnit === "L") || (inputUnit === "piece" && baseUnit === "pcs") || (inputUnit === "pcs" && baseUnit === "piece");
}

/** Converts a purchase or base-unit quantity into the material's normalized base unit. */
export function convertToBase(
  quantity: number,
  inputUnit: InputUnit,
  baseUnit: Unit,
  conversionRatio?: number,
  legacyRollEquivalent?: number,
  legacySheetEquivalent?: number,
): number {
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error("Quantity must be zero or greater.");
  if (inputUnit === baseUnit || isDirectUnitPair(inputUnit, baseUnit)) return quantity;

  const ratio = inputUnit === "roll"
    ? conversionRatio ?? legacyRollEquivalent
    : inputUnit === "sheet"
      ? conversionRatio ?? legacySheetEquivalent
      : conversionRatio;
  if (ratio === undefined || !Number.isFinite(ratio) || ratio <= 0) {
    throw new Error(`Cannot convert ${inputUnit} to ${baseUnit} without a positive conversion ratio.`);
  }
  return Number((quantity * ratio).toFixed(3));
}

export function formatQuantity(quantity: number, unit: Unit): string {
  const decimals = unit === "m²" || unit === "L" || unit === "m" ? 2 : 0;
  return `${quantity.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })} ${unit}`;
}

export function calculateOffcutArea(width: number, length: number): number {
  return Number((width * length).toFixed(2));
}
