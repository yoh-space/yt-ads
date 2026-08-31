import { describe, expect, it } from "vitest";
import { calculateOffcutArea, convertToBase, formatQuantity } from "@/lib/units";

describe("inventory unit conversion", () => {
  it("converts two banner rolls into 320 square metres", () => {
    expect(convertToBase(2, "roll", "m²", 160)).toBe(320);
  });

  it("converts rigid sheets into square metres using the confirmed area", () => {
    expect(convertToBase(2, "sheet", "m²", 2.977)).toBe(5.954);
  });

  it("converts a DTF film roll into 100 running metres", () => {
    expect(convertToBase(1, "roll", "m", 100)).toBe(100);
  });

  it("converts LED packs into pieces", () => {
    expect(convertToBase(3, "pack", "pcs", 20)).toBe(60);
  });

  it("converts neon-light rolls into running metres", () => {
    expect(convertToBase(4, "roll", "m", 5)).toBe(20);
  });

  it("preserves direct base-unit entries without conversion", () => {
    expect(convertToBase(96, "m", "m", 50)).toBe(96);
    expect(convertToBase(7, "piece", "pcs", 1)).toBe(7);
  });

  it("rejects a purchase-unit entry without a positive ratio", () => {
    expect(() => convertToBase(1, "roll", "m²")).toThrow("positive conversion ratio");
  });

  it("calculates reusable sheet offcuts in square metres", () => {
    expect(calculateOffcutArea(1.2, 0.8)).toBe(0.96);
  });

  it("formats tracked quantities consistently", () => {
    expect(formatQuantity(18.25, "L")).toBe("18.25 L");
  });
});
