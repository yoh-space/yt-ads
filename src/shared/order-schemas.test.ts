import { describe, expect, it } from "vitest";
import {
  CompleteOrderPayloadSchema,
  CustomerEditPayloadSchema,
  BusinessIdentitySchema,
  DimensionsAndQuantitySchema,
} from "./order-schemas";
import { normalizePhone } from "./phone-normalization";

describe("Order Zod schemas", () => {
  it("validates a complete individual order payload", () => {
    const result = CompleteOrderPayloadSchema.safeParse({
      customerName: "አዲስ ደንበር",
      phone: "0912345678",
      accountType: "individual",
      serviceId: "banner_print",
      dimensions: "2m x 3m",
      quantity: "5",
      preferredDueDate: Date.now() + 86400000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe("+251912345678");
    }
  });

  it("rejects an individual order with a company field populated", () => {
    const result = CompleteOrderPayloadSchema.safeParse({
      customerName: "አዲስ ደንበር",
      phone: "0912345678",
      accountType: "individual",
      companyLegalName: "Some Company",
      tinNumber: "1234567890",
      serviceId: "banner_print",
      dimensions: "2m x 3m",
      quantity: "5",
      preferredDueDate: Date.now() + 86400000,
    });
    expect(result.success).toBe(true);
  });

  it("requires company and TIN for corporate accounts", () => {
    const result = CompleteOrderPayloadSchema.safeParse({
      customerName: "Acme Corp",
      phone: "+251912345678",
      accountType: "corporate",
      serviceId: "neon_light",
      dimensions: "1m x 2m",
      quantity: "1",
      preferredDueDate: Date.now() + 86400000,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "companyLegalName")).toBe(true);
      expect(result.error.issues.some((i) => i.path[0] === "tinNumber")).toBe(true);
    }
  });

  it("requires company and TIN for government accounts", () => {
    const result = CompleteOrderPayloadSchema.safeParse({
      customerName: "የመንግስት ቢም ትዕዛዝ",
      phone: "0712345678",
      accountType: "government",
      companyLegalName: "Ministry of Finance",
      tinNumber: "1234567890",
      serviceId: "light_box_a1",
      dimensions: "0.5m x 0.7m",
      quantity: "3",
      preferredDueDate: Date.now() + 86400000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid TIN for corporate accounts", () => {
    const result = CompleteOrderPayloadSchema.safeParse({
      customerName: "Acme Corp",
      phone: "+251912345678",
      accountType: "corporate",
      companyLegalName: "Acme Corp",
      tinNumber: "123",
      serviceId: "banner_print",
      dimensions: "2m x 3m",
      quantity: "1",
      preferredDueDate: Date.now() + 86400000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-positive dimensions", () => {
    const result = DimensionsAndQuantitySchema.safeParse({
      dimensions: "0m x 3m",
      quantity: "1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero quantity", () => {
    const result = DimensionsAndQuantitySchema.safeParse({
      dimensions: "2m x 3m",
      quantity: "0",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown service id", () => {
    const result = CompleteOrderPayloadSchema.safeParse({
      customerName: "Test",
      phone: "0912345678",
      accountType: "individual",
      serviceId: "unknown_service",
      dimensions: "2m x 3m",
      quantity: "1",
      preferredDueDate: Date.now() + 86400000,
    });
    expect(result.success).toBe(false);
  });
});

describe("BusinessIdentitySchema", () => {
  it("allows individual without company or TIN", () => {
    expect(BusinessIdentitySchema.safeParse({ accountType: "individual" }).success).toBe(true);
  });

  it("requires company and TIN for corporate", () => {
    const result = BusinessIdentitySchema.safeParse({ accountType: "corporate" });
    expect(result.success).toBe(false);
  });

  it("validates corporate with company and TIN", () => {
    const result = BusinessIdentitySchema.safeParse({
      accountType: "corporate",
      companyLegalName: "ACME Ltd",
      tinNumber: "1234567890",
    });
    expect(result.success).toBe(true);
  });
});

describe("CustomerEditPayloadSchema", () => {
  it("requires editRevision for optimistic concurrency", () => {
    const result = CustomerEditPayloadSchema.safeParse({
      customerName: "Updated Name",
    });
    expect(result.success).toBe(false);
  });

  it("validates a complete edit payload", () => {
    const result = CustomerEditPayloadSchema.safeParse({
      customerName: "Updated Name",
      phone: "0912345678",
      serviceId: "banner_print",
      dimensions: "2m x 3m",
      quantity: "1",
      editRevision: 2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown keys", () => {
    const result = CustomerEditPayloadSchema.safeParse({
      customerName: "Updated Name",
      editRevision: 2,
      unknownField: "value",
    });
    expect(result.success).toBe(false);
  });
});
