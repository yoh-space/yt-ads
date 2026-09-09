import { describe, expect, it } from "vitest";
import {
  calcRollOffCutScrap,
  calcRigidSheetOffCutScrap,
  calculateOffCutAndScrap,
  MIN_USABLE_OFFCUT_WIDTH,
} from "./material-calc";

describe("calcRollOffCutScrap", () => {
  it("matches the canonical banner example (3.2m roll, 1.0m job width)", () => {
    const result = calcRollOffCutScrap(
      { rollWidth: 3.2, isRigidSheet: false },
      { width: 1.0, length: 3.0, quantity: 1 },
      { minUsableOffcutWidth: MIN_USABLE_OFFCUT_WIDTH, defaultMarginSquareMetres: 0.15 },
    );
    expect(result.kind).toBe("roll");
    expect(result.grossArea).toBeCloseTo(9.6, 2); // 3.2 x 3.0
    expect(result.netArea).toBeCloseTo(3.0, 2); // 1.0 x 3.0
    expect(result.unusedWidth).toBeCloseTo(2.2, 2);
    expect(result.usableOffcut).not.toBeNull();
    expect(result.usableOffcut!.width).toBeCloseTo(2.2, 2);
    expect(result.usableOffcut!.length).toBeCloseTo(3.0, 2);
    expect(result.usableOffcut!.area).toBeCloseTo(6.6, 2); // 2.2 x 3.0 usable side roll
    expect(result.sideStripScrapArea).toBeCloseTo(0, 2);
    // (gross - net - offcut) + setup waste = (9.6 - 3.0 - 6.6) + 0.15 = 0.15
    expect(result.totalScrapArea).toBeCloseTo(0.15, 2);
  });

  it("classifies a sub-0.3m side strip as scrap instead of off-cut", () => {
    const result = calcRollOffCutScrap(
      { rollWidth: 3.2, isRigidSheet: false },
      { width: 3.0, length: 2.0, quantity: 1 },
      { minUsableOffcutWidth: MIN_USABLE_OFFCUT_WIDTH, defaultMarginSquareMetres: 0 },
    );
    expect(result.unusedWidth).toBeCloseTo(0.2, 2);
    expect(result.usableOffcut).toBeNull();
    expect(result.sideStripScrapArea).toBeCloseTo(0.4, 2); // 0.2 x 2.0
    // (gross - net - 0) + 0 = (6.4 - 6.0) + 0 = 0.4
    expect(result.totalScrapArea).toBeCloseTo(0.4, 2);
  });

  it("scales with job quantity", () => {
    const result = calcRollOffCutScrap(
      { rollWidth: 3.2 },
      { width: 1.0, length: 3.0, quantity: "2" },
      { defaultMarginSquareMetres: 0 },
    );
    expect(result.grossArea).toBeCloseTo(19.2, 2); // 3.2 x 3.0 x 2
    expect(result.netArea).toBeCloseTo(6.0, 2);
    expect(result.usableOffcut!.area).toBeCloseTo(13.2, 2); // 2.2 x 3.0 x 2
  });
});

describe("calcRigidSheetOffCutScrap", () => {
  it("computes sheet layout and off-cut remainder", () => {
    const result = calcRigidSheetOffCutScrap(
      { sheetWidth: 1.22, sheetLength: 2.44, isRigidSheet: true },
      { width: 0.5, length: 0.5, quantity: 4 },
      { defaultMarginSquareMetres: 0 },
    );
    expect(result.kind).toBe("rigid_sheet");
    expect(result.sheetArea).toBeCloseTo(2.977, 2); // 1.22 x 2.44
    // cutouts per width = floor(1.22/0.5) = 2, per length = floor(2.44/0.5) = 4 → 8/sheet
    expect(result.sheetsNeeded).toBe(1);
    expect(result.usableOffcut).not.toBeNull();
  });

  it("calculates via the unified engine for sheet-family materials", () => {
    const result = calculateOffCutAndScrap(
      { sheetWidth: 1.22, sheetLength: 2.44 },
      { width: 1.0, length: 1.0, quantity: 1 },
      { defaultMarginSquareMetres: 0 },
    );
    expect(result.kind).toBe("rigid_sheet");
  });
});
