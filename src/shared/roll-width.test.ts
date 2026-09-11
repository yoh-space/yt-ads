import { describe, expect, it } from "vitest";
import {
  parseRollOptionWidth,
  resolveRollSubstrate,
  RollWidthExceededError,
  serviceHasDerivedRoll,
} from "./roll-width";

describe("roll width derivation", () => {
  it("parses catalog roll option strings into metres", () => {
    expect(parseRollOptionWidth("3.2m × 50m")).toBe(3.2);
    expect(parseRollOptionWidth("2.07m × 50m")).toBe(2.07);
    expect(parseRollOptionWidth("1.2 Meter × 50 Meter Roll")).toBe(1.2);
    expect(parseRollOptionWidth("60cm × 100m")).toBe(0.6);
  });

  it("selects the smallest banner roll that fits the requested width", () => {
    const narrow = resolveRollSubstrate("banner_print", 1.8);
    expect(narrow?.option).toBe("2.07m × 50m");
    expect(narrow?.rollWidth).toBe(2.07);

    const wide = resolveRollSubstrate("banner_print", 3.0);
    expect(wide?.option).toBe("3.2m × 50m");
    expect(wide?.rollWidth).toBe(3.2);
  });

  it("uses the exact roll when the width matches a roll boundary", () => {
    const exact = resolveRollSubstrate("banner_print", 2.07);
    expect(exact?.rollWidth).toBe(2.07);
  });

  it("throws when the width exceeds the largest available roll", () => {
    expect(() => resolveRollSubstrate("banner_print", 4.5)).toThrow(RollWidthExceededError);
  });

  it("returns null for services without a derived roll", () => {
    expect(serviceHasDerivedRoll("light_box_a1")).toBe(false);
    expect(resolveRollSubstrate("light_box_a1", 1)).toBeNull();
  });

  it("derives sticker roll substrate from the entering width", () => {
    const result = resolveRollSubstrate("sticker_white", 1.5);
    expect(result?.option).toBe("1.52 Meter × 50 Meter Roll");
  });
});