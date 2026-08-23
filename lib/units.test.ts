import { describe, expect, it } from "vitest";
import { calculateOffcutArea, convertToBase, formatQuantity } from "@/lib/units";

describe("inventory unit conversion", () => {
  it("converts a banner roll into the configured square-meter base quantity", () => {
    expect(convertToBase(2, "roll", "m²", 160)).toBe(320);
  });

  it("converts sheets into square meters using the configured sheet rule", () => {
    expect(convertToBase(2, "sheet", "m²", undefined, 2.98)).toBe(5.96);
  });

  it("preserves base-unit entries without conversion", () => {
    expect(convertToBase(96, "m", "m", 50)).toBe(96);
  });

  it("calculates reusable sheet offcuts in square meters", () => {
    expect(calculateOffcutArea(1.2, 0.8)).toBe(0.96);
  });

  it("formats tracked quantities consistently", () => {
    expect(formatQuantity(18.25, "L")).toBe("18.3 L");
  });
});
