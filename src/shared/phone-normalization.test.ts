import { describe, expect, it } from "vitest";
import { normalizePhone, isValidEthiopianPhone, displayPhone } from "./phone-normalization";

describe("normalizePhone", () => {
  it("normalizes local Ethiopian mobile forms to E.164", () => {
    expect(normalizePhone("0912345678")).toBe("+251912345678");
    expect(normalizePhone("0712345678")).toBe("+251712345678");
    expect(normalizePhone("+251912345678")).toBe("+251912345678");
    expect(normalizePhone("+251712345678")).toBe("+251712345678");
  });

  it("strips spaces, hyphens, and parentheses before validating", () => {
    expect(normalizePhone("0912-345-678")).toBe("+251912345678");
    expect(normalizePhone("(0912) 345 678")).toBe("+251912345678");
    expect(normalizePhone("+251 (912) 345-678")).toBe("+251912345678");
  });

  it("rejects numbers that are not 9 digits after prefix", () => {
    expect(normalizePhone("091234567")).toBeNull();
    expect(normalizePhone("09123456789")).toBeNull();
  });

  it("rejects numbers not starting with 9 or 7 after 0", () => {
    expect(normalizePhone("0812345678")).toBeNull();
  });

  it("rejects empty or non-Ethiopian-format strings", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("1234567890")).toBeNull();
    expect(normalizePhone("hello")).toBeNull();
  });

  it("rejects +251 prefixes that lack 9/7 after the country code", () => {
    expect(normalizePhone("+251812345678")).toBeNull();
    expect(normalizePhone("+25191234567")).toBeNull();
  });
});

describe("isValidEthiopianPhone", () => {
  it("returns true for valid forms", () => {
    expect(isValidEthiopianPhone("0912345678")).toBe(true);
    expect(isValidEthiopianPhone("+251912345678")).toBe(true);
  });

  it("returns false for invalid forms", () => {
    expect(isValidEthiopianPhone("abc")).toBe(false);
  });
});

describe("displayPhone", () => {
  it("formats a normalized number for display", () => {
    expect(displayPhone("+251912345678")).toBe("9-123-456-78");
    expect(displayPhone("+251712345678")).toBe("7-123-456-78");
  });

  it("returns the input unchanged for non-normalized values", () => {
    expect(displayPhone("12345")).toBe("12345");
  });
});
