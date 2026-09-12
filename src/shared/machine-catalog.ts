import type { Role, Unit } from "../lib/operations-types";
import {
  CANONICAL_SERVICE_ROUTES,
  normalizeCapabilityId,
  type CapabilityId,
  type CanonicalServiceRoute,
} from "./production-manifest";
import type { ServiceId } from "./services";

export type MachineCatalogDefinition = {
  name: string;
  code: string;
  type: string;
  manufacturer?: string;
  model: string;
  capability: string;
  capabilities: readonly CapabilityId[];
  operatorRole: Role;
  materialUnit: Unit;
  displayUnit: string;
  primaryMaterialNames: readonly string[];
  compatibleInkNames: readonly string[];
  solventNames: readonly string[];
  defaultWasteMarginPercent: number;
  maxAllowedScrapLimitPercent: number;
  isProductionFleet: boolean;
  notes?: string;
};

/** Canonical 6 production machines + 2 auxiliary machines. Now local static data — machines live in DB. */
const CANONICAL_MACHINES: readonly MachineCatalogDefinition[] = [
  {
    name: "Crystal Jet 7K Series", code: "CJ7K-01", type: "Large Format Solvent Printer",
    manufacturer: "Crystal", model: "Crystal Jet 7K Series",
    capability: "3.2m Print Width · Heavy Duty Exterior Banner & Mesh",
    capabilities: ["PRINT_ROLL_3_2M"],
    operatorRole: "crystal_jet_operator", materialUnit: "m²", displayUnit: "m²",
    primaryMaterialNames: ["Banner Flex", "Mesh Sticker"],
    compatibleInkNames: ["Banner Ink 5L Canister"],
    solventNames: ["Banner Solvent"],
    defaultWasteMarginPercent: 5, maxAllowedScrapLimitPercent: 10,
    isProductionFleet: true,
  },
  {
    name: "Crystc Eco-Solvent Printer", code: "CESP-01", type: "Eco-Solvent Printer & Cutter",
    manufacturer: "Crystal", model: "Eco-Solvent Print & Cut",
    capability: "1.6m Print Width · High Resolution Vinyl, Stickers & Grayback",
    capabilities: ["PRINT_ROLL_1_6M"],
    operatorRole: "crystek_operator", materialUnit: "m²", displayUnit: "m²",
    primaryMaterialNames: ["Frosted Sticker", "Transparent Sticker", "Reflective Sticker"],
    compatibleInkNames: ["Print & Cut Ink 1L Canister"],
    solventNames: ["Print & Cut Solvent"],
    defaultWasteMarginPercent: 5, maxAllowedScrapLimitPercent: 8,
    isProductionFleet: true,
  },
  {
    name: "Ricoh Flatbed UV Machine", code: "RUV-01", type: "UV Flatbed Printer",
    manufacturer: "Ricoh", model: "Flatbed UV",
    capability: "Direct-to-Rigid Board · UV Industrial Flatbed",
    capabilities: ["PRINT_RIGID_UV_122_244"],
    operatorRole: "ricoh_uv_operator", materialUnit: "m²", displayUnit: "m²",
    primaryMaterialNames: ["Mica", "Foam Board", "Cladding", "Canvas (Canva)"],
    compatibleInkNames: ["UV Ink 1L Canister"],
    solventNames: [],
    defaultWasteMarginPercent: 4, maxAllowedScrapLimitPercent: 8,
    isProductionFleet: true,
  },
  {
    name: "DTF I32", code: "DTF-01", type: "DTF Printer",
    manufacturer: "i3200", model: "DTF i3200",
    capability: "0.60m Print Width · 60cm Textile Films, T-Shirt Direct Transfer",
    capabilities: ["PRINT_ROLL_0_6M_DTF"],
    operatorRole: "dtf_operator", materialUnit: "m", displayUnit: "m",
    primaryMaterialNames: ["DTF Film", "T-Shirts"],
    compatibleInkNames: ["DTF Ink 1L Canister"],
    solventNames: ["DTF Solvent"],
    defaultWasteMarginPercent: 5, maxAllowedScrapLimitPercent: 10,
    isProductionFleet: true,
  },
  {
    name: "Laser cutting machine 1325", code: "LAS-01", type: "CO2 Laser Cutter",
    model: "CO2 Laser Cutter 1325",
    capability: "1.22m x 2.44m Bed · Precision Mica, Acrylic & Foam Board Cutting",
    capabilities: ["CUT_RIGID_122_244_LASER"],
    operatorRole: "laser_operator", materialUnit: "m²", displayUnit: "m²",
    primaryMaterialNames: ["Mica", "Foam Board", "Acrylic"],
    compatibleInkNames: [],
    solventNames: [],
    defaultWasteMarginPercent: 4, maxAllowedScrapLimitPercent: 8,
    isProductionFleet: true,
  },
  {
    name: "CNC Router", code: "CNC-01", type: "Heavy Duty CNC Router",
    model: "CNC Router 2030",
    capability: "2.0m x 3.0m Bed · Foam Board, Cladding, MDF Heavy Routing",
    capabilities: ["CUT_RIGID_2030_CNC"],
    operatorRole: "cnc_operator", materialUnit: "m²", displayUnit: "m²",
    primaryMaterialNames: ["Foam Board", "Cladding", "MDF Sheet"],
    compatibleInkNames: [],
    solventNames: [],
    defaultWasteMarginPercent: 5, maxAllowedScrapLimitPercent: 10,
    isProductionFleet: true,
  },
  {
    name: "Heat Press", code: "HPR-01", type: "Heat Press Machine",
    model: "Heat Press Machine",
    capability: "Garment Transfer Press",
    capabilities: ["TRANSFER_TEXTILE"],
    operatorRole: "dtf_operator", materialUnit: "pcs", displayUnit: "pcs",
    primaryMaterialNames: ["T-Shirts"],
    compatibleInkNames: [],
    solventNames: [],
    defaultWasteMarginPercent: 0, maxAllowedScrapLimitPercent: 5,
    isProductionFleet: false,
  },
  {
    name: "Paper Cutter", code: "CON-01", type: "Heavy-Duty Guillotine",
    model: "Heavy-Duty Guillotine",
    capability: "A3+ Sheet Trimming",
    capabilities: ["TRIM_A3_PLUS"],
    operatorRole: "crystek_operator", materialUnit: "sheet", displayUnit: "sheet",
    primaryMaterialNames: [],
    compatibleInkNames: [],
    solventNames: [],
    defaultWasteMarginPercent: 0, maxAllowedScrapLimitPercent: 2,
    isProductionFleet: false,
  },
] as const;

/**
 * Authoritative 6 Production Machines & Auxiliary Fleet for YT Advertisement.
 * Synchronized with the Canonical Production Manifest (`src/shared/production-manifest.ts`).
 */
export const MACHINE_CATALOG: readonly MachineCatalogDefinition[] = CANONICAL_MACHINES;

/** The 6 Owner-Confirmed Production Fleet Machines (excluding auxiliary finishing equipment) */
export const CONFIRMED_FLEET_MACHINES = MACHINE_CATALOG.filter((m) => m.isProductionFleet);

/**
 * Service to Machine & Material Routing Matrix.
 * Automated assignment logic: removes manual receptionist guesswork.
 * Derived from canonical service routes in the production manifest.
 */
export const SERVICE_ROUTING_MAP: Record<
  string,
  {
    preferredMachineCode: string;
    primaryMaterialName: string;
    compatibleInkName?: string;
    calculationUnit: Unit;
    defaultWasteMarginPercent: number;
    maxScrapLimitPercent: number;
    requiredCapabilities: readonly CapabilityId[];
  }
> = Object.fromEntries(
  Object.entries(CANONICAL_SERVICE_ROUTES).map(([serviceId, route]) => {
    let compatibleInkName: string | undefined;
    if (route.preferredMachineCode === "CJ7K-01") compatibleInkName = "Banner Ink 5L Canister";
    else if (route.preferredMachineCode === "CESP-01") compatibleInkName = "Print & Cut Ink 1L Canister";
    else if (route.preferredMachineCode === "RUV-01") compatibleInkName = "UV Ink 1L Canister";
    else if (route.preferredMachineCode === "DTF-01") compatibleInkName = "DTF Ink 1L Canister";

    return [
      serviceId,
      {
        preferredMachineCode: route.preferredMachineCode,
        primaryMaterialName: route.primaryMaterialName ?? route.preferredMaterialName,
        compatibleInkName,
        calculationUnit: route.calculationUnit,
        defaultWasteMarginPercent: route.defaultWasteMarginPercent,
        maxScrapLimitPercent: route.maxScrapLimitPercent,
        requiredCapabilities: route.requiredCapabilities,
      },
    ];
  }),
);

export function findMachineCatalogDefinition(codeOrName: string): MachineCatalogDefinition | undefined {
  const query = codeOrName.trim().toLowerCase();
  return MACHINE_CATALOG.find(
    (m) =>
      m.code.toLowerCase() === query ||
      m.name.toLowerCase() === query ||
      m.model.toLowerCase() === query,
  );
}

/**
 * Resolves a manifest machine by code, name, or business name.
 * Used by orderAutomation.ts for machine assignment.
 */
export function findManifestMachine(codeOrName: string): MachineCatalogDefinition | undefined {
  const query = codeOrName.trim().toLowerCase();
  return MACHINE_CATALOG.find(
    (m) =>
      m.code.toLowerCase() === query ||
      m.name.toLowerCase() === query ||
      m.model.toLowerCase() === query,
  );
}

export { normalizeCapabilityId };
