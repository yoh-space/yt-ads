import { describe, expect, it } from "vitest";
import {
  CAPABILITY_IDS,
  CAPABILITY_REGISTRY,
  CANONICAL_SERVICE_ROUTES,
  normalizeCapabilityId,
  resolveManifestRoute,
} from "./production-manifest";
import { MATERIAL_SPECIFICATIONS } from "./material-specifications";
import { SERVICE_IDS } from "./services";
import { MACHINE_CATALOG, findMachineCatalogDefinition } from "./machine-catalog";

describe("Canonical Production Manifest", () => {
  it("normalizes free-text capabilities to canonical capability IDs safely", () => {
    expect(normalizeCapabilityId("3.2m Print Width · Heavy Duty Exterior Banner & Mesh")).toBe("PRINT_ROLL_3_2M");
    expect(normalizeCapabilityId("3.2m Print Width")).toBe("PRINT_ROLL_3_2M");
    expect(normalizeCapabilityId("1.6m Print Width · High Resolution Vinyl, Stickers & Grayback")).toBe("PRINT_ROLL_1_6M");
    expect(normalizeCapabilityId("1.6m Width")).toBe("PRINT_ROLL_1_6M");
    expect(normalizeCapabilityId("Direct-to-Rigid Board")).toBe("PRINT_RIGID_UV_122_244");
    expect(normalizeCapabilityId("60cm Textile Films, T-Shirt Direct Transfer")).toBe("PRINT_ROLL_0_6M_DTF");
    expect(normalizeCapabilityId("1.22m x 2.44m Bed · Precision Mica, Acrylic & Foam Board Cutting")).toBe("CUT_RIGID_122_244_LASER");
    expect(normalizeCapabilityId("2.0m x 3.0m Bed · Foam Board, Cladding, MDF Heavy Routing")).toBe("CUT_RIGID_2030_CNC");
    expect(normalizeCapabilityId("PRINT_ROLL_3_2M")).toBe("PRINT_ROLL_3_2M");
  });

  it("validates that every canonical service has a route with valid capability and machine", () => {
    const OPERATOR_ROLE_CODES = [
      "crystal_jet_operator", "crystek_operator", "ricoh_uv_operator",
      "dtf_operator", "laser_operator", "cnc_operator",
    ];
    for (const serviceId of SERVICE_IDS) {
      const route = resolveManifestRoute(serviceId);
      expect(route).toBeDefined();
      expect(OPERATOR_ROLE_CODES).toContain(route!.operatorRole);
      for (const cap of route!.requiredCapabilities) {
        expect(CAPABILITY_REGISTRY[cap]).toBeDefined();
      }
      // Preferred machine must exist in the fleet
      const machine = findMachineCatalogDefinition(route!.preferredMachineCode);
      expect(machine).toBeDefined();
      // Machine must support at least one required capability
      const hasCapability = route!.requiredCapabilities.some((c) => machine!.capabilities.includes(c));
      expect(hasCapability).toBe(true);
    }
  });

  it("guarantees zero duplicate names in the canonical material specifications catalog", () => {
    const names = MATERIAL_SPECIFICATIONS.map((m) => m.name.toLowerCase());
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it("includes MDF Sheet as a canonical rigid sheet material compatible with CNC Router", () => {
    const mdf = MATERIAL_SPECIFICATIONS.find((m) => m.name === "MDF Sheet");
    expect(mdf).toBeDefined();
    expect(mdf?.compatibleMachineTypes).toContain("CNC Router");
    expect(mdf?.baseUnit).toBe("m²");
  });
});
