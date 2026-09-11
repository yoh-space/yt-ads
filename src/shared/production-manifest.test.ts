import { describe, expect, it } from "vitest";
import {
  CAPABILITY_IDS,
  CAPABILITY_REGISTRY,
  CANONICAL_OPERATOR_ROLES,
  CANONICAL_MACHINES,
  CONFIRMED_PRODUCTION_MACHINES,
  CANONICAL_SERVICE_ROUTES,
  normalizeCapabilityId,
  findManifestMachine,
  resolveManifestRoute,
} from "./production-manifest";
import { MATERIAL_SPECIFICATIONS } from "./material-specifications";
import { SERVICE_IDS } from "./services";

describe("Canonical Production Manifest", () => {
  it("enforces exactly 6 Owner-confirmed production machines", () => {
    expect(CONFIRMED_PRODUCTION_MACHINES).toHaveLength(6);
    const codes = CONFIRMED_PRODUCTION_MACHINES.map((m) => m.code);
    expect(codes).toEqual([
      "CJ7K-01", // Crystal Jet 7K Series
      "CESP-01", // Crystc Eco-Solvent Printer
      "RUV-01",  // Ricoh Flatbed UV Machine
      "DTF-01",  // DTF i3200
      "LAS-01",  // Laser Cutter
      "CNC-01",  // CNC Router
    ]);
  });

  it("identifies auxiliary machines as non-production routing fleet", () => {
    const auxiliary = CANONICAL_MACHINES.filter((m) => !m.isProductionFleet);
    expect(auxiliary).toHaveLength(2);
    expect(auxiliary.map((m) => m.code)).toEqual(["HPR-01", "CON-01"]);
  });

  it("guarantees unique machine IDs and machine codes", () => {
    const ids = CANONICAL_MACHINES.map((m) => m.id);
    const codes = CANONICAL_MACHINES.map((m) => m.code);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("verifies all machines have at least one valid capability in the capability registry", () => {
    for (const machine of CANONICAL_MACHINES) {
      expect(machine.capabilities.length).toBeGreaterThan(0);
      for (const cap of machine.capabilities) {
        expect(CAPABILITY_REGISTRY[cap]).toBeDefined();
      }
    }
  });

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

  it("validates that every canonical service has a route with valid capability and operator role", () => {
    for (const serviceId of SERVICE_IDS) {
      const route = resolveManifestRoute(serviceId);
      expect(route).toBeDefined();
      expect(CANONICAL_OPERATOR_ROLES).toContain(route!.operatorRole);
      for (const cap of route!.requiredCapabilities) {
        expect(CAPABILITY_REGISTRY[cap]).toBeDefined();
      }
      // Preferred machine must exist in the fleet
      const machine = findManifestMachine(route!.preferredMachineCode);
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

  it("resolves manifest machines by code, name, and owner business name", () => {
    expect(findManifestMachine("CJ7K-01")?.name).toBe("Crystal Jet 7K Series");
    expect(findManifestMachine("Recho Flatbed UV Machine")?.code).toBe("RUV-01");
    expect(findManifestMachine("DTF I32")?.code).toBe("DTF-01");
    expect(findManifestMachine("Laser Cut")?.code).toBe("LAS-01");
  });
});
