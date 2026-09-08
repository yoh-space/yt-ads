import { describe, expect, it } from "vitest";
import { MATERIAL_SPECIFICATIONS, findMaterialSpecification } from "./material-specifications";

describe("YT Advertisement material specifications", () => {
  it("contains the 23+ verified raw material categories across 4 primary units", () => {
    expect(MATERIAL_SPECIFICATIONS).toHaveLength(24);
    expect(findMaterialSpecification("Neon Light Flex")?.specificationOptions).toContain("Warm");
    expect(findMaterialSpecification("Foam Board")?.specificationOptions).toEqual(["18mm", "10mm", "8mm", "5mm", "3mm"]);
    expect(findMaterialSpecification("Power Supply")?.specificationOptions).toEqual(["60 Watt", "100 Watt", "200 Watt", "400 Watt"]);
    expect(findMaterialSpecification("Zecolo")?.specificationOptions).toEqual(["8 cm", "6 cm"]);
  });

  it("resolves earlier material names and aliases to canonical records", () => {
    expect(findMaterialSpecification("LED")?.name).toBe("LED Modules");
    expect(findMaterialSpecification("Mica Sheet")?.name).toBe("Mica");
    expect(findMaterialSpecification("Canvas (Canva)")?.name).toBe("Canvas");
    expect(findMaterialSpecification("ZOCOLO")?.name).toBe("Zecolo");
    expect(findMaterialSpecification("Banner")?.name).toBe("Banner Flex");
    expect(findMaterialSpecification("Foam")?.name).toBe("Foam Board");
  });

  it("retains exact confirmed metric conversion metadata", () => {
    expect(findMaterialSpecification("Banner Flex")).toMatchObject({ purchaseUnit: "roll", baseUnit: "m²", conversionRatio: 160 });
    expect(findMaterialSpecification("Acrylic")).toMatchObject({ purchaseUnit: "sheet", baseUnit: "m²", conversionRatio: 2.977 });
    expect(findMaterialSpecification("LED Modules")).toMatchObject({ purchaseUnit: "pack", baseUnit: "pcs", conversionRatio: 20 });
    expect(findMaterialSpecification("Amire")).toMatchObject({ purchaseUnit: "pack", baseUnit: "pcs", conversionRatio: 250 });
  });

  it("identifies solvents as excluded from per-job synchronous deduction", () => {
    expect(findMaterialSpecification("Solvents")?.isSolvent).toBe(true);
    expect(findMaterialSpecification("Banner Solvent")?.isSolvent).toBe(true);
  });
});
