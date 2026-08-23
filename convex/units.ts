import type { Unit } from "./types";

export type InputUnit = "roll" | "sheet" | Unit;

export function convertToBase(
  quantity: number,
  inputUnit: InputUnit,
  materialUnit: Unit,
  rollEquivalent?: number,
  sheetEquivalent?: number,
): number {
  if (inputUnit === materialUnit) return quantity;
  if (inputUnit === "roll" && rollEquivalent) return quantity * rollEquivalent;
  if (inputUnit === "sheet" && sheetEquivalent) return quantity * sheetEquivalent;
  throw new Error(`Cannot convert ${inputUnit} to ${materialUnit} without a conversion rule.`);
}

export function formatQuantity(quantity: number, unit: Unit): string {
  const decimals = unit === "m²" || unit === "L" ? 1 : 0;
  return `${quantity.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })} ${unit}`;
}

export function calculateOffcutArea(width: number, length: number): number {
  return Number((width * length).toFixed(2));
}
