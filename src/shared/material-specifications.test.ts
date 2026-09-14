import { describe, expect, it } from "vitest";
import { MATERIAL_SPECIFICATIONS, findMaterialSpecification } from "./material-specifications";

describe("YT Advertisement material specifications", () => {
  it("contains the ten canonical specification families", () => {
    expect(MATERIAL_SPECIFICATIONS).toHaveLength(42);
    expect(findMaterialSpecification("Neon Light")?.specificationOptions).toEqual([
      "White (Warm White, Cool White)",
      "White",
      "Warm",
      "Yellow",
      "Red",
      "Blue",
      "Green",
      "Ice Blue",
      "Pink",
      "Orange",
      "Purple",
    ]);
    expect(findMaterialSpecification("Foam")?.specificationOptions).toEqual(["18mm", "15mm", "10mm", "5mm", "3mm"]);
    expect(findMaterialSpecification("Power Supply")?.specificationOptions).toEqual(["60 Watt", "100 Watt", "200 Watt", "400 Watt", "60 watt", "100 watt", "200 watt", "400 watt"]);
    expect(findMaterialSpecification("Zocolo (Base / Skirting)")?.specificationOptions).toEqual(["8 cm", "6 cm", "8 cm thickness", "6 cm thickness"]);
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
    expect(findMaterialSpecification("Acrylic")).toMatchObject({ name: "Mica", purchaseUnit: "sheet", baseUnit: "m²", conversionRatio: 2.977 });
    expect(findMaterialSpecification("LED Modules")).toMatchObject({ purchaseUnit: "pack", baseUnit: "pcs", conversionRatio: 20 });
    expect(findMaterialSpecification("Amire")).toMatchObject({ purchaseUnit: "pack", baseUnit: "pcs", conversionRatio: 250 });
  });

  it("identifies solvents as excluded from per-job synchronous deduction", () => {
    expect(findMaterialSpecification("Solvents")?.isSolvent).toBe(true);
    expect(findMaterialSpecification("Banner Solvent")?.isSolvent).toBe(true);
  });

  it("ensures each ink specification has independent color property and ink materialFamily", () => {
    const inks = MATERIAL_SPECIFICATIONS.filter((m) => m.category === "Ink");
    expect(inks).toHaveLength(18);
    for (const ink of inks) {
      expect(ink.materialFamily).toBe("INK");
      expect(ink.catalogFamily).toBe("INK_SOLVENT");
      expect(["CYAN", "MAGENTA", "YELLOW", "BLACK", "WHITE"]).toContain(ink.inkColor);
    }
    // Verify specific color lookups
    expect(findMaterialSpecification("Banner Ink Cyan")?.inkColor).toBe("CYAN");
    expect(findMaterialSpecification("Banner Ink 5L Canister - Magenta")?.inkColor).toBe("MAGENTA");
    expect(findMaterialSpecification("DTF Ink 1L Canister - White")?.inkColor).toBe("WHITE");
    expect(findMaterialSpecification("UV Ink 1L Canister - Black")?.inkColor).toBe("BLACK");
  });
});
