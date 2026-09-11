import { describe, expect, it } from "vitest";
import { serviceSpecificationFields, validateServiceSpecifications } from "./service-specifications";

describe("service specification intake", () => {
  it("exposes the exact Digital Screen catalog labels for light boxes", () => {
    const field = serviceSpecificationFields("light_box_a1").find((item) => item.key === "screenSize");
    expect(field?.options).toEqual(["A1 (594 × 841 mm)", "A2 (420 × 594 mm)", "Digital Screen A1", "Digital Screen A2"]);
  });

  it("accepts a complete canonical light-box payload", () => {
    expect(validateServiceSpecifications("light_box_a1", {
      screenSize: "A1 (594 × 841 mm)",
      faceMaterial: "Mica Sheet",
      thickness: "3mm",
      color: "White",
      lightingType: "LED Modules",
      ledColor: "Cool White (6000K-6500K)",
      powerSupply: "100 Watt",
    })).toEqual({
      screenSize: "A1 (594 × 841 mm)",
      faceMaterial: "Mica Sheet",
      thickness: "3mm",
      color: "White",
      lightingType: "LED Modules",
      ledColor: "Cool White (6000K-6500K)",
      powerSupply: "100 Watt",
    });
  });

  it("rejects missing and non-catalog values", () => {
    expect(() => validateServiceSpecifications("dtf", { garmentSize: "S" })).toThrow();
    expect(() => validateServiceSpecifications("dtf", { garmentSize: "XXXL", filmWidth: "60cm × 100m" })).toThrow();
  });
});
