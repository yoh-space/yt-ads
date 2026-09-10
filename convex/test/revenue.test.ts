import { describe, expect, it } from "vitest";
import { calculateActualMaterialCost } from "../owner/revenue";

describe("owner revenue COGS", () => {
  const config = { etbPerSquareMetre: 25, etbPerLitre: 100, etbPerPiece: 50, etbPerMetre: 20, etbPerSheet: 80, materialOverrides: [] };
  const materials = new Map([["banner", { name: "Banner Flex", baseUnit: "m²" }]]);

  it("does not expense store-to-operator transfers", () => {
    expect(calculateActualMaterialCost([{ eventType: "STORE_TO_OPERATOR_TRANSFER", baseQuantity: 100, materialId: "banner" }], materials, config)).toBe(0);
  });

  it("values actual production consumption at the configured owner rate", () => {
    expect(calculateActualMaterialCost([{ eventType: "PRODUCTION_CONSUMPTION", baseQuantity: 2, materialId: "banner" }], materials, config)).toBe(50);
  });

  it("ignores unrelated inventory events while preserving multiple consumed materials", () => {
    const inkMaterials = new Map([
      ["banner", { name: "Banner Flex", baseUnit: "m²" }],
      ["ink", { name: "Ink", baseUnit: "L" }],
    ]);
    expect(calculateActualMaterialCost([
      { eventType: "STORE_TO_OPERATOR_TRANSFER", baseQuantity: 100, materialId: "banner" },
      { eventType: "PRODUCTION_CONSUMPTION", baseQuantity: 2, materialId: "banner" },
      { eventType: "PRODUCTION_CONSUMPTION", baseQuantity: 0.1, materialId: "ink" },
      { eventType: "SCRAP_LOG", baseQuantity: 4, materialId: "banner" },
    ], inkMaterials, config)).toBe(60);
  });
});
