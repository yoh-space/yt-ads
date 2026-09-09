import { describe, expect, it } from "vitest";
import {
  isAtOrBelowReorderLevel,
  isPackageAtOrBelowReorderLevel,
  packageReorderThreshold,
} from "../lowStock";

describe("low-stock policy", () => {
  it("uses the admin material reorder level for central stock", () => {
    expect(isAtOrBelowReorderLevel(10, 10)).toBe(true);
    expect(isAtOrBelowReorderLevel(10.01, 10)).toBe(false);
    expect(isAtOrBelowReorderLevel(0, 0)).toBe(false);
  });

  it("converts the same admin threshold for machine operator stock", () => {
    expect(packageReorderThreshold(100, 20)).toBe(5);
    expect(isPackageAtOrBelowReorderLevel(5, 100, 20)).toBe(true);
    expect(isPackageAtOrBelowReorderLevel(5.01, 100, 20)).toBe(false);
  });

  it("does not apply a fallback usage percentage", () => {
    expect(isPackageAtOrBelowReorderLevel(1, 0, 20)).toBe(false);
  });
});
