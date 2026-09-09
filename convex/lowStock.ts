/**
 * Authoritative low-stock policy.
 *
 * Admin configures `materials.reorderAt` in the material settings. Central
 * store views compare the material's base-unit balance directly. Machine
 * operators are the only customized view: their package/floor balance is
 * compared after converting the same admin threshold into that machine
 * stock's unit using its conversion ratio.
 */
export function isAtOrBelowReorderLevel(quantity: number, reorderAt: number): boolean {
  return reorderAt > 0 && quantity <= reorderAt;
}

export function packageReorderThreshold(reorderAt: number, conversionRatio?: number): number {
  return conversionRatio !== undefined && conversionRatio > 0 ? reorderAt / conversionRatio : reorderAt;
}

export function isPackageAtOrBelowReorderLevel(
  quantity: number,
  reorderAt: number,
  conversionRatio?: number,
): boolean {
  return isAtOrBelowReorderLevel(quantity, packageReorderThreshold(reorderAt, conversionRatio));
}
