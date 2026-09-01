import { describe, expect, it } from "vitest";
import {
  formatOrderSummary,
  formatStatusLine,
  serviceLabel,
  serviceTypeFor,
  statusLabel,
  t,
} from "./i18n";

describe("copy strings", () => {
  it("defaults to Amharic copy with the required product strings", () => {
    const choice = t("am", "serviceChoice");
    expect(choice).toContain("ስራ");
    expect(t("am", "dimensionsPrompt")).toContain("2x3");
    expect(t("am", "phonePrompt")).toContain("ስልክ");
  });

  it("provides English copy when requested", () => {
    expect(t("en", "serviceChoice")).toContain("order");
  });

  it("interpolates template variables", () => {
    const summary = t("am", "miniAppConfirmed", { code: "ORD-2026-123456" });
    expect(summary).toContain("ORD-2026-123456");
  });
});

describe("formatOrderSummary", () => {
  it("renders service, area and order code", () => {
    const text = formatOrderSummary("am", {
      serviceType: "Banner (Flex)",
      serviceLabel: "Banner (Flex)",
      area: 6,
      dimensions: "2m × 3m",
    }, "ORD-2026-123456");
    expect(text).toContain("6 ሜ²");
    expect(text).toContain("2m × 3m");
    expect(text).toContain("ORD-2026-123456");
  });
});

describe("statusLabel", () => {
  it("translates statuses for Amharic and keeps English labels", () => {
    expect(statusLabel("am", "In Production")).toBe("በምርት ላይ ነው");
    expect(statusLabel("en", "Received")).toBe("Received");
  });
});

describe("formatStatusLine", () => {
  it("includes the translated status and service details", () => {
    const line = formatStatusLine("am", {
      code: "ORD-2026-1",
      serviceType: "Sticker",
      dimensions: "1m × 1m",
      status: "Ready for Pickup",
      createdAt: 0,
    });
    expect(line).toContain("ለመቀበል ዝግጁ ነው");
    expect(line).toContain("Sticker");
  });
});

describe("service mapping", () => {
  it("maps canned services to canonical and display labels", () => {
    expect(serviceTypeFor("banner")).toBe("Banner (Flex)");
    expect(serviceLabel("am", "sticker")).toContain("ስቲከር");
    expect(serviceLabel("en", "acrylic")).toBe("Acrylic");
  });
});