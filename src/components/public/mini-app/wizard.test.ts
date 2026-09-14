import { describe, expect, it } from "vitest";
import {
  getActiveWizardSteps,
  nextStep,
  prevStep,
  stepNumber,
  stepLabel,
  totalSteps,
  type WizardStep,
} from "@/shared/wizard-steps";
import {
  CompleteOrderPayloadSchema,
  CustomerEditPayloadSchema,
  DimensionsSchema,
  EthiopianMobileSchema,
  TIN_SCHEMA,
} from "@/shared/order-schemas";
import { serviceSpecificationFields } from "@/shared/service-specifications";

describe("Wizard Navigation and Dynamic Step Engine", () => {
  it("skips company-tin step for individual account type", () => {
    const steps = getActiveWizardSteps({ accountType: "individual" });
    expect(steps).not.toContain("company-tin");
    expect(steps).toContain("account-type");
    expect(steps).toContain("category");
    expect(steps.length).toBe(9);
  });

  it("includes company-tin step for corporate and government account types", () => {
    const corpSteps = getActiveWizardSteps({ accountType: "corporate" });
    expect(corpSteps).toContain("company-tin");
    expect(corpSteps.length).toBe(10);

    const govSteps = getActiveWizardSteps({ accountType: "government" });
    expect(govSteps).toContain("company-tin");
    expect(govSteps.length).toBe(10);
  });

  it("advances from account-type directly to category for individual", () => {
    const next = nextStep("account-type", { accountType: "individual" });
    expect(next).toBe("category");
  });

  it("advances from account-type to company-tin for corporate", () => {
    const next = nextStep("account-type", { accountType: "corporate" });
    expect(next).toBe("company-tin");
  });

  it("navigates backward from category to account-type for individual", () => {
    const prev = prevStep("category", { accountType: "individual" });
    expect(prev).toBe("account-type");
  });

  it("navigates backward from category to company-tin for corporate", () => {
    const prev = prevStep("category", { accountType: "corporate" });
    expect(prev).toBe("company-tin");
  });

  it("handles out-of-order recovery when accountType switches to individual while on company-tin", () => {
    const next = nextStep("company-tin", { accountType: "individual" });
    expect(next).toBe("category");

    const prev = prevStep("company-tin", { accountType: "individual" });
    expect(prev).toBe("account-type");
  });

  it("computes accurate step number and total count based on account type", () => {
    expect(totalSteps({ accountType: "individual" })).toBe(9);
    expect(totalSteps({ accountType: "corporate" })).toBe(10);

    expect(stepNumber("category", { accountType: "individual" })).toBe(4);
    expect(stepNumber("category", { accountType: "corporate" })).toBe(5);
    expect(stepLabel("dimensions")).toBe("Dimensions & Qty");
  });
});

describe("Wizard Form and Payload Schemas", () => {
  it("validates phone numbers across accepted Ethiopian formats", () => {
    expect(EthiopianMobileSchema.parse("0911234567")).toBe("+251911234567");
    expect(EthiopianMobileSchema.parse("+251912345678")).toBe("+251912345678");
    expect(EthiopianMobileSchema.parse("0712345678")).toBe("+251712345678");
    expect(() => EthiopianMobileSchema.parse("0811234567")).toThrow();
  });

  it("validates 10-digit TIN numbers", () => {
    expect(TIN_SCHEMA.parse("1234567890")).toBe("1234567890");
    expect(() => TIN_SCHEMA.parse("123456789")).toThrow();
    expect(() => TIN_SCHEMA.parse("12345678901")).toThrow();
    expect(() => TIN_SCHEMA.parse("12345abc90")).toThrow();
  });

  it("validates metric dimension strings", () => {
    expect(DimensionsSchema.parse("2m x 3m")).toBe("2m x 3m");
    expect(DimensionsSchema.parse("1.5m × 2.0m")).toBe("1.5m × 2.0m");
    expect(DimensionsSchema.parse("0.594 x 0.841")).toBe("0.594 x 0.841");
    expect(() => DimensionsSchema.parse("0m x 2m")).toThrow();
    expect(() => DimensionsSchema.parse("invalid")).toThrow();
  });

  it("validates a complete individual order payload", () => {
    const payload = {
      customerName: "Abebe Kebede",
      phone: "0911223344",
      accountType: "individual",
      serviceId: "banner_print",
      specifications: { "Roll Dimensions": "3.2m × 50m (160 m²)" },
      dimensions: "2m x 3m",
      length: 3,
      width: 2,
      quantity: "2",
      notes: "Standard eyelets",
      preferredDueDate: Date.now() + 86400000,
    };

    const parsed = CompleteOrderPayloadSchema.parse(payload);
    expect(parsed.customerName).toBe("Abebe Kebede");
    expect(parsed.phone).toBe("+251911223344");
    expect(parsed.accountType).toBe("individual");
    expect(parsed.companyLegalName).toBeUndefined();
    expect(parsed.tinNumber).toBeUndefined();
  });

  it("requires company name and TIN for corporate account type", () => {
    const validCorporate = {
      customerName: "Dawit Haile",
      phone: "0911445566",
      accountType: "corporate",
      companyLegalName: "Abyssinia Media PLC",
      tinNumber: "0012345678",
      serviceId: "light_box_a1",
      specifications: { "Power Supply": "100W", "LED Module": "White" },
      dimensions: "0.594m x 0.841m",
      quantity: "5",
      preferredDueDate: Date.now() + 86400000,
    };

    const parsed = CompleteOrderPayloadSchema.parse(validCorporate);
    expect(parsed.companyLegalName).toBe("Abyssinia Media PLC");
    expect(parsed.tinNumber).toBe("0012345678");

    const missingTin = { ...validCorporate, tinNumber: undefined };
    expect(() => CompleteOrderPayloadSchema.parse(missingTin)).toThrow();

    const missingCompany = { ...validCorporate, companyLegalName: undefined };
    expect(() => CompleteOrderPayloadSchema.parse(missingCompany)).toThrow();
  });

  it("validates customer edit payloads strictly and requires editRevision", () => {
    const editPayload = {
      customerName: "Abebe Kebede Updated",
      dimensions: "3m x 4m",
      quantity: "3",
      editRevision: 1,
    };

    const parsed = CustomerEditPayloadSchema.parse(editPayload);
    expect(parsed.customerName).toBe("Abebe Kebede Updated");
    expect(parsed.editRevision).toBe(1);

    // Rejects payload missing editRevision
    expect(() => CustomerEditPayloadSchema.parse({ customerName: "Test" })).toThrow();

    // Rejects unknown extraneous fields due to strict()
    expect(() =>
      CustomerEditPayloadSchema.parse({ ...editPayload, arbitraryField: "malicious" }),
    ).toThrow();
  });

  it("verifies service specification requirements match canonical definitions", () => {
    const bannerSpecs = serviceSpecificationFields("banner_print");
    expect(bannerSpecs).toEqual([]);

    const lightBoxSpecs = serviceSpecificationFields("light_box_a1");
    expect(lightBoxSpecs.length).toBeGreaterThan(0);
    const specKeys = lightBoxSpecs.map((s) => s.key);
    expect(specKeys).toContain("powerSupply");
    expect(specKeys).toContain("ledColor");
  });

  it("orders dimensions before specifications and skips specs for roll services", () => {
    const rollSteps = getActiveWizardSteps({ accountType: "individual", serviceId: "banner_print" });
    expect(rollSteps.indexOf("dimensions")).toBeLessThan(rollSteps.indexOf("artwork"));
    expect(rollSteps).not.toContain("specifications");
    expect(nextStep("dimensions", { accountType: "individual", serviceId: "banner_print" })).toBe("artwork");
    expect(prevStep("artwork", { accountType: "individual", serviceId: "banner_print" })).toBe("dimensions");

    const specSteps = getActiveWizardSteps({ accountType: "individual", serviceId: "light_box_a1" });
    expect(specSteps).toContain("specifications");
    expect(specSteps.indexOf("dimensions")).toBeLessThan(specSteps.indexOf("specifications"));
    expect(specSteps.indexOf("specifications")).toBeLessThan(specSteps.indexOf("artwork"));
  });

  it("dynamically skips or includes specifications step when hasSpecifications is explicitly provided", () => {
    // Custom database service with spec fields
    const customWithSpecs = getActiveWizardSteps({
      accountType: "individual",
      serviceId: "custom_service_xyz",
      hasSpecifications: true,
    });
    expect(customWithSpecs).toContain("specifications");
    expect(nextStep("dimensions", { accountType: "individual", serviceId: "custom_service_xyz", hasSpecifications: true })).toBe("specifications");
    expect(nextStep("specifications", { accountType: "individual", serviceId: "custom_service_xyz", hasSpecifications: true })).toBe("artwork");

    // Custom database service without spec fields
    const customWithoutSpecs = getActiveWizardSteps({
      accountType: "individual",
      serviceId: "custom_service_xyz",
      hasSpecifications: false,
    });
    expect(customWithoutSpecs).not.toContain("specifications");
    expect(nextStep("dimensions", { accountType: "individual", serviceId: "custom_service_xyz", hasSpecifications: false })).toBe("artwork");
  });
});
