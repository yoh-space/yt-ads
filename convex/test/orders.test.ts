import { describe, expect, it } from "vitest";
import { computeStandardAllocation } from "../orderAutomation";

describe("Phase 6 & Orders Auto-Routing Invariants", () => {
  it("computes standard allocation accurately for standard order sizes", () => {
    const order = { length: 3, width: 2, quantity: "2" };
    const material = {
      name: "Banner Flex",
      unit: "m²",
      baseUnit: "m²",
      productionType: "area" as const,
      consumptionRate: 1,
    };
    const config = {
      standardWasteMargin: 5,
      maxAllowedScrapLimit: 10,
    };

    const alloc = computeStandardAllocation(order, material, config);
    // Net: 3 * 2 * 2 = 12 m²
    expect(alloc.netBaseQuantity).toBe(12);
    // Planned with 5% waste: 12 * 1.05 = 12.6 m²
    expect(alloc.plannedBaseQuantity).toBe(12.6);
    // Approved scrap with 10% limit: 12 * 0.1 = 1.2 m²
    expect(alloc.approvedScrapQuantity).toBe(1.2);
    expect(alloc.wasteMarginPercent).toBe(5);
    expect(alloc.maxScrapLimitPercent).toBe(10);
  });

  it("handles unit/piece orders without length/width", () => {
    const order = { quantity: "5" };
    const material = {
      name: "Acrylic Stand",
      unit: "pcs",
      baseUnit: "pcs",
      productionType: "unit" as const,
      consumptionRate: 1,
    };
    const config = {
      standardWasteMargin: 0,
      maxAllowedScrapLimit: 5,
    };

    const alloc = computeStandardAllocation(order, material, config);
    expect(alloc.netBaseQuantity).toBe(5);
    expect(alloc.plannedBaseQuantity).toBe(5);
    expect(alloc.approvedScrapQuantity).toBe(0.25);
  });
});
