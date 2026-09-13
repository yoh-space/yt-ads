import { describe, expect, it } from "vitest";
import { formatInkColorLabel } from "./utils";
import { normalizeCompositeInkColors, normalizeInkColor } from "../../convex/utils/inkColor";

describe("ink color normalization", () => {
  it.each([
    [" blue ", "CYAN"], ["cyan", "CYAN"], ["c", "CYAN"], ["CMYK", "CYAN"],
    ["red", "MAGENTA"], ["m", "MAGENTA"], ["yellow", "YELLOW"],
    ["k", "BLACK"], ["white", "WHITE"], [undefined, "BLACK"], ["", "BLACK"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeInkColor(input)).toBe(expected);
  });

  it("expands CMYK composites", () => {
    expect(normalizeCompositeInkColors(" cmyk ")).toEqual(["CYAN", "MAGENTA", "YELLOW", "BLACK"]);
  });
});

describe("ink color labels", () => {
  it("formats canonical keys for display", () => {
    expect(formatInkColorLabel("CYAN")).toBe("Blue (Cyan)");
    expect(formatInkColorLabel("MAGENTA")).toBe("Red (Magenta)");
    expect(formatInkColorLabel("WHITE")).toBe("White");
  });
});
