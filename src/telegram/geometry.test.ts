import { describe, expect, it } from "vitest";
import { isOrderCode, looksLikePhone, normalizePhone, parseDimensions } from "./geometry";

describe("parseDimensions", () => {
  it("parses simple 2x3 input", () => {
    expect(parseDimensions("2x3")).toEqual({ width: 2, height: 3, area: 6, label: "2m × 3m" });
  });

  it("parses spaces, the unicode times sign, and an asterisk", () => {
    expect(parseDimensions("1.5 x 2")?.area).toBe(3);
    expect(parseDimensions("2×3")?.area).toBe(6);
    expect(parseDimensions("2*3")?.area).toBe(6);
    expect(parseDimensions("2x3m")?.area).toBe(6);
  });

  it("rounds the computed area to two decimals", () => {
    expect(parseDimensions("1.3 x 1.7")?.area).toBe(2.21);
  });

  it("rejects malformed or impossible inputs", () => {
    for (const input of ["abc", "2", "2x", "x3", "0x3", "2x0", "-1x3", "2 3", "20x3x1", ""]) {
      expect(parseDimensions(input)).toBeNull();
    }
  });
});

describe("isOrderCode", () => {
  it("matches the ORD-YYYY-XXXXXX format case-insensitively", () => {
    expect(isOrderCode("ORD-2026-123456")).toBe(true);
    expect(isOrderCode("ord-2026-123456")).toBe(true);
    expect(isOrderCode("ORD-2026")).toBe(false);
    expect(isOrderCode("hello")).toBe(false);
  });
});

describe("phone helpers", () => {
  it("recognises local and international numbers", () => {
    expect(looksLikePhone("0911223344")).toBe(true);
    expect(looksLikePhone("+251 91 122 33 44")).toBe(true);
    expect(looksLikePhone("not a phone")).toBe(false);
  });

  it("normalises away formatting characters", () => {
    expect(normalizePhone("+251 91 122 33 44")).toBe("+251911223344");
    expect(normalizePhone("0911223344")).toBe("0911223344");
  });
});