import { describe, expect, it } from "vitest";
import { assertPositiveFinite, assertProductionQuantities } from "../validation";

describe("production validation", () => {
  it("accepts valid production quantities", () => {
    expect(() => assertProductionQuantities(10, 8, 2)).not.toThrow();
  });

  it("rejects output and waste greater than input", () => {
    expect(() => assertProductionQuantities(10, 8, 3)).toThrow("cannot exceed");
  });

  it("rejects invalid or negative quantities", () => {
    expect(() => assertProductionQuantities(0, 0, 0)).toThrow("greater than zero");
    expect(() => assertProductionQuantities(Number.NaN, 1, 0)).toThrow("valid numbers");
    expect(() => assertProductionQuantities(10, -1, 0)).toThrow("cannot be negative");
  });

  it("requires positive finite dimensions or quantities", () => {
    expect(() => assertPositiveFinite(1.5, "Width")).not.toThrow();
    expect(() => assertPositiveFinite(0, "Width")).toThrow("greater than zero");
    expect(() => assertPositiveFinite(Number.POSITIVE_INFINITY, "Width")).toThrow("greater than zero");
  });
});
