import { describe, expect, it } from "vitest";
import { getUsageAllowanceStatus } from "../materialUsage";

describe("usage allowance status", () => {
  it("keeps usage normal through the 80 percent threshold", () => {
    expect(getUsageAllowanceStatus(80, 100, 0)).toBe("NORMAL");
  });

  it("flags watch and critical usage before exceeding the allowance", () => {
    expect(getUsageAllowanceStatus(81, 100, 0)).toBe("WATCH");
    expect(getUsageAllowanceStatus(96, 100, 0)).toBe("CRITICAL");
  });

  it("uses approved scrap allowance before declaring an overuse", () => {
    expect(getUsageAllowanceStatus(110, 100, 10)).toBe("CRITICAL");
    expect(getUsageAllowanceStatus(111, 100, 10)).toBe("EXCEEDED");
  });

  it("does not classify invalid or empty plans as overuse", () => {
    expect(getUsageAllowanceStatus(100, 0, 0)).toBe("NORMAL");
    expect(getUsageAllowanceStatus(Number.NaN, 100, 0)).toBe("NORMAL");
  });
});
