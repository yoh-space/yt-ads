import { describe, expect, it } from "vitest";

describe("Storekeeper Material Stock Movement Modal Logic", () => {
  type CategoryFamily = "ROLL" | "RIGID_SHEET" | "INK_SOLVENT" | "HARDWARE" | "OTHER";

  function getMaterialFamily(m: {
    catalogFamily?: string;
    materialFamily?: string;
    category?: string;
    purchaseUnit?: string;
    isSolvent?: boolean;
  }): CategoryFamily {
    if (m.catalogFamily) {
      if (m.catalogFamily === "ROLL") return "ROLL";
      if (m.catalogFamily === "RIGID_SHEET" || m.catalogFamily === "BARS") return "RIGID_SHEET";
      if (m.catalogFamily === "INK_SOLVENT") return "INK_SOLVENT";
      if (
        m.catalogFamily === "HARDWARE" ||
        m.catalogFamily === "SIGNAGE_FRAME_PROFILE" ||
        m.catalogFamily === "ILLUMINATED_DISPLAY_SYSTEM" ||
        m.catalogFamily === "PACKAGES"
      ) {
        return "HARDWARE";
      }
    }
    if (
      m.materialFamily === "INK" ||
      m.materialFamily === "SOLVENT" ||
      m.category?.toLowerCase().includes("ink") ||
      m.isSolvent
    ) {
      return "INK_SOLVENT";
    }
    if (
      m.category?.toLowerCase().includes("roll") ||
      m.category?.toLowerCase().includes("banner") ||
      m.category?.toLowerCase().includes("sticker") ||
      m.category?.toLowerCase().includes("vinyl") ||
      m.purchaseUnit === "roll"
    ) {
      return "ROLL";
    }
    if (
      m.category?.toLowerCase().includes("sheet") ||
      m.category?.toLowerCase().includes("acrylic") ||
      m.category?.toLowerCase().includes("board") ||
      m.purchaseUnit === "sheet"
    ) {
      return "RIGID_SHEET";
    }
    if (
      m.materialFamily === "HARDWARE" ||
      m.category?.toLowerCase().includes("hardware") ||
      m.category?.toLowerCase().includes("accessor")
    ) {
      return "HARDWARE";
    }
    return "OTHER";
  }

  it("accurately classifies materials into their proper category family", () => {
    expect(
      getMaterialFamily({
        catalogFamily: "ROLL",
        category: "Banner",
        purchaseUnit: "roll",
      })
    ).toBe("ROLL");

    expect(
      getMaterialFamily({
        catalogFamily: "RIGID_SHEET",
        category: "Acrylic",
        purchaseUnit: "sheet",
      })
    ).toBe("RIGID_SHEET");

    expect(
      getMaterialFamily({
        catalogFamily: "INK_SOLVENT",
        category: "Ink",
        purchaseUnit: "canister",
      })
    ).toBe("INK_SOLVENT");

    expect(
      getMaterialFamily({
        catalogFamily: "HARDWARE",
        category: "Fasteners",
        purchaseUnit: "piece",
      })
    ).toBe("HARDWARE");
  });

  it("validates stock-out boundaries against available on-hand base stock", () => {
    function validateStockMovement(
      direction: "in" | "out",
      convertedQuantity: number,
      availableBaseStock: number
    ): { valid: boolean; error?: string } {
      if (convertedQuantity <= 0) {
        return { valid: false, error: "Quantity must be greater than zero." };
      }
      if (direction === "out" && convertedQuantity > availableBaseStock) {
        return {
          valid: false,
          error: "Insufficient stock in main store.",
        };
      }
      return { valid: true };
    }

    // Stock in is always permitted as long as quantity > 0
    expect(validateStockMovement("in", 500, 100).valid).toBe(true);

    // Stock out within balance is valid
    expect(validateStockMovement("out", 50, 100).valid).toBe(true);
    expect(validateStockMovement("out", 100, 100).valid).toBe(true);

    // Stock out exceeding balance is flagged
    const invalidStockOut = validateStockMovement("out", 105, 100);
    expect(invalidStockOut.valid).toBe(false);
    expect(invalidStockOut.error).toBe("Insufficient stock in main store.");
  });

  it("computes projected stock balances accurately", () => {
    function calculateProjectedBalance(
      currentBaseStock: number,
      direction: "in" | "out",
      convertedQuantity: number
    ): number {
      return direction === "in"
        ? currentBaseStock + convertedQuantity
        : Math.max(0, currentBaseStock - convertedQuantity);
    }

    expect(calculateProjectedBalance(1000, "in", 250)).toBe(1250);
    expect(calculateProjectedBalance(1000, "out", 250)).toBe(750);
    expect(calculateProjectedBalance(100, "out", 100)).toBe(0);
  });
});
