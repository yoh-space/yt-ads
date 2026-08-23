export function assertPositiveFinite(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
}

export function assertProductionQuantities(inputQuantity: number, outputQuantity: number, wasteQuantity: number) {
  if (![inputQuantity, outputQuantity, wasteQuantity].every(Number.isFinite)) {
    throw new Error("Production quantities must be valid numbers.");
  }
  if (inputQuantity <= 0 || outputQuantity < 0 || wasteQuantity < 0) {
    throw new Error("Production input must be greater than zero and outputs cannot be negative.");
  }
  if (outputQuantity + wasteQuantity > inputQuantity) {
    throw new Error("Output plus waste cannot exceed production input.");
  }
}
