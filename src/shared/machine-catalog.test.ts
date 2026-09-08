import { describe, expect, it } from "vitest";
import { MACHINE_CATALOG, SERVICE_ROUTING_MAP, findMachineCatalogDefinition } from "./machine-catalog";

describe("Machine Catalog & Service Routing Matrix", () => {
  it("contains the 6 primary confirmed production machines", () => {
    const codes = MACHINE_CATALOG.map((m) => m.code);
    expect(codes).toContain("CJ7K-01"); // Crystal Jet 7K Series
    expect(codes).toContain("CESP-01"); // Crystc Eco-Solvent Printer
    expect(codes).toContain("RUV-01");  // Ricoh Flatbed UV Machine
    expect(codes).toContain("DTF-01");  // DTF i3200
    expect(codes).toContain("LAS-01");  // Laser Cutter
    expect(codes).toContain("CNC-01");  // CNC Router
  });

  it("verifies material and ink associations for the printing fleet", () => {
    const crystalJet = findMachineCatalogDefinition("CJ7K-01");
    expect(crystalJet).toBeDefined();
    expect(crystalJet?.primaryMaterialNames).toContain("Banner Flex");
    expect(crystalJet?.compatibleInkNames).toContain("Banner Ink 5L Canister");
    expect(crystalJet?.solventNames).toContain("Banner Solvent");

    const ecoSolvent = findMachineCatalogDefinition("CESP-01");
    expect(ecoSolvent?.primaryMaterialNames).toContain("Frosted Sticker");
    expect(ecoSolvent?.compatibleInkNames).toContain("Print & Cut Ink 1L Canister");

    const ricohUv = findMachineCatalogDefinition("RUV-01");
    expect(ricohUv?.primaryMaterialNames).toContain("Mica");
    expect(ricohUv?.primaryMaterialNames).toContain("Foam Board");
    expect(ricohUv?.primaryMaterialNames).toContain("Cladding");
    expect(ricohUv?.compatibleInkNames).toContain("UV Ink 1L Canister");

    const dtf = findMachineCatalogDefinition("DTF-01");
    expect(dtf?.primaryMaterialNames).toContain("DTF Film");
    expect(dtf?.primaryMaterialNames).toContain("T-Shirts");
    expect(dtf?.compatibleInkNames).toContain("DTF Ink 1L Canister");
  });

  it("verifies zero-ink configuration for mechanical cutting machines", () => {
    const laser = findMachineCatalogDefinition("LAS-01");
    expect(laser?.compatibleInkNames).toHaveLength(0);
    expect(laser?.primaryMaterialNames).toContain("Mica");

    const cnc = findMachineCatalogDefinition("CNC-01");
    expect(cnc?.compatibleInkNames).toHaveLength(0);
    expect(cnc?.primaryMaterialNames).toContain("Cladding");
    expect(cnc?.primaryMaterialNames).toContain("Foam Board");
  });

  it("routes services to automated machines with standard waste margins", () => {
    expect(SERVICE_ROUTING_MAP["banner_print"]).toMatchObject({
      preferredMachineCode: "CJ7K-01",
      primaryMaterialName: "Banner Flex",
      defaultWasteMarginPercent: 5,
    });

    expect(SERVICE_ROUTING_MAP["uv_print_mica"]).toMatchObject({
      preferredMachineCode: "RUV-01",
      primaryMaterialName: "Mica",
      defaultWasteMarginPercent: 4,
    });

    expect(SERVICE_ROUTING_MAP["dtf"]).toMatchObject({
      preferredMachineCode: "DTF-01",
      primaryMaterialName: "DTF Film",
      defaultWasteMarginPercent: 5,
    });

    expect(SERVICE_ROUTING_MAP["mica_cutout"]).toMatchObject({
      preferredMachineCode: "LAS-01",
      primaryMaterialName: "Mica",
      defaultWasteMarginPercent: 4,
    });
  });
});
